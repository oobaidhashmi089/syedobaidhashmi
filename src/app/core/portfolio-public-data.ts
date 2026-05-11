import { ATS_OPTIMIZED_SKILL_ROWS, ATS_OPTIMIZED_SUMMARY } from './ats-optimized-content';
import type { JobEntry, ResumeEducation } from './resume.types';
import { DEFAULT_RESUME_MODEL } from './resume.types';

/** Hero line — aligned with ATS summary themes; edit alongside resume messaging. */
export const PORTFolio_HERO_TAGLINE =
  'Full Stack Developer crafting enterprise-scale applications across banking, finance & ERP domains — shipping production systems with .NET, Angular, and Microsoft Dynamics 365.';

export const PORTFolio_TYPING_PHRASES = [
  'Full Stack Developer',
  '.NET Core Engineer',
  'Angular Developer',
  'Dynamics 365 Developer',
  'API Designer',
];

export const PORTFolio_ABOUT_HEADLINE = {
  lead: 'Building systems that ',
  accent: 'actually',
  tail: ' scale.',
} as const;

export function portfolioPersonal() {
  return DEFAULT_RESUME_MODEL.personal;
}

export const PORTFolio_SKILLS_SECTION_SUB =
  'Full-stack delivery refined across banking, ERP, and cloud-native backends.';

function skillTokens(...labelPrefixes: string[]): string[] {
  for (const p of labelPrefixes) {
    const row = ATS_OPTIMIZED_SKILL_ROWS.find((r) =>
      r.label.toLowerCase().startsWith(p.toLowerCase()),
    );
    if (row) {
      return row.value
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 10);
    }
  }
  return [];
}

export interface PortfolioSkillCard {
  icon: string;
  name: string;
  tags: string[];
}

/** Skill cards: tags derived from `ATS_OPTIMIZED_SKILL_ROWS` where possible. */
export const PORTFolio_SKILL_CARDS: PortfolioSkillCard[] = [
  { icon: '⚡', name: 'Languages', tags: skillTokens('Languages') },
  { icon: '⚙️', name: 'Backend', tags: skillTokens('Backend').slice(0, 6) },
  { icon: '🖥️', name: 'Frontend', tags: skillTokens('Frontend') },
  { icon: '🗃️', name: 'Data', tags: skillTokens('Databases') },
  {
    icon: '🏗️',
    name: 'Architecture',
    tags: ['Microservices', 'MVC', 'REST', 'SOAP', 'AOT'],
  },
  {
    icon: '🧩',
    name: 'ERP / CRM',
    tags: skillTokens('Microsoft Dynamics'),
  },
];

export const PORTFolio_PROFICIENCY: { label: string; pct: number }[] = [
  { label: '.NET Core / C#', pct: 92 },
  { label: 'RESTful API Design', pct: 90 },
  { label: 'Angular / TypeScript', pct: 88 },
  { label: 'SQL / Database Design', pct: 85 },
  { label: 'Microsoft Dynamics 365', pct: 82 },
  { label: 'React / Next.js', pct: 78 },
];

/** Short tags for about section + orbit strip — keep consistent with skill focus. */
export const PORTFolio_ABOUT_TAGS = [
  '.NET Core',
  'Angular',
  'React',
  'Dynamics 365',
  'SQL',
  'Microservices',
  'REST API',
  'AWS',
];

export const PORTFolio_EXPERIENCE_SUB =
  'Enterprise delivery across product, consulting, and internship roles.';

export const PORTFolio_CONTACT_BLURB =
  'Open to full-time roles, contracts, and consulting — especially enterprise software & ERP.';

export function portfolioAboutParagraphs(): string[] {
  const s = ATS_OPTIMIZED_SUMMARY.trim();
  const parts = s.split(/(?<=[.!?])\s+/).filter(Boolean);
  if (parts.length >= 3) {
    return [`${parts[0]} ${parts[1]}`.trim(), parts.slice(2).join(' ').trim()];
  }
  if (parts.length === 2) return parts;
  return [s];
}

export function portfolioJobs(): JobEntry[] {
  return DEFAULT_RESUME_MODEL.jobs;
}

export function portfolioStats(): { yearsExp: number; companies: number; projects: number; certs: number } {
  return {
    yearsExp: 2,
    companies: DEFAULT_RESUME_MODEL.jobs.length,
    projects: 6,
    certs: DEFAULT_RESUME_MODEL.certifications.length,
  };
}

export function portfolioEducation(): ResumeEducation {
  return DEFAULT_RESUME_MODEL.education;
}

export function portfolioEducationChips(ed: ResumeEducation): string[] {
  const field = ed.degree.toLowerCase().includes('computer science') ? 'Computer Science' : '';
  const city = ed.location.split(',')[0]?.trim() ?? '';
  return [ed.dates, field, city].filter(Boolean);
}

export function parseCertificationLine(line: string): { title: string; meta: string } {
  const mdash = line.match(/^(.+?)\s*[–—]\s*(.+)$/);
  if (mdash) {
    const meta = mdash[2].trim().replace(/\((\d{4})\)/, '· $1');
    return { title: mdash[1].trim(), meta };
  }
  const yearEnd = line.match(/^(.+?)\s*\((\d{4})\)\s*$/);
  if (yearEnd) return { title: yearEnd[1].trim(), meta: yearEnd[2] };
  return { title: line.trim(), meta: '' };
}

export function portfolioCertRows(): { title: string; meta: string }[] {
  return DEFAULT_RESUME_MODEL.certifications.map(parseCertificationLine);
}

const ERP_ICONS = ['🏭', '🛒', '🤝'];

export interface PortfolioErpCard {
  num: string;
  icon: string;
  title: string;
  items: string[];
}

export function portfolioErpCards(): PortfolioErpCard[] {
  return DEFAULT_RESUME_MODEL.erpBlocks.map((b, i) => ({
    num: String(i + 1).padStart(2, '0'),
    icon: ERP_ICONS[i] ?? '📋',
    title: b.title,
    items: b.items,
  }));
}

/** Tech pills under each timeline card — keyed by company name from resume jobs. */
export const PORTFolio_TIMELINE_TECH: Record<string, string[]> = {
  'Cee Solutions': ['.NET Core', 'Angular', 'AWS', 'Hangfire', 'SQL'],
  BariTechSol: ['Microservices', 'Full Stack', 'C#'],
  'Evincible Sol': ['D365', 'X++', 'AOT'],
  'Folio3 Soft': ['SDLC', 'QA'],
};

export function timelineTechFor(company: string): string[] {
  return PORTFolio_TIMELINE_TECH[company] ?? [];
}

/** Tech strip under hero — duplicated in template for seamless CSS marquee. */
export const PORTFolio_MARQUEE_ITEMS = [
  '.NET Core',
  'Angular',
  'React',
  'Microservices',
  'Dynamics 365',
  'X++',
  'SQL Server',
  'TypeScript',
  'MongoDB',
  'RESTful APIs',
  'Hangfire',
  'Next.js',
  'PostgreSQL',
  'Power Automate',
  'C#',
  'FastAPI',
];
