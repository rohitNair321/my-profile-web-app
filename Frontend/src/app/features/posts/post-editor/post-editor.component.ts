import {
  Component, OnInit, OnDestroy, inject, signal, computed, Injector
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { QuillEditorComponent } from 'src/app/shared/components/quill-editor/quill-editor.component';
import { PostService, Post, PostCreateDTO } from 'src/app/core/services/post.service';
import { CommonApp } from 'src/app/core/services/common';
import { Subject, takeUntil } from 'rxjs';

type TabId = 'editor' | 'seo';

@Component({
  selector: 'app-post-editor',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterLink, QuillEditorComponent],
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
  isSaving  = signal(false);
  isLoading = signal(false);
  error     = signal<string | null>(null);
  activeTab = signal<TabId>('editor');
  showPreview = signal(false);

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
    // We call getAllAdmin to get by ID since there's no public GET by ID
    // Instead we'll use the admin update flow — load all and find, or just patch
    // Actually the cleanest is to call update with no changes and read back.
    // For simplicity we use getBySlug — but we need ID, not slug.
    // Use admin endpoint:
    this.postService.getAllAdmin({ limit: 1000 }).pipe(takeUntil(this.destroy$)).subscribe({
      next: (res) => {
        const post = res.data.posts.find(p => p.id === id);
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
    });
  }

  onEditorChanged(event: any): void {
    // Sync plain-text content_raw for SEO and read time
    if (event?.text !== undefined) {
      this.form.patchValue({ content_raw: event.text }, { emitEvent: false });
    }
  }

  // ── Tags ─────────────────────────────────────────────────────

  get tags(): string[] {
    return this.form.get('tags')?.value || [];
  }

  addTag(): void {
    const tag = this.tagInput.trim();
    if (!tag || this.tags.includes(tag)) { this.tagInput = ''; return; }
    this.form.patchValue({ tags: [...this.tags, tag] });
    this.tagInput = '';
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

  // ── Save ─────────────────────────────────────────────────────

  async save(publishNow = false): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.alertService.showAlert('Please fill in the required fields.', 'error');
      return;
    }

    // Upload pending cover first
    if (this.pendingCoverFile()) {
      await this.uploadCoverImage();
    }

    const payload: PostCreateDTO = {
      ...this.form.value,
      status: publishNow ? 'published' : this.form.get('status')?.value,
    };

    this.isSaving.set(true);
    const request$ = this.isEditMode()
      ? this.postService.update(this.editId()!, payload)
      : this.postService.create(payload);

    request$.pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.isSaving.set(false);
        this.alertService.showAlert(
          publishNow ? 'Post published!' : 'Post saved!',
          'success'
        );
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
