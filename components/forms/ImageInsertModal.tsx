// components/forms/ImageInsertModal.tsx
"use client";

import { useState, useRef } from "react";
import { Modal, Field, FormFooter, inputCls, Segmented } from "@/components/ui/Modal";
import { compressImage, type ImageAlignment, type ImageSize } from "@/lib/images";
import { Upload, Link2, Image as ImageIcon, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ImageInsertModalProps {
  open: boolean;
  onClose: () => void;
  onInsert: (
    src: string,
    options: { caption: string; align: ImageAlignment; size: ImageSize },
  ) => void;
}

export function ImageInsertModal({ open, onClose, onInsert }: ImageInsertModalProps) {
  const [tab, setTab] = useState<"upload" | "url">("upload");
  const [imageUrl, setImageUrl] = useState("");
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [align, setAlign] = useState<ImageAlignment>("center");
  const [size, setSize] = useState<ImageSize>("full");
  const [compressing, setCompressing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setImageUrl("");
    setPreviewSrc(null);
    setCaption("");
    setAlign("center");
    setSize("full");
    setCompressing(false);
    setTab("upload");
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setCompressing(true);
      const compressed = await compressImage(file);
      setPreviewSrc(compressed);
    } catch (err) {
      console.error("Compression error:", err);
    } finally {
      setCompressing(false);
    }
  };

  const activeSrc = tab === "upload" ? previewSrc : imageUrl.trim();

  const handleInsert = () => {
    if (!activeSrc) return;
    onInsert(activeSrc, {
      caption,
      align,
      size,
    });
    handleClose();
  };

  return (
    <Modal open={open} onClose={handleClose} title="Insert Photo" size="lg" preventBackdropClose={true}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleInsert();
        }}
        className="space-y-4"
      >
        {/* Source Tabs */}
        <div className="flex rounded-xl bg-surface-2 p-1 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setTab("upload")}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg transition-all",
              tab === "upload" ? "bg-surface-1 text-accent shadow-sm" : "text-faint hover:text-muted",
            )}
          >
            <Upload className="w-3.5 h-3.5" /> Upload / Camera
          </button>
          <button
            type="button"
            onClick={() => setTab("url")}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg transition-all",
              tab === "url" ? "bg-surface-1 text-accent shadow-sm" : "text-faint hover:text-muted",
            )}
          >
            <Link2 className="w-3.5 h-3.5" /> Image Link (URL)
          </button>
        </div>

        {tab === "upload" ? (
          <div className="space-y-2">
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />

            {previewSrc ? (
              <div className="relative group rounded-xl overflow-hidden border border-border bg-surface-2/40 p-2 flex flex-col items-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewSrc}
                  alt="Preview"
                  className="max-h-48 object-contain rounded-lg"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-2 text-xs font-semibold text-accent hover:underline"
                >
                  Change photo
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={compressing}
                className="w-full h-40 border-2 border-dashed border-border hover:border-accent rounded-xl flex flex-col items-center justify-center gap-2 text-faint hover:text-accent transition-all bg-surface-2/30 hover:bg-accent/5"
              >
                {compressing ? (
                  <>
                    <Loader2 className="w-6 h-6 animate-spin text-accent" />
                    <span className="text-xs font-medium">Optimizing photo...</span>
                  </>
                ) : (
                  <>
                    <div className="p-3 rounded-full bg-surface-2 text-accent">
                      <ImageIcon className="w-6 h-6" />
                    </div>
                    <span className="text-xs font-semibold text-text">Choose file or take photo</span>
                    <span className="text-[11px] text-faint">Auto-compressed for instant sync</span>
                  </>
                )}
              </button>
            )}
          </div>
        ) : (
          <Field label="Image Web Address (URL)">
            <div className="relative">
              <Link2 className="absolute left-3 top-2.5 h-4 w-4 text-faint" />
              <input
                className={`${inputCls} pl-9`}
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://example.com/image.png"
              />
            </div>
          </Field>
        )}

        {/* Layout & Alignment Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <Field label="Placement / Alignment">
            <Segmented
              value={align}
              onChange={(val) => {
                const newAlign = val as ImageAlignment;
                setAlign(newAlign);
                if ((newAlign === "left" || newAlign === "right") && size === "full") {
                  setSize("medium");
                }
              }}
              options={[
                { value: "center", label: "Center" },
                { value: "left", label: "Left Float" },
                { value: "right", label: "Right Float" },
                { value: "full", label: "Full" },
              ]}
            />
          </Field>

          <Field label="Size">
            <Segmented
              value={size}
              onChange={(val) => setSize(val as ImageSize)}
              options={[
                { value: "small", label: "Small (33%)" },
                { value: "medium", label: "Medium (66%)" },
                { value: "full", label: "Full (100%)" },
              ]}
            />
          </Field>
        </div>

        <Field label="Caption (Optional)">
          <input
            className={inputCls}
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="e.g. System Architecture Diagram"
          />
        </Field>

        <FormFooter
          submitLabel="Insert Photo"
          disabled={!activeSrc || compressing}
          onCancel={handleClose}
        />
      </form>
    </Modal>
  );
}
