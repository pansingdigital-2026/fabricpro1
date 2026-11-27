/** Column shapes the MySQL executor needs to know about (isomorphic metadata). */

export const JSON_COLUMNS: Record<string, string[]> = {
  authors: ["social_links", "seo"],
  content_types: ["seo"],
  categories: ["seo"],
  tags: ["seo"],
  content: ["seo", "related_ids"],
  content_revisions: ["snapshot"],
  pages: ["sections", "seo"],
  homepage_sections: ["settings"],
  site_settings: ["value"],
  automation_events: ["details"],
};

export const BOOL_COLUMNS: Record<string, string[]> = {
  content_types: ["is_video", "enabled"],
  content: ["is_featured", "is_editors_pick"],
  homepage_sections: ["enabled"],
  redirects: ["enabled"],
};

export type Relation =
  | { kind: "one"; table: string; fk: string; pk: string }
  | { kind: "many"; table: string; parentKey: string; childKey: string };

/** Embedded selects the CMS uses, e.g. `author:authors(...)` on `content`. */
export const RELATIONS: Record<string, Record<string, Relation>> = {
  content: {
    authors: { kind: "one", table: "authors", fk: "author_id", pk: "id" },
    categories: { kind: "one", table: "categories", fk: "category_id", pk: "id" },
    content_tags: {
      kind: "many",
      table: "content_tags",
      parentKey: "id",
      childKey: "content_id",
    },
  },
  content_tags: {
    tags: { kind: "one", table: "tags", fk: "tag_id", pk: "id" },
  },
  categories: {
    categories: { kind: "one", table: "categories", fk: "parent_id", pk: "id" },
  },
  menu_items: {
    menus: { kind: "one", table: "menus", fk: "menu_id", pk: "id" },
  },
};

/** Tables the admin UI may read/write. Anything else is rejected. */
export const KNOWN_TABLES = [
  "authors",
  "content_types",
  "categories",
  "tags",
  "media",
  "content",
  "content_tags",
  "content_revisions",
  "pages",
  "homepage_sections",
  "menus",
  "menu_items",
  "site_settings",
  "redirects",
  "contact_submissions",
  "newsletter_subscribers",
  "automation_events",
];

/** Tables a signed-out visitor may read through the public server client. */
export const PUBLIC_READABLE = new Set([
  "authors",
  "content_types",
  "categories",
  "tags",
  "media",
  "content",
  "content_tags",
  "pages",
  "homepage_sections",
  "menus",
  "menu_items",
  "site_settings",
  "redirects",
]);
