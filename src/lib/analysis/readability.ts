/**
 * Deterministic readability analysis (no AI APIs).
 * Pure functions: safe to run on the server, in a worker or in the browser.
 */
import {
  AUDIENCES,
  COMPLEX_WORDS,
  DEFAULT_AUDIENCE,
  IRREGULAR_PARTICIPLES,
  LIMITS,
  MAX_POINTS,
  RATING_BANDS,
  TRANSITION_PHRASES,
  TRANSITION_WORDS,
  type Audience,
  type CategoryKey,
} from "./constants";

export type { Audience, CategoryKey };

export interface CategoryResult {
  key: CategoryKey;
  score: number;
  max: number;
  status: "good" | "warn" | "bad";
  summary: string;
  /** Text fragments the editor can look at / highlight. */
  instances: string[];
  target: string;
}

export interface ReadabilityResult {
  total: number;
  rating: string;
  tone: "good" | "warn" | "bad";
  audience: Audience;
  categories: CategoryResult[];
  stats: {
    words: number;
    sentences: number;
    paragraphs: number;
    longSentences: number;
    longSentencePct: number;
    longParagraphs: number;
    longestParagraph: number;
    fleschScore: number;
    passiveSentences: number;
    passivePct: number;
    transitionPct: number;
    longestSectionWords: number;
    complexWordCount: number;
    repetitionRuns: number;
  };
  improvements: { category: CategoryKey; message: string; instances: string[] }[];
  analyzedAt: string;
}

export interface SavedReadability {
  total: number;
  rating: string;
  audience: Audience;
  components: Partial<Record<CategoryKey, number>>;
  analyzedAt: string;
}

/* ------------------------------------------------------------------ text */

export type BlockKind = "heading" | "paragraph" | "list" | "quote";
export interface Block {
  kind: BlockKind;
  level?: number;
  text: string;
}

function decode(input: string): string {
  return input
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;|&apos;|&rsquo;/gi, "'")
    .replace(/&[a-z]+;/gi, " ");
}

/** Strip HTML that must never be analysed and return clean text blocks. */
export function extractBlocks(html: string): Block[] {
  const cleaned = (html ?? "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(script|style|pre|code|iframe|svg|noscript|table)[\s\S]*?<\/\1>/gi, "")
    .replace(/<figcaption[\s\S]*?<\/figcaption>/gi, "")
    .replace(/<(img|br|hr|source|embed)[^>]*>/gi, " ");

  const blocks: Block[] = [];
  const re = /<(h[1-6]|p|li|blockquote)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(cleaned))) {
    const tag = match[1]!.toLowerCase();
    const text = decode(match[2]!.replace(/<[^>]+>/g, " "))
      .replace(/\s+/g, " ")
      .trim();
    if (!text) continue;
    if (tag.startsWith("h")) blocks.push({ kind: "heading", level: Number(tag[1]), text });
    else if (tag === "li") blocks.push({ kind: "list", text });
    else if (tag === "blockquote") blocks.push({ kind: "quote", text });
    else blocks.push({ kind: "paragraph", text });
  }

  if (blocks.length === 0) {
    const plain = decode(cleaned.replace(/<[^>]+>/g, " ")).replace(/[ \t]+/g, " ");
    for (const part of plain.split(/\n{2,}|\n/)) {
      const text = part.trim();
      if (text) blocks.push({ kind: "paragraph", text });
    }
  }
  return blocks;
}

