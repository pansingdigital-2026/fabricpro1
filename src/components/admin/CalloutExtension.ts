import { Node, mergeAttributes } from "@tiptap/core";

/** Block-level "Key takeaway" box rendered as <div class="callout"> in article HTML. */
export const Callout = Node.create({
  name: "callout",
  group: "block",
  content: "block+",
  defining: true,

  parseHTML() {
    return [{ tag: "div.callout" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { class: "callout" }), 0];
  },
});
