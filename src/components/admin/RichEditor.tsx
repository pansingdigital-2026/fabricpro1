import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { marked } from "marked";
import { useEffect, useState } from "react";
import TurndownService from "turndown";

import type { MediaFolder, MediaItem } from "@/lib/types";

import { Callout } from "./CalloutExtension";
import { ImageInfo } from "./ImageInfo";
import { MediaPicker } from "./MediaPicker";
import { Btn, TextInput } from "./ui";

const turndown = new TurndownService({ headingStyle: "atx", codeBlockStyle: "fenced" });

export interface EditorValue {
  html: string;
  markdown: string;
  mode: "rich" | "markdown";
}

const RichImage = Image.extend({
  addAttributes() {
    const attr = (name: string) => ({
      default: null,
      parseHTML: (el: HTMLElement) => el.getAttribute(name),
      renderHTML: (a: Record<string, unknown>) => {
        const key = name === "data-kind" ? "kind" : name === "data-mobile-src" ? "mobileSrc" : name;
        return a[key] ? { [name]: a[key] } : {};
      },
    });
    return {
      ...this.parent?.(),
      width: attr("width"),
      height: attr("height"),
      kind: attr("data-kind"),
      mobileSrc: attr("data-mobile-src"),
    };
  },
});

type PendingImage = {
  url: string;
  alt: string;
  kind: "standard" | "infographic";
  mobileSrc: string;
  width: number | null;
  height: number | null;
};

