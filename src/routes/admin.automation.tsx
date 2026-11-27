import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { Btn, Empty, Panel, Toggle } from "@/components/admin/ui";
import { fetchRows, saveRow, saveSettingsGroup, useRows } from "@/lib/admin/api";
import type { AutomationEvent, ContentItem, NewsAutomationSettings } from "@/lib/types";

export const Route = createFileRoute("/admin/automation")({
  component: NewsAutomationPage,
});

const STEP_LABELS: Record<string, string> = {
  upload_article: "Upload article",
  upload_image: "Upload image",
  mark_ready: "Mark ready",
  direct_update: "Direct update",
};

function formatTime(value: string | null | undefined) {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString();
}

function NewsAutomationPage() {
  const qc = useQueryClient();
  const [savingSwitch, setSavingSwitch] = useState(false);
  const [publishingId, setPublishingId] = useState<string | null>(null);

  const { data: settingRows = [] } = useQuery({
    queryKey: ["admin", "site_settings", "news_automation"],
    queryFn: () =>
      fetchRows<{ key: string; value: Partial<NewsAutomationSettings> }>("site_settings", {
        eq: { key: "news_automation" },
        limit: 1,
      }),
  });
  const autoPublish = settingRows[0]?.value?.autoPublish === true;

  const { data: draftUpdates = [] } = useRows<ContentItem>("content", {
    eq: { type_slug: "news", status: "draft" },
    order: { column: "updated_at", ascending: false },
    limit: 50,
  });
  const reviewQueue = draftUpdates.filter((item) => item.seo?.automationState === "ready_for_review");

  const { data: events = [], isError: eventsError } = useRows<AutomationEvent>("automation_events", {
    order: { column: "created_at", ascending: false },
    limit: 50,
  });

  async function toggleAutoPublish(next: boolean) {
    setSavingSwitch(true);
    try {
      await saveSettingsGroup("news_automation", { autoPublish: next });
      await qc.invalidateQueries({ queryKey: ["admin", "site_settings", "news_automation"] });
      toast.success(
        next
          ? "Auto-publish turned On for newly completed News articles"
          : "Auto-publish turned Off — completed News articles will wait for review",
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save setting");
    } finally {
      setSavingSwitch(false);
    }
  }

  async function publishManually(item: ContentItem) {
    setPublishingId(item.id);
    try {
      const now = new Date().toISOString();
      await saveRow("content", {
        id: item.id,
        status: "published",
        published_at: now,
        seo: { ...item.seo, automationState: "published", automationPublishedAt: now },
      });
      await qc.invalidateQueries({ queryKey: ["admin", "content"] });
      toast.success("Published to News");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Publish failed");
    } finally {
      setPublishingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <Panel
        title="News Automation"
        description="Control how completed automated News articles are handled when uploaded."
      >
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-muted/20 p-3">
            <div className="space-y-1">
              <Toggle
                label="Automatically publish completed News"
                checked={autoPublish}
                onChange={(v) => {
                  if (!savingSwitch) void toggleAutoPublish(v);
                }}
              />
              <p className="text-xs text-muted-foreground">
                {autoPublish
                  ? "On: newly completed News articles publish live right away. Drafts already in the review queue stay there until you publish them."
                  : "Off (default): completed News articles are saved as drafts in the review queue below for manual review and publishing."}
              </p>
            </div>
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                autoPublish
                  ? "bg-primary text-primary-foreground"
                  : "border border-border bg-background text-muted-foreground"
              }`}
            >
              {autoPublish ? "Auto-publish On" : "Manual review"}
            </span>
          </div>
        </div>
      </Panel>

      <Panel
        title={`Ready for review (${reviewQueue.length})`}
        description="Completed Updates waiting for your approval. Turning on Auto-publish leaves these here."
      >
        {reviewQueue.length === 0 ? (
          <Empty text="No automated Updates are waiting for review." />
        ) : (
          <div className="divide-y divide-border">
            {reviewQueue.map((item) => (
              <div
                key={item.id}
                className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 items-center gap-3">
                  {item.featured_image_url ? (
                    <img
                      src={item.featured_image_url}
                      alt={item.featured_image_alt ?? item.title}
                      className="h-12 w-20 shrink-0 rounded border border-border object-cover"
                    />
                  ) : null}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{item.title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {item.seo?.sourceName ? `Source: ${item.seo.sourceName} · ` : ""}
                      Ready {formatTime(item.seo?.automationReadyAt ?? item.updated_at)}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Link
                    to="/admin/content/$id"
                    params={{ id: item.id }}
                    className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent"
                  >
                    Review & edit
                  </Link>
                  <Btn
                    disabled={publishingId === item.id}
                    onClick={() => void publishManually(item)}
                  >
                    {publishingId === item.id ? "Publishing…" : "Publish now"}
                  </Btn>
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <Panel
        title="Upload activity & errors"
        description="Latest automated upload steps, errors, and final outcomes."
      >
        {eventsError ? (
          <p className="text-xs text-muted-foreground">
            Activity log table is not installed yet. Run the latest SQL migration in phpMyAdmin.
          </p>
        ) : events.length === 0 ? (
          <Empty text="No automated upload activity yet." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border text-muted-foreground">
                <tr>
                  <th className="py-2 pr-3 font-medium">Time</th>
                  <th className="py-2 pr-3 font-medium">Step</th>
                  <th className="py-2 pr-3 font-medium">Result</th>
                  <th className="py-2 pr-3 font-medium">Article / Details</th>
                  <th className="py-2 font-medium">Link</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {events.map((ev) => (
                  <tr key={ev.id}>
                    <td className="whitespace-nowrap py-2 pr-3 text-muted-foreground">
                      {formatTime(ev.created_at)}
                    </td>
                    <td className="whitespace-nowrap py-2 pr-3 font-medium text-foreground">
                      {STEP_LABELS[ev.step] ?? ev.step}
                    </td>
                    <td className="whitespace-nowrap py-2 pr-3">
                      <span
                        className={`inline-block rounded px-2 py-0.5 text-[11px] font-medium ${
                          ev.outcome === "error"
                            ? "bg-destructive/15 text-destructive"
                            : ev.outcome === "reused"
                              ? "bg-muted text-muted-foreground"
                              : "bg-primary/15 text-primary"
                        }`}
                      >
                        {ev.outcome === "error"
                          ? "Error"
                          : ev.outcome === "reused"
                            ? `${ev.result_state ?? "Reused"} (retry)`
                            : ev.result_state ?? "OK"}
                      </span>
                    </td>
                    <td className="max-w-xs py-2 pr-3">
                      {ev.title ? <p className="truncate font-medium text-foreground">{ev.title}</p> : null}
                      {ev.error_message ? (
                        <p className="text-destructive">{ev.error_message}</p>
                      ) : ev.draft_id ? (
                        <p className="truncate text-[11px] text-muted-foreground">Draft {ev.draft_id}</p>
                      ) : null}
                    </td>
                    <td className="whitespace-nowrap py-2">
                      {ev.result_url && ev.step !== "upload_image" ? (
                        <a
                          href={ev.result_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-primary underline"
                        >
                          Open ↗
                        </a>
                      ) : ev.draft_id ? (
                        <Link
                          to="/admin/content/$id"
                          params={{ id: ev.draft_id }}
                          className="text-primary underline"
                        >
                          Draft
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}