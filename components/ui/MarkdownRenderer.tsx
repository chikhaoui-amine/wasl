"use client";

import { useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import { ExternalLink, CheckSquare, Square, ZoomIn } from "lucide-react";
import { parseImageMarkdown, type ImageAlignment, type ImageSize } from "@/lib/images";
import { ImageLightbox } from "@/components/ui/ImageLightbox";
import { cn } from "@/lib/utils";

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

/**
 * Detects if a text string contains Right-to-Left characters (Arabic, Hebrew, Persian, etc.)
 */
export function isRtlText(text: string): boolean {
  if (!text) return false;
  const rtlRegex = /[\u0591-\u07FF\uFB1D-\uFDFD\uFE70-\uFEFC]/;
  return rtlRegex.test(text);
}

/**
 * Normalizes Markdown so that unindented text immediately following a list item
 * breaks out of the list and renders as a top-level paragraph at column 0 (left margin).
 */
function normalizeMarkdownContent(raw: string): string {
  if (!raw) return "";
  const lines = raw.split("\n");
  const result: string[] = [];

  const isListItem = (line: string) => /^\s*([-*+]\s+|\d+\.\s+)/.test(line);
  const isBlank = (line: string) => /^\s*$/.test(line);

  for (let i = 0; i < lines.length; i++) {
    const current = lines[i];
    const prev = i > 0 ? lines[i - 1] : null;

    if (
      prev &&
      isListItem(prev) &&
      !isListItem(current) &&
      !isBlank(current) &&
      !current.startsWith(" ") &&
      !current.startsWith("\t")
    ) {
      result.push("");
    }
    result.push(current);
  }

  return result.join("\n");
}

function getImageContainerClasses(align: ImageAlignment, size: ImageSize, isRtl: boolean): string {
  const sizeClass =
    size === "small"
      ? "max-w-[280px]"
      : size === "medium"
        ? "max-w-[580px]"
        : "w-full";

  if (align === "left") {
    return cn(
      "my-3 w-full sm:w-auto",
      sizeClass,
      isRtl
        ? "float-none sm:float-right sm:ml-5 sm:mr-0 mb-4 clear-both sm:clear-none text-right"
        : "float-none sm:float-left sm:mr-5 sm:ml-0 mb-4 clear-both sm:clear-none text-left",
    );
  }

  if (align === "right") {
    return cn(
      "my-3 w-full sm:w-auto",
      sizeClass,
      isRtl
        ? "float-none sm:float-left sm:mr-5 sm:ml-0 mb-4 clear-both sm:clear-none text-left"
        : "float-none sm:float-right sm:ml-5 sm:mr-0 mb-4 clear-both sm:clear-none text-right",
    );
  }

  if (align === "full") {
    return "my-5 w-full block clear-both";
  }

  // default center
  return cn("my-5 mx-auto block clear-both", sizeClass);
}

export function MarkdownRenderer({ content, className }: MarkdownRendererProps) {
  const normalizedContent = useMemo(() => normalizeMarkdownContent(content), [content]);
  const isRtl = useMemo(() => isRtlText(content), [content]);

  // Collect all images in order for lightbox navigation
  const allImages = useMemo(() => {
    if (!content) return [];
    const matches = Array.from(content.matchAll(/!\[([^\]]*)\]\(([^)]+)\)/g));
    return matches.map((m) => {
      const { caption } = parseImageMarkdown(m[1] || "");
      return {
        rawAlt: m[1] || "",
        caption,
        src: m[2],
      };
    });
  }, [content]);

  const [activeImageIndex, setActiveImageIndex] = useState<number | null>(null);

  if (!content) return null;

  return (
    <>
      <div
        dir={isRtl ? "rtl" : "ltr"}
        className={cn(
          "prose-wasl prose-lifeos space-y-4 text-text leading-relaxed clear-both",
          isRtl ? "text-right" : "text-left",
          className,
        )}
      >
        <ReactMarkdown
          remarkPlugins={[remarkGfm, remarkBreaks]}
          components={{
            h1: ({ children }) => (
              <h1 className={cn("font-display text-2xl sm:text-3xl font-bold tracking-tight text-text mt-6 mb-3 border-b border-border/50 pb-2 clear-both", isRtl ? "text-right" : "text-left")}>
                {children}
              </h1>
            ),
            h2: ({ children }) => (
              <h2 className={cn("font-display text-xl sm:text-2xl font-bold tracking-tight text-text mt-5 mb-2.5 clear-both", isRtl ? "text-right" : "text-left")}>
                {children}
              </h2>
            ),
            h3: ({ children }) => (
              <h3 className={cn("font-display text-lg sm:text-xl font-semibold text-text mt-4 mb-2 clear-both", isRtl ? "text-right" : "text-left")}>
                {children}
              </h3>
            ),
            h4: ({ children }) => (
              <h4 className={cn("font-display text-base font-semibold text-text mt-3 mb-1.5 clear-both", isRtl ? "text-right" : "text-left")}>
                {children}
              </h4>
            ),
            p: ({ children }) => (
              <p className={cn("text-base leading-relaxed text-text/90 my-2 font-normal whitespace-pre-wrap", isRtl ? "text-right" : "text-left")}>
                {children}
              </p>
            ),
            strong: ({ children }) => (
              <strong className="font-bold text-text">{children}</strong>
            ),
            em: ({ children }) => (
              <em className="italic text-text/90">{children}</em>
            ),
            ul: ({ children }) => (
              <ul className={cn("my-3 list-disc space-y-1.5 text-base text-text/90", isRtl ? "mr-6 ml-0 text-right" : "ml-6 mr-0 text-left")}>
                {children}
              </ul>
            ),
            ol: ({ children }) => (
              <ol className={cn("my-3 list-decimal space-y-1.5 text-base text-text/90", isRtl ? "mr-6 ml-0 text-right" : "ml-6 mr-0 text-left")}>
                {children}
              </ol>
            ),
            li: ({ children, className: liClassName }) => (
              <li className={cn("leading-relaxed", isRtl ? "text-right" : "text-left", liClassName)}>{children}</li>
            ),
            blockquote: ({ children }) => (
              <blockquote className={cn("my-4 bg-accent/5 px-4 py-3 text-base italic text-muted clear-both", isRtl ? "border-r-4 border-accent rounded-l-xl text-right" : "border-l-4 border-accent rounded-r-xl text-left")}>
                {children}
              </blockquote>
            ),
            code: ({ className: codeClassName, children }) => {
              const isBlock = codeClassName?.includes("language-");
              if (isBlock) {
                return (
                  <pre dir="ltr" className="my-4 overflow-x-auto rounded-xl border border-border/80 bg-surface-2 p-4 font-mono text-xs sm:text-sm text-text shadow-inner text-left clear-both">
                    <code>{children}</code>
                  </pre>
                );
              }
              return (
                <code className="rounded-md border border-border/60 bg-surface-2 px-1.5 py-0.5 font-mono text-[13px] text-accent font-medium">
                  {children}
                </code>
              );
            },
            a: ({ href, children }) => (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-semibold text-accent hover:underline"
              >
                {children} <ExternalLink className="h-3.5 w-3.5 inline" />
              </a>
            ),
            img: ({ src, alt }) => {
              if (!src) return null;
              const { caption, align, size } = parseImageMarkdown(alt || "");
              const containerCls = getImageContainerClasses(align, size, isRtl);
              const imgIndex = allImages.findIndex((img) => img.src === src);

              return (
                <figure className={cn("group relative inline-block not-prose", containerCls)}>
                  <div
                    onClick={() => setActiveImageIndex(imgIndex >= 0 ? imgIndex : 0)}
                    className="relative overflow-hidden rounded-xl border border-border/80 bg-surface-2/40 shadow-sm transition-all duration-200 hover:border-accent/50 hover:shadow-md cursor-zoom-in"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={src}
                      alt={caption || "Note photo"}
                      loading="lazy"
                      className="h-auto w-full max-h-[550px] object-contain rounded-xl transition-transform duration-300 group-hover:scale-[1.01]"
                    />
                    <div className="absolute top-2 right-2 rounded-lg bg-black/50 p-1.5 text-white/90 opacity-0 backdrop-blur-sm transition-opacity duration-200 group-hover:opacity-100">
                      <ZoomIn className="h-3.5 w-3.5" />
                    </div>
                  </div>
                  {caption && (
                    <figcaption className="mt-1.5 text-center text-xs font-medium italic text-faint">
                      {caption}
                    </figcaption>
                  )}
                </figure>
              );
            },
            input: ({ type, checked }) => {
              if (type === "checkbox") {
                return checked ? (
                  <CheckSquare className={cn("inline-block h-4 w-4 text-success align-text-bottom", isRtl ? "ml-2" : "mr-2")} />
                ) : (
                  <Square className={cn("inline-block h-4 w-4 text-faint align-text-bottom", isRtl ? "ml-2" : "mr-2")} />
                );
              }
              return null;
            },
          }}
        >
          {normalizedContent}
        </ReactMarkdown>
      </div>

      {activeImageIndex !== null && allImages[activeImageIndex] && (
        <ImageLightbox
          open={true}
          src={allImages[activeImageIndex].src}
          alt={allImages[activeImageIndex].rawAlt}
          caption={allImages[activeImageIndex].caption}
          onClose={() => setActiveImageIndex(null)}
          hasPrev={activeImageIndex > 0}
          hasNext={activeImageIndex < allImages.length - 1}
          onPrev={() => setActiveImageIndex((i) => (i !== null && i > 0 ? i - 1 : i))}
          onNext={() => setActiveImageIndex((i) => (i !== null && i < allImages.length - 1 ? i + 1 : i))}
        />
      )}
    </>
  );
}
