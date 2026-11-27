// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import { Table } from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableHeader from "@tiptap/extension-table-header";
import TableCell from "@tiptap/extension-table-cell";

describe("Publishing editor dependency compatibility", () => {
  it("preserves editable headings, source links, image alt text, and tables", () => {
    const editor = new Editor({
      extensions: [StarterKit, Image, Table, TableRow, TableHeader, TableCell],
      content: '<h2>Marketing update</h2><p>Original <a href="https://example.com/news">source</a>.</p><img src="https://example.com/featured.webp" alt="Marketing illustration"><table><tbody><tr><th>Channel</th></tr><tr><td>Search</td></tr></tbody></table>',
    });
    try {
      const html = editor.getHTML();
      const container = document.createElement("div");
      container.innerHTML = html;
      expect(container.querySelector("h2")?.textContent).toBe("Marketing update");
      expect(container.querySelector("a")?.getAttribute("href")).toBe("https://example.com/news");
      expect(container.querySelector("img")?.getAttribute("alt")).toBe("Marketing illustration");
      expect(container.querySelector("th")?.textContent).toBe("Channel");
      expect(container.querySelector("td")?.textContent).toBe("Search");
      editor.commands.insertContent("<p>Additional reporting.</p>");
      expect(editor.getText()).toContain("Additional reporting.");
    } finally {
      editor.destroy();
    }
  });
});