// lib/images.ts

export type ImageAlignment = "center" | "left" | "right" | "full";
export type ImageSize = "small" | "medium" | "full";

export interface ParsedImageAlt {
  caption: string;
  align: ImageAlignment;
  size: ImageSize;
}

export function parseImageMarkdown(alt: string = ""): ParsedImageAlt {
  if (!alt || !alt.trim()) {
    return {
      caption: "",
      align: "center",
      size: "full",
    };
  }

  const rawParts = alt.split("|").map((p) => p.trim()).filter(Boolean);
  if (rawParts.length === 0) {
    return {
      caption: "",
      align: "center",
      size: "full",
    };
  }

  let align: ImageAlignment = "center";
  let size: ImageSize = "full";
  const captionParts: string[] = [];

  for (const part of rawParts) {
    const lower = part.toLowerCase();
    if (lower === "left" || lower === "right" || lower === "center") {
      align = lower as ImageAlignment;
    } else if (lower === "small" || lower === "medium" || lower === "large") {
      size = (lower === "large" ? "full" : lower) as ImageSize;
    } else if (lower === "full") {
      // "full" can denote either full alignment or full width
      align = "full";
      size = "full";
    } else {
      captionParts.push(part);
    }
  }

  return {
    caption: captionParts.join(" | ").trim(),
    align,
    size,
  };
}

export function formatImageMarkdown(
  src: string,
  options: { caption?: string; align?: ImageAlignment | string; size?: ImageSize | string } = {},
): string {
  const caption = options.caption?.trim() || "";
  const align = (options.align as ImageAlignment) || "center";
  const size = (options.size as ImageSize) || "full";

  const altParts = [caption, align, size].filter(Boolean);
  const altText = altParts.join(" | ");
  return `![${altText}](${src})`;
}

export function formatImageReference(
  refKey: string,
  options: { caption?: string; align?: ImageAlignment | string; size?: ImageSize | string } = {},
): string {
  const caption = options.caption?.trim() || "";
  const align = (options.align as ImageAlignment) || "center";
  const size = (options.size as ImageSize) || "full";

  const altParts = [caption, align, size].filter(Boolean);
  const altText = altParts.join(" | ");
  return `![${altText}][${refKey}]`;
}

export interface ParsedNoteMarkdown {
  cleanBody: string;
  references: Record<string, string>;
  nextId: number;
}

/**
 * Parses raw note markdown, extracting [ref]: url definitions and converting
 * legacy inline base64 images into clean reference tags ![alt][img-N].
 */
export function parseNoteMarkdown(rawMarkdown: string = ""): ParsedNoteMarkdown {
  if (!rawMarkdown) {
    return { cleanBody: "", references: {}, nextId: 1 };
  }

  const references: Record<string, string> = {};
  const lines = rawMarkdown.replace(/\r\n/g, "\n").split("\n");
  const bodyLines: string[] = [];

  // 1. Extract reference definitions [ref]: url from lines
  for (const line of lines) {
    const refMatch = line.match(/^\[([a-zA-Z0-9_-]+)\]:\s*(\S+)\s*$/);
    if (refMatch) {
      const refKey = refMatch[1];
      const refUrl = refMatch[2];
      references[refKey] = refUrl;
    } else {
      bodyLines.push(line);
    }
  }

  let cleanBody = bodyLines.join("\n").trimEnd();

  // Find the highest existing numeric ID in reference keys
  let maxId = 0;
  for (const key of Object.keys(references)) {
    const numMatch = key.match(/^img-(\d+)$/);
    if (numMatch) {
      const id = parseInt(numMatch[1], 10);
      if (id > maxId) maxId = id;
    }
  }

  // 2. Convert any inline base64 images into reference tags
  const inlineBase64Regex = /!\[([^\]]*)\]\((data:image\/[^)]+)\)/g;
  cleanBody = cleanBody.replace(inlineBase64Regex, (_match, alt, dataUri) => {
    maxId += 1;
    const refKey = `img-${maxId}`;
    references[refKey] = dataUri;
    return `![${alt}][${refKey}]`;
  });

  return {
    cleanBody,
    references,
    nextId: maxId + 1,
  };
}

/**
 * Composes clean markdown body and reference definitions into standard GFM markdown.
 */
export function composeNoteMarkdown(cleanBody: string = "", references: Record<string, string> = {}): string {
  const trimmedBody = (cleanBody || "").trimEnd();
  const refKeys = Object.keys(references);

  if (refKeys.length === 0) {
    return trimmedBody;
  }

  const refLines = refKeys.map((key) => `[${key}]: ${references[key]}`);
  return trimmedBody ? `${trimmedBody}\n\n${refLines.join("\n")}\n` : `${refLines.join("\n")}\n`;
}

export function extractFirstImageUrl(markdown: string = ""): string | null {
  if (!markdown) return null;
  // Check direct inline image
  const inlineMatch = markdown.match(/!\[[^\]]*\]\(([^)]+)\)/);
  if (inlineMatch) return inlineMatch[1];

  // Check reference-style image
  const refMatch = markdown.match(/!\[[^\]]*\]\[([a-zA-Z0-9_-]+)\]/);
  if (refMatch) {
    const refKey = refMatch[1];
    const defMatch = markdown.match(new RegExp(`^\\[${refKey}\\]:\\s*(\\S+)`, "m"));
    if (defMatch) return defMatch[1];
  }

  return null;
}

export async function compressImage(
  file: File | Blob,
  options: { maxDimension?: number; quality?: number } = {},
): Promise<string> {
  const maxDimension = options.maxDimension ?? 1600;
  const quality = options.quality ?? 0.82;

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(e.target?.result as string);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        // Try WebP first, fallback to JPEG
        try {
          const webpData = canvas.toDataURL("image/webp", quality);
          if (webpData && webpData.startsWith("data:image/webp")) {
            resolve(webpData);
            return;
          }
        } catch {
          // Fall through to jpeg
        }

        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = () => reject(new Error("Failed to load image for compression"));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error("Failed to read image file"));
    reader.readAsDataURL(file);
  });
}
