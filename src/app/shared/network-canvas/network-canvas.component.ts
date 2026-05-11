import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  inject,
  input,
  viewChild,
} from '@angular/core';

type Particle = { x: number; y: number; vx: number; vy: number };

@Component({
  selector: 'app-network-canvas',
  standalone: true,
  template:
    '<canvas #cv class="net-canvas" role="presentation" aria-hidden="true"></canvas>',
  styles: [
    `
      :host {
        display: block;
        pointer-events: none;
        overflow: hidden;
      }
      .net-canvas {
        display: block;
      }
    `,
  ],
})
export class NetworkCanvasComponent implements AfterViewInit, OnDestroy {
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly cv = viewChild.required<ElementRef<HTMLCanvasElement>>('cv');

  /** Full viewport overlay (login / cover) vs filling a positioned parent (resume canvas). */
  readonly attach = input<'viewport' | 'parent'>('parent');
  readonly linkDistance = input(118);
  readonly dotRadius = input(1.15);
  /** Hex e.g. #baff29 */
  readonly accent = input('#baff29');
  readonly speedMul = input(1);
  readonly interactive = input(true);
  /** Approximate particles per CSS pixel² */
  readonly density = input(0.000052);

  private ctx!: CanvasRenderingContext2D;
  private particles: Particle[] = [];
  private raf = 0;
  private lastW = 0;
  private lastH = 0;
  private mx = -99999;
  private my = -99999;
  private reducedMotion = false;
  private rgb = { r: 186, g: 255, b: 41 };

  private readonly onWinResize = (): void => {
    if (this.attach() === 'viewport') {
      this.resizeCanvas(window.innerWidth, window.innerHeight);
    }
  };

  private readonly onMove = (e: MouseEvent): void => {
    const el = this.host.nativeElement;
    const r = el.getBoundingClientRect();
    this.mx = e.clientX - r.left;
    this.my = e.clientY - r.top;
  };

