import {
  AfterViewInit,
  Component,
  HostListener,
  OnInit,
  computed,
  effect,
  inject,
  signal,
  ElementRef,
  viewChild,
  ChangeDetectorRef,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgStyle, NgClass, UpperCasePipe } from '@angular/common';
import { DomSanitizer, SafeHtml, Title } from '@angular/platform-browser';
import { RouterLink, Router } from '@angular/router';
import { I18nService, AppLang } from '../core/i18n.service';
import { ResumeWorkspaceService } from '../core/resume-workspace.service';
import { TranslatePipe } from '../pipes/translate.pipe';
import { TemplateId, JobEntry, PageFormat, PdfOrientation, pagePreviewCssSize } from '../core/resume.types';
import { normalizeRichHtml, stripRichHtmlToPlain } from '../core/rich-html';
import { computeAtsCheck, type AtsCheckResult } from '../core/ats-check';
import {
  ATS_OPTIMIZED_CERTIFICATIONS,
  ATS_OPTIMIZED_SKILL_ROWS,
  ATS_OPTIMIZED_SUMMARY,
  rewriteJobForAts,
} from '../core/ats-optimized-content';
import { AdminAuthService } from '../core/admin-auth.service';
import { RichTextFieldComponent } from '../shared/rich-text-field/rich-text-field.component';
import { NetworkCanvasComponent } from '../shared/network-canvas/network-canvas.component';

type ResumeDesignNums =
  | 'nameSize'
  | 'bodySize'
  | 'contactSize'
  | 'sectionTitleSize'
  | 'lineHeight'
  | 'sectionLetterSpacing'
  | 'sectionGap'
  | 'bulletGap'
  | 'pageHPad'
  | 'pageVPad'
  | 'pdfMarginMm';

