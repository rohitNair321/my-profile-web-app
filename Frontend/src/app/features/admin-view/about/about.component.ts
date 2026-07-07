import { ChangeDetectionStrategy, Component, Injector, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Observable, tap } from 'rxjs';
import { CommonApp } from 'src/app/core/services/common';
import { AdminDirtyComponent } from 'src/app/core/app-gards/unsaved-changes.guard';

type EditorMode = 'edit' | 'preview';

@Component({
  selector: 'app-admin-about',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './about.component.html',
  styleUrls: ['./about.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminAboutComponent extends CommonApp implements OnInit, AdminDirtyComponent {
  activeMode = signal<EditorMode>('preview');
  saving     = signal(false);
  savedOk    = signal(false);
  markdownText = '';

  // Last-saved snapshot for dirty detection
  private _original = '';

  isDirty(): boolean { return this.markdownText !== this._original; }

  discardChanges(): void { this.markdownText = this._original; }

  constructor(public override injector: Injector) {
    super(injector);
  }

  ngOnInit(): void {
    const p = this.appService.profile();
    const loaded = p?.description ?? '';
    this.markdownText = loaded;
    this._original    = loaded;
  }

  get previewHtml(): string {
    return this.markdownText
      .replace(/^## (.+)$/gm,    '<h2>$1</h2>')
      .replace(/^### (.+)$/gm,   '<h3>$1</h3>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g,     '<em>$1</em>')
      .replace(/^- (.+)$/gm,     '<li>$1</li>')
      .replace(/(<li>[^]*?<\/li>)/gs, '<ul>$1</ul>')
      .replace(/\n\n/g,           '</p><p>')
      .replace(/^(?!<[hulo])/gm,  '')
      .replace(/<p><\/p>/g,       '');
  }

  setMode(m: EditorMode): void { this.activeMode.set(m); }

  saveChanges(): Observable<any> {
    const fd = new FormData();
    fd.append('description', this.markdownText);
    return this.saveWithFeedback(this.appService.updateProfile(fd), 'About section saved')
      .pipe(tap(() => { this._original = this.markdownText; }));
  }

  save(): void {
    if (!this.isDirty() || this.saving()) return;
    this.saving.set(true);
    this.saveChanges().subscribe({
      next:  () => { this.saving.set(false); this.savedOk.set(true); setTimeout(() => this.savedOk.set(false), 2500); },
      error: () => this.saving.set(false),
    });
  }
}
