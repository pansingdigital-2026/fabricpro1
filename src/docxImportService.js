import path from "node:path";
import mammoth from "mammoth";
import { syncBinaryFile } from "./github.js";
import { cleanArticleHtml } from "./articleRenderer.js";
import { sanitizeFileName, slugify, uniqueId } from "./utils.js";

function extensionForContentType(contentType = "") {
  const type = String(contentType).toLowerCase();
  if (type.includes("png")) return ".png";
  if (type.includes("webp")) return ".webp";
  if (type.includes("gif")) return ".gif";
  if (type.includes("svg")) return ".svg";
  return ".jpg";
}

function uploadFolder() {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `public/uploads/articles/${year}/${month}`;
}

function publicPath(relativePath = "") {
  return `/${relativePath.replace(/^public\//, "").replace(/\\/g, "/")}`;
}

export async function importDocxToHtml(file, options = {}) {
  if (!file?.buffer?.length) throw new Error("Please upload a DOCX file.");
  const lowerName = String(file.filename || "").toLowerCase();
  const isDocx = lowerName.endsWith(".docx") || file.contentType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (!isDocx) throw new Error("Only .docx files are supported for Word import.");

  const slug = slugify(options.slug || path.basename(file.filename, path.extname(file.filename)) || "article");
  const folder = uploadFolder();
  const savedImages = [];

  const result = await mammoth.convertToHtml(
    { buffer: file.buffer },
    {
      styleMap: [
        "p[style-name='Title'] => h1:fresh",
        "p[style-name='Subtitle'] => p.article-subtitle:fresh",
        "p[style-name='Heading 1'] => h2:fresh",
        "p[style-name='Heading 2'] => h2:fresh",
        "p[style-name='Heading 3'] => h3:fresh",
        "p[style-name='Heading 4'] => h4:fresh"
      ],
      convertImage: mammoth.images.imgElement(async (image) => {
        const base64 = await image.read("base64");
        const buffer = Buffer.from(base64, "base64");
        const ext = extensionForContentType(image.contentType);
        const fileName = sanitizeFileName(`${slug}-${uniqueId("docx-image")}${ext}`);
        const relativePath = `${folder}/${fileName}`;
        await syncBinaryFile(relativePath, buffer, `Upload DOCX image: ${fileName}`);
        const src = publicPath(relativePath);
        savedImages.push(src);
        return { src, alt: "", loading: "lazy", decoding: "async" };
      })
    }
  );

  return {
    html: cleanArticleHtml(result.value),
    warnings: (result.messages || []).map((message) => message.message || String(message)).filter(Boolean),
    images: savedImages
  };
}
