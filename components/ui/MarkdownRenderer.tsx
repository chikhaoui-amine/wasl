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
      ? "max-w-[260px] w-full"
      : size === "medium"
        ? "max-w-[460px] w-full"
        : "w-full";

  if (align === "left") {
    return cn(
      "my-3",
      size === "full" ? "w-full sm:max-w-[48%]" : sizeClass,
      isRtl
        ? "block sm:inline-block sm:float-right sm:ml-6 sm:mr-0 mb-4 clear-none text-right ml-auto mr-0"
        : "block sm:inline-block sm:float-left sm:mr-6 sm:ml-0 mb-4 clear-none text-left mr-auto ml-0",
    );
  }

  if (align === "right") {
    return cn(
      "my-3",
      size === "full" ? "w-full sm:max-w-[48%]" : sizeClass,
      isRtl
        ? "block sm:inline-block sm:float-left sm:mr-6 sm:ml-0 mb-4 clear-none text-left mr-auto ml-0"
        : "block sm:inline-block sm:float-right sm:ml-6 sm:mr-0 mb-4 clear-none text-right ml-auto mr-0",
    );
  }

  if (align === "full") {
    return "my-5 w-full block clear-both";
  }

  // default center
  return cn("my-5 mx-auto block clear-both", sizeClass);
}

/**
 * Safe URL transform for ReactMarkdown that permits data:image/ URIs alongside standard protocols.
 */
export function safeMarkdownUrlTransform(url: string): string {
  if (!url) return "";
  const trimmed = url.trim();
  if (
    trimmed.startsWith("data:image/") ||
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("/") ||
    trimmed.startsWith("./") ||
    trimmed.startsWith("#") ||
    trimmed.startsWith("mailto:") ||
    trimmed.startsWith("tel:")
  ) {
    return trimmed;
  }
  return "";
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
        dir="auto"
        className={cn(
          "prose-wasl prose-lifeos text-text leading-relaxed clear-both",
          "text-start",
          className,
        )}
      >
        <ReactMarkdown
          urlTransform={safeMarkdownUrlTransform}
          remarkPlugins={[remarkGfm, remarkBreaks]}
          components={{
            h1: ({ children }) => (
              <h1 dir="auto" className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-text mt-6 mb-3 border-b border-border/50 pb-2 text-start">
                {children}
              </h1>
            ),
            h2: ({ children }) => (
              <h2 dir="auto" className="font-display text-xl sm:text-2xl font-bold tracking-tight text-text mt-5 mb-2.5 text-start">
                {children}
              </h2>
            ),
            h3: ({ children }) => (
              <h3 dir="auto" className="font-display text-lg sm:text-xl font-semibold text-text mt-4 mb-2 text-start">
                {children}
              </h3>
            ),
            h4: ({ children }) => (
              <h4 dir="auto" className="font-display text-base font-semibold text-text mt-3 mb-1.5 text-start">
                {children}
              </h4>
            ),
            p: ({ children }) => (
              <div dir="auto" className="text-base leading-relaxed text-text/90 my-2 font-normal text-start">
                {children}
              </div>
            ),
            strong: ({ children }) => (
              <strong className="font-bold text-text">{children}</strong>
            ),
            em: ({ children }) => (
              <em className="italic text-text/90">{children}</em>
            ),
            ul: ({ children }) => (
              <ul dir="auto" className="my-3 list-disc space-y-1.5 text-base text-text/90 ms-6">
                {children}
              </ul>
            ),
            ol: ({ children }) => (
              <ol dir="auto" className="my-3 list-decimal space-y-1.5 text-base text-text/90 ms-6">
                {children}
              </ol>
            ),
            li: ({ children, className: liClassName }) => (
              <li dir="auto" className={cn("leading-relaxed text-start", liClassName)}>{children}</li>
            ),
            blockquote: ({ children }) => (
              <blockquote dir="auto" className="my-4 border-s-4 border-accent rounded-s-xl bg-accent/5 px-4 py-3 text-base italic text-muted text-start">
                {children}
              </blockquote>
            ),
            code: ({ className: codeClassName, children }) => {
              const isBlock = codeClassName?.includes("language-");
              if (isBlock) {
                return (
                  <pre dir="ltr" className="my-4 overflow-x-auto rounded-xl border border-border/80 bg-surface-2 p-4 font-mono text-xs sm:text-sm text-text shadow-inner text-left">
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
                <figure className={cn("group relative not-prose", containerCls)}>
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
