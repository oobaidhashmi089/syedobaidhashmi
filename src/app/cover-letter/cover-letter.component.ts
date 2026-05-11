import { Component, inject, signal, AfterViewInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { UpperCasePipe } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { I18nService, AppLang } from '../core/i18n.service';
import { TranslatePipe } from '../pipes/translate.pipe';
import { isProbablyPlainText, normalizeRichHtml, stripRichHtmlToPlain } from '../core/rich-html';
import { AdminAuthService } from '../core/admin-auth.service';
import { RichTextFieldComponent } from '../shared/rich-text-field/rich-text-field.component';
import { NetworkCanvasComponent } from '../shared/network-canvas/network-canvas.component';

const CL_KEY = 'ats-cover-letter-v1';

export interface CoverModel {
  yourName: string;
  email: string;
  phone: string;
  company: string;
  manager: string;
  role: string;
  dateStr: string;
  opening: string;
  body: string;
  closing: string;
}

const DEFAULT_COVER: CoverModel = {
  yourName: 'Syed Obaid Hashmi',
  email: 'syedhashmi089@gmail.com',
  phone: '03030323458',
  company: 'Hiring Company',
  manager: 'Hiring Manager',
  role: 'Software Engineer',
  dateStr: new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }),
  opening:
    'I am writing to express my strong interest in the {{role}} opportunity at {{company}}. With hands-on experience building enterprise web applications and integrations, I am excited about contributing to your engineering goals.',
  body: 'In my current role, I deliver scalable APIs, Angular and .NET solutions, and workflow automation that measurably improves operational efficiency. I enjoy collaborating with stakeholders, owning features end-to-end, and maintaining high quality through testing and code review.',
  closing: 'Thank you for your time and consideration. I would welcome the opportunity to discuss how my background aligns with your team’s needs.\n\nSincerely,\n{{yourName}}',
};

@Component({
  selector: 'app-cover-letter',
  standalone: true,
  imports: [FormsModule, RouterLink, TranslatePipe, UpperCasePipe, RichTextFieldComponent, NetworkCanvasComponent],
  templateUrl: './cover-letter.component.html',
  styleUrl: './cover-letter.component.css',
})
export class CoverLetterComponent implements AfterViewInit {
  readonly i18n = inject(I18nService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly router = inject(Router);
  private readonly adminAuth = inject(AdminAuthService);

  readonly model = signal<CoverModel>({ ...DEFAULT_COVER });
  readonly zoom = signal(88);
  readonly pdfBusy = signal(false);
  readonly langs: AppLang[] = ['en', 'es', 'ur', 'de'];

  constructor() {
    try {
      const raw = localStorage.getItem(CL_KEY);
      if (raw) this.model.set({ ...DEFAULT_COVER, ...JSON.parse(raw) });
    } catch {
      /* ignore */
    }
  }

  ngAfterViewInit(): void {
    this.applyZoom();
  }

  signOut(): void {
    this.adminAuth.logout();
    void this.router.navigateByUrl('/');
  }

  persist(): void {
    try {
      localStorage.setItem(CL_KEY, JSON.stringify(this.model()));
    } catch {
      /* ignore */
    }
  }

  patch<K extends keyof CoverModel>(key: K, value: CoverModel[K]): void {
    this.model.update((m) => ({ ...m, [key]: value }));
    this.persist();
  }

  interpolated(text: string): string {
    const m = this.model();
    return text
      .replace(/\{\{company\}\}/g, m.company)
      .replace(/\{\{role\}\}/g, m.role)
      .replace(/\{\{yourName\}\}/g, m.yourName)
      .replace(/\{\{manager\}\}/g, m.manager);
  }

  safeCl(html: string): SafeHtml {
    const raw = html ?? '';
    const withBreaks = isProbablyPlainText(raw) ? raw.replace(/\n/g, '<br>') : raw;
    return this.sanitizer.bypassSecurityTrustHtml(normalizeRichHtml(withBreaks));
  }

  adjZoom(d: number): void {
    this.zoom.update((z) => Math.max(40, Math.min(120, z + d)));
    this.applyZoom();
  }

  private applyZoom(): void {
    const wrap = document.getElementById('cover-wrap');
    if (wrap) wrap.style.transform = `scale(${this.zoom() / 100})`;
  }

  async doPdf(): Promise<void> {
    const el = document.getElementById('cover-root');
    if (!el || this.pdfBusy()) return;

    const safeName = this.model().yourName.replace(/[^\w\-]+/g, '_').slice(0, 80) || 'CoverLetter';

    this.pdfBusy.set(true);
    await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
    try {
      const { captureElementToPdf } = await import('../core/pdf-export');
      await captureElementToPdf(el, {
        fileName: `${safeName}_CoverLetter.pdf`,
        format: 'a4',
        backgroundColor: '#ffffff',
        zoomWrapId: 'cover-wrap',
        pdfContentAlign: 'top',
      });
      this.toast(this.i18n.t('toastPdf'));
    } catch (e) {
      console.error(e);
      this.toast(this.i18n.t('toastPdfFail'));
    } finally {
      this.pdfBusy.set(false);
      this.applyZoom();
    }
  }

  async shareText(): Promise<void> {
    const text = [
      this.model().yourName,
      this.model().email,
      this.model().phone,
      '',
      this.model().dateStr,
      '',
      `Dear ${this.model().manager},`,
      '',
      stripRichHtmlToPlain(this.interpolated(this.model().opening)),
      '',
      stripRichHtmlToPlain(this.interpolated(this.model().body)),
      '',
      stripRichHtmlToPlain(this.interpolated(this.model().closing)),
    ].join('\n');
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Cover letter', text });
        return;
      }
    } catch {
      return;
    }
    await navigator.clipboard.writeText(text);
    this.toast(this.i18n.t('toastCopied'));
  }

  doPrint(): void {
    window.print();
  }

  doPdfAts(): void {
    if (this.pdfBusy()) return;
    setTimeout(() => window.print(), 120);
  }

  toast(msg: string, durationMs = 2000, multiline = false): void {
    const el = document.createElement('div');
    el.textContent = msg;
    Object.assign(el.style, {
      position: 'fixed',
      bottom: '22px',
      left: '50%',
      transform: 'translateX(-50%)',
      background: '#0f172a',
      color: '#e2e8f0',
      border: '1px solid #334155',
      padding: multiline ? '12px 16px' : '7px 18px',
      borderRadius: '20px',
      fontSize: '12px',
      fontWeight: '700',
      zIndex: '99999',
      whiteSpace: multiline ? 'normal' : 'nowrap',
      maxWidth: multiline ? 'min(420px, 92vw)' : '',
      textAlign: multiline ? 'center' : 'left',
      lineHeight: multiline ? '1.45' : '1.2',
    });
    document.body.appendChild(el);
    setTimeout(() => el.remove(), durationMs);
  }
}