export function RichEditor({
  value,
  onChange,
  mediaFolder,
}: {
  value: EditorValue;
  onChange: (v: EditorValue) => void;
  mediaFolder?: MediaFolder;
}) {
  const [mode, setMode] = useState<"rich" | "markdown">(value.mode ?? "rich");
  const [imagePicker, setImagePicker] = useState(false);
  const [pending, setPending] = useState<PendingImage | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3, 4] } }),
      Link.configure({ openOnClick: false }),
      RichImage,
      Callout,
    ],
    content: value.html || "",
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class:
          "prose prose-sm max-w-none min-h-72 rounded-b-md bg-background px-4 py-3 outline-none",
      },
    },
    onUpdate: ({ editor: e }) => {
      const html = e.getHTML();
      onChange({ html, markdown: turndown.turndown(html), mode: "rich" });
    },
  });

  useEffect(() => {
    if (mode === "rich" && editor && editor.getHTML() !== value.html) {
      editor.commands.setContent(value.html, { emitUpdate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, editor, value.html]);

  useEffect(() => {
    setMode(value.mode);
  }, [value.mode]);

  function switchMode(next: "rich" | "markdown") {
    if (next === mode) return;
    if (next === "markdown") {
      const html = editor?.getHTML() ?? value.html;
      onChange({ html, markdown: turndown.turndown(html || ""), mode: "markdown" });
    } else {
      const html = String(marked.parse(value.markdown || "", { async: false }));
      onChange({ html, markdown: value.markdown, mode: "rich" });
      editor?.commands.setContent(html, { emitUpdate: false });
    }
    setMode(next);
  }

  const tool = (label: string, action: () => void, active?: boolean) => (
    <Btn key={label} variant={active ? "primary" : "ghost"} onClick={action} className="px-2 py-1">
      {label}
    </Btn>
  );

  return (
    <div className="rounded-md border border-input">
      <div className="sticky top-0 z-30 rounded-t-md bg-background shadow-sm">
        <div className="flex flex-wrap items-center gap-1 border-b border-border bg-muted/40 px-2 py-1.5">
          {mode === "rich" && editor ? (
            <>
              {tool("B", () => editor.chain().focus().toggleBold().run(), editor.isActive("bold"))}
              {tool(
                "I",
                () => editor.chain().focus().toggleItalic().run(),
                editor.isActive("italic"),
              )}
              {tool(
                "H2",
                () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
                editor.isActive("heading", { level: 2 }),
              )}
              {tool(
                "H3",
                () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
                editor.isActive("heading", { level: 3 }),
              )}
              {tool(
                "Quote",
                () => editor.chain().focus().toggleBlockquote().run(),
                editor.isActive("blockquote"),
              )}
              {tool(
                "List",
                () => editor.chain().focus().toggleBulletList().run(),
                editor.isActive("bulletList"),
              )}
              {tool(
                "1.",
                () => editor.chain().focus().toggleOrderedList().run(),
                editor.isActive("orderedList"),
              )}
              {tool(
                "Code",
                () => editor.chain().focus().toggleCodeBlock().run(),
                editor.isActive("codeBlock"),
              )}
              {tool("Link", () => {
                const url = window.prompt("Link URL");
                if (url) editor.chain().focus().setLink({ href: url }).run();
              })}
              {tool("Image", () => setImagePicker((o) => !o), imagePicker)}
              {tool(
                "Key takeaway",
                () => {
                  if (editor.isActive("callout")) {
                    editor.chain().focus().lift("callout").run();
                    return;
                  }
                  editor
                    .chain()
                    .focus()
                    .insertContent(
                      '<div class="callout"><p><strong>Key takeaway.</strong> Write the one thing readers must remember.</p></div>',
                    )
                    .run();
                },
                editor.isActive("callout"),
              )}
              {tool("Clear", () => editor.chain().focus().unsetAllMarks().clearNodes().run())}
            </>
          ) : (
            <span className="px-2 text-[11px] text-muted-foreground">
              Markdown mode — content is converted to HTML on save.
            </span>
          )}
          <div className="ml-auto flex gap-1">
            <Btn
              variant={mode === "rich" ? "primary" : "outline"}
              onClick={() => switchMode("rich")}
              className="px-2 py-1"
            >
              Rich text
            </Btn>
            <Btn
              variant={mode === "markdown" ? "primary" : "outline"}
              onClick={() => switchMode("markdown")}
              className="px-2 py-1"
            >
              Markdown
            </Btn>
          </div>
        </div>

        {mode === "rich" && imagePicker ? (
          <div className="border-b border-border bg-muted/30 px-3 py-3">
            {!pending ? (
              <MediaPicker
                label="Insert inline image"
                defaultOpen
                {...(mediaFolder ? { defaultFolder: mediaFolder } : {})}
                value=""
                onChange={(url, item?: MediaItem) => {
                  if (!url) return;
                  setPending({
                    url,
                    alt: item?.alt_text ?? "",
                    kind: "standard",
                    mobileSrc: "",
                    width: item?.width ?? null,
                    height: item?.height ?? null,
                  });
                }}
              />
            ) : (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="self-center font-medium">Image type:</span>
                  {(["standard", "infographic"] as const).map((k) => (
                    <Btn
                      key={k}
                      variant={pending.kind === k ? "primary" : "outline"}
                      onClick={() => setPending({ ...pending, kind: k })}
                      className="px-2 py-1"
                    >
                      {k === "standard"
                        ? "Standard photo / illustration"
                        : "Infographic / chart / text"}
                    </Btn>
                  ))}
                </div>
                <label className="block space-y-1 text-xs">
                  <span className="font-medium">Alt text</span>
                  <TextInput
                    value={pending.alt}
                    onChange={(e) => setPending({ ...pending, alt: e.target.value })}
                    placeholder="Describe the image"
                  />
                </label>
                {pending.kind === "infographic" ? (
                  <MediaPicker
                    label="Mobile version (optional — a tall, single-column copy for phones)"
                    {...(mediaFolder ? { defaultFolder: mediaFolder } : {})}
                    value={pending.mobileSrc}
                    onChange={(url) => setPending({ ...pending, mobileSrc: url })}
                  />
                ) : null}
                <ImageInfo url={pending.url} kind={pending.kind} mobileUrl={pending.mobileSrc} />
                <div className="flex gap-2">
                  <Btn
                    onClick={() => {
                      const attrs: Record<string, unknown> = { src: pending.url, alt: pending.alt };
                      if (pending.width) attrs["width"] = String(pending.width);
                      if (pending.height) attrs["height"] = String(pending.height);
                      if (pending.kind === "infographic") attrs["kind"] = "infographic";
                      if (pending.kind === "infographic" && pending.mobileSrc)
                        attrs["mobileSrc"] = pending.mobileSrc;
                      editor
                        ?.chain()
                        .focus()
                        .setImage(attrs as { src: string })
                        .run();
                      setPending(null);
                      setImagePicker(false);
                    }}
                  >
                    Insert image
                  </Btn>
                  <Btn variant="outline" onClick={() => setPending(null)}>
                    Choose another
                  </Btn>
                </div>
              </div>
            )}
          </div>
        ) : null}
      </div>

      {mode === "rich" ? (
        <EditorContent editor={editor} />
      ) : (
        <textarea
          value={value.markdown}
          onChange={(e) => {
            const md = e.target.value;
            onChange({
              markdown: md,
              html: String(marked.parse(md, { async: false })),
              mode: "markdown",
            });
          }}
          className="min-h-72 w-full rounded-b-md bg-background px-4 py-3 font-mono text-sm outline-none"
          placeholder="# Write in Markdown"
        />
      )}
    </div>
  );
}
