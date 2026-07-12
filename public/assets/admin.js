(() => {
  const toggle = document.querySelector("[data-nav-toggle]");
  const menu = document.querySelector("[data-nav-menu]");
  if (toggle && menu) {
    toggle.addEventListener("click", () => {
      const open = !menu.classList.contains("open");
      menu.classList.toggle("open", open);
      toggle.setAttribute("aria-expanded", String(open));
    });
  }

  document.querySelectorAll("form[data-confirm]").forEach((form) => {
    form.addEventListener("submit", (event) => {
      if (!window.confirm(form.dataset.confirm || "Are you sure?")) event.preventDefault();
    });
  });

  const uploadSettings = {
    imageFile: { maxWidth: 1400, maxHeight: 900, quality: 0.82 },
    inlineImage: { maxWidth: 1200, maxHeight: 900, quality: 0.82 },
    logoFile: { maxWidth: 640, maxHeight: 320, quality: 0.86 }
  };

  const supportedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

  document.querySelectorAll('input[type="file"]').forEach((input) => {
    const settings = uploadSettings[input.name];
    if (!settings) return;

    input.addEventListener("change", async () => {
      const file = input.files?.[0];
      if (!file || !supportedTypes.has(file.type) || typeof DataTransfer === "undefined") return;

      input.dataset.optimizing = "1";
      setUploadStatus(input, "Optimizing image...");

      try {
        const optimized = await optimizeImage(file, settings);
        if (optimized && optimized.size < file.size) {
          const files = new DataTransfer();
          files.items.add(optimized);
          input.files = files.files;
          setUploadStatus(input, `Optimized to ${formatBytes(optimized.size)} WebP`);
        } else {
          setUploadStatus(input, "Image already optimized");
        }
      } catch {
        setUploadStatus(input, "Using original image");
      } finally {
        delete input.dataset.optimizing;
      }
    });
  });

  document.querySelectorAll("form").forEach((form) => {
    form.addEventListener("submit", (event) => {
      const optimizing = form.querySelector('[data-optimizing="1"]');
      if (!optimizing) return;
      event.preventDefault();
      setUploadStatus(optimizing, "Please wait for image optimization to finish.");
      optimizing.focus();
    });
  });

  const contentFormat = document.querySelector("[data-content-format]");
  const contentPanels = document.querySelectorAll("[data-format-panel]");
  const contentEditors = document.querySelectorAll("[data-content-editor]");
  let activeEditor = document.querySelector('[data-content-editor="markdown"]');

  contentEditors.forEach((editor) => {
    editor.addEventListener("focus", () => {
      activeEditor = editor;
    });
  });

  if (contentFormat) {
    contentFormat.addEventListener("change", updateContentPanels);
    updateContentPanels();
  }

  function updateContentPanels() {
    const format = contentFormat?.value || "markdown";
    contentPanels.forEach((panel) => {
      const key = panel.dataset.formatPanel;
      const visible = format === "markdown" ? key === "markdown" : key === "html";
      panel.hidden = !visible;
    });
    activeEditor = document.querySelector(`[data-content-editor="${format === "markdown" ? "markdown" : "html"}"]`) || activeEditor;
  }

  const docxButton = document.querySelector("[data-docx-import]");
  if (docxButton) {
    docxButton.addEventListener("click", async () => {
      const fileInput = document.querySelector("[data-docx-file]");
      const status = document.querySelector("[data-docx-status]");
      const preview = document.querySelector("[data-docx-preview]");
      const htmlEditor = document.querySelector('[data-content-editor="html"]');
      const file = fileInput?.files?.[0];
      if (!file) {
        setText(status, "Choose a DOCX file first.");
        return;
      }

      const formData = new FormData();
      formData.append("docxFile", file);
      formData.append("title", document.querySelector('input[name="title"]')?.value || "");
      formData.append("slug", document.querySelector('input[name="slug"]')?.value || "");

      docxButton.disabled = true;
      setText(status, "Importing DOCX...");
      try {
        const response = await fetch("/admin/articles/import-docx", {
          method: "POST",
          body: formData
        });
        const data = await response.json();
        if (!response.ok || !data.ok) throw new Error(data.error || "DOCX import failed.");

        if (contentFormat) {
          contentFormat.value = "docx_imported";
          updateContentPanels();
        }
        if (htmlEditor) {
          htmlEditor.value = data.html || "";
          htmlEditor.focus();
          activeEditor = htmlEditor;
        }
        if (preview) {
          preview.hidden = false;
          preview.innerHTML = `<h3>DOCX preview</h3><div class="article-content">${data.html || ""}</div>`;
        }
        const warningText = data.warnings?.length ? ` Imported with ${data.warnings.length} warning(s).` : "";
        setText(status, `DOCX imported. Review and edit the HTML before saving.${warningText}`);
      } catch (error) {
        setText(status, error.message || "DOCX import failed.");
      } finally {
        docxButton.disabled = false;
      }
    });
  }

  const inlineButton = document.querySelector("[data-inline-insert]");
  if (inlineButton) {
    inlineButton.addEventListener("click", async () => {
      const fileInput = document.querySelector("[data-inline-image]");
      const status = document.querySelector("[data-inline-status]");
      const file = fileInput?.files?.[0];
      if (!file) {
        setText(status, "Choose an inline image first.");
        return;
      }

      const formData = new FormData();
      formData.append("inlineImage", file);
      formData.append("inlineImageAlt", document.querySelector("[data-inline-alt]")?.value || "");
      formData.append("inlineImageCaption", document.querySelector("[data-inline-caption]")?.value || "");
      formData.append("title", document.querySelector('input[name="title"]')?.value || "");
      formData.append("slug", document.querySelector('input[name="slug"]')?.value || "");

      inlineButton.disabled = true;
      setText(status, "Uploading image...");
      try {
        const response = await fetch("/admin/articles/upload-inline-image", {
          method: "POST",
          body: formData
        });
        const data = await response.json();
        if (!response.ok || !data.ok) throw new Error(data.error || "Image upload failed.");

        const editor = activeEditor || document.querySelector('[data-content-editor="markdown"]');
        insertAtCursor(editor, `\n\n${data.figure}\n\n`);
        setText(status, "Image inserted into article body.");
      } catch (error) {
        setText(status, error.message || "Image upload failed.");
      } finally {
        inlineButton.disabled = false;
      }
    });
  }

  async function optimizeImage(file, settings) {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, settings.maxWidth / bitmap.width, settings.maxHeight / bitmap.height);
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d", { alpha: true });
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/webp", settings.quality));
    if (!blob) return null;

    const originalName = file.name.replace(/\.[^.]+$/, "");
    return new File([blob], `${originalName}.webp`, {
      type: "image/webp",
      lastModified: Date.now()
    });
  }

  function setUploadStatus(input, text) {
    let status = input.parentElement?.querySelector(".upload-status");
    if (!status) {
      status = document.createElement("span");
      status.className = "upload-status";
      input.insertAdjacentElement("afterend", status);
    }
    status.textContent = text;
  }

  function setText(element, text) {
    if (element) element.textContent = text;
  }

  function insertAtCursor(textarea, text) {
    if (!textarea) return;
    const start = textarea.selectionStart ?? textarea.value.length;
    const end = textarea.selectionEnd ?? textarea.value.length;
    textarea.value = `${textarea.value.slice(0, start)}${text}${textarea.value.slice(end)}`;
    const position = start + text.length;
    textarea.focus();
    textarea.setSelectionRange?.(position, position);
  }

  function formatBytes(bytes) {
    if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
})();