export function splitSentences(text: string): string[] {
  return text
    .replace(/([.!?…])\s+(?=["'“(]?[A-Z0-9])/g, "$1\u0000")
    .split("\u0000")
    .map((s) => s.trim())
    .filter((s) => /[A-Za-z]/.test(s));
}

export function words(text: string): string[] {
  return text.match(/[A-Za-z0-9][A-Za-z0-9'’\-]*/g) ?? [];
}

export function countSyllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (!w) return 0;
  if (w.length <= 3) return 1;
  const trimmed = w
    .replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "")
    .replace(/^y/, "");
  const groups = trimmed.match(/[aeiouy]{1,2}/g);
  return Math.max(1, groups ? groups.length : 1);
}

/* --------------------------------------------------------------- helpers */

function pct(part: number, total: number): number {
  return total > 0 ? (part / total) * 100 : 0;
}

function band(value: number, table: [number, number][], fallback: number): number {
  for (const [limit, points] of table) if (value <= limit) return points;
  return fallback;
}

function statusFor(score: number, max: number): "good" | "warn" | "bad" {
  const ratio = max > 0 ? score / max : 1;
  if (ratio >= 0.85) return "good";
  if (ratio >= 0.5) return "warn";
  return "bad";
}

const BE_VERBS = new Set(["is", "are", "was", "were", "be", "been", "being", "am", "get", "gets", "got"]);
const PARTICIPLES = new Set(IRREGULAR_PARTICIPLES);
const NON_PARTICIPLE_ED = new Set(["need", "indeed", "embed", "speed", "seed", "feed", "exceed", "succeed", "proceed"]);

export function isPassiveSentence(sentence: string): boolean {
  const list = words(sentence).map((w) => w.toLowerCase());
  for (let i = 0; i < list.length; i += 1) {
    if (!BE_VERBS.has(list[i]!)) continue;
    for (let j = i + 1; j <= Math.min(i + 3, list.length - 1); j += 1) {
      const candidate = list[j]!;
      if (j > i + 1 && !/ly$/.test(list[j - 1]!) && !["not", "being", "been"].includes(list[j - 1]!))
        break;
      if (PARTICIPLES.has(candidate)) return true;
      if (candidate.length > 4 && /ed$/.test(candidate) && !NON_PARTICIPLE_ED.has(candidate)) {
        const after = list[j + 1];
        if (!after || after === "by" || !/^(a|an|the|his|her|its|their|to)$/.test(after) || after === "by")
          return true;
      }
    }
  }
  return false;
}

const TRANSITION_SET = new Set(TRANSITION_WORDS);

export function hasTransition(sentence: string): boolean {
  const lower = ` ${sentence.toLowerCase()} `;
  if (TRANSITION_PHRASES.some((p) => lower.includes(` ${p} `))) return true;
  return words(sentence).some((w) => TRANSITION_SET.has(w.toLowerCase()));
}

/* -------------------------------------------------------------- analysis */

export interface AnalyzeOptions {
  audience?: Audience;
  /** Words that must never be flagged as complex (brand / technical terms). */
  dictionary?: string[];
}

export function analyzeReadability(html: string, options: AnalyzeOptions = {}): ReadabilityResult {
  const audience = options.audience ?? DEFAULT_AUDIENCE;
  const dictionary = new Set((options.dictionary ?? []).map((w) => w.toLowerCase().trim()));
  const blocks = extractBlocks(html);

  const proseBlocks = blocks.filter((b) => b.kind === "paragraph" || b.kind === "quote");
  const paragraphs = blocks.filter((b) => b.kind === "paragraph");
  const sentences: string[] = [];
  for (const b of proseBlocks) sentences.push(...splitSentences(b.text));
  for (const b of blocks.filter((x) => x.kind === "list")) {
    const s = splitSentences(b.text);
    sentences.push(...s);
  }

  const allWords = sentences.flatMap((s) => words(s));
  const totalWords = allWords.length;
  const totalSentences = sentences.length;

  /* 1. Sentence length */
  const longSentences = sentences.filter((s) => words(s).length > LIMITS.longSentenceWords);
  const longPct = pct(longSentences.length, totalSentences);
  let sentenceScore = band(
    longPct,
    [
      [10, 20],
      [15, 18],
      [20, 15],
      [25, 11],
      [35, 6],
    ],
    Math.max(0, Math.round(4 * (1 - Math.min(1, (longPct - 35) / 40)))),
  );
  if (totalSentences === 0) sentenceScore = 0;

  /* 2. Paragraph length */
  const paragraphWordCounts = paragraphs.map((p) => words(p.text).length);
  const longParagraphs = paragraphs.filter((p) => words(p.text).length > LIMITS.paragraphMaxWords);
  const longParaPct = pct(longParagraphs.length, paragraphs.length);
  let paragraphScore = band(
    longParaPct,
    [
      [0, 15],
      [5, 13],
      [10, 10],
      [20, 6],
    ],
    Math.max(0, Math.round(4 * (1 - Math.min(1, (longParaPct - 20) / 40)))),
  );
  if (paragraphs.length === 0) paragraphScore = 0;

  /* 3. Reading ease */
  const syllables = allWords.reduce((sum, w) => sum + countSyllables(w), 0);
  const flesch =
    totalSentences > 0 && totalWords > 0
      ? 206.835 - 1.015 * (totalWords / totalSentences) - 84.6 * (syllables / totalWords)
      : 0;
  const fleschScore = Math.round(Math.max(0, Math.min(100, flesch)));
  const range = AUDIENCES.find((a) => a.value === audience) ?? AUDIENCES[0]!;
  let easeScore: number;
  if (totalWords === 0) easeScore = 0;
  else if (fleschScore >= range.min && fleschScore <= range.max) easeScore = 20;
  else {
    const distance = fleschScore < range.min ? range.min - fleschScore : fleschScore - range.max;
    easeScore = Math.max(0, Math.round(20 - distance * 0.6));
  }

  /* 4. Subheading distribution */
  let running = 0;
  let longestSection = 0;
  const sectionsOver: string[] = [];
  let sectionLabel = "Article start";
  for (const b of blocks) {
    if (b.kind === "heading" && words(b.text).length >= 1 && b.text.length > 2) {
      if (running > LIMITS.subheadingMaxWords) sectionsOver.push(`${sectionLabel} — ${running} words`);
      longestSection = Math.max(longestSection, running);
      running = 0;
      sectionLabel = b.text;
      continue;
    }
    running += words(b.text).length;
  }
  if (running > LIMITS.subheadingMaxWords) sectionsOver.push(`${sectionLabel} — ${running} words`);
  longestSection = Math.max(longestSection, running);
  const subheadingScore = band(
    longestSection,
    [
      [250, 15],
      [300, 13],
      [400, 9],
      [500, 5],
    ],
    0,
  );

  /* 5. Passive voice */
  const passive = sentences.filter(isPassiveSentence);
  const passivePct = pct(passive.length, totalSentences);
  const passiveScore = band(
    passivePct,
    [
      [10, 10],
      [15, 8],
      [20, 6],
      [25, 3],
    ],
    0,
  );

  /* 6. Transition words */
  const withTransition = sentences.filter(hasTransition);
  const transitionPct = pct(withTransition.length, totalSentences);
  const transitionScore =
    transitionPct >= 30 ? 10 : transitionPct >= 25 ? 8 : transitionPct >= 20 ? 6 : transitionPct >= 15 ? 3 : 0;

  /* 7. Complex words */
  const complexHits = new Map<string, number>();
  for (const w of allWords) {
    const lower = w.toLowerCase();
    if (dictionary.has(lower)) continue;
    if (COMPLEX_WORDS[lower]) complexHits.set(lower, (complexHits.get(lower) ?? 0) + 1);
  }
  const complexCount = [...complexHits.values()].reduce((a, b) => a + b, 0);
  const complexDensity = pct(complexCount, totalWords);
  const complexScore =
    totalWords === 0 ? 0 : complexDensity <= 0.5 ? 5 : complexDensity <= 1 ? 4 : complexDensity <= 1.5 ? 3 : complexDensity <= 2.5 ? 2 : complexDensity <= 4 ? 1 : 0;

  /* 8. Repetitive beginnings */
  const repetition: string[] = [];
  let runStart = 0;
  const firstWords = sentences.map((s) => (words(s)[0] ?? "").toLowerCase());
  for (let i = 1; i <= firstWords.length; i += 1) {
    if (i < firstWords.length && firstWords[i] && firstWords[i] === firstWords[runStart]) continue;
    const length = i - runStart;
    if (length >= LIMITS.repetitionRun && firstWords[runStart]) {
      repetition.push(sentences.slice(runStart, i).join(" ").slice(0, 220));
    }
    runStart = i;
  }
  const repetitionScore = repetition.length === 0 ? 5 : repetition.length === 1 ? 3 : repetition.length === 2 ? 2 : 0;

  const categories: CategoryResult[] = [
    {
      key: "sentenceLength",
      score: sentenceScore,
      max: MAX_POINTS.sentenceLength,
      status: statusFor(sentenceScore, MAX_POINTS.sentenceLength),
      summary: `${longSentences.length} of ${totalSentences} sentences over ${LIMITS.longSentenceWords} words (${longPct.toFixed(0)}%)`,
      instances: longSentences.slice(0, 10).map((s) => s.slice(0, 220)),
      target: "≤10% long sentences",
    },
    {
      key: "paragraphLength",
      score: paragraphScore,
      max: MAX_POINTS.paragraphLength,
      status: statusFor(paragraphScore, MAX_POINTS.paragraphLength),
      summary: `${longParagraphs.length} of ${paragraphs.length} paragraphs over ${LIMITS.paragraphMaxWords} words · longest ${Math.max(0, ...paragraphWordCounts, 0)} words`,
      instances: longParagraphs.slice(0, 10).map((p) => p.text.slice(0, 220)),
      target: "No paragraph above 120 words",
    },
    {
      key: "readingEase",
      score: easeScore,
      max: MAX_POINTS.readingEase,
      status: statusFor(easeScore, MAX_POINTS.readingEase),
      summary: `Flesch ${fleschScore} · ${range.label} target ${range.min}–${range.max}`,
      instances: [],
      target: `${range.min}–${range.max}`,
    },
    {
      key: "subheadings",
      score: subheadingScore,
      max: MAX_POINTS.subheadings,
      status: statusFor(subheadingScore, MAX_POINTS.subheadings),
      summary: `Longest section without a subheading: ${longestSection} words`,
      instances: sectionsOver,
      target: "≤300 words per section",
    },
    {
      key: "passiveVoice",
      score: passiveScore,
      max: MAX_POINTS.passiveVoice,
      status: statusFor(passiveScore, MAX_POINTS.passiveVoice),
      summary: `${passive.length} passive sentences (${passivePct.toFixed(0)}%)`,
      instances: passive.slice(0, 10).map((s) => s.slice(0, 220)),
      target: "≤10%",
    },
    {
      key: "transitionWords",
      score: transitionScore,
      max: MAX_POINTS.transitionWords,
      status: statusFor(transitionScore, MAX_POINTS.transitionWords),
      summary: `${transitionPct.toFixed(0)}% of sentences use transition words`,
      instances: [],
      target: "≈30%",
    },
    {
      key: "complexWords",
      score: complexScore,
      max: MAX_POINTS.complexWords,
      status: statusFor(complexScore, MAX_POINTS.complexWords),
      summary:
        complexCount === 0
          ? "No unnecessarily difficult words found"
          : `${complexCount} difficult words: ${[...complexHits.keys()].slice(0, 6).join(", ")}`,
      instances: [...complexHits.keys()].map((w) => `${w} → ${COMPLEX_WORDS[w]}`),
      target: "Prefer simpler alternatives",
    },
    {
      key: "repetitiveBeginnings",
      score: repetitionScore,
      max: MAX_POINTS.repetitiveBeginnings,
      status: statusFor(repetitionScore, MAX_POINTS.repetitiveBeginnings),
      summary:
        repetition.length === 0
          ? "No repetitive sentence openings"
          : `${repetition.length} runs of 3+ sentences starting with the same word`,
      instances: repetition,
      target: "No 3+ repeated openings",
    },
  ];

  const total = categories.reduce((sum, c) => sum + c.score, 0);
  const bandInfo = RATING_BANDS.find((b) => total >= b.min) ?? RATING_BANDS[RATING_BANDS.length - 1]!;

  const improvements = categories
    .filter((c) => c.score < c.max)
    .map((c) => ({ category: c.key, message: `${c.summary}. Recommended: ${c.target}.`, instances: c.instances }));

  return {
    total,
    rating: bandInfo.label,
    tone: bandInfo.tone,
    audience,
    categories,
    stats: {
      words: totalWords,
      sentences: totalSentences,
      paragraphs: paragraphs.length,
      longSentences: longSentences.length,
      longSentencePct: Math.round(longPct),
      longParagraphs: longParagraphs.length,
      longestParagraph: paragraphWordCounts.length ? Math.max(...paragraphWordCounts) : 0,
      fleschScore,
      passiveSentences: passive.length,
      passivePct: Math.round(passivePct),
      transitionPct: Math.round(transitionPct),
      longestSectionWords: longestSection,
      complexWordCount: complexCount,
      repetitionRuns: repetition.length,
    },
    improvements,
    analyzedAt: new Date().toISOString(),
  };
}

export function toSavedReadability(result: ReadabilityResult): SavedReadability {
  return {
    total: result.total,
    rating: result.rating,
    audience: result.audience,
    components: Object.fromEntries(result.categories.map((c) => [c.key, c.score])) as Partial<
      Record<CategoryKey, number>
    >,
    analyzedAt: result.analyzedAt,
  };
}

export function ratingFor(total: number) {
  return RATING_BANDS.find((b) => total >= b.min) ?? RATING_BANDS[RATING_BANDS.length - 1]!;
}
