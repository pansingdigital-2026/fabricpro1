import type { Author } from "./types";

export const DEFAULT_AUTHOR_SLUG = "pankaj-singh";
export const DEFAULT_AUTHOR_LINKEDIN = "https://www.linkedin.com/in/pankajsinghin/";

export type AuthorSummary = Pick<
  Author,
  "id" | "name" | "slug" | "photo_url" | "job_title" | "bio" | "social_links"
>;

export const DEFAULT_AUTHOR: Author = {
  id: "00000000-0000-4000-8000-000000000001",
  user_id: null,
  name: "Pankaj Singh",
  slug: DEFAULT_AUTHOR_SLUG,
  bio: null,
  job_title: "Founder & Editor",
  photo_url: null,
  social_links: { linkedin: DEFAULT_AUTHOR_LINKEDIN },
  seo: {},
};

export function getAuthorLinkedIn(author: Pick<Author, "social_links" | "slug"> | null | undefined): string | null {
  if (!author) return null;
  const url = author.social_links?.["linkedin"]?.trim();
  if (url) return url;
  if (author.slug === DEFAULT_AUTHOR_SLUG) return DEFAULT_AUTHOR_LINKEDIN;
  return null;
}

export function resolveAuthor(
  author: AuthorSummary | null | undefined,
  fallback?: AuthorSummary | null,
): AuthorSummary {
  return author ?? fallback ?? DEFAULT_AUTHOR;
}