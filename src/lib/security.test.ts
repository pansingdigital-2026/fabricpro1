import { describe, expect, it } from "vitest";

import { escapeCsvCell } from "./csv";
import { DEFAULT_SETTINGS } from "./defaults";
import { sanitizeHtml } from "./sanitize-html";
import { themeCss } from "./theme";
import { detectAllowedUpload, isWebpBuffer } from "./upload-validation";

describe("HTML sanitization", () => {
  it("strips script, iframe, svg, nested scripts, event handlers, and javascript URLs", () => {
    const dirty = [
      '<p>Safe intro</p>',
      '<script>alert(1)</script>',
      '<scr<script>ipt>alert(2)</scr</script>ipt>',
      '<iframe src="https://evil.example"></iframe>',
      '<svg onload="alert(3)"><circle /></svg>',
      '<img src="x" onerror="alert(4)">',
      '<a href="javascript:alert(5)">bad</a>',
      '<a href="&#106;avascript:alert(6)">encoded</a>',
      '<p style="background:url(javascript:alert(7))">styled</p>',
    ].join("");

    const clean = sanitizeHtml(dirty);
    expect(clean).toContain("<p>Safe intro</p>");
    expect(clean).not.toMatch(/<script/i);
    expect(clean).not.toMatch(/<iframe/i);
    expect(clean).not.toMatch(/<svg/i);
    expect(clean).not.toMatch(/on(?:error|load|click)\s*=/i);
    expect(clean).not.toMatch(/javascript:/i);
    expect(clean).not.toMatch(/style=/i);
  });

  it("preserves editorial formatting, callouts, tables, and responsive images", () => {
    const article =
      '<h2 id="overview">Overview</h2>' +
      '<div class="callout"><p><strong>Key takeaway</strong></p></div>' +
      '<picture><source media="(max-width: 767px)" srcset="/uploads/2026/a-w480.webp 480w" sizes="100vw">' +
      '<img src="/uploads/2026/a.png" alt="Chart" data-kind="infographic" data-mobile-src="/uploads/2026/m.png" loading="lazy"></picture>' +
      '<a href="https://fabric-pro.com" target="_blank">Fabric-Pro</a>';

    const clean = sanitizeHtml(article);
    expect(clean).toContain('<h2 id="overview">Overview</h2>');
    expect(clean).toContain('<div class="callout">');
    expect(clean).toContain('data-kind="infographic"');
    expect(clean).toContain('data-mobile-src="/uploads/2026/m.png"');
    expect(clean).toContain('rel="noopener noreferrer"');
  });
});

describe("Theme CSS sanitization", () => {
  it("blocks style-tag breakout and arbitrary CSS injection in color and font settings", () => {
    const poisoned = structuredClone(DEFAULT_SETTINGS);
    poisoned.colors.primary = '#000;}</style><script>alert(1)</script>';
    poisoned.typography.headingFont = 'Inter"};</style><img src=x onerror=alert(1)>';

    const css = themeCss(poisoned);
    expect(css).not.toContain("<script");
    expect(css).not.toContain("</style>");
    expect(css).not.toContain("onerror");
    expect(css).toContain("--site-primary:#0F1E3A;");
  });
});

describe("Upload file signature validation", () => {
  it("accepts real PNG, JPEG, WebP, and PDF magic bytes", () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
    const jpg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00]);
    const webp = Buffer.from("RIFF\x00\x00\x00\x00WEBP");
    const pdf = Buffer.from("%PDF-1.7\n");

    expect(detectAllowedUpload(png)).toEqual({ ext: "png", mimeType: "image/png" });
    expect(detectAllowedUpload(jpg)).toEqual({ ext: "jpg", mimeType: "image/jpeg" });
    expect(detectAllowedUpload(webp)).toEqual({ ext: "webp", mimeType: "image/webp" });
    expect(isWebpBuffer(webp)).toBe(true);
    expect(detectAllowedUpload(pdf)).toEqual({ ext: "pdf", mimeType: "application/pdf" });
  });

  it("rejects HTML, SVG, JavaScript, and shell scripts", () => {
    expect(detectAllowedUpload(Buffer.from("<svg onload=alert(1)></svg>"))).toBeNull();
    expect(detectAllowedUpload(Buffer.from("<html><script>alert(1)</script></html>"))).toBeNull();
    expect(detectAllowedUpload(Buffer.from("#!/bin/sh\nrm -rf /"))).toBeNull();
    expect(isWebpBuffer(Buffer.from("<svg></svg>"))).toBe(false);
  });
});

describe("Newsletter CSV formula protection", () => {
  it("neutralizes leading formula characters while keeping normal addresses intact", () => {
    expect(escapeCsvCell("+1+1@example.com")).toBe("'+1+1@example.com");
    expect(escapeCsvCell("=CMD|' /C calc'!A0")).toBe("'=CMD|' /C calc'!A0");
    expect(escapeCsvCell("-2+3@example.com")).toBe("'-2+3@example.com");
    expect(escapeCsvCell("@SUM(1+1)@example.com")).toBe("'@SUM(1+1)@example.com");
    expect(escapeCsvCell("reader@fabric-pro.com")).toBe("reader@fabric-pro.com");
    expect(escapeCsvCell('a,"b"@example.com')).toBe('"a,""b""@example.com"');
  });
});