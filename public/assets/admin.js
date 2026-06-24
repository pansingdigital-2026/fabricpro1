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

  function formatBytes(bytes) {
    if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
})();
