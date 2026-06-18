import {
  Component, Input, Output, EventEmitter, AfterViewInit, OnDestroy,
  ElementRef, ViewChild, forwardRef, NgZone
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { CommonModule } from '@angular/common';

declare const Quill: any;

/**
 * Custom Quill editor wrapper — works with Angular 19.
 * Quill is loaded globally via angular.json scripts/styles.
 * Implements ControlValueAccessor so it works with [formControlName].
 */
@Component({
  selector: 'app-quill-editor',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div #editorContainer class="quill-container"></div>
  `,
  styles: [`
    :host { display: block; }
    .quill-container { min-height: 400px; }
    :host ::ng-deep .ql-toolbar {
      border-radius: 12px 12px 0 0;
      border-color: transparent;
      background: var(--surface-alt, #f8fafc);
    }
    :host ::ng-deep .ql-container {
      border-color: transparent;
      font-size: 1rem;
      font-family: inherit;
    }
    :host ::ng-deep .ql-editor {
      min-height: 380px;
      line-height: 1.8;
      color: var(--text-primary, #1e293b);
    }
    :host ::ng-deep .ql-editor.ql-blank::before {
      color: var(--text-muted, #94a3b8);
      font-style: normal;
    }
  `],
  providers: [{
    provide: NG_VALUE_ACCESSOR,
    useExisting: forwardRef(() => QuillEditorComponent),
    multi: true
  }]
})
export class QuillEditorComponent implements AfterViewInit, OnDestroy, ControlValueAccessor {

  @ViewChild('editorContainer', { static: true }) container!: ElementRef<HTMLDivElement>;
  @Input() placeholder = 'Start writing…';
  @Input() modules: any = {};

  /** Emits { html, text } on every change */
  @Output() contentChanged = new EventEmitter<{ html: string; text: string }>();

  private quill: any;
  private onChange: (value: string) => void = () => {};
  private onTouched: () => void = () => {};
  private pendingValue: string | null = null;

  constructor(private zone: NgZone) {}

  ngAfterViewInit(): void {
    // Quill is loaded as a global from angular.json scripts
    const Q = (window as any).Quill;
    if (!Q) {
      console.error('[QuillEditorComponent] Quill not found on window. Check angular.json scripts.');
      return;
    }

    const defaultModules = {
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

    this.zone.runOutsideAngular(() => {
      this.quill = new Q(this.container.nativeElement, {
        theme: 'snow',
        placeholder: this.placeholder,
        modules: Object.keys(this.modules).length ? this.modules : defaultModules,
      });

      // Apply pending value from writeValue() called before init
      if (this.pendingValue !== null) {
        this.quill.clipboard.dangerouslyPasteHTML(this.pendingValue);
        this.pendingValue = null;
      }

      this.quill.on('text-change', () => {
        this.zone.run(() => {
          const html = this.quill.root.innerHTML;
          const text = this.quill.getText();
          this.onChange(html);
          this.contentChanged.emit({ html, text });
        });
      });
    });
  }

  // ── ControlValueAccessor ────────────────────────────────

  writeValue(value: string): void {
    if (!this.quill) {
      this.pendingValue = value || '';
      return;
    }
    const current = this.quill.root.innerHTML;
    if (current !== value) {
      this.quill.clipboard.dangerouslyPasteHTML(value || '');
    }
  }

  registerOnChange(fn: (v: string) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }

  setDisabledState(isDisabled: boolean): void {
    if (this.quill) {
      this.quill.enable(!isDisabled);
    }
  }

  ngOnDestroy(): void {
    this.quill = null;
  }
}
