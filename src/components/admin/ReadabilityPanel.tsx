import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { db as supabase } from "@/lib/db/client";
import { saveSettingsGroup } from "@/lib/admin/api";
import {
  AUDIENCES,
  CATEGORY_LABELS,
  DEFAULT_AUDIENCE,
  PUBLISH_TARGET,
  type Audience,
} from "@/lib/analysis/constants";
import { analyzeReadability, ratingFor, type ReadabilityResult } from "@/lib/analysis/readability";
import { cn } from "@/lib/utils";

import { Btn, Field, Panel, SelectInput } from "./ui";

export interface ReadabilitySettings {
  audience?: Audience;
  dictionary?: string[];
}

const TONE_CLASS: Record<"good" | "warn" | "bad", string> = {
  good: "text-emerald-600",
  warn: "text-amber-600",
  bad: "text-red-600",
};
const TONE_BG: Record<"good" | "warn" | "bad", string> = {
  good: "bg-emerald-500/15 text-emerald-600",
  warn: "bg-amber-500/15 text-amber-600",
  bad: "bg-red-500/15 text-red-600",
};
const TONE_ICON: Record<"good" | "warn" | "bad", string> = { good: "✓", warn: "!", bad: "✕" };
const TONE_TEXT: Record<"good" | "warn" | "bad", string> = {
  good: "Good",
  warn: "Needs attention",
  bad: "Problem",
};

export function useReadabilitySettings() {
  return useQuery({
    queryKey: ["admin", "site_settings", "readability"],
    queryFn: async (): Promise<ReadabilitySettings> => {
      const { data, error } = await supabase
        .from("site_settings")
        .select("value")
        .eq("key", "readability")
        .maybeSingle();
      if (error) throw new Error(error.message);
      return ((data?.value as ReadabilitySettings) ?? {}) as ReadabilitySettings;
    },
  });
}

/** Debounced live readability analysis for the article editor. */
export function useReadability(
  html: string,
  audience: Audience,
  dictionary: string[],
  delay = 700,
) {
  const [result, setResult] = useState<ReadabilityResult | null>(null);
  const dictKey = dictionary.join("|");

  useEffect(() => {
    const id = window.setTimeout(() => {
      setResult(analyzeReadability(html, { audience, dictionary: dictKey ? dictKey.split("|") : [] }));
    }, delay);
    return () => window.clearTimeout(id);
  }, [html, audience, dictKey, delay]);

  return result;
}

