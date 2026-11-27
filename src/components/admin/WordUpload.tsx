import { useRef, useState } from "react";
import { FileUp, Loader2 } from "lucide-react";
import { readWordArticle, type WordArticle } from "@/lib/admin/word-import";
import { MediaPicker } from "./MediaPicker";
import { Btn, Field, Panel, TextInput } from "./ui";

export type LibraryImage = { url: string; alt: string };

export function WordUpload({
  onImport,
  hasContent,
  disabled,
}: {
  onImport: (
    article: WordArticle,
    image: File | null,
    library: LibraryImage | null,
  ) => Promise<string[]>;
  hasContent: boolean;
  disabled: boolean;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [word, setWord] = useState<File | null>(null);
  const [image, setImage] = useState<File | null>(null);
  const [library, setLibrary] = useState<LibraryImage | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<string[] | null>(null);

  async function importFile() {
    if (!word) return;
    if (
      hasContent &&
      !window.confirm(
        "Replace the current article fields with this Word document? Your existing article is not changed until you save.",
      )
    )
      return;
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const article = await readWordArticle(word);
      const warnings = await onImport(article, image, library);
      setResult([...article.warnings, ...warnings]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "The document could not be imported.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel title="Upload Updates article">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <input
            ref={fileInput}
            aria-label="Word article"
            type="file"
            accept=".docx,.doc"
            className="hidden"
            disabled={busy || disabled}
            onChange={(e) => {
              setWord(e.target.files?.[0] ?? null);
              setError("");
              setResult(null);
            }}
          />
          <Btn
            variant="outline"
            disabled={busy || disabled}
            onClick={() => fileInput.current?.click()}
          >
            <FileUp size={15} />
            Choose Word file
          </Btn>
          <span className="min-w-0 break-all text-xs text-muted-foreground">
            {word?.name ?? "No file selected"}
          </span>
        </div>
        <Field label="Featured image (optional)">
          <TextInput
            aria-label="Import featured image"
            type="file"
            accept="image/webp,image/jpeg,image/png"
            disabled={busy || disabled}
            onChange={(e) => {
              const file = e.target.files?.[0] ?? null;
              setImage(file);
              if (file) setLibrary(null);
            }}
          />
        </Field>
        <MediaPicker
          value={library?.url ?? ""}
          label="Or select from Library"
          defaultFolder="news"
          onChange={(url, item) => {
            setLibrary(url ? { url, alt: item?.alt_text ?? "" } : null);
            if (url) setImage(null);
          }}
        />
        <Btn disabled={!word || busy || disabled} onClick={() => void importFile()}>
          {busy ? <Loader2 size={15} className="animate-spin" /> : <FileUp size={15} />}
          {busy ? "Importing…" : "Fill article from Word"}
        </Btn>
        {error ? (
          <p role="alert" className="text-xs text-destructive">
            {error}
          </p>
        ) : null}
        {result ? (
          <div role="status" className="space-y-1 text-xs text-muted-foreground">
            <p className="font-medium text-foreground">
              Article imported — not saved or published.
            </p>
            {result.map((w) => (
              <p key={w}>{w}</p>
            ))}
          </div>
        ) : null}
      </div>
    </Panel>
  );
}
