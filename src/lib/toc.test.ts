import { describe, expect, it } from "vitest";

import { isUpdatesType, shouldShowArticleToc } from "./toc";

describe("article sidebar rules", () => {
  it("shows table of contents only for Blogs and Insights when enabled", () => {
    expect(shouldShowArticleToc("blogs", true)).toBe(true);
    expect(shouldShowArticleToc("playbook", true)).toBe(true);
    expect(shouldShowArticleToc("insight", true)).toBe(true);
    expect(shouldShowArticleToc("insights", true)).toBe(true);
    expect(shouldShowArticleToc("update", true)).toBe(false);
    expect(shouldShowArticleToc("updates", true)).toBe(false);
    expect(shouldShowArticleToc("news", true)).toBe(false);
    expect(shouldShowArticleToc("blogs", false)).toBe(false);
    expect(shouldShowArticleToc("insight", false)).toBe(false);
  });

  it("identifies Updates content types for the Recent Updates sidebar", () => {
    expect(isUpdatesType("update")).toBe(true);
    expect(isUpdatesType("updates")).toBe(true);
    expect(isUpdatesType("news")).toBe(true);
    expect(isUpdatesType("playbook")).toBe(false);
    expect(isUpdatesType("insight")).toBe(false);
  });
});