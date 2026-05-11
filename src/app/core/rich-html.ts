import DOMPurify from 'dompurify';

/** Limits markup to inline formatting for resume/cover fields. */
export const RICH_HTML_CONFIG = {
  ALLOWED_TAGS: ['b', 'strong', 'i', 'em', 'u', 'span', 'br', 'div', 'p'],
  ALLOWED_ATTR: ['style'],
  ALLOWED_STYLES: {
    'font-size': [/^[\d.]+px$/],
    'font-weight': [/^bold$/, /^700$/],
    'font-style': [/^italic$/],
  },
};

export function normalizeRichHtml(html: string): string {
  if (!html?.trim()) return '';
  if (typeof document === 'undefined') return html;
  return String(DOMPurify.sanitize(html, RICH_HTML_CONFIG as Parameters<typeof DOMPurify.sanitize>[1]));
}

export function isProbablyPlainText(s: string): boolean {
  return !/[<>]/.test(s);
}

/** Plain text for ATS export / share (preserves line breaks from block tags). */
export function stripRichHtmlToPlain(html: string): string {
  if (!html) return '';
  if (isProbablyPlainText(html)) return html;
  if (typeof document === 'undefined') return html.replace(/<[^>]+>/g, ' ');
  const div = document.createElement('div');
  div.innerHTML = normalizeRichHtml(html);
  return (div.innerText ?? '').replace(/\u00a0/g, ' ');
}
