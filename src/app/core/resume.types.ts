import {
  ATS_OPTIMIZED_CERTIFICATIONS,
  ATS_OPTIMIZED_SKILL_ROWS,
  ATS_OPTIMIZED_SUMMARY,
  defaultJobsWithAtsContent,
} from './ats-optimized-content';

export interface JobEntry {
  id: string;
  company: string;
  dates: string;
  role: string;
  bullets: string[];
}

export interface SkillRow {
  label: string;
  value: string;
}

export interface ErpBlock {
  title: string;
  items: string[];
}

export interface ResumePersonal {
  name: string;
  title: string;
  phone: string;
  email: string;
  linkedin: string;
  location: string;
}

export interface ResumeEducation {
  degree: string;
  school: string;
  location: string;
  dates: string;
}

export interface ResumeModel {
  personal: ResumePersonal;
  summary: string;
  jobs: JobEntry[];
  skillRows: SkillRow[];
  erpBlocks: ErpBlock[];
  education: ResumeEducation;
  certifications: string[];
}

export type TemplateId =
  | 'classic'
  | 'modern'
  | 'minimal'
  | 'executive'
  | 'sharp'
  | 'compact'
  | 'corporate'
  | 'academic'
  | 'atslinear';

export type PageFormat = 'a4' | 'letter' | 'legal';

/** Matches jsPDF `orientation`; preview swaps width/height when landscape. */
export type PdfOrientation = 'portrait' | 'landscape';

/** Portrait dimensions in mm (used before orientation swap for preview). */
export const PAGE_FORMAT_DIM_MM: Record<PageFormat, { w: number; h: number }> = {
  a4: { w: 210, h: 297 },
  letter: { w: 215.9, h: 279.4 },
  legal: { w: 215.9, h: 355.6 },
};

/** CSS width/height for the resume sheet (reflects paper + orientation). */
export function pagePreviewCssSize(fmt: PageFormat, orientation: PdfOrientation): { w: string; h: string } {
  let { w, h } = PAGE_FORMAT_DIM_MM[fmt];
  if (orientation === 'landscape') {
    const t = w;
    w = h;
    h = t;
  }
  return { w: `${w}mm`, h: `${h}mm` };
}

export interface ResumeDesign {
  accent: string;
  fontId: string;
  templateId: TemplateId;
  dividerId: string;
  pageFormat: PageFormat;
  /** Preview matches this; PDF uses the same orientation. */
  pdfOrientation: PdfOrientation;
  /** Extra inset around the fitted image in exported PDF only (mm). */
  pdfMarginMm: number;
  paperBg: string;
  nameCase: 'uppercase' | 'capitalize' | 'none';
  nameSize: number;
  bodySize: number;
  contactSize: number;
  sectionTitleSize: number;
  lineHeight: number;
  sectionLetterSpacing: number;
  sectionGap: number;
  bulletGap: number;
  pageHPad: number;
  pageVPad: number;
  plainContact: boolean;
}

export interface SectionVisibility {
  summary: boolean;
  experience: boolean;
  skills: boolean;
  erp: boolean;
  education: boolean;
  certifications: boolean;
}

export const DEFAULT_RESUME_MODEL: ResumeModel = {
  personal: {
    name: 'Syed Obaid Hashmi',
    title: 'Full Stack Software Developer',
    phone: '+92 303 0323458',
    email: 'syedhashmi089@gmail.com',
    linkedin: 'https://linkedin.com/in/obaid-hashmi',
    location: 'Karachi, Pakistan',
  },
  summary: ATS_OPTIMIZED_SUMMARY,
  jobs: defaultJobsWithAtsContent(),
  skillRows: ATS_OPTIMIZED_SKILL_ROWS,
  erpBlocks: [
    {
      title: 'Microsoft Dynamics 365 F&O',
      items: [
        'Customised tables, forms, and data models using AOT',
        'Implemented business logic via Chain of Command (CoC) and event handlers',
        'Assisted in workflow automation and approval processes',
        'Extended standard functionalities using X++',
      ],
    },
    {
      title: 'Dynamics 365 Commerce / POS',
      items: [
        'Understanding of retail architecture (POS, Commerce Runtime, Retail Server)',
        'Knowledge of transaction flow from POS to Headquarters',
        'Familiar with extending retail functionality and APIs',
      ],
    },
    {
      title: 'Microsoft Dynamics 365 CRM',
      items: [
        'Understanding of CRM architecture (Client, Application, Data layer)',
        'Knowledge of entities, forms, views, and relationships',
        'Basic experience with plugins (C#) and execution pipeline',
        'Familiar with Power Automate and workflow automation',
        'Experience integrating systems using REST APIs',
      ],
    },
  ],
  education: {
    degree: 'Bachelor of Science in Computer Science',
    school: 'Sir Syed University of Engineering and Technology',
    location: 'Karachi, Pakistan',
    dates: 'Aug 2020 – Aug 2024',
  },
  certifications: ATS_OPTIMIZED_CERTIFICATIONS,
};

export const DEFAULT_DESIGN: ResumeDesign = {
  accent: '#1a3a5c',
  fontId: 'professional',
  templateId: 'classic',
  dividerId: 'd-solid',
  pageFormat: 'a4',
  pdfOrientation: 'portrait',
  pdfMarginMm: 0,
  paperBg: '#ffffff',
  nameCase: 'uppercase',
  nameSize: 28,
  bodySize: 13,
  contactSize: 12,
  sectionTitleSize: 11,
  lineHeight: 1.55,
  sectionLetterSpacing: 2,
  sectionGap: 14,
  bulletGap: 3,
  pageHPad: 18,
  pageVPad: 16,
  plainContact: false,
};

export const DEFAULT_SECTIONS: SectionVisibility = {
  summary: true,
  experience: true,
  skills: true,
  erp: false,
  education: true,
  certifications: true,
};
