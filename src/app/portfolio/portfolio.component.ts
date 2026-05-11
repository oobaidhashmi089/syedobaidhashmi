import {
  AfterViewInit,
  Component,
  DestroyRef,
  ElementRef,
  OnDestroy,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { Title } from '@angular/platform-browser';
import {
  PORTFolio_ABOUT_HEADLINE,
  PORTFolio_ABOUT_TAGS,
  PORTFolio_EXPERIENCE_SUB,
  PORTFolio_HERO_TAGLINE,
  PORTFolio_MARQUEE_ITEMS,
  PORTFolio_PROFICIENCY,
  PORTFolio_SKILL_CARDS,
  PORTFolio_SKILLS_SECTION_SUB,
  PORTFolio_TYPING_PHRASES,
  PORTFolio_CONTACT_BLURB,
  portfolioAboutParagraphs,
  portfolioCertRows,
  portfolioEducation,
  portfolioEducationChips,
  portfolioErpCards,
  portfolioJobs,
  portfolioPersonal,
  portfolioStats,
  timelineTechFor,
} from '../core/portfolio-public-data';

@Component({
  selector: 'app-portfolio',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './portfolio.component.html',
  styleUrl: './portfolio.component.scss',
})
export class PortfolioComponent implements AfterViewInit, OnDestroy {
  private readonly destroyRef = inject(DestroyRef);
  private readonly title = inject(Title);

  readonly heroTagline = PORTFolio_HERO_TAGLINE;
  readonly typingPhrases = PORTFolio_TYPING_PHRASES;
  readonly aboutHeadline = PORTFolio_ABOUT_HEADLINE;
  readonly aboutParas = portfolioAboutParagraphs();
  readonly aboutTags = PORTFolio_ABOUT_TAGS;
  readonly orbitTags = PORTFolio_ABOUT_TAGS.slice(0, 6);
  readonly skillCards = PORTFolio_SKILL_CARDS;
  readonly skillsSectionSub = PORTFolio_SKILLS_SECTION_SUB;
  readonly profBars = PORTFolio_PROFICIENCY;
  readonly jobs = portfolioJobs();
  readonly stats = portfolioStats();
  readonly education = portfolioEducation();
  readonly educationChips = portfolioEducationChips(this.education);
  readonly certRows = portfolioCertRows();
  readonly erpCards = portfolioErpCards();
  readonly personal = portfolioPersonal();

  telHref(): string {
    return 'tel:' + this.personal.phone.replace(/\s+/g, '');
  }
  readonly experienceSub = PORTFolio_EXPERIENCE_SUB;
  readonly contactBlurb = PORTFolio_CONTACT_BLURB;
  readonly year = new Date().getFullYear();

  readonly marqueeLoop = [...PORTFolio_MARQUEE_ITEMS, ...PORTFolio_MARQUEE_ITEMS];

  jobTechs(company: string): string[] {
    return timelineTechFor(company);
  }

  private alive = true;

  @ViewChild('particleCanvas') particleCanvas!: ElementRef<HTMLCanvasElement>;

  private rafCursor = 0;
  private rafParticles = 0;
  private mx = -100;
  private my = -100;
  private rx = -100;
  private ry = -100;
  private typingTimer: ReturnType<typeof setTimeout> | null = null;

  /** Set true when `public/portfolio/profile.jpg` is missing or fails to load. */
  readonly photoMissing = signal(false);

  private readonly boundMove = (e: MouseEvent) => {
    this.mx = e.clientX;
    this.my = e.clientY;
  };

  constructor() {
    this.title.setTitle('Syed Obaid Hashmi · Developer');
  }

  ngAfterViewInit(): void {
    this.initCursor();
    this.initParticles();
    this.initTyping();
    this.initReveal();
    this.initCounters();
    this.initProfBars();
    this.initCardTilt();
    this.initNavScroll();
    window.addEventListener('scroll', this.onWinScroll, { passive: true });
    this.destroyRef.onDestroy(() => window.removeEventListener('scroll', this.onWinScroll));
  }

  ngOnDestroy(): void {
    this.alive = false;
    cancelAnimationFrame(this.rafCursor);
    cancelAnimationFrame(this.rafParticles);
    document.removeEventListener('mousemove', this.boundMove);
    if (this.typingTimer) clearTimeout(this.typingTimer);
  }

  mobileMenuOpen = false;

  toggleMenu(): void {
    this.mobileMenuOpen = !this.mobileMenuOpen;
  }

  closeMenu(): void {
    this.mobileMenuOpen = false;
  }

  private esc(v: string): string {
    return (v ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  private buildResumeHtml(): string {
    const skills = this.skillCards.map((s) => `${s.name}: ${s.tags.join(', ')}`).join(' | ');
    const jobsHtml = this.jobs
      .map((job) => {
        const bullets = job.bullets
          .slice(0, 4)
          .map((b) => `<li>${this.esc(b)}</li>`)
          .join('');
        return `
          <article class="job">
            <div class="job-top">
              <strong>${this.esc(job.role)}</strong>
              <span>${this.esc(job.dates)}</span>
            </div>
            <div class="job-company">${this.esc(job.company)}</div>
            <ul>${bullets}</ul>
          </article>
        `;
      })
      .join('');

    const certsHtml = this.certRows
      .map((c) => `<li>${this.esc(c.title)}${c.meta ? ` <span>(${this.esc(c.meta)})</span>` : ''}</li>`)
      .join('');

    return `
      <style>
        .resume-page { width: 210mm; min-height: 297mm; box-sizing: border-box; background: #fff; color: #111; padding: 16mm 18mm; font-family: 'Source Sans 3', Arial, sans-serif; }
        .head { border-bottom: 2px solid #1a3a5c; padding-bottom: 8px; margin-bottom: 12px; }
        .name { font-family: 'Libre Baskerville', Georgia, serif; font-size: 28px; font-weight: 700; color: #1a3a5c; line-height: 1.05; letter-spacing: 0.3px; }
        .role { margin-top: 3px; font-size: 12px; text-transform: uppercase; letter-spacing: 1.8px; color: #333; font-weight: 600; }
        .contact { margin-top: 8px; font-size: 11px; color: #333; line-height: 1.45; }
        .sec { margin-bottom: 11px; }
        .sec h3 { margin: 0 0 6px; font-family: 'Libre Baskerville', Georgia, serif; color: #1a3a5c; border-bottom: 1px solid #1a3a5c; font-size: 11px; letter-spacing: 1.2px; text-transform: uppercase; padding-bottom: 2px; }
        .sec p, .sec li, .sec div { font-size: 11px; line-height: 1.5; color: #222; }
        .job { margin-bottom: 8px; }
        .job-top { display: flex; justify-content: space-between; gap: 10px; }
        .job-company { font-size: 11px; font-weight: 700; margin-top: 1px; margin-bottom: 2px; }
        .job ul { margin: 2px 0 0; padding-left: 15px; }
        .job li { margin: 1px 0; }
        .mini { margin: 0; padding-left: 15px; }
        .mini li span { color: #555; }
      </style>
      <main class="resume-page">
        <header class="head">
          <div class="name">${this.esc(this.personal.name.toUpperCase())}</div>
          <div class="role">${this.esc(this.personal.title)}</div>
          <div class="contact">${this.esc(this.personal.email)} | ${this.esc(this.personal.phone)} | ${this.esc(this.personal.location)}<br/>${this.esc(this.personal.linkedin)}</div>
        </header>

        <section class="sec">
          <h3>Professional Summary</h3>
          <p>${this.esc(this.heroTagline)}</p>
        </section>

        <section class="sec">
          <h3>Core Skills</h3>
          <p>${this.esc(skills)}</p>
        </section>

        <section class="sec">
          <h3>Experience</h3>
          ${jobsHtml}
        </section>

        <section class="sec">
          <h3>Education</h3>
          <div><strong>${this.esc(this.education.degree)}</strong></div>
          <div>${this.esc(this.education.school)}, ${this.esc(this.education.location)}</div>
          <div>${this.esc(this.education.dates)}</div>
        </section>

        <section class="sec">
          <h3>Certifications</h3>
          <ul class="mini">${certsHtml}</ul>
        </section>
      </main>
    `;
  }

  async downloadResume(): Promise<void> {
    const fileName = 'Syed Obaid Hashmi - Full Stack Software Developer.pdf';
    const rootId = 'portfolio-resume-download-root';
    let root = document.getElementById(rootId) as HTMLDivElement | null;
    if (root) root.remove();
    root = document.createElement('div');
    root.id = rootId;
    root.style.position = 'fixed';
    root.style.left = '-10000px';
    root.style.top = '0';
    root.style.width = '210mm';
    root.style.background = '#ffffff';
    root.innerHTML = this.buildResumeHtml();
    document.body.appendChild(root);

    try {
      const { captureElementToPdf } = await import('../core/pdf-export');
      await captureElementToPdf(root, {
        fileName,
        documentTitle: fileName.replace(/\.pdf$/i, ''),
        format: 'a4',
        orientation: 'portrait',
        marginMm: 0,
        backgroundColor: '#ffffff',
        zoomWrapId: rootId,
        pdfContentAlign: 'top',
      });
    } finally {
      root.remove();
    }
  }

  onPhotoError(): void {
    this.photoMissing.set(true);
  }

  private onWinScroll = (): void => {
    this.navScroll();
    this.animateTimeline();
    this.heroParallax();
  };

  private heroParallax(): void {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const hi = document.querySelector('.hero-inner') as HTMLElement | null;
    if (!hi) return;
    const y = window.scrollY;
    const vh = window.innerHeight;
    if (y < vh * 1.35) {
      hi.style.transform = `translateY(${y * 0.22}px)`;
    } else {
      hi.style.transform = '';
    }
  }

  private initCursor(): void {
    if (window.matchMedia('(pointer: coarse)').matches) return;
    const cursor = document.getElementById('cursor');
    const ring = document.getElementById('cursor-ring');
    const spot = document.getElementById('spotlight');
    if (!cursor || !ring) return;

    document.addEventListener('mousemove', this.boundMove);
    document.addEventListener('mouseleave', () => {
      cursor.style.opacity = '0';
      ring.style.opacity = '0';
    });
    document.addEventListener('mouseenter', () => {
      cursor.style.opacity = '1';
      ring.style.opacity = '1';
    });

    const loop = (): void => {
      if (!this.alive) return;
      cursor.style.left = `${this.mx}px`;
      cursor.style.top = `${this.my}px`;
      this.rx += (this.mx - this.rx) * 0.12;
      this.ry += (this.my - this.ry) * 0.12;
      ring.style.left = `${this.rx}px`;
      ring.style.top = `${this.ry}px`;
      if (spot) {
        spot.style.left = `${this.mx}px`;
        spot.style.top = `${this.my}px`;
      }
      this.rafCursor = requestAnimationFrame(loop);
    };
    this.rafCursor = requestAnimationFrame(loop);
  }

  private initParticles(): void {
    const canvas = this.particleCanvas?.nativeElement;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let W = 0;
    let H = 0;
    const pts: { x: number; y: number; vx: number; vy: number; r: number }[] = [];

    const mkPt = () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
      r: Math.random() * 1.5 + 0.5,
    });

    const resize = (): void => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      W = rect.width;
      H = rect.height;
      canvas.width = Math.max(1, Math.floor(W * dpr));
      canvas.height = Math.max(1, Math.floor(H * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      pts.length = 0;
      for (let i = 0; i < 90; i++) pts.push(mkPt());
    };
    resize();
    window.addEventListener('resize', resize);
    this.destroyRef.onDestroy(() => window.removeEventListener('resize', resize));

    const draw = (): void => {
      if (!this.alive) return;
      ctx.clearRect(0, 0, W, H);
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > W) p.vx *= -1;
        if (p.y < 0 || p.y > H) p.vy *= -1;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(186,255,41,0.5)';
        ctx.fill();

        for (let j = i + 1; j < pts.length; j++) {
          const q = pts[j];
          const dx = p.x - q.x;
          const dy = p.y - q.y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < 120) {
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(q.x, q.y);
            ctx.strokeStyle = `rgba(186,255,41,${(1 - d / 120) * 0.12})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }
      this.rafParticles = requestAnimationFrame(draw);
    };
    this.rafParticles = requestAnimationFrame(draw);
  }

  private initTyping(): void {
    const el = document.getElementById('typedText');
    if (!el) return;
    const words = this.typingPhrases;
    let wi = 0;
    let ci = 0;
    let deleting = false;

    const tick = (): void => {
      if (!this.alive) return;
      const word = words[wi];
      if (!deleting) {
        ci++;
        el.textContent = word.slice(0, ci);
        if (ci === word.length) {
          deleting = true;
          this.typingTimer = setTimeout(tick, 2200);
          return;
        }
      } else {
        ci--;
        el.textContent = word.slice(0, ci);
        if (ci === 0) {
          deleting = false;
          wi = (wi + 1) % words.length;
        }
      }
      this.typingTimer = setTimeout(tick, deleting ? 40 : 75);
    };
    this.typingTimer = setTimeout(tick, 1800);
  }

  private initReveal(): void {
    const rev = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            const el = e.target as HTMLElement;
            el.classList.add('in');
            rev.unobserve(el);
          }
        });
      },
      { threshold: 0.12 },
    );
    document.querySelectorAll('.reveal-up').forEach((el) => rev.observe(el));
  }

  private initCounters(): void {
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          const el = e.target as HTMLElement;
          const target = +(el.dataset['to'] ?? '0');
          let start = 0;
          const dur = 1600;
          const step = (timestamp: number): void => {
            if (!start) start = timestamp;
            const prog = Math.min((timestamp - start) / dur, 1);
            const ease = 1 - Math.pow(1 - prog, 3);
            el.textContent = String(Math.floor(ease * target));
            if (prog < 1) requestAnimationFrame(step);
            else el.textContent = String(target);
          };
          requestAnimationFrame(step);
          obs.unobserve(el);
        });
      },
      { threshold: 0.5 },
    );
    document.querySelectorAll('.count-num').forEach((el) => obs.observe(el));
  }

  private initProfBars(): void {
    const profGrid = document.getElementById('profGrid');
    if (!profGrid) return;
    const barObs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          e.target.querySelectorAll<HTMLElement>('.prof-fill').forEach((bar) => {
            setTimeout(() => {
              bar.style.width = `${bar.dataset['w'] ?? '0'}%`;
            }, 300);
          });
          barObs.unobserve(e.target);
        });
      },
      { threshold: 0.3 },
    );
    barObs.observe(profGrid);
  }

  private navScroll(): void {
    const nav = document.getElementById('nav');
    if (nav) nav.classList.toggle('scrolled', window.scrollY > 60);

    const sections = document.querySelectorAll('section[id]');
    const navLinks = document.querySelectorAll<HTMLAnchorElement>('.nav-links a[data-section]');
    let cur = '';
    sections.forEach((s) => {
      const el = s as HTMLElement;
      if (window.scrollY >= el.offsetTop - 120) cur = el.id;
    });
    navLinks.forEach((a) => {
      a.classList.toggle('active', a.dataset['section'] === cur);
    });
  }

  private animateTimeline(): void {
    const tl = document.querySelector('.timeline');
    const fill = document.getElementById('tlFill');
    if (!tl || !fill) return;
    const rect = tl.getBoundingClientRect();
    const viewH = window.innerHeight;
    const scrolled = Math.max(0, viewH - rect.top);
    const pct = Math.min(scrolled / tl.clientHeight, 1);
    fill.style.height = `${pct * tl.clientHeight}px`;
  }

  private initNavScroll(): void {
    this.navScroll();
    this.animateTimeline();
  }

  private initCardTilt(): void {
    if (window.matchMedia('(pointer: coarse)').matches) return;
    document.querySelectorAll<HTMLElement>('.tl-card, .erp-card, .skill-card').forEach((card) => {
      card.addEventListener('mousemove', (e) => {
        const r = card.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5;
        const y = (e.clientY - r.top) / r.height - 0.5;
        card.style.transform = `perspective(600px) rotateY(${x * 8}deg) rotateX(${-y * 6}deg) translateY(-4px)`;
      });
      card.addEventListener('mouseleave', () => {
        card.style.transform = '';
      });
    });
  }
}
