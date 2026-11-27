import type { MediaFolder } from "./types";

export const MEDIA_FOLDERS: {
  id: MediaFolder;
  label: string;
  description: string;
}[] = [
  { id: "branding", label: "Branding", description: "Logos, favicons, and site-wide brand images." },
  { id: "news", label: "News", description: "Featured and inline images for News articles." },
  { id: "blogs", label: "Blogs", description: "Featured and inline images for Blogs articles." },
  { id: "insights", label: "Insights", description: "Featured and inline images for Insights articles." },
];

export function isMediaFolder(value: unknown): value is MediaFolder {
  return value === "branding" || value === "news" || value === "blogs" || value === "insights";
}

export function folderLabel(folder: string | null | undefined): string {
  const match = MEDIA_FOLDERS.find((f) => f.id === folder);
  return match ? match.label : "Uncategorized";
}

export function folderForContentType(typeSlug: string | null | undefined): MediaFolder | undefined {
  if (typeSlug === "news" || typeSlug === "update" || typeSlug === "updates") return "news";
  if (typeSlug === "blogs" || typeSlug === "blog" || typeSlug === "playbook") return "blogs";
  if (typeSlug === "insights" || typeSlug === "insight") return "insights";
  return undefined;
}