export function ReadabilityPanel({
  html,
  audience,
  onAudienceChange,
  ignoredWords,
  onIgnoreWord,
  onResult,
}: {
  html: string;
  audience?: Audience | null | undefined;
  onAudienceChange: (a: Audience | undefined) => void;
  ignoredWords: string[];
  onIgnoreWord: (word: string) => void;
  onResult?: ((result: ReadabilityResult) => void) | undefined;
}) {
  const qc = useQueryClient();
  const { data: settings } = useReadabilitySettings();
  const [open, setOpen] = useState<string | null>(null);

  const siteDictionary = useMemo(() => settings?.dictionary ?? [], [settings]);
  const effectiveAudience = audience ?? settings?.audience ?? DEFAULT_AUDIENCE;
  const dictionary = useMemo(
    () => [...siteDictionary, ...ignoredWords],
    [siteDictionary, ignoredWords],
  );

  const result = useReadability(html, effectiveAudience, dictionary);

  useEffect(() => {
    if (result && onResult) onResult(result);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);

  async function addToSiteDictionary(word: string) {
    try {
      const next = Array.from(new Set([...siteDictionary, word.toLowerCase()]));
      await saveSettingsGroup("readability", { ...(settings ?? {}), dictionary: next });
      void qc.invalidateQueries({ queryKey: ["admin", "site_settings"] });
      toast.success(`"${word}" added to the site dictionary`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  if (!result) {
    return (
      <Panel title="Readability">
        <p className="text-xs text-muted-foreground">Analysing content…</p>
      </Panel>
    );
  }

  const rating = ratingFor(result.total);

  return (
    <Panel title="Readability" description="Deterministic analysis — guidance only, never blocks publishing.">
      <div className="space-y-4">
        <div className="flex items-end gap-3">
          <div>
            <div className={cn("text-3xl font-bold leading-none", TONE_CLASS[rating.tone])}>
              {result.total}
              <span className="text-base font-medium text-muted-foreground"> / 100</span>
            </div>
            <div className={cn("mt-1 text-xs font-semibold", TONE_CLASS[rating.tone])}>
              {TONE_ICON[rating.tone]} {result.rating}
            </div>
          </div>
          <p className="ml-auto text-right text-[11px] text-muted-foreground">
            Target {PUBLISH_TARGET}+<br />
            {result.stats.words} words · {result.stats.sentences} sentences
          </p>
        </div>

        <Field label="Content audience" hint="Overrides the site default for this article only.">
          <SelectInput
            value={audience ?? ""}
            onChange={(e) => onAudienceChange((e.target.value || undefined) as Audience | undefined)}
          >
            <option value="">
              Site default ({AUDIENCES.find((a) => a.value === (settings?.audience ?? DEFAULT_AUDIENCE))?.label})
            </option>
            {AUDIENCES.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label} ({a.min}–{a.max})
              </option>
            ))}
          </SelectInput>
        </Field>

        <ul className="divide-y divide-border rounded-md border border-border">
          {result.categories.map((c) => (
            <li key={c.key} className="px-3 py-2">
              <div className="flex items-center gap-2">
                <span className={cn("rounded-full px-1.5 text-[11px] font-bold", TONE_BG[c.status])}>
                  {TONE_ICON[c.status]}
                </span>
                <span className="text-xs font-medium text-foreground">{CATEGORY_LABELS[c.key]}</span>
                <span className="sr-only">{TONE_TEXT[c.status]}</span>
                <span className="ml-auto text-xs font-semibold text-foreground">
                  {c.score} / {c.max}
                </span>
              </div>
              <p className="mt-0.5 text-[11px] text-muted-foreground">{c.summary}</p>
              {c.instances.length > 0 ? (
                <>
                  <Btn
                    variant="ghost"
                    className="mt-1 px-0"
                    onClick={() => setOpen(open === c.key ? null : c.key)}
                  >
                    {open === c.key ? "Hide instances" : `Show instances (${c.instances.length})`}
                  </Btn>
                  {open === c.key ? (
                    <ul className="mt-1 space-y-1">
                      {c.instances.map((t, i) => (
                        <li
                          key={`${c.key}-${i}`}
                          className="flex items-start gap-2 rounded bg-muted/50 px-2 py-1 text-[11px] text-foreground"
                        >
                          <span className="flex-1">{t}</span>
                          {c.key === "complexWords" ? (
                            <span className="flex shrink-0 gap-1">
                              <Btn
                                variant="ghost"
                                className="px-1 py-0"
                                onClick={() => onIgnoreWord(t.split(" ")[0]!)}
                              >
                                Ignore
                              </Btn>
                              <Btn
                                variant="ghost"
                                className="px-1 py-0"
                                onClick={() => void addToSiteDictionary(t.split(" ")[0]!)}
                              >
                                Add to dictionary
                              </Btn>
                            </span>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </>
              ) : null}
            </li>
          ))}
          <li className="flex items-center justify-between bg-muted/40 px-3 py-2 text-xs font-semibold">
            <span>TOTAL</span>
            <span>{result.total} / 100</span>
          </li>
        </ul>

        <div>
          <h3 className="text-xs font-semibold text-foreground">Improvements</h3>
          {result.improvements.length === 0 ? (
            <p className="mt-1 text-[11px] text-muted-foreground">
              ✓ Nothing to fix — this article scores full marks.
            </p>
          ) : (
            <ul className="mt-1 list-disc space-y-1 pl-4 text-[11px] text-muted-foreground">
              {result.improvements.map((i) => (
                <li key={i.category}>{i.message}</li>
              ))}
            </ul>
          )}
        </div>

        {ignoredWords.length > 0 ? (
          <p className="text-[11px] text-muted-foreground">
            Ignored in this article: {ignoredWords.join(", ")}
          </p>
        ) : null}
      </div>
    </Panel>
  );
}
