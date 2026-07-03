"use client";

import { useRef, useState } from "react";
import { Loader2, Sparkles, UploadCloud, X } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

const MAX_BYTES = 10 * 1024 * 1024;

/**
 * Upload panel for the image scanners (screenshot/QR): drag-drop or browse, with
 * preview and validation. Calls `onAnalyze(file)` - the page owns the result state.
 */
export function ImageUploader({
  kind,
  loading,
  onAnalyze,
}: {
  kind: "screenshot" | "qr";
  loading: boolean;
  onAnalyze: (file: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const accept = (f: File | undefined) => {
    if (!f) return;
    setError(null);
    if (!f.type.startsWith("image/")) return setError("Please choose an image file.");
    if (f.size > MAX_BYTES) return setError("Image must be under 10 MB.");
    setFile(f);
    setPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(f);
    });
  };

  const clear = () => {
    setFile(null);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
  };

  return (
    <div className="glass rounded-3xl p-5">
      <div className="mb-3 text-xs uppercase tracking-widest text-muted-foreground">
        Upload {kind === "qr" ? "QR image" : "screenshot"}
      </div>

      {!preview ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            accept(e.dataTransfer.files?.[0]);
          }}
          className={cn(
            "grid w-full place-items-center rounded-2xl border border-dashed px-6 py-14 text-center transition",
            dragging ? "border-primary/60 bg-primary/5" : "border-border/70 hover:border-primary/40",
          )}
        >
          <UploadCloud className="mb-3 h-8 w-8 text-muted-foreground" />
          <div className="text-sm font-medium">Drop an image, or click to browse</div>
          <p className="mt-1 text-xs text-muted-foreground">PNG, JPG or WebP · max 10 MB</p>
        </button>
      ) : (
        <div className="relative overflow-hidden rounded-2xl border border-border bg-background/40">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="preview" className="max-h-72 w-full object-contain" />
          <button
            type="button"
            onClick={clear}
            aria-label="Remove image"
            className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-background/80 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          accept(e.target.files?.[0]);
          e.target.value = "";
        }}
      />

      {error && <p className="mt-3 text-xs text-danger">{error}</p>}

      <div className="mt-4 flex justify-end">
        <Button
          variant="primary"
          size="md"
          disabled={!file}
          loading={loading}
          onClick={() => file && onAnalyze(file)}
        >
          {!loading && <Sparkles className="h-4 w-4" />}
          {kind === "qr" ? "Decode & scan" : "Read & scan"}
        </Button>
      </div>

      {loading && (
        <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
          {kind === "qr" ? "Decoding QR…" : "Running OCR…"} this can take a few seconds.
        </div>
      )}
    </div>
  );
}
