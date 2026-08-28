import type { Note, NoteContentType } from "./data/domains/notes";

export interface ParsedNoteData {
  title: string;
  body: string;
  tag: string;
  author?: string;
  sourceUrl?: string;
  contentType?: NoteContentType;
  pinned?: boolean;
}

export function parseMarkdownNote(
  rawText: string,
  fileName: string,
  fallbackTag: string = "General",
): ParsedNoteData {
  const trimmed = rawText.trim();
  let title = "";
  let tag = fallbackTag;
  let author: string | undefined;
  let sourceUrl: string | undefined;
  let contentType: NoteContentType = "note";
  let pinned = false;
  let body = trimmed;

  // 1. Check for YAML frontmatter (--- ... ---)
  if (trimmed.startsWith("---")) {
    const endIndex = trimmed.indexOf("---", 3);
    if (endIndex !== -1) {
      const frontmatterText = trimmed.slice(3, endIndex).trim();
      body = trimmed.slice(endIndex + 3).trim();

      const lines = frontmatterText.split("\n");
      for (const line of lines) {
        const colonIdx = line.indexOf(":");
        if (colonIdx === -1) continue;

        const key = line.slice(0, colonIdx).trim().toLowerCase();
        let val = line.slice(colonIdx + 1).trim();
        if (
          (val.startsWith('"') && val.endsWith('"')) ||
          (val.startsWith("'") && val.endsWith("'"))
        ) {
          val = val.slice(1, -1);
        }

        if (key === "title") title = val;
        else if (key === "tag" || key === "category") tag = val;
        else if (key === "author") author = val;
        else if (key === "sourceurl" || key === "source_url" || key === "url") sourceUrl = val;
        else if (key === "contenttype" || key === "content_type" || key === "type") {
          if (["note", "read", "listen", "idea"].includes(val.toLowerCase())) {
            contentType = val.toLowerCase() as NoteContentType;
          }
        } else if (key === "pinned") {
          pinned = val.toLowerCase() === "true";
        }
      }
    }
  }

  // 2. If no title from frontmatter, search for first # Heading
  if (!title) {
    const headingMatch = body.match(/^#\s+(.+)$/m);
    if (headingMatch) {
      title = headingMatch[1].trim();
      body = body.replace(/^#\s+.+\n?/, "").trim();
    }
  }

  // 3. If still no title, derive from filename
  if (!title) {
    const nameWithoutExt = fileName.replace(/\.(md|markdown|txt)$/i, "");
    title = nameWithoutExt.replace(/[-_]+/g, " ").trim();
  }

  return {
    title: title || "Untitled Note",
    body: body || "",
    tag: tag || fallbackTag || "General",
    author,
    sourceUrl,
    contentType,
    pinned,
  };
}

export async function importMarkdownFiles(
  files: FileList | File[],
  fallbackTag: string,
  onAddNote: (note: Omit<Note, "id" | "updatedAt">) => Promise<unknown>,
): Promise<number> {
  const fileArray = Array.from(files);
  let importedCount = 0;

  for (const file of fileArray) {
    if (!file.name.match(/\.(md|markdown|txt)$/i)) continue;

    try {
      const text = await file.text();
      const parsed = parseMarkdownNote(text, file.name, fallbackTag);
      await onAddNote({
        title: parsed.title,
        body: parsed.body,
        tag: parsed.tag,
        author: parsed.author,
        sourceUrl: parsed.sourceUrl,
        contentType: parsed.contentType,
        pinned: parsed.pinned ?? false,
      });
      importedCount++;
    } catch (err) {
      console.error(`Failed to import note file ${file.name}:`, err);
    }
  }

  return importedCount;
}
