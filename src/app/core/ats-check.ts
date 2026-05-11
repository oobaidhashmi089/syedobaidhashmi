import { ResumeModel, SectionVisibility } from './resume.types';
import { stripRichHtmlToPlain } from './rich-html';

const STOP = new Set([
  'the',
  'and',
  'for',
  'with',
  'you',
  'your',
  'our',
  'are',
  'will',
  'this',
  'that',
  'from',
  'have',
  'has',
  'was',
  'were',
  'been',
  'being',
  'any',
  'all',
  'not',
  'but',
  'can',
  'may',
  'into',
  'about',
  'work',
  'team',
  'role',
  'job',
  'must',
  'should',
  'would',
  'could',
  'their',
  'they',
  'them',
  'such',
  'also',
  'via',
  'per',
  'etc',
]);

export interface AtsKeywordRow {
  word: string;
  jdCount: number;
  inResume: boolean;
}

/** One line of the transparent rubric (earned points vs max for that rule). */
export interface AtsBreakdownRow {
  id: string;
  labelKey: string;
  earned: number;
  max: number;
}

/** Prioritized change derived from gaps in the rubric. */
export interface AtsSuggestion {
  messageKey: string;
  /** Points still available for this rubric line (max − earned). */
  pointsAvailable: number;
}

export interface AtsCheckResult {
  /**
   * Sum of rubric rows — deterministic from your resume text & toggles.
   * Not a prediction of a specific employer’s ATS; see `disclaimerKey`.
   */
  score: number;
  breakdown: AtsBreakdownRow[];
  suggestions: AtsSuggestion[];
  /** Sum(structure-related rows) / sum(structure max) × 100 */
  structureScore: number;
  /** Sum(content-related rows) / sum(content max) × 100 */
  contentScore: number;
  jdMatchScore: number;
  matchedKeywordCount: number;
  trackedKeywordCount: number;
  keywords: AtsKeywordRow[];
  /** @deprecated use suggestions — kept for backward compat */
  tips: string[];
  jdEmpty: boolean;
  disclaimerKey: string;
}