  ngAfterViewInit(): void {
    const canvas = this.cv().nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    this.ctx = ctx;

    this.rgb = parseHex(this.accent());
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const h = this.host.nativeElement;
    if (this.attach() === 'viewport') {
      h.style.position = 'fixed';
      h.style.inset = '0';
      h.style.width = '100%';
      h.style.height = '100%';
      window.addEventListener('resize', this.onWinResize, { passive: true });
      this.resizeCanvas(window.innerWidth, window.innerHeight);
    } else {
      h.style.position = 'absolute';
      h.style.left = '0';
      h.style.top = '0';
      const p = h.parentElement;
      if (p) {
        this.resizeCanvas(p.scrollWidth, p.scrollHeight);
      }
    }

    if (this.interactive()) {
      window.addEventListener('mousemove', this.onMove, { passive: true });
    }

    this.raf = requestAnimationFrame(this.frame);
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.onWinResize);
    window.removeEventListener('mousemove', this.onMove);
  }

  private readonly frame = (): void => {
    let w = this.lastW;
    let h = this.lastH;

    if (this.attach() === 'viewport') {
      const iw = window.innerWidth;
      const ih = window.innerHeight;
      if (iw !== this.lastW || ih !== this.lastH) {
        this.resizeCanvas(iw, ih);
      }
      w = this.lastW;
      h = this.lastH;
    } else {
      const p = this.host.nativeElement.parentElement;
      if (p) {
        const sw = p.scrollWidth;
        const sh = p.scrollHeight;
        if (sw !== this.lastW || sh !== this.lastH) {
          this.resizeCanvas(sw, sh);
        }
        w = this.lastW;
        h = this.lastH;
      }
    }

    if (w > 0 && h > 0 && !this.reducedMotion) {
      this.tick(w, h);
    }

    this.raf = requestAnimationFrame(this.frame);
  };

  private resizeCanvas(w: number, h: number): void {
    this.lastW = w;
    this.lastH = h;
    const el = this.host.nativeElement;
    el.style.width = `${w}px`;
    el.style.height = `${h}px`;

    const canvas = this.cv().nativeElement;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.floor(w * dpr));
    canvas.height = Math.max(1, Math.floor(h * dpr));
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    this.spawnParticles(w, h);
    if (this.reducedMotion) {
      this.drawStill(w, h);
    }
  }

  private spawnParticles(w: number, h: number): void {
    const area = w * h;
    const n = clamp(Math.floor(area * this.density()), 36, 132);
    const next: Particle[] = [];
    for (let i = 0; i < n; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = 0.28 + Math.random() * 0.45;
      next.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
      });
    }
    this.particles = next;
  }

  private tick(w: number, h: number): void {
    const maxD = this.linkDistance();
    const { r, g, b } = this.rgb;
    const baseSpeed = 0.14 * this.speedMul();
    const ctx = this.ctx;

    for (const p of this.particles) {
      p.x += p.vx * baseSpeed;
      p.y += p.vy * baseSpeed;

      if (p.x < 0) p.x += w;
      else if (p.x > w) p.x -= w;
      if (p.y < 0) p.y += h;
      else if (p.y > h) p.y -= h;

      if (this.interactive()) {
        const dx = p.x - this.mx;
        const dy = p.y - this.my;
        const d2 = dx * dx + dy * dy;
        const rr = 165 * 165;
        if (d2 < rr && d2 > 0.01) {
          const d = Math.sqrt(d2);
          const push = ((165 - d) / 165) * 0.062;
          p.vx -= (dx / d) * push;
          p.vy -= (dy / d) * push;
        }
      }

      p.vx *= 0.994;
      p.vy *= 0.994;
      p.vx += (Math.random() - 0.5) * 0.0016;
      p.vy += (Math.random() - 0.5) * 0.0016;
    }

    ctx.clearRect(0, 0, w, h);

    const pts = this.particles;
    const pn = pts.length;
    for (let i = 0; i < pn; i++) {
      for (let j = i + 1; j < pn; j++) {
        const dx = pts[i].x - pts[j].x;
        const dy = pts[i].y - pts[j].y;
        const d = Math.hypot(dx, dy);
        if (d < maxD) {
          const alpha = (1 - d / maxD) * 0.32;
          ctx.strokeStyle = `rgba(${r},${g},${b},${alpha})`;
          ctx.lineWidth = 0.65;
          ctx.beginPath();
          ctx.moveTo(pts[i].x, pts[i].y);
          ctx.lineTo(pts[j].x, pts[j].y);
          ctx.stroke();
        }
      }
    }

    const dr = this.dotRadius();
    ctx.fillStyle = `rgba(${r},${g},${b},0.52)`;
    for (const p of pts) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, dr, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawStill(w: number, h: number): void {
    const maxD = this.linkDistance();
    const { r, g, b } = this.rgb;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, w, h);

    const pts = this.particles;
    const pn = pts.length;
    for (let i = 0; i < pn; i++) {
      for (let j = i + 1; j < pn; j++) {
        const dx = pts[i].x - pts[j].x;
        const dy = pts[i].y - pts[j].y;
        const d = Math.hypot(dx, dy);
        if (d < maxD) {
          const alpha = (1 - d / maxD) * 0.28;
          ctx.strokeStyle = `rgba(${r},${g},${b},${alpha})`;
          ctx.lineWidth = 0.65;
          ctx.beginPath();
          ctx.moveTo(pts[i].x, pts[i].y);
          ctx.lineTo(pts[j].x, pts[j].y);
          ctx.stroke();
        }
      }
    }

    const dr = this.dotRadius();
    ctx.fillStyle = `rgba(${r},${g},${b},0.48)`;
    for (const p of pts) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, dr, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

function parseHex(hex: string): { r: number; g: number; b: number } {
  const m = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(hex.trim());
  if (!m) return { r: 186, g: 255, b: 41 };
  return {
    r: parseInt(m[1], 16),
    g: parseInt(m[2], 16),
    b: parseInt(m[3], 16),
  };
}