@Component({
  selector: 'app-resume-builder',
  standalone: true,
  imports: [FormsModule, RouterLink, TranslatePipe, NgStyle, NgClass, UpperCasePipe, RichTextFieldComponent, NetworkCanvasComponent],
  templateUrl: './resume-builder.component.html',
  styleUrl: './resume-builder.component.css',
})
export class ResumeBuilderComponent implements OnInit, AfterViewInit {
  readonly i18n = inject(I18nService);
  readonly ws = inject(ResumeWorkspaceService);
  private readonly router = inject(Router);
  private readonly adminAuth = inject(AdminAuthService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly pageTitle = inject(Title);

  /** Browser tab + PDF metadata title: "Name - Job title". */
  private readonly resumeDocumentTitle = computed(() => {
    const m = this.ws.model();
    const name = stripRichHtmlToPlain(m.personal.name ?? '').trim();
    const job = stripRichHtmlToPlain(m.personal.title ?? '').trim();
    if (name && job) return `${name} - ${job}`;
    if (name) return name;
    if (job) return job;
    return 'ATS Resume Studio';
  });

  constructor() {
    effect(() => {
      this.pageTitle.setTitle(this.resumeDocumentTitle());
    });
  }

  private readonly resumeEl = viewChild<ElementRef<HTMLElement>>('resumeRoot');

  /** Start in edit mode so fields and “add bullet / section” controls are available immediately. */
  readonly editMode = signal(true);
  readonly pdfBusy = signal(false);
  readonly pdfFriendly = signal(false);
  readonly zoom = signal(85);
  readonly sidebarOpen = signal(true);
  readonly activeTab = signal<'design' | 'spacing' | 'layout' | 'sections' | 'tools'>('design');
  readonly shareOpen = signal(false);
  readonly jdText = signal('');
  readonly keywordHints = signal<{ word: string; count: number }[]>([]);
  readonly atsResult = signal<AtsCheckResult | null>(null);
  readonly atsIgnoredWords = signal<Set<string>>(new Set());

  private static readonly ATS_IGNORE_STORAGE = 'ats-ignored-keywords-v1';

  readonly langs: AppLang[] = ['en', 'es', 'ur', 'de'];

  readonly colors = [
    { name: 'Navy', hex: '#1a3a5c' },
    { name: 'Forest', hex: '#1c5c3a' },
    { name: 'Crimson', hex: '#7c1a2c' },
    { name: 'Charcoal', hex: '#2d3436' },
    { name: 'Purple', hex: '#4a1f7c' },
    { name: 'Teal', hex: '#0d5f6e' },
    { name: 'Copper', hex: '#7c4212' },
    { name: 'Slate', hex: '#374151' },
  ];

  readonly fonts = [
    {
      id: 'times',
      name: 'Times New Roman',
      sub: 'Classic formal',
      h: "'Times New Roman',Times,'Liberation Serif','Noto Serif',Georgia,serif",
      b: "'Times New Roman',Times,'Liberation Serif','Noto Serif',Georgia,serif",
    },
    { id: 'professional', name: 'Professional', sub: 'Baskerville + Source Sans', h: "'Libre Baskerville',Georgia,serif", b: "'Source Sans 3',Calibri,sans-serif" },
    { id: 'elegant', name: 'Elegant', sub: 'Playfair + Lato', h: "'Playfair Display',Georgia,serif", b: "'Lato',Helvetica,sans-serif" },
    { id: 'modern', name: 'Modern', sub: 'Montserrat + Open Sans', h: "'Montserrat',Arial,sans-serif", b: "'Open Sans',Arial,sans-serif" },
    { id: 'academic', name: 'Academic', sub: 'EB Garamond + Nunito', h: "'EB Garamond',Georgia,serif", b: "'Nunito',Helvetica,sans-serif" },
    { id: 'executive', name: 'Executive', sub: 'Raleway + Roboto', h: "'Raleway',Arial,sans-serif", b: "'Roboto',Arial,sans-serif" },
    { id: 'unified', name: 'Unified', sub: 'DM Sans', h: "'DM Sans',Arial,sans-serif", b: "'DM Sans',Arial,sans-serif" },
    { id: 'inter', name: 'Inter + Merriweather', sub: 'Readable ATS', h: "'Merriweather',Georgia,serif", b: "'Inter',Segoe UI,sans-serif" },
    { id: 'ibm', name: 'IBM Plex', sub: 'Corporate tech', h: "'IBM Plex Serif',Georgia,serif", b: "'IBM Plex Sans',Segoe UI,sans-serif" },
    { id: 'pt', name: 'PT Serif + Sans', sub: 'Classic EU', h: "'PT Serif',Georgia,serif", b: "'PT Sans',Arial,sans-serif" },
    { id: 'source', name: 'Source Pro', sub: 'Adobe pair', h: "'Source Serif 4',Georgia,serif", b: "'Source Sans 3',Calibri,sans-serif" },
  ];

  readonly templates: { id: TemplateId; icon: string; name: string; desc: string }[] = [
    { id: 'classic', icon: '📋', name: 'Classic', desc: 'Traditional ATS-safe' },
    { id: 'atslinear', icon: '📄', name: 'ATS Linear', desc: 'Ultra-simple parsing' },
    { id: 'compact', icon: '▤', name: 'Compact', desc: 'Dense one-page fit' },
    { id: 'modern', icon: '⚡', name: 'Modern', desc: 'Coloured section tags' },
    { id: 'minimal', icon: '✦', name: 'Minimal', desc: 'Ultra-clean & airy' },
    { id: 'executive', icon: '👔', name: 'Executive', desc: 'Coloured header band' },
    { id: 'corporate', icon: '🏢', name: 'Corporate', desc: 'Strong grid bars' },
    { id: 'academic', icon: '🎓', name: 'Academic', desc: 'Serif emphasis' },
    { id: 'sharp', icon: '◈', name: 'Sharp', desc: 'Gradient accents' },
  ];

  readonly dividers = [
    { id: 'd-solid', lbl: 'Solid', css: 'border-bottom:1.5px solid var(--accent)' },
    { id: 'd-thin', lbl: 'Thin', css: 'border-bottom:1px solid #aaaaaa' },
    { id: 'd-double', lbl: 'Double', css: 'border-bottom:3px double var(--accent)' },
    { id: 'd-none', lbl: 'None', css: 'border-bottom:none' },
  ];

  readonly dividerPreview: Record<string, string> = {
    'd-solid': 'height:2px;background:var(--accent,#1a3a5c);width:100%',
    'd-thin': 'height:1px;background:#aaa;width:100%',
    'd-double': 'height:4px;border-top:3px double #888;width:100%',
    'd-none': 'height:2px;background:transparent;width:100%',
  };

  readonly sectionMeta = computed(() => [
    { id: 'summary' as const, labelKey: 'sectionSummary' },
    { id: 'experience' as const, labelKey: 'sectionExperience' },
    { id: 'skills' as const, labelKey: 'sectionSkills' },
    { id: 'erp' as const, labelKey: 'sectionErp' },
    { id: 'education' as const, labelKey: 'sectionEducation' },
    { id: 'certifications' as const, labelKey: 'sectionCerts' },
  ]);

  safeRich(html: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(normalizeRichHtml(html ?? ''));
  }

  resumeClasses(): string {
    const d = this.ws.design();
    const parts = ['resume-doc'];
    if (d.templateId !== 'classic') {
      parts.push('tpl-' + d.templateId);
    }
    return parts.join(' ');
  }

  resumeStyle(): Record<string, string> {
    const d = this.ws.design();
    const { w, h } = pagePreviewCssSize(d.pageFormat, d.pdfOrientation);
    return {
      width: w,
      minHeight: h,
      background: d.paperBg,
      '--accent': d.accent,
      '--heading-font': this.headingFont(),
      '--body-font': this.bodyFont(),
      '--name-size': d.nameSize + 'px',
      '--section-title-size': d.sectionTitleSize + 'px',
      '--body-size': d.bodySize + 'px',
      '--contact-size': d.contactSize + 'px',
      '--line-height': String(d.lineHeight),
      '--section-gap': d.sectionGap + 'px',
      '--bullet-gap': d.bulletGap + 'px',
      '--page-h-pad': d.pageHPad + 'mm',
      '--page-v-pad': d.pageVPad + 'mm',
      '--section-letter-spacing': d.sectionLetterSpacing + 'px',
      '--paper-bg': d.paperBg,
    } as Record<string, string>;
  }

  nameTextTransform(): string {
    const c = this.ws.design().nameCase;
    if (c === 'uppercase') return 'uppercase';
    if (c === 'capitalize') return 'capitalize';
    return 'none';
  }

  linkedinUrl(): string {
    const u = this.ws.model().personal.linkedin.trim();
    if (!u) return '#';
    if (/^https?:\/\//i.test(u)) return u;
    return 'https://' + u;
  }

  linkedinLabel(): string {
    return this.ws.model().personal.linkedin.trim() ? 'LinkedIn' : '';
  }

  phoneDisplay(): string {
    const raw = (this.ws.model().personal.phone ?? '').trim();
    const digits = raw.replace(/\D/g, '');
    if (digits.length === 11) return `${digits.slice(0, 4)} ${digits.slice(4)}`;
    return raw;
  }

  private phoneForAts(): string {
    const raw = (this.ws.model().personal.phone ?? '').trim();
    const digits = raw.replace(/\D/g, '');
    // Already in international format (kept by user) — keep as-is, just normalize spaces.
    if (raw.startsWith('+')) return raw.replace(/\s+/g, ' ');
    // Pakistan local format: 11 digits starting with 0 → +92 XXX XXXXXXX.
    if (digits.length === 11 && digits.startsWith('0')) {
      const local = digits.slice(1);
      return `+92 ${local.slice(0, 3)} ${local.slice(3)}`;
    }
    // 10 digits without leading 0 → assume Pakistan local without zero.
    if (digits.length === 10) return `+92 ${digits.slice(0, 3)} ${digits.slice(3)}`;
    // 12 digits starting with 92 → already country-coded, just add +.
    if (digits.length === 12 && digits.startsWith('92')) {
      const local = digits.slice(2);
      return `+92 ${local.slice(0, 3)} ${local.slice(3)}`;
    }
    return digits || raw;
  }

  private headingFont(): string {
    const f = this.fonts.find((x) => x.id === this.ws.design().fontId);
    return f?.h ?? this.fonts[0].h;
  }

  private bodyFont(): string {
    const f = this.fonts.find((x) => x.id === this.ws.design().fontId);
    return f?.b ?? this.fonts[0].b;
  }

  ngOnInit(): void {
    this.applyDividerCss(this.ws.design().dividerId);
    try {
      const raw = sessionStorage.getItem(ResumeBuilderComponent.ATS_IGNORE_STORAGE);
      if (raw) this.atsIgnoredWords.set(new Set(JSON.parse(raw) as string[]));
    } catch {
      /* ignore */
    }
  }

  ngAfterViewInit(): void {
    this.setZoom(this.zoom());
  }

  setTab(tab: 'design' | 'spacing' | 'layout' | 'sections' | 'tools'): void {
    this.activeTab.set(tab);
  }

  toggleSidebar(): void {
    this.sidebarOpen.update((v) => !v);
  }

  toggleEdit(): void {
    const next = !this.editMode();
    this.editMode.set(next);
    if (!next) {
      this.ws.snapshot();
      this.ws.persist();
      this.toast(this.i18n.t('toastSaved'));
    }
  }

  signOut(): void {
    this.adminAuth.logout();
    void this.router.navigateByUrl('/');
  }

  toggleShare(): void {
    this.shareOpen.update((v) => !v);
  }

  setZoom(z: number): void {
    const v = Math.max(30, Math.min(160, z));
    this.zoom.set(v);
    const wrap = document.getElementById('resume-wrap');
    const r = document.getElementById('resume-root');
    if (wrap && r) {
      const { w: wmm } = pagePreviewCssSize(this.ws.design().pageFormat, this.ws.design().pdfOrientation);
      wrap.style.width = wmm;
      if (this.pdfFriendly()) {
        wrap.style.transform = 'none';
        wrap.style.marginBottom = '0px';
      } else {
        wrap.style.transform = `scale(${v / 100})`;
        const scaledH = r.offsetHeight * (v / 100);
        wrap.style.marginBottom = Math.max(0, scaledH - r.offsetHeight) + 'px';
      }
    }
  }

  adjZoom(d: number): void {
    this.setZoom(this.zoom() + d);
  }

  togglePdfFriendly(): void {
    this.pdfFriendly.update((v) => !v);
    this.setZoom(this.zoom());
    this.toast(this.pdfFriendly() ? this.i18n.t('pdfFriendlyOn') : this.i18n.t('pdfFriendlyOff'));
  }

  applyAccent(hex: string): void {
    this.ws.snapshot();
    this.ws.design.update((d) => ({ ...d, accent: hex }));
    this.ws.persist();
  }

  applyFont(id: string): void {
    this.ws.snapshot();
    this.ws.design.update((d) => ({ ...d, fontId: id }));
    this.ws.persist();
  }

  applyTpl(id: TemplateId): void {
    this.ws.snapshot();
    this.ws.design.update((d) => ({ ...d, templateId: id }));
    this.ws.persist();
  }

  applyDivider(id: string): void {
    this.ws.design.update((d) => ({ ...d, dividerId: id }));
    this.applyDividerCss(id);
  }

  applyDividerCss(id: string): void {
    const div = this.dividers.find((x) => x.id === id);
    let s = document.getElementById('divider-style-el') as HTMLStyleElement | null;
    if (!s) {
      s = document.createElement('style');
      s.id = 'divider-style-el';
      document.head.appendChild(s);
    }
    s.textContent =
      id === 'd-none'
        ? '#resume-root .r-section-title { border-bottom: none !important; }'
        : `#resume-root .r-section-title { ${div?.css ?? ''} !important; }`;
  }

  onDividerPick(id: string): void {
    this.ws.snapshot();
    this.applyDivider(id);
    this.ws.persist();
  }

  setFmt(fmt: PageFormat): void {
    this.ws.snapshot();
    this.ws.design.update((d) => ({ ...d, pageFormat: fmt }));
    this.ws.persist();
    queueMicrotask(() => this.setZoom(this.zoom()));
  }

  setPdfOrientation(o: PdfOrientation): void {
    this.ws.snapshot();
    this.ws.design.update((d) => ({ ...d, pdfOrientation: o }));
    this.ws.persist();
    queueMicrotask(() => this.setZoom(this.zoom()));
  }

  setPaper(hex: string): void {
    this.ws.snapshot();
    this.ws.design.update((d) => ({ ...d, paperBg: hex }));
    this.ws.persist();
  }

  setNameCase(mode: 'uppercase' | 'capitalize' | 'none'): void {
    this.ws.snapshot();
    this.ws.design.update((d) => ({ ...d, nameCase: mode }));
    this.ws.persist();
  }

  setPlainContact(v: boolean): void {
    this.ws.snapshot();
    this.ws.design.update((d) => ({ ...d, plainContact: v }));
    this.ws.persist();
  }

  setDesignNumber(key: ResumeDesignNums, value: number): void {
    let v = value;
    if (key === 'pdfMarginMm') v = Math.max(0, Math.min(25, Math.round(v)));
    this.ws.design.update((d) => ({ ...d, [key]: v }));
    this.ws.persist();
  }

  onSliderChange(): void {
    this.ws.snapshot();
  }

  toggleSection(id: keyof import('../core/resume.types').SectionVisibility, show: boolean): void {
    this.ws.snapshot();
    this.ws.sections.update((s) => ({ ...s, [id]: show }));
    this.ws.persist();
  }

  patchPersonal(field: string, value: string): void {
    this.ws.model.update((m) => ({
      ...m,
      personal: { ...m.personal, [field]: value },
    }));
    this.ws.persist();
  }

  patchSummary(v: string): void {
    this.ws.model.update((m) => ({ ...m, summary: v }));
    this.ws.persist();
  }

  patchJob(job: JobEntry, field: keyof JobEntry, value: unknown): void {
    this.ws.model.update((m) => ({
      ...m,
      jobs: m.jobs.map((j) => (j.id === job.id ? { ...j, [field]: value } : j)),
    }));
    this.ws.persist();
  }

  patchSkill(i: number, field: 'label' | 'value', value: string): void {
    this.ws.model.update((m) => {
      const skillRows = m.skillRows.map((r, idx) => (idx === i ? { ...r, [field]: value } : r));
      return { ...m, skillRows };
    });
    this.ws.persist();
  }

  patchErpTitle(blockIdx: number, title: string): void {
    this.ws.model.update((m) => ({
      ...m,
      erpBlocks: m.erpBlocks.map((b, i) => (i === blockIdx ? { ...b, title } : b)),
    }));
    this.ws.persist();
  }

  patchErpItem(blockIdx: number, itemIdx: number, value: string): void {
    this.ws.model.update((m) => {
      const erpBlocks = m.erpBlocks.map((b, i) => {
        if (i !== blockIdx) return b;
        const items = b.items.map((t, j) => (j === itemIdx ? value : t));
        return { ...b, items };
      });
      return { ...m, erpBlocks };
    });
    this.ws.persist();
  }

  addErpItem(blockIdx: number): void {
    this.ws.snapshot();
    this.ws.model.update((m) => {
      const erpBlocks = m.erpBlocks.map((b, i) => {
        if (i !== blockIdx) return b;
        return { ...b, items: [...b.items, 'New bullet — describe expertise.'] };
      });
      return { ...m, erpBlocks };
    });
    this.ws.persist();
  }

  removeErpItem(blockIdx: number, itemIdx: number): void {
    this.ws.snapshot();
    this.ws.model.update((m) => {
      const erpBlocks = m.erpBlocks.map((b, i) => {
        if (i !== blockIdx) return b;
        return { ...b, items: b.items.filter((_, j) => j !== itemIdx) };
      });
      return { ...m, erpBlocks };
    });
    this.ws.persist();
  }

  patchEducation(field: string, value: string): void {
    this.ws.model.update((m) => ({
      ...m,
      education: { ...m.education, [field]: value },
    }));
    this.ws.persist();
  }

  patchCert(i: number, v: string): void {
    this.ws.model.update((m) => {
      const certifications = m.certifications.map((c, idx) => (idx === i ? v : c));
      return { ...m, certifications };
    });
    this.ws.persist();
  }

  addBullet(job: JobEntry): void {
    this.ws.snapshot();
    this.patchJob(job, 'bullets', [...job.bullets, 'New bullet — quantify impact.']);
  }

  removeBullet(job: JobEntry, idx: number): void {
    this.ws.snapshot();
    this.patchJob(
      job,
      'bullets',
      job.bullets.filter((_, i) => i !== idx),
    );
  }

  updateBullet(job: JobEntry, idx: number, text: string): void {
    this.patchJob(
      job,
      'bullets',
      job.bullets.map((x, i) => (i === idx ? text : x)),
    );
  }

  addJob(): void {
    this.ws.snapshot();
    const j = this.ws.newJob();
    this.ws.model.update((m) => ({ ...m, jobs: [...m.jobs, j] }));
    this.ws.persist();
  }

  duplicateJob(job: JobEntry): void {
    this.ws.snapshot();
    const copy: JobEntry = {
      ...job,
      id: this.ws.newJob().id,
      bullets: [...job.bullets],
    };
    this.ws.model.update((m) => {
      const idx = m.jobs.findIndex((x) => x.id === job.id);
      const jobs = [...m.jobs];
      jobs.splice(idx + 1, 0, copy);
      return { ...m, jobs };
    });
    this.ws.persist();
  }

  removeJob(job: JobEntry): void {
    this.ws.snapshot();
    this.ws.model.update((m) => ({ ...m, jobs: m.jobs.filter((j) => j.id !== job.id) }));
    this.ws.persist();
  }

  addCert(): void {
    this.ws.snapshot();
    this.ws.model.update((m) => ({ ...m, certifications: [...m.certifications, 'New certification'] }));
    this.ws.persist();
  }

  removeCert(i: number): void {
    this.ws.snapshot();
    this.ws.model.update((m) => ({
      ...m,
      certifications: m.certifications.filter((_, idx) => idx !== i),
    }));
    this.ws.persist();
  }

  addSkillRow(): void {
    this.ws.snapshot();
    this.ws.model.update((m) => ({
      ...m,
      skillRows: [...m.skillRows, { label: 'Category:', value: 'Skills' }],
    }));
    this.ws.persist();
  }

  removeSkillRow(i: number): void {
    this.ws.snapshot();
    this.ws.model.update((m) => ({
      ...m,
      skillRows: m.skillRows.filter((_, idx) => idx !== i),
    }));
    this.ws.persist();
  }

  undo(): void {
    if (this.editMode()) return;
    if (this.ws.undo()) {
      this.applyDividerCss(this.ws.design().dividerId);
      this.toast(this.i18n.t('undo'));
    }
  }

  redo(): void {
    if (this.editMode()) return;
    if (this.ws.redo()) {
      this.applyDividerCss(this.ws.design().dividerId);
      this.toast(this.i18n.t('redo'));
    }
  }

  doPrint(): void {
    window.print();
  }

  doPdfAts(): void {
    if (this.pdfBusy()) return;
    const ok = confirm(this.i18n.t('pdfAtsChecklist'));
    if (!ok) return;
    const wasEdit = this.editMode();
    if (wasEdit) {
      this.editMode.set(false);
      this.cdr.detectChanges();
    }
    const done = (): void => {
      if (wasEdit) {
        this.editMode.set(true);
        this.cdr.detectChanges();
      }
      this.setZoom(this.zoom());
    };
    window.addEventListener('afterprint', done, { once: true });
    setTimeout(() => window.print(), 120);
  }

  fitOnePage(): void {
    const root = this.resumeEl()?.nativeElement;
    if (!root) return;
    this.ws.snapshot();

    // Ensure preview is measured unscaled.
    const wasFriendly = this.pdfFriendly();
    if (!wasFriendly) {
      this.pdfFriendly.set(true);
      this.cdr.detectChanges();
      this.setZoom(this.zoom());
    }

    const targetPx = this.pageHeightPx();
    let tries = 0;
    while (tries < 35 && root.scrollHeight > targetPx) {
      const d = this.ws.design();
      this.ws.design.update((cur) => ({
        ...cur,
        bodySize: Math.max(10, cur.bodySize - 0.3),
        contactSize: Math.max(9, cur.contactSize - 0.2),
        lineHeight: Math.max(1.25, cur.lineHeight - 0.02),
        sectionGap: Math.max(8, cur.sectionGap - 0.5),
        bulletGap: Math.max(0, cur.bulletGap - 0.4),
        pageVPad: Math.max(8, cur.pageVPad - 0.5),
      }));
      this.cdr.detectChanges();
      // stop if nothing else can shrink
      const n = this.ws.design();
      if (
        n.bodySize === d.bodySize &&
        n.contactSize === d.contactSize &&
        n.lineHeight === d.lineHeight &&
        n.sectionGap === d.sectionGap &&
        n.bulletGap === d.bulletGap &&
        n.pageVPad === d.pageVPad
      ) {
        break;
      }
      tries++;
    }

    this.ws.persist();
    this.setZoom(this.zoom());
    this.toast(this.i18n.t(root.scrollHeight <= targetPx ? 'fitOnePageDone' : 'fitOnePagePartial'));
  }

  private pageHeightPx(): number {
    const { h } = pagePreviewCssSize(this.ws.design().pageFormat, this.ws.design().pdfOrientation);
    const mm = Number(h.replace('mm', ''));
    return (mm * 96) / 25.4;
  }

  /** Safe filename for PDF download (keeps spaces; strips illegal Windows/path chars). */
  private safeResumePdfFileName(displayTitle: string): string {
    const t = displayTitle.replace(/[<>:"/\\|?*\u0000-\u001f]+/g, '').trim().slice(0, 180);
    return t || 'Resume';
  }

  async doPdf(): Promise<void> {
    const el = this.resumeEl()?.nativeElement;
    if (!el || this.pdfBusy()) return;

    const wasEdit = this.editMode();
    if (wasEdit) {
      this.editMode.set(false);
      this.cdr.detectChanges();
    }

    const titleStr = this.resumeDocumentTitle();
    const fileBase = this.safeResumePdfFileName(titleStr);

    this.pdfBusy.set(true);
    await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
    try {
      const { captureElementToPdf } = await import('../core/pdf-export');
      const d = this.ws.design();
      await captureElementToPdf(el, {
        fileName: `${fileBase}.pdf`,
        documentTitle: titleStr,
        format: d.pageFormat,
        orientation: d.pdfOrientation,
        marginMm: d.pdfMarginMm,
        backgroundColor: d.paperBg || '#ffffff',
        zoomWrapId: 'resume-wrap',
      });
      this.toast(this.i18n.t('toastPdf'));
    } catch (e) {
      console.error(e);
      this.toast(this.i18n.t('toastPdfFail'));
    } finally {
      this.pdfBusy.set(false);
      if (wasEdit) {
        this.editMode.set(true);
        this.cdr.detectChanges();
      }
      this.setZoom(this.zoom());
    }
  }

  private linkedinForAts(): string {
    const li = (this.ws.model().personal.linkedin ?? '').trim();
    if (!li) return '';
    return /^https?:\/\//i.test(li) ? li : `https://${li}`;
  }

  buildPlainText(): string {
    const m = this.ws.model();
    const lines: string[] = [];
    lines.push(m.personal.name.trim().toUpperCase());
    lines.push(stripRichHtmlToPlain(m.personal.title));
    const contact: string[] = [this.phoneForAts(), m.personal.email];
    const li = (m.personal.linkedin ?? '').trim();
    if (li) contact.push(this.linkedinForAts());
    contact.push(m.personal.location);
    lines.push(contact.filter(Boolean).join(' | '));
    lines.push('');
    lines.push(this.i18n.t('professionalSummary').toUpperCase());
    lines.push(stripRichHtmlToPlain(m.summary));
    lines.push('');
    lines.push(this.i18n.t('technicalSkills').toUpperCase());
    for (const s of m.skillRows) lines.push(`${s.label} ${s.value}`);
    lines.push('');
    lines.push(this.i18n.t('professionalExperience').toUpperCase());
    lines.push('');
    for (const j of m.jobs) {
      lines.push(`${j.company} | ${j.dates}`);
      lines.push(stripRichHtmlToPlain(j.role));
      for (const b of j.bullets) lines.push(`- ${stripRichHtmlToPlain(b)}`);
      lines.push('');
    }
    lines.push(this.i18n.t('education').toUpperCase());
    lines.push(m.education.degree);
    lines.push(`${m.education.school}, ${m.education.location}`);
    lines.push(m.education.dates);
    lines.push('');
    lines.push(this.i18n.t('certifications').toUpperCase());
    for (const c of m.certifications) lines.push(`- ${c}`);
    return lines.join('\n');
  }

  async copyPlain(): Promise<void> {
    await navigator.clipboard.writeText(this.buildPlainText());
    this.toast(this.i18n.t('toastCopied'));
  }

  downloadJson(): void {
    const blob = new Blob([JSON.stringify(this.ws.exportSnapshot(), null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'resume-backup.json';
    a.click();
    URL.revokeObjectURL(a.href);
    this.toast(this.i18n.t('toastCopied'));
  }

  async copyJson(): Promise<void> {
    await navigator.clipboard.writeText(JSON.stringify(this.ws.exportSnapshot(), null, 2));
    this.toast(this.i18n.t('toastCopied'));
  }

  onImportFile(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        this.ws.importSnapshot(String(reader.result));
        this.applyDividerCss(this.ws.design().dividerId);
        this.toast(this.i18n.t('toastImported'));
      } catch {
        this.toast('Invalid file');
      }
    };
    reader.readAsText(file);
    input.value = '';
  }

  analyzeKeywords(): void {
    this.runAtsCheck();
  }

  runAtsCheck(): void {
    const result = computeAtsCheck({
      jd: this.jdText(),
      resumePlain: this.buildPlainText(),
      model: this.ws.model(),
      sections: this.ws.sections(),
      ignoredKeywords: this.atsIgnoredWords(),
    });
    this.atsResult.set(result);
    this.keywordHints.set(
      result.keywords
        .filter((k) => !k.inResume)
        .slice(0, 28)
        .map((k) => ({ word: k.word, count: k.jdCount })),
    );
  }

  autoFixAts(): void {
    this.ws.snapshot();
    const impactPhrases = [
      'which improved release predictability across weekly cycles.',
      'which reduced avoidable handoff delays between teams.',
      'which accelerated issue triage and resolution during active sprints.',
      'which strengthened release stability during high-traffic periods.',
      'which lowered rework by clarifying requirements and acceptance checks earlier.',
      'which increased consistency in day-to-day engineering workflows.',
      'which shortened cycle time across feature rollout and release readiness.',
      'which raised first-time-right outcomes during sprint reviews.',
    ];
    let metricIdx = 0;
    const normalize = (s: string): string =>
      s
        .replace(/\bin\.\s*net\b/gi, 'in .NET')
        .replace(/\.\s+net\b/gi, '.NET')
        .replace(/\.\s+net core\b/gi, '.NET Core')
        .replace(/\.\s+net developer\b/gi, '.NET Developer')
        .replace(/\bnext\.\s*js\b/gi, 'Next.js')
        .replace(/\breactjs\b/gi, 'React.js')
        .replace(/\breact js\b/gi, 'React.js')
        .replace(/\bshipment service\b/gi, 'shipment-service')
        .replace(/\bend to end\b/gi, 'end-to-end')
        .replace(/\bsignoff\b/gi, 'sign-off')
        .replace(/\bscholar-seeker\b/gi, 'scholar seeker')
        .replace(/\bback-and-forth\b/gi, 'back and forth')
        .replace(/\bcross functional\b/gi, 'cross-functional')
        .replace(/\bhigh-traffic\b/gi, 'high traffic')
        .replace(/\bnear real time\b/gi, 'near-real-time')
        .replace(/\breal time\b/gi, 'real-time')
        .replace(/\boptimisation\b/gi, 'optimization')
        .replace(/\boptimised\b/gi, 'optimized')
        .replace(/\boptimise\b/gi, 'optimize')
        .replace(/\bcustomising\b/gi, 'customizing')
        .replace(/\bcustomised\b/gi, 'customized')
        .replace(/\bcustomise\b/gi, 'customize')
        .replace(/\brecognised\b/gi, 'recognized')
        .replace(/\bbehaviour\b/gi, 'behavior')
        .replace(/\borganisation\b/gi, 'organization')
        .replace(/\borganise\b/gi, 'organize')
        .replace(/\banalysed\b/gi, 'analyzed')
        .replace(/\banalyse\b/gi, 'analyze')
        .replace(/\bmodernise(d|s)?\b/gi, (m) => 'moderniz' + (m.endsWith('d') ? 'ed' : m.endsWith('s') ? 'es' : 'e'))
        .replace(/\bprioritise(d|s)?\b/gi, (m) => 'prioritiz' + (m.endsWith('d') ? 'ed' : m.endsWith('s') ? 'es' : 'e'))
        .replace(/\butilis(e|ed|es|ing)\b/gi, 'utiliz$1')
        .replace(/\bcentr(e|es|ed)\b/gi, (m) => 'cent' + (m.endsWith('e') ? 'er' : m.endsWith('es') ? 'ers' : 'ered'))
        .replace(/\blicence\b/gi, 'license')
        .replace(/\bfavour(ed|s|ite)?\b/gi, (m) => 'favor' + (m.length > 6 ? m.slice(6) : ''))
        .replace(/\bcolour\b/gi, 'color')
        .replace(/\bdefence\b/gi, 'defense')
        .replace(/\benrolment\b/gi, 'enrollment')
        .replace(/\btravelled\b/gi, 'traveled')
        .replace(/\btravelling\b/gi, 'traveling')
        .replace(/\benquir(e|ed|y|ies)\b/gi, (m) => 'inquir' + m.slice(6))
        .replace(/\bprogramme\b/gi, 'program')
        .replace(/\barchitected\b/gi, 'designed')
        .replace(/\barchitecting\b/gi, 'designing')
        .replace(/\bnear-real-time\b/gi, 'near real time')
        .replace(/\bnear real-time\b/gi, 'near real time')
        .replace(/\bmodul(es?)\b/gi, 'module$1')
        .replace(/\brecieve\b/gi, 'receive')
        .replace(/\bseperat(e|ed|ion)\b/gi, 'separat$1')
        .replace(/\bteh\b/gi, 'the')
        .replace(/\bwiht\b/gi, 'with')
        .replace(/\s+([,.;:!?])/g, '$1')
        .replace(/([,.;:!?])([A-Za-z])/g, '$1 $2')
        .replace(/\s{2,}/g, ' ')
        .replace(/\b([A-Za-z]+)\s+\1\b/g, '$1');
    const stripLegacyMetricTail = (s: string): string =>
      s
        .replace(/improved cycle time by \d+(\.\d+)?% and reduced manual effort by \d+(\.\d+)?%\.?/gi, '')
        .replace(/increased delivery speed by \d+(\.\d+)?% while lowering defects by \d+(\.\d+)?%\.?/gi, '')
        .replace(/reduced process turnaround by \d+(\.\d+)?% and improved reliability by \d+(\.\d+)?%\.?/gi, '')
        .replace(/raised release quality by \d+(\.\d+)?% and cut support issues by \d+(\.\d+)?%\.?/gi, '')
        .replace(/\s{2,}/g, ' ')
        .trim();
    const fixSentenceCase = (s: string): string => {
      const trimmed = s.trim();
      if (!trimmed) return trimmed;
      return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
    };
    const removePercentStyle = (s: string): string =>
      stripLegacyMetricTail(s)
        .replace(/\bby\s+\d+(\.\d+)?%\b/gi, 'measurably')
        .replace(/\b\d+(\.\d+)?%\b/g, 'measurably');
    const toFullMonth = (m: string): string => {
      const map: Record<string, string> = {
        jan: 'January',
        feb: 'February',
        mar: 'March',
        apr: 'April',
        may: 'May',
        jun: 'June',
        jul: 'July',
        aug: 'August',
        sep: 'September',
        sept: 'September',
        oct: 'October',
        nov: 'November',
        dec: 'December',
      };
      const k = m.toLowerCase().replace('.', '');
      return map[k] ?? m;
    };
    const normalizeDateRange = (s: string): string => {
      const raw = stripRichHtmlToPlain(s ?? '').trim();
      if (!raw) return raw;
      const normalized = raw
        .replace(/–/g, '-')
        .replace(/\s*-\s*/g, ' - ')
        .replace(
          /\b(\d{4})\s*-\s*Present\b/gi,
          (_all, startYear: string) => `January ${startYear} - Present`,
        )
        .replace(
          /\b(\d{4})\s*-\s*(\d{4})\b/g,
          (_all, startYear: string, endYear: string) => `January ${startYear} - December ${endYear}`,
        )
        .replace(
          /\b(\d{1,2})\/(\d{4})\s*-\s*(Present|\d{1,2}\/\d{4})\b/gi,
          (_all, sm: string, sy: string, end: string) => {
            const monthNames = [
              'January',
              'February',
              'March',
              'April',
              'May',
              'June',
              'July',
              'August',
              'September',
              'October',
              'November',
              'December',
            ];
            const startMon = monthNames[Math.max(1, Math.min(12, Number(sm))) - 1];
            if (/^present$/i.test(end)) return `${startMon} ${sy} - Present`;
            const [em, ey] = end.split('/');
            const endMon = monthNames[Math.max(1, Math.min(12, Number(em))) - 1];
            return `${startMon} ${sy} - ${endMon} ${ey}`;
          },
        )
        .replace(
          /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\.?\s+(\d{4})\b/gi,
          (_all, mon: string, year: string) => `${toFullMonth(mon)} ${year}`,
        )
        .replace(/\bPresent\b/gi, 'Present');
      return normalized;
    };
    const hasQuantifiedImpact = (s: string): boolean => {
      const t = s.toLowerCase();
      // Strong signals of measurable achievement (not product/version numbers like "Dynamics 365")
      if (/\b\d+(\.\d+)?\s?%/.test(t)) return true;
      if (/\b(reduced|increased|improved|cut|saved|grew|boosted|lowered)\b.{0,28}\b\d+(\.\d+)?\b/.test(t))
        return true;
      if (/\b\d+(\.\d+)?\s?(hours?|days?|weeks?|months?|tickets?|defects?|incidents?|releases?)\b/.test(t))
        return true;
      if (/\b(kpi|sla|roi|uptime|downtime|latency|throughput)\b/.test(t) && /\b\d+(\.\d+)?\b/.test(t))
        return true;
      return false;
    };
    const targetedRewrite = (s: string): string => {
      const raw = fixSentenceCase(removePercentStyle(normalize(stripRichHtmlToPlain(s))));
      const t = raw.toLowerCase();
      if (t.includes('gained in-depth understanding of microservices architecture')) {
        return 'Learned the shipment-service microservices architecture end-to-end and used that understanding to deliver features with fewer back-and-forth handoffs.';
      }
      if (t.includes('assisted with workflow automation and aot enhancements')) {
        return 'Implemented workflow automation and AOT enhancements that reduced manual approval follow-ups and improved processing consistency.';
      }
      if (t.includes('contributed to end-to-end development cycles')) {
        return 'Contributed across implementation, debugging, and QA for full project cycles, helping keep milestone releases on schedule.';
      }
      if (t.includes('implemented automated background jobs')) {
        return 'Implemented automated background jobs and scheduling workflows using Hangfire to improve runtime reliability and reduce manual intervention.';
      }
      if (t.includes('worked with cross-functional team members to validate feature behavior and close test feedback')) {
        return 'Worked with cross-functional team members to validate feature behavior and close test feedback across 6 sprint demo cycles before release sign-off.';
      }
      return raw;
    };
    const diversifyLeadVerb = (text: string, idx: number): string => {
      const replacements = [
        ['Implemented', 'Built'],
        ['Implemented', 'Engineered'],
        ['Contributed', 'Supported'],
        ['Designed and implemented', 'Designed and built'],
        ['Applied', 'Used'],
        ['Learned', 'Developed'],
      ] as const;
      let out = text;
      for (const [from, to] of replacements) {
        if (new RegExp(`^${from}\\b`, 'i').test(out) && idx % 2 === 1) {
          out = out.replace(new RegExp(`^${from}\\b`, 'i'), to);
          break;
        }
      }
      return out;
    };
    const ensureReadableSpacing = (text: string): string =>
      text
        .replace(/\.(?=[A-Za-z])/g, '. ')
        .replace(/\s{2,}/g, ' ')
        .trim();
    const enrich = (s: string): string => {
      const base = ensureReadableSpacing(removePercentStyle(normalize(stripRichHtmlToPlain(s).trim())));
      if (!base) return base;
      const rewritten = targetedRewrite(base);
      if (hasQuantifiedImpact(rewritten)) return rewritten;
      const phrase = impactPhrases[metricIdx % impactPhrases.length];
      metricIdx++;
      return `${rewritten}, ${phrase}`;
    };

    this.ws.model.update((m) => ({
      ...m,
      summary: ATS_OPTIMIZED_SUMMARY,
      personal: {
        ...m.personal,
        phone: this.phoneForAts(),
        linkedin: this.linkedinForAts(),
      },
      jobs: m.jobs.map((j) => ({
        ...j,
        dates: (() => {
          const c = j.company.toLowerCase();
          if (c.includes('cee solutions')) return 'Jan 2025 – Present';
          if (c.includes('baritechsol')) return 'May 2024 – Dec 2024';
          if (c.includes('evincible sol')) return 'Dec 2023 – Feb 2024';
          if (c.includes('folio3')) return 'May 2022 – Aug 2022';
          return normalizeDateRange(j.dates);
        })(),
        role: (() => {
          const manual = rewriteJobForAts(j.company, j.role);
          if (manual) return manual.role;
          return ensureReadableSpacing(fixSentenceCase(removePercentStyle(normalize(stripRichHtmlToPlain(j.role)))));
        })(),
        bullets: (() => {
          const manual = rewriteJobForAts(j.company, j.role);
          if (manual) return manual.bullets;
          return j.bullets.map((b, bi) => diversifyLeadVerb(enrich(b), bi));
        })(),
      })),
      erpBlocks: m.erpBlocks.map((b) => ({
        ...b,
        title: ensureReadableSpacing(fixSentenceCase(removePercentStyle(normalize(stripRichHtmlToPlain(b.title))))),
        items: b.items.map((it, ii) => diversifyLeadVerb(enrich(it), ii)),
      })),
      skillRows: ATS_OPTIMIZED_SKILL_ROWS,
      education: {
        ...m.education,
        dates: 'Aug 2020 – Aug 2024',
      },
      certifications: ATS_OPTIMIZED_CERTIFICATIONS,
    }));

    this.ws.sections.update((s) => ({ ...s, erp: false }));

    // Apply ATS-friendly but less generic visual defaults.
    this.ws.design.update((d) => ({
      ...d,
      templateId: 'atslinear',
      plainContact: true,
      dividerId: 'd-thin',
      paperBg: '#ffffff',
      sectionLetterSpacing: 0.5,
      bodySize: Math.max(11.5, d.bodySize),
      lineHeight: Math.min(1.45, d.lineHeight),
    }));
    this.ws.persist();
    this.runAtsCheck();
    this.toast(this.i18n.t('atsAutoFixed'));
  }

  ignoreAtsKeyword(word: string): void {
    this.atsIgnoredWords.update((s) => new Set([...s, word]));
    try {
      sessionStorage.setItem(ResumeBuilderComponent.ATS_IGNORE_STORAGE, JSON.stringify([...this.atsIgnoredWords()]));
    } catch {
      /* ignore */
    }
    this.runAtsCheck();
  }

  clearAtsIgnored(): void {
    this.atsIgnoredWords.set(new Set());
    try {
      sessionStorage.removeItem(ResumeBuilderComponent.ATS_IGNORE_STORAGE);
    } catch {
      /* ignore */
    }
    this.runAtsCheck();
  }

  atsScoreClass(score: number): string {
    if (score >= 80) return 'good';
    if (score >= 60) return 'mid';
    return 'low';
  }

  async webShare(): Promise<void> {
    const text = this.buildPlainText();
    const m = this.ws.model();
    try {
      if (navigator.share) {
        await navigator.share({ title: m.personal.name + ' — Resume', text });
        return;
      }
    } catch {
      /* user cancelled */
      return;
    }
    await this.copyPlain();
  }

  doReset(): void {
    if (!confirm('Reset all design and content to defaults?')) return;
    this.ws.resetDefaults();
    this.applyDividerCss(this.ws.design().dividerId);
    this.toast(this.i18n.t('resetBtn'));
  }

  @HostListener('document:keydown', ['$event'])
  onKey(ev: KeyboardEvent): void {
    const ctl = ev.ctrlKey || ev.metaKey;
    if (ctl && ev.key === 'z' && !this.editMode()) {
      ev.preventDefault();
      this.undo();
    }
    if (ctl && (ev.key === 'y' || (ev.shiftKey && ev.key === 'z')) && !this.editMode()) {
      ev.preventDefault();
      this.redo();
    }
    if (ctl && ev.key === 'p') {
      ev.preventDefault();
      this.doPrint();
    }
  }

  toast(msg: string, durationMs = 2000, multiline = false): void {
    const el = document.createElement('div');
    el.textContent = msg;
    Object.assign(el.style, {
      position: 'fixed',
      bottom: '22px',
      left: '50%',
      transform: 'translateX(-50%) translateY(8px)',
      background: '#0f172a',
      color: '#e2e8f0',
      border: '1px solid #334155',
      padding: multiline ? '12px 16px' : '7px 18px',
      borderRadius: '20px',
      fontSize: '12px',
      fontWeight: '700',
      zIndex: '99999',
      boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
      opacity: '0',
      transition: 'all .25s',
      whiteSpace: multiline ? 'normal' : 'nowrap',
      maxWidth: multiline ? 'min(420px, 92vw)' : '',
      textAlign: multiline ? 'center' : 'left',
      lineHeight: multiline ? '1.45' : '1.2',
    });
    document.body.appendChild(el);
    requestAnimationFrame(() => {
      el.style.opacity = '1';
      el.style.transform = 'translateX(-50%) translateY(0)';
    });
    setTimeout(() => {
      el.style.opacity = '0';
      setTimeout(() => el.remove(), 280);
    }, durationMs);
  }
}
