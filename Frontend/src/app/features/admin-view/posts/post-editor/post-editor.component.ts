import {
  ChangeDetectionStrategy, Component, OnInit, OnDestroy, inject, signal, computed, Injector
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { QuillEditorComponent } from 'src/app/shared/components/quill-editor/quill-editor.component';
import { PostService, Post, PostCreateDTO } from 'src/app/core/services/post.service';
import { CommonApp } from 'src/app/core/services/common';
import { DateTimePickerComponent } from 'src/app/shared/components/ui/date-time-picker/date-time-picker.component';
import { Subject, takeUntil } from 'rxjs';

type TabId = 'editor' | 'seo';

@Component({
  selector: 'app-post-editor',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterLink, QuillEditorComponent, DateTimePickerComponent],
  templateUrl: './post-editor.component.html',
  styleUrls: ['./post-editor.component.scss'],
})
export class PostEditorComponent extends CommonApp implements OnInit, OnDestroy {

  private fb          = inject(FormBuilder);
  private postService = inject(PostService);
  private sanitizer   = inject(DomSanitizer);
  private destroy$    = new Subject<void>();

  // Edit mode
  editId = signal<string | null>(null);
  isEditMode = computed(() => !!this.editId());

  // UI State
  isSaving    = signal(false);
  isLoading   = signal(false);
  error       = signal<string | null>(null);
  activeTab   = signal<TabId>('editor');
  showPreview = signal(false);

  // Content size cap — keep posts small/medium (backend enforces 60k HTML chars;
  // this plain-text cap is the author-facing limit)
  readonly MAX_CONTENT_CHARS = 15000;
  contentChars = signal(0);
  contentNearLimit = computed(() => this.contentChars() >= this.MAX_CONTENT_CHARS * 0.8);
  contentOverLimit = computed(() => this.contentChars() > this.MAX_CONTENT_CHARS);

  // Tags input helper
  tagInput = '';

  // Cover image
  pendingCoverFile = signal<File | null>(null);
  isUploadingCover = signal(false);

  // Form
  form!: FormGroup;

  // Quill config
  quillModules = {
    toolbar: [
      ['bold', 'italic', 'underline', 'strike'],
      [{ color: [] }, { background: [] }],
      [{ header: [1, 2, 3, false] }],
      ['blockquote', 'code-block'],
      [{ list: 'ordered' }, { list: 'bullet' }],
      ['link'],
      ['clean'],
    ],
  };

  constructor(public override injector: Injector) {
    super(injector);
  }

  ngOnInit(): void {
    this.form = this.fb.group({
      title:           ['', [Validators.required, Validators.minLength(3)]],
      content:         ['', Validators.required],
      content_raw:     [''],
      excerpt:         [''],
      status:          ['draft'],
      is_featured:     [false],
      week_number:     [null],
      tags:            [[]],
      cover_image_url: [''],
      linkedin_url:    [''],
      seo_title:       [''],
      seo_description: [''],
      og_image_url:    [''],
      scheduled_at:    [null],
    });

    this.route.params.pipe(takeUntil(this.destroy$)).subscribe(params => {
      if (params['id']) {
        this.editId.set(params['id']);
        this.loadPost(params['id']);
      }
    });
  }

  loadPost(id: string): void {
    this.isLoading.set(true);
    this.postService.getAdminById(id).pipe(takeUntil(this.destroy$)).subscribe({
      next: (res) => {
        const post = res.data?.post;
        if (post) {
          this.patchForm(post);
        } else {
          this.error.set('Post not found.');
        }
        this.isLoading.set(false);
      },
      error: () => {
        this.error.set('Failed to load post.');
        this.isLoading.set(false);
      }
    });
  }

