// lib/images.ts

export type ImageAlignment = "center" | "left" | "right" | "full";
export type ImageSize = "small" | "medium" | "full";

export interface ParsedImageAlt {
  caption: string;
  align: ImageAlignment;
  size: ImageSize;
}

export function parseImageMarkdown(alt: string = ""): ParsedImageAlt {
  if (!alt || !alt.includes("|")) {
    return {
      caption: alt?.trim() || "",
      align: "center",
      size: "full",
    };
  }

  const parts = alt.split("|").map((p) => p.trim().toLowerCase());
  const caption = alt.split("|")[0].trim();

  let align: ImageAlignment = "center";
  let size: ImageSize = "full";

  for (let i = 1; i < parts.length; i++) {
    const part = parts[i];
    if (part === "left" || part === "right" || part === "center" || part === "full") {
      align = part as ImageAlignment;
    }
    if (part === "small" || part === "medium" || part === "full" || part === "large") {
      size = (part === "large" ? "full" : part) as ImageSize;
    }
  }

  return { caption, align, size };
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

export function extractFirstImageUrl(markdown: string = ""): string | null {
  if (!markdown) return null;
  const match = markdown.match(/!\[[^\]]*\]\(([^)]+)\)/);
  return match ? match[1] : null;
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