function tok(s: string): string[] {
  return s.toLowerCase().match(/[a-z0-9][a-z0-9+#.-]{1,}/g) ?? [];
}

export function extractJdKeywords(jd: string): Map<string, number> {
  const jdCount = new Map<string, number>();
  for (const w of tok(jd)) {
    if (STOP.has(w) || w.length < 3) continue;
    jdCount.set(w, (jdCount.get(w) ?? 0) + 1);
  }
  return jdCount;
}

function wordCount(htmlOrText: string): number {
  return stripRichHtmlToPlain(htmlOrText ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

/** Structure-related rubric ids (contact + education + certs visibility). */
const STRUCTURE_IDS = new Set(['email', 'phoneLi', 'location', 'education', 'certs']);

/**
 * Fixed 100-point rubric: same resume → same score. Each row documents exactly what was measured.
 */
function computeRubric(model: ResumeModel, sections: SectionVisibility): {
  breakdown: AtsBreakdownRow[];
  suggestions: AtsSuggestion[];
  structureScore: number;
  contentScore: number;
  score: number;
} {
  const rows: AtsBreakdownRow[] = [];

  // --- Contact (23 pts) ---
  const email = model.personal.email?.trim() ?? '';
  let emailPts = 0;
  if (/[^\s@]+@[^\s@]+\.[^\s@]{2,}/.test(email)) emailPts = 10;
  else if (email.includes('@')) emailPts = 6;
  rows.push({ id: 'email', labelKey: 'atsRbEmail', earned: emailPts, max: 10 });

  const phoneDigits = model.personal.phone?.replace(/\D/g, '') ?? '';
  const li = model.personal.linkedin?.trim() ?? '';
  let phonePts = 0;
  if (phoneDigits.length >= 10 && li.length > 6) phonePts = 8;
  else if (phoneDigits.length >= 10 || li.length > 8) phonePts = 6;
  else if (phoneDigits.length >= 8 || li.length > 4) phonePts = 4;
  rows.push({ id: 'phoneLi', labelKey: 'atsRbPhoneLi', earned: phonePts, max: 8 });

  const loc = model.personal.location?.trim() ?? '';
  const locPts = loc.length >= 3 ? 5 : 0;
  rows.push({ id: 'location', labelKey: 'atsRbLocation', earned: locPts, max: 5 });

  // --- Summary (15 pts) ---
  let sumPts = 0;
  if (sections.summary) {
    const wc = wordCount(model.summary ?? '');
    if (wc >= 45 && wc <= 240) sumPts = 15;
    else if (wc >= 28) sumPts = 11;
    else if (wc >= 15) sumPts = 6;
    else if (wc >= 1) sumPts = 3;
  }
  rows.push({ id: 'summary', labelKey: 'atsRbSummary', earned: sumPts, max: 15 });

  // --- Experience (22 pts) ---
  let expPts = 0;
  const jobs = model.jobs;
  let bulletCount = 0;
  let longBullets = 0;
  for (const j of jobs) {
    for (const b of j.bullets) {
      bulletCount++;
      if (stripRichHtmlToPlain(b).trim().length >= 52) longBullets++;
    }
  }
  const hasJob =
    sections.experience &&
    jobs.some((j) => j.company?.trim().length && (j.bullets?.length ?? 0) > 0);
  if (hasJob) {
    expPts += 8;
    if (bulletCount >= 8) expPts += 7;
    else if (bulletCount >= 4) expPts += 4;
    if (bulletCount > 0) {
      const ratio = longBullets / bulletCount;
      if (ratio >= 0.55 && bulletCount >= 5) expPts += 7;
      else if (ratio >= 0.35) expPts += 4;
    }
  }
  rows.push({ id: 'experience', labelKey: 'atsRbExperience', earned: Math.min(22, expPts), max: 22 });

  // --- Skills (12 pts) ---
  const skillText = model.skillRows.map((r) => `${r.label} ${r.value}`).join(' ');
  let skPts = 0;
  if (sections.skills && model.skillRows.length >= 2 && skillText.trim().length >= 100) skPts = 12;
  else if (sections.skills && skillText.trim().length >= 60) skPts = 8;
  else if (sections.skills && model.skillRows.length > 0) skPts = 4;
  rows.push({ id: 'skills', labelKey: 'atsRbSkills', earned: skPts, max: 12 });

  // --- Education (8 pts) ---
  let eduPts = 0;
  if (sections.education && model.education.school?.trim().length >= 2) {
    eduPts = model.education.degree?.trim() ? 8 : 5;
  }
  rows.push({ id: 'education', labelKey: 'atsRbEducation', earned: eduPts, max: 8 });

  // --- Certifications (6 pts) ---
  const certCount = model.certifications.filter((c) => c?.trim()).length;
  let certPts = 0;
  if (sections.certifications && certCount >= 3) certPts = 6;
  else if (sections.certifications && certCount >= 1) certPts = 4;
  rows.push({ id: 'certs', labelKey: 'atsRbCerts', earned: certPts, max: 6 });

  // --- ERP / extra expertise (8 pts) ---
  let erpPts = 0;
  if (
    sections.erp &&
    model.erpBlocks.some((b) =>
      b.items.some((i) => stripRichHtmlToPlain(i).trim().length > 12),
    )
  ) {
    erpPts = 8;
  } else if (sections.erp && model.erpBlocks.some((b) => b.title?.trim())) {
    erpPts = 3;
  }
  rows.push({ id: 'erp', labelKey: 'atsRbErp', earned: erpPts, max: 8 });

  // --- Title line (6 pts) ---
  const titleWords = wordCount(model.personal.title ?? '');
  let titlePts = 0;
  if (titleWords >= 2 && titleWords <= 18) titlePts = 6;
  else if (titleWords >= 1) titlePts = 3;
  rows.push({ id: 'headline', labelKey: 'atsRbHeadline', earned: titlePts, max: 6 });

  const score = Math.min(100, rows.reduce((a, r) => a + r.earned, 0));

  let structEarn = 0,
    structMax = 0,
    contentEarn = 0,
    contentMax = 0;
  for (const r of rows) {
    if (STRUCTURE_IDS.has(r.id)) {
      structEarn += r.earned;
      structMax += r.max;
    } else {
      contentEarn += r.earned;
      contentMax += r.max;
    }
  }
  const structureScore = structMax > 0 ? Math.round((structEarn / structMax) * 100) : 0;
  const contentScore = contentMax > 0 ? Math.round((contentEarn / contentMax) * 100) : 0;

  const suggestionMap: Record<string, string> = {
    email: 'atsSgEmail',
    phoneLi: 'atsSgPhoneLi',
    location: 'atsSgLocation',
    summary: 'atsSgSummary',
    experience: 'atsSgExperience',
    skills: 'atsSgSkills',
    education: 'atsSgEducation',
    certs: 'atsSgCerts',
    erp: 'atsSgErp',
    headline: 'atsSgHeadline',
  };

  const suggestions: AtsSuggestion[] = rows
    .filter((r) => r.earned < r.max)
    .map((r) => ({
      messageKey: suggestionMap[r.id] ?? 'atsSgGeneric',
      pointsAvailable: r.max - r.earned,
    }))
    .sort((a, b) => b.pointsAvailable - a.pointsAvailable);

  return { breakdown: rows, suggestions, structureScore, contentScore, score };
}

/**
 * Resume score = transparent rubric sum (only your resume).
 * Optional JD: keyword list + jdMatchScore (does not change `score`).
 */
export function computeAtsCheck(params: {
  jd: string;
  resumePlain: string;
  model: ResumeModel;
  sections: SectionVisibility;
  ignoredKeywords: Set<string>;
  keywordLimit?: number;
}): AtsCheckResult {
  const { jd, resumePlain, model, sections, ignoredKeywords } = params;
  const limit = params.keywordLimit ?? 36;
  const resumeLower = resumePlain.toLowerCase();
  const jdEmpty = !jd.trim();

  const rubric = computeRubric(model, sections);

  let keywords: AtsKeywordRow[] = [];
  let matchedKeywordCount = 0;
  let trackedKeywordCount = 0;
  let jdMatchScore = 0;
  const tipFallback = rubric.suggestions.map((s) => s.messageKey);

  if (!jdEmpty) {
    const jdCount = extractJdKeywords(jd);
    const ranked = [...jdCount.entries()]
      .filter(([w]) => !ignoredKeywords.has(w))
      .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length);

    const tracked = ranked.slice(0, limit);
    keywords = tracked.map(([word, c]) => ({
      word,
      jdCount: c,
      inResume: resumeLower.includes(word),
    }));

    matchedKeywordCount = keywords.filter((k) => k.inResume).length;
    trackedKeywordCount = keywords.length;
    jdMatchScore =
      trackedKeywordCount > 0 ? Math.round((matchedKeywordCount / trackedKeywordCount) * 100) : 100;
  }

  return {
    score: rubric.score,
    breakdown: rubric.breakdown,
    suggestions: rubric.suggestions,
    structureScore: rubric.structureScore,
    contentScore: rubric.contentScore,
    jdMatchScore,
    matchedKeywordCount,
    trackedKeywordCount,
    keywords,
    tips: tipFallback,
    jdEmpty,
    disclaimerKey: 'atsDisclaimer',
  };
}