  private patchForm(post: Post): void {
    this.form.patchValue({
      title:           post.title,
      content:         post.content,
      content_raw:     post.content_raw || '',
      excerpt:         post.excerpt || '',
      status:          post.status,
      is_featured:     post.is_featured,
      week_number:     post.week_number || null,
      tags:            post.tags || [],
      cover_image_url: post.cover_image_url || '',
      linkedin_url:    post.linkedin_url || '',
      seo_title:       post.seo_title || '',
      seo_description: post.seo_description || '',
      og_image_url:    post.og_image_url || '',
      scheduled_at:    post.scheduled_at || null,
    });

    // Seed the character counter from the loaded HTML
    const plain = (post.content || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    this.contentChars.set(plain.length);
  }

  onEditorChanged(event: any): void {
    // Sync plain-text content_raw for SEO and read time
    if (event?.text !== undefined) {
      this.form.patchValue({ content_raw: event.text }, { emitEvent: false });
      this.contentChars.set(event.text.trim().length);
    }
  }

  // ── Tags ─────────────────────────────────────────────────────

  get tags(): string[] {
    return this.form.get('tags')?.value || [];
  }

  // Mirrors the backend caps (post.service.js LIMITS)
  private readonly MAX_TAGS = 8;
  private readonly MAX_TAG_LEN = 30;

  addTag(): void {
    this.addTagsFromText(this.tagInput);
    this.tagInput = '';
  }

  /**
   * Accepts a single tag OR a pasted list ("Angular, TypeScript, Web Development")
   * and adds each entry as an individual tag — split on commas/semicolons/newlines,
   * trimmed, de-duplicated (case-insensitive), capped at MAX_TAGS × MAX_TAG_LEN.
   */
  private addTagsFromText(text: string): void {
    const incoming = (text || '')
      .split(/[,;\n]/)
      .map(t => t.trim())
      .filter(Boolean);
    if (incoming.length === 0) return;

    const current = [...this.tags];
    const existingLower = new Set(current.map(t => t.toLowerCase()));
    let skipped = 0;

    for (const tag of incoming) {
      if (existingLower.has(tag.toLowerCase())) continue;      // duplicate
      if (tag.length > this.MAX_TAG_LEN || current.length >= this.MAX_TAGS) {
        skipped++;
        continue;
      }
      current.push(tag);
      existingLower.add(tag.toLowerCase());
    }

    this.form.patchValue({ tags: current });

    if (skipped > 0) {
      this.alertService.showAlert(
        `${skipped} tag${skipped > 1 ? 's' : ''} skipped — max ${this.MAX_TAGS} tags, ${this.MAX_TAG_LEN} characters each.`,
        'warning'
      );
    }
  }

  onTagPaste(event: ClipboardEvent): void {
    const text = event.clipboardData?.getData('text') ?? '';
    // Only intercept when the paste contains separators — plain single-word
    // pastes keep the normal type-then-Enter flow
    if (/[,;\n]/.test(text)) {
      event.preventDefault();
      this.addTagsFromText(text);
      this.tagInput = '';
    }
  }

  removeTag(tag: string): void {
    this.form.patchValue({ tags: this.tags.filter(t => t !== tag) });
  }

  onTagKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      this.addTag();
    }
  }

  // ── Cover Image ──────────────────────────────────────────────

  onCoverFileChange(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) this.pendingCoverFile.set(file);
  }

  async uploadCoverImage(): Promise<void> {
    const file = this.pendingCoverFile();
    if (!file) return;
    this.isUploadingCover.set(true);
    this.postService.uploadCover(file).subscribe({
      next: (res) => {
        this.form.patchValue({ cover_image_url: res.data.url });
        this.pendingCoverFile.set(null);
        this.isUploadingCover.set(false);
      },
      error: () => {
        this.alertService.showAlert('Cover upload failed. Try again.', 'error');
        this.isUploadingCover.set(false);
      }
    });
  }

  removeCover(): void {
    this.form.patchValue({ cover_image_url: '' });
    this.pendingCoverFile.set(null);
  }

  // ── Schedule ─────────────────────────────────────────────────

  get isScheduledFuture(): boolean {
    const sa = this.form?.get('scheduled_at')?.value;
    return !!sa && new Date(sa) > new Date();
  }

  get minScheduleIso(): string {
    return new Date(Date.now() + 5 * 60000).toISOString();
  }

  onScheduledAtChange(iso: string | null): void {
    this.form.patchValue({ scheduled_at: iso });
  }

  formatScheduleDate(iso: string | null | undefined): string {
    if (!iso) return '';
    return new Date(iso).toLocaleString('en-IN', {
      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
    });
  }

  // ── Preview ──────────────────────────────────────────────────

  get safePreviewContent(): SafeHtml {
    const content = this.form.get('content')?.value || '';
    return this.sanitizer.bypassSecurityTrustHtml(content);
  }

  get estimatedReadTime(): number {
    const raw = this.form.get('content_raw')?.value || this.form.get('content')?.value || '';
    const text = raw.replace(/<[^>]*>/g, '');
    return Math.max(1, Math.ceil(text.trim().split(/\s+/).filter(Boolean).length / 200));
  }

  // ── AI writing assist ────────────────────────────────────────

  aiOpen    = signal(false);
  aiAction  = signal<'excerpt' | 'titles' | 'improve' | 'seo' | null>(null);
  aiError   = signal<string>('');
  aiExcerpt = signal<string>('');
  aiImprove = signal<string>('');
  aiTitles  = signal<string[]>([]);
  aiSeo     = signal<{ seo_title?: string; seo_description?: string; tags?: string[] } | null>(null);

  toggleAiPanel(): void {
    this.aiOpen.update(v => !v);
  }

  runAi(action: 'excerpt' | 'titles' | 'improve' | 'seo'): void {
    if (this.aiAction()) return; // a request is already in flight
    const title   = this.form.get('title')?.value || '';
    const content = this.form.get('content')?.value || '';
    if (!title.trim() && !content.trim()) {
      this.alertService.showAlert('Add a title or some content first.', 'warning');
      return;
    }

    this.aiAction.set(action);
    this.aiError.set('');
    this.postService.aiAssist({ action, title, content })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          const raw = res.data?.result ?? '';
          switch (action) {
            case 'excerpt': this.aiExcerpt.set(raw); break;
            case 'improve': this.aiImprove.set(raw); break;
            case 'titles':
              this.aiTitles.set(
                raw.split('\n')
                  .map(s => s.replace(/^[-*\d.)\s"]+/, '').replace(/"+$/, '').trim())
                  .filter(Boolean)
                  .slice(0, 5)
              );
              break;
            case 'seo': this.aiSeo.set(this.parseSeo(raw)); break;
          }
          this.aiAction.set(null);
        },
        error: (err) => {
          this.aiError.set(err?.error?.message || 'AI request failed. Try again.');
          this.aiAction.set(null);
        },
      });
  }

  private parseSeo(raw: string): { seo_title?: string; seo_description?: string; tags?: string[] } {
    try {
      const o = JSON.parse(raw);
      return {
        seo_title:       typeof o.seo_title === 'string' ? o.seo_title : undefined,
        seo_description: typeof o.seo_description === 'string' ? o.seo_description : undefined,
        tags:            Array.isArray(o.tags) ? o.tags.filter((t: any) => typeof t === 'string') : [],
      };
    } catch {
      // Model didn't return clean JSON — treat the whole thing as a description
      return { seo_description: raw };
    }
  }

  applyAiExcerpt(): void {
    this.form.patchValue({ excerpt: this.aiExcerpt() });
    this.alertService.showAlert('Excerpt applied.', 'success');
  }

  applyAiTitle(title: string): void {
    this.form.patchValue({ title });
    this.alertService.showAlert('Title applied.', 'success');
  }

  applyAiImprove(): void {
    const html = this.aiImprove();
    this.form.patchValue({ content: html });
    // keep the char counter in sync (writeValue won't emit contentChanged)
    const plain = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    this.form.patchValue({ content_raw: plain }, { emitEvent: false });
    this.contentChars.set(plain.length);
    this.alertService.showAlert('Improved content applied.', 'success');
  }

  applyAiSeo(): void {
    const s = this.aiSeo();
    if (!s) return;
    const patch: any = {};
    if (s.seo_title)       patch.seo_title = s.seo_title;
    if (s.seo_description) patch.seo_description = s.seo_description;
    this.form.patchValue(patch);
    if (s.tags?.length) this.addTagsFromText(s.tags.join(','));
    this.alertService.showAlert('SEO metadata applied.', 'success');
  }

  // ── Save ─────────────────────────────────────────────────────

  async save(publishNow = false): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.alertService.showAlert('Please fill in the required fields.', 'error');
      return;
    }

    if (this.contentOverLimit()) {
      this.alertService.showAlert(
        `Post is too long — keep it under ${this.MAX_CONTENT_CHARS.toLocaleString()} characters ` +
        `(currently ${this.contentChars().toLocaleString()}).`,
        'error'
      );
      return;
    }

    if (this.pendingCoverFile()) {
      await this.uploadCoverImage();
    }

    const formVal = this.form.value;
    const scheduled = this.isScheduledFuture;

    let status: PostCreateDTO['status'];
    let scheduled_at: string | null = null;

    if (publishNow) {
      status = 'published';
    } else if (scheduled) {
      status = 'scheduled';
      scheduled_at = formVal.scheduled_at;
    } else {
      status = formVal.status || 'draft';
    }

    const successMsg = publishNow ? 'Post published!'
      : (scheduled ? 'Post scheduled!' : 'Post saved!');

    const payload: PostCreateDTO = { ...formVal, status, scheduled_at };

    this.isSaving.set(true);
    const request$ = this.isEditMode()
      ? this.postService.update(this.editId()!, payload)
      : this.postService.create(payload);

    request$.pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.isSaving.set(false);
        this.alertService.showAlert(successMsg, 'success');
        this.router.navigate(['/admin/posts']);
      },
      error: (err: any) => {
        this.isSaving.set(false);
        this.alertService.showAlert(
          (err as any)?.error?.message || 'Failed to save post. Try again.',
          'error'
        );
      }
    });
  }

  get titleError(): boolean {
    const c = this.form.get('title');
    return !!(c?.invalid && c?.touched);
  }

  get contentError(): boolean {
    const c = this.form.get('content');
    return !!(c?.invalid && c?.touched);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
