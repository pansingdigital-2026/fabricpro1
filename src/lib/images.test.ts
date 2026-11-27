import { describe, expect, it } from "vitest";

import { enhanceBodyImages, srcSetFor, variantUrl, variantWidthsFor } from "./images";

const U = "/uploads/2026/0f8fad5b-d9cb-469f-a165-70867728950e.png";

describe("responsive images", () => {
  it("never upscales: an 1000px image gets only 480 and 768 copies", () => {
    expect(variantWidthsFor(1000)).toEqual([480, 768]);
  });
  it("names copies next to the original as webp", () => {
    expect(variantUrl(U, 768)).toBe("/uploads/2026/0f8fad5b-d9cb-469f-a165-70867728950e-w768.webp");
  });
  it("leaves external images alone", () => {
    expect(srcSetFor("https://example.com/a.jpg")).toBeUndefined();
  });
  it("lazy-loads body images and wraps mobile versions", () => {
    const out = enhanceBodyImages(`<img src="${U}" data-mobile-src="${U}" width="1000">`);
    expect(out).toContain('loading="lazy"');
    expect(out).toContain('<source media="(max-width: 767px)"');
    const plain = enhanceBodyImages(`<img src="${U}" width="1000">`);
    expect(plain).not.toContain("-w1200.webp");
    expect(plain).toContain(`${U} 1000w`);
  });
});
