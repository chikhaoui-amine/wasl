"use client";

import { useState } from "react";
import { Image as ImageIcon, Plus, Trash2, ArrowUpRight, Check, Eye } from "lucide-react";
import { ImageLightbox } from "@/components/ui/ImageLightbox";
import { parseImageMarkdown } from "@/lib/images";

interface AttachedPhotosBarProps {
  references: Record<string, string>;
  body: string;
  onInsertRef: (refKey: string, snippet: string) => void;
  onRemoveRef: (refKey: string) => void;
  onAddPhotoClick: () => void;
}

export function AttachedPhotosBar({
  references,
  body,
  onInsertRef,
  onRemoveRef,
  onAddPhotoClick,
}: AttachedPhotosBarProps) {
  const [activeLightboxSrc, setActiveLightboxSrc] = useState<string | null>(null);
  const refKeys = Object.keys(references);

  if (refKeys.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border/80 bg-surface-1/40 p-4 transition-all hover:bg-surface-1/70">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
          <div className="flex items-center gap-2.5">
            <div className="grid h-9 w-9 place-items-center rounded-xl border border-border/80 bg-surface-2 text-muted">
              <ImageIcon className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs font-semibold text-text">Photo Attachments</p>
              <p className="text-[11px] text-faint">
                Paste, drag & drop, or click Add Photo to embed images cleanly without base64 clutter.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onAddPhotoClick}
            className="flex items-center gap-1.5 rounded-full border border-border bg-surface-2 px-3 py-1 text-xs font-semibold text-text transition-colors hover:border-accent hover:text-accent shrink-0"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add Photo</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-2xl border border-border/80 bg-surface-1/60 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ImageIcon className="h-4 w-4 text-accent" />
          <span className="text-xs font-bold text-text">Attached Photos ({refKeys.length})</span>
        </div>
        <button
          type="button"
          onClick={onAddPhotoClick}
          className="flex items-center gap-1 text-xs font-semibold text-accent hover:underline"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>Add Another Photo</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
        {refKeys.map((key) => {
          const src = references[key];
          // Find if reference is used in body text
          const refPattern = new RegExp(`!\\[([^\\]]*)\\]\\[${key}\\]`);
          const match = body.match(refPattern);
          const isUsed = !!match;
          const { caption, align, size } = match ? parseImageMarkdown(match[1]) : { caption: key, align: "center", size: "full" };

          return (
            <div
              key={key}
              className="flex items-center justify-between gap-2.5 rounded-xl border border-border/80 bg-surface-2/70 p-2 transition-all hover:border-accent/40"
            >
              {/* Thumbnail */}
              <button
                type="button"
                onClick={() => setActiveLightboxSrc(src)}
                className="group relative h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-border/60 bg-surface-3"
                title="Click to view image preview"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt={caption || key} className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Eye className="h-3.5 w-3.5 text-white" />
                </div>
              </button>

              {/* Metadata */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-[11px] font-bold text-accent">[{key}]</span>
                  {isUsed ? (
                    <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-success bg-success/10 px-1.5 py-0.2 rounded">
                      <Check className="h-2.5 w-2.5" /> in text
                    </span>
                  ) : (
                    <span className="text-[10px] font-medium text-warn bg-warn/10 px-1.5 py-0.2 rounded">
                      not in text
                    </span>
                  )}
                </div>
                <p className="truncate text-xs font-medium text-text mt-0.5" title={caption || key}>
                  {caption || key}
                </p>
                {isUsed && (
                  <p className="text-[10px] text-faint capitalize">
                    {align} · {size}
                  </p>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-1 shrink-0">
                {!isUsed && (
                  <button
                    type="button"
                    onClick={() => onInsertRef(key, `![${caption || "Photo"} | center | full][${key}]`)}
                    className="grid h-7 w-7 place-items-center rounded-lg border border-border bg-surface-1 text-muted transition-colors hover:border-accent hover:text-accent"
                    title="Insert reference tag at cursor"
                  >
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onRemoveRef(key)}
                  className="grid h-7 w-7 place-items-center rounded-lg border border-border bg-surface-1 text-faint transition-colors hover:border-danger/40 hover:bg-danger/10 hover:text-danger"
                  title="Delete image attachment"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {activeLightboxSrc && (
        <ImageLightbox
          open={true}
          src={activeLightboxSrc}
          alt="Attached photo"
          onClose={() => setActiveLightboxSrc(null)}
        />
      )}
    </div>
  );
}
