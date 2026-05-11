import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

export interface CapturePdfOptions {
  fileName: string;
  /** Shown in PDF viewers as document title / metadata (browser print uses HTML title separately). */
  documentTitle?: string;
  format: 'a4' | 'letter' | 'legal';
  /** Capture scale (device-independent). Higher = sharper PDF, more memory. */
  scale?: number;
  backgroundColor?: string;
  /** Clear this element’s CSS transform during capture (e.g. resume-wrap / cover-wrap). */
  zoomWrapId: string;
  /** PDF page orientation (must match how the element was laid out for capture). */
  orientation?: 'portrait' | 'landscape';
  /** Uniform blank margin inside the PDF page around the scaled capture (mm). */
  marginMm?: number;
  /**
   * When the scaled image is shorter than the printable area, pin it to the top or center vertically.
   * Resumes default to `middle` so extra space is split (less blank band at the bottom). Cover letters should use `top`.
   */
  pdfContentAlign?: 'top' | 'middle';
}

function raf2(): Promise<void> {
  return new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
}

async function waitFonts(): Promise<void> {
  try {
    await document.fonts.ready;
  } catch {
    /* ignore */
  }
}

function stripResumeEditChrome(doc: Document): void {
  const root = doc.getElementById('resume-root');
  if (!root) return;
  root.querySelectorAll('.inline-input, .area-input, .bullet-input').forEach((n) => {
    const el = n as HTMLElement;
    el.style.border = '1px solid transparent';
    el.style.background = 'transparent';
    el.style.boxShadow = 'none';
    el.style.outline = 'none';
  });
  root.querySelectorAll('.job-tools, .mini-btn, .icon-btn').forEach((n) => {
    (n as HTMLElement).style.display = 'none';
  });
}

/**
 * html2canvas fixes applied only to the cloned DOM (not the live preview).
 * - `foreignObjectRendering` often produces blank output in Chromium without throwing; we avoid it.
 * - CanvasRenderer + system serif stacks can collapse spaces; a tiny letter-spacing stabilizes metrics.
 */
function patchPdfClone(doc: Document): void {
  stripResumeEditChrome(doc);

  const style = doc.createElement('style');
  style.setAttribute('data-ats-pdf-capture', '1');
  style.textContent = `
    #resume-root,
    #cover-root {
      letter-spacing: 0.02px;
      text-rendering: geometricPrecision;
    }
  `;

  const head = doc.head;
  if (head) head.appendChild(style);
}

/**
 * Places the full raster on one sheet, scaled down uniformly so width and height fit the page
 * (same aspect ratio as the canvas — nothing is cropped).
 */
function canvasToSinglePagePdf(
  canvas: HTMLCanvasElement,
  format: 'a4' | 'letter' | 'legal',
  fileName: string,
  orientation: 'portrait' | 'landscape' = 'portrait',
  marginMm = 0,
  verticalAlign: 'top' | 'middle' = 'middle',
  documentTitle?: string,
): void {
  const dataUrl = canvas.toDataURL('image/png');
  const pdf = new jsPDF({ orientation, unit: 'mm', format });
  const metaTitle =
    documentTitle?.trim() ||
    fileName.replace(/\.pdf$/i, '').replace(/_/g, ' ') ||
    'Document';
  pdf.setProperties({
    title: metaTitle,
    subject: 'Resume',
    creator: 'ATS Resume Studio',
  });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();

  const maxM = Math.max(0, Math.min(marginMm, Math.min(pageW, pageH) / 2 - 0.5));
  const innerW = Math.max(1, pageW - 2 * maxM);
  const innerH = Math.max(1, pageH - 2 * maxM);

  const cw = Math.max(1, canvas.width);
  const ch = Math.max(1, canvas.height);
  const ratio = cw / ch;

  let imgW = innerW;
  let imgH = innerW / ratio;
  if (imgH > innerH) {
    imgH = innerH;
    imgW = innerH * ratio;
  }

  const x = maxM + (innerW - imgW) / 2;
  const y =
    verticalAlign === 'top' ? maxM : maxM + Math.max(0, (innerH - imgH) / 2);

  pdf.addImage(dataUrl, 'PNG', x, y, imgW, imgH);
  pdf.save(fileName);
}

/**
 * Rasterizes the element to PNG and builds a one-page PDF (content is scaled to fit the sheet).
 * Resets zoom wrap transform and waits for fonts/layout for a stable capture.
 */
export async function captureElementToPdf(el: HTMLElement, opts: CapturePdfOptions): Promise<void> {
  const wrap = document.getElementById(opts.zoomWrapId);
  const prevTransform = wrap?.style.transform ?? '';
  if (wrap) wrap.style.transform = 'none';

  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
  const scale = opts.scale ?? Math.min(2.75, Math.max(2, Math.round(dpr * 100) / 100));

  await waitFonts();
  await raf2();

  const w = Math.max(1, Math.ceil(Math.max(el.scrollWidth, el.offsetWidth)));
  const h = Math.max(1, Math.ceil(Math.max(el.scrollHeight, el.offsetHeight)));

  try {
    const canvas = await html2canvas(el, {
      scale,
      useCORS: true,
      allowTaint: false,
      logging: false,
      backgroundColor: opts.backgroundColor ?? '#ffffff',
      width: w,
      height: h,
      windowWidth: w,
      windowHeight: h,
      scrollX: 0,
      scrollY: 0,
      onclone: (doc) => patchPdfClone(doc),
    });

    canvasToSinglePagePdf(
      canvas,
      opts.format,
      opts.fileName,
      opts.orientation ?? 'portrait',
      opts.marginMm ?? 0,
      opts.pdfContentAlign ?? 'middle',
      opts.documentTitle,
    );
  } finally {
    if (wrap) wrap.style.transform = prevTransform;
  }
}
