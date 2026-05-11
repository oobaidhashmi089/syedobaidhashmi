import {
  AfterViewInit,
  Component,
  ElementRef,
  forwardRef,
  input,
  ViewChild,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { isProbablyPlainText, normalizeRichHtml } from '../../core/rich-html';

export type RichTextVariant = 'area' | 'line' | 'role' | 'title';

@Component({
  selector: 'app-rich-text-field',
  standalone: true,
  templateUrl: './rich-text-field.component.html',
  styleUrl: './rich-text-field.component.css',
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => RichTextFieldComponent), multi: true },
  ],
})
export class RichTextFieldComponent implements ControlValueAccessor, AfterViewInit {
  @ViewChild('host') hostRef!: ElementRef<HTMLDivElement>;

  /** `area` = summary; `line` = bullets; `role` = job title line; `title` = headline under your name */
  readonly variant = input<RichTextVariant>('area');
  readonly sizeLabel = input('Size');

  readonly fontSizes = [10, 11, 12, 13, 14, 15, 16, 18, 20, 22, 24, 26, 28];

  private value = '';
  private onChange: (v: string) => void = () => {};
  private onTouched: () => void = () => {};
  private disabled = false;

  ngAfterViewInit(): void {
    this.applyValueToHost();
  }

  writeValue(v: string | null): void {
    this.value = v ?? '';
    queueMicrotask(() => this.applyValueToHost());
  }

  registerOnChange(fn: (v: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
    const el = this.hostRef?.nativeElement;
    if (el) {
      el.contentEditable = isDisabled ? 'false' : 'true';
    }
  }

  holdFocus(ev: MouseEvent): void {
    ev.preventDefault();
  }

  bold(): void {
    this.exec(() => document.execCommand('bold', false));
  }

  italic(): void {
    this.exec(() => document.execCommand('italic', false));
  }

  onSizeChange(sel: HTMLSelectElement): void {
    const px = Number(sel.value);
    sel.selectedIndex = 0;
    if (!px || Number.isNaN(px)) return;
    this.exec(() => this.wrapSelectionFontSize(px));
  }

  emitChange(): void {
    const el = this.hostRef?.nativeElement;
    if (!el) return;
    const clean = normalizeRichHtml(el.innerHTML);
    if (clean !== el.innerHTML) {
      el.innerHTML = clean;
    }
    this.value = clean;
    this.onChange(clean);
  }

  onPaste(ev: ClipboardEvent): void {
    ev.preventDefault();
    const text = ev.clipboardData?.getData('text/plain') ?? '';
    document.execCommand('insertText', false, text);
    this.emitChange();
  }

  onBlur(): void {
    this.onTouched();
  }

  private exec(run: () => void): void {
    const el = this.hostRef?.nativeElement;
    if (!el || this.disabled) return;
    el.focus();
    run();
    this.emitChange();
  }

  private wrapSelectionFontSize(px: number): void {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    if (range.collapsed) return;
    const span = document.createElement('span');
    span.style.fontSize = `${px}px`;
    span.appendChild(range.extractContents());
    range.insertNode(span);
    sel.removeAllRanges();
    const next = document.createRange();
    next.selectNodeContents(span);
    next.collapse(false);
    sel.addRange(next);
  }

  private applyValueToHost(): void {
    const el = this.hostRef?.nativeElement;
    if (!el) return;
    const v = this.value;
    if (!v) {
      el.innerHTML = '';
      return;
    }
    if (isProbablyPlainText(v)) {
      el.innerText = v;
    } else {
      el.innerHTML = normalizeRichHtml(v);
    }
  }
}
