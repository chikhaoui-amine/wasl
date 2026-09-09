import type { Note } from "./data/domains/notes";

export function sanitizeFileName(name: string): string {
  const sanitized = name
    .replace(/[<>:"/\\|?*]+/g, " - ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[-_\s]+|[-_\s]+$/g, "");
  return sanitized || "untitled-note";
}

/**
 * Formats a Note entity into Markdown with YAML frontmatter.
 * Designed to be symmetrical with `lib/notes-import.ts`.
 */
export function formatNoteToMarkdown(note: Note): string {
  const frontmatterLines: string[] = [
    "---",
    `title: ${JSON.stringify(note.title || "Untitled Note")}`,
    `tag: ${JSON.stringify(note.tag || "General")}`,
  ];

  if (note.author) {
    frontmatterLines.push(`author: ${JSON.stringify(note.author)}`);
  }
  if (note.sourceUrl) {
    frontmatterLines.push(`sourceUrl: ${JSON.stringify(note.sourceUrl)}`);
  }
  if (note.contentType) {
    frontmatterLines.push(`contentType: ${JSON.stringify(note.contentType)}`);
  }
  if (typeof note.pinned === "boolean") {
    frontmatterLines.push(`pinned: ${note.pinned}`);
  }
  if (note.section) {
    frontmatterLines.push(`section: ${JSON.stringify(note.section)}`);
  }

  frontmatterLines.push("---", "");
  const body = note.body ? note.body.trim() : "";

  return frontmatterLines.join("\n") + body + "\n";
}

// Backward compatibility alias
export const formatNoteAsMarkdownString = formatNoteToMarkdown;

// CRC-32 Table for standard zip checksums
function makeCrcTable(): Uint32Array {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c;
  }
  return table;
}

const CRC_TABLE = makeCrcTable();

function calculateCrc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ bytes[i]) & 0xff];
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * Zero-dependency standard PKZIP archive generator.
 * Emits an uncompressed (Store) ZIP Blob compatible with all major OS zip tools.
 */
export function createZipArchive(
  files: Array<{ name: string; content: string }>,
): Blob {
  const encoder = new TextEncoder();
  const localChunks: Uint8Array[] = [];
  const centralChunks: Uint8Array[] = [];

  let offset = 0;
  const now = new Date();
  const dosTime =
    ((now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1)) & 0xffff;
  const dosDate =
    (((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate()) & 0xffff;

  for (const file of files) {
    const filenameBytes = encoder.encode(file.name);
    const dataBytes = encoder.encode(file.content);
    const crc = calculateCrc32(dataBytes);
    const size = dataBytes.length;

    // 1. Local File Header (30 bytes + name + data)
    const localHeader = new Uint8Array(30 + filenameBytes.length);
    const lv = new DataView(localHeader.buffer);
    lv.setUint32(0, 0x04034b50, true); // Local header signature
    lv.setUint16(4, 20, true); // Version needed to extract (2.0)
    lv.setUint16(6, 0x0800, true); // Bit flag (0x0800 = UTF-8 filenames)
    lv.setUint16(8, 0, true); // Compression method: 0 (Store)
    lv.setUint16(10, dosTime, true);
    lv.setUint16(12, dosDate, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, size, true); // Compressed size
    lv.setUint32(22, size, true); // Uncompressed size
    lv.setUint16(26, filenameBytes.length, true);
    lv.setUint16(28, 0, true); // Extra field length
    localHeader.set(filenameBytes, 30);

    localChunks.push(localHeader);
    localChunks.push(dataBytes);

    // 2. Central Directory Header (46 bytes + name)
    const cdHeader = new Uint8Array(46 + filenameBytes.length);
    const cv = new DataView(cdHeader.buffer);
    cv.setUint32(0, 0x02014b50, true); // Central header signature
    cv.setUint16(4, 20, true); // Version made by
    cv.setUint16(6, 20, true); // Version needed to extract
    cv.setUint16(8, 0x0800, true); // Bit flag: UTF-8
    cv.setUint16(10, 0, true); // Compression method: Store
    cv.setUint16(12, dosTime, true);
    cv.setUint16(14, dosDate, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, size, true);
    cv.setUint32(24, size, true);
    cv.setUint16(28, filenameBytes.length, true);
    cv.setUint16(30, 0, true); // Extra field length
    cv.setUint16(32, 0, true); // Comment length
    cv.setUint16(34, 0, true); // Disk number start
    cv.setUint16(36, 0, true); // Internal attributes
    cv.setUint32(38, 0, true); // External attributes
    cv.setUint32(42, offset, true); // Relative offset of local header
    cdHeader.set(filenameBytes, 46);

    centralChunks.push(cdHeader);

    offset += localHeader.length + dataBytes.length;
  }

  const centralDirOffset = offset;
  let centralDirSize = 0;
  for (const chunk of centralChunks) {
    centralDirSize += chunk.length;
  }

  // 3. End of Central Directory Record (22 bytes)
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true); // EOCD signature
  ev.setUint16(4, 0, true); // Disk number
  ev.setUint16(6, 0, true); // Disk with central directory
  ev.setUint16(8, files.length, true); // Total entries on this disk
  ev.setUint16(10, files.length, true); // Total entries
  ev.setUint32(12, centralDirSize, true); // Size of central directory
  ev.setUint32(16, centralDirOffset, true); // Offset of start of central directory
  ev.setUint16(20, 0, true); // ZIP comment length

  return new Blob([...localChunks, ...centralChunks, eocd] as BlobPart[], {
    type: "application/zip",
  });
}

function triggerBrowserDownload(blob: Blob, fileName: string): void {
  if (typeof window === "undefined") return;
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/**
 * Triggers a browser download of selected notes.
 * If 1 note is given: downloads a single `.md` file.
 * If multiple notes: bundles them into a clean `.zip` archive.
 */
export async function exportNotesAsFiles(notes: Note[]): Promise<void> {
  if (notes.length === 0) return;

  if (notes.length === 1) {
    exportNoteAsMarkdown(notes[0]);
    return;
  }

  // Deduplicate file names if notes have identical titles
  const seenNames = new Map<string, number>();
  const files: Array<{ name: string; content: string }> = [];

  for (const note of notes) {
    const baseName = sanitizeFileName(note.title);
    const count = seenNames.get(baseName) || 0;
    seenNames.set(baseName, count + 1);

    const fileName = count > 0 ? `${baseName}-${count + 1}.md` : `${baseName}.md`;
    files.push({
      name: fileName,
      content: formatNoteToMarkdown(note),
    });
  }

  const zipBlob = createZipArchive(files);
  triggerBrowserDownload(zipBlob, `wasl-notes-export-${new Date().toISOString().slice(0, 10)}.zip`);
}

/**
 * Single note markdown export function.
 */
export function exportNoteAsMarkdown(note: Note): void {
  if (typeof window === "undefined") return;

  const content = formatNoteToMarkdown(note);
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const sanitizedTitle = sanitizeFileName(note.title);
  triggerBrowserDownload(blob, `${sanitizedTitle}.md`);
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function renderMarkdownToCleanHtml(markdown: string): string {
  if (!markdown) return "";

  const lines = markdown.split("\n");
  const htmlChunks: string[] = [];
  let inList = false;
  let inNumberedList = false;
  let inCodeBlock = false;
  let codeBlockContent: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    // Code blocks
    if (trimmed.startsWith("```")) {
      if (inCodeBlock) {
        htmlChunks.push(`<pre><code>${escapeHtml(codeBlockContent.join("\n"))}</code></pre>`);
        codeBlockContent = [];
        inCodeBlock = false;
      } else {
        if (inList) { htmlChunks.push("</ul>"); inList = false; }
        if (inNumberedList) { htmlChunks.push("</ol>"); inNumberedList = false; }
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockContent.push(rawLine);
      continue;
    }

    // Blank line
    if (!trimmed) {
      if (inList) { htmlChunks.push("</ul>"); inList = false; }
      if (inNumberedList) { htmlChunks.push("</ol>"); inNumberedList = false; }
      continue;
    }

    const formatInline = (text: string) => {
      let res = escapeHtml(text);
      res = res.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
      res = res.replace(/\*(.*?)\*/g, "<em>$1</em>");
      res = res.replace(/`([^`]+)`/g, "<code>$1</code>");
      res = res.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');
      return res;
    };

    // Headings
    if (trimmed.startsWith("### ")) {
      if (inList) { htmlChunks.push("</ul>"); inList = false; }
      if (inNumberedList) { htmlChunks.push("</ol>"); inNumberedList = false; }
      htmlChunks.push(`<h3>${formatInline(trimmed.slice(4))}</h3>`);
      continue;
    }
    if (trimmed.startsWith("## ")) {
      if (inList) { htmlChunks.push("</ul>"); inList = false; }
      if (inNumberedList) { htmlChunks.push("</ol>"); inNumberedList = false; }
      htmlChunks.push(`<h2>${formatInline(trimmed.slice(3))}</h2>`);
      continue;
    }
    if (trimmed.startsWith("# ")) {
      if (inList) { htmlChunks.push("</ul>"); inList = false; }
      if (inNumberedList) { htmlChunks.push("</ol>"); inNumberedList = false; }
      htmlChunks.push(`<h2>${formatInline(trimmed.slice(2))}</h2>`);
      continue;
    }

    // Blockquote
    if (trimmed.startsWith("> ")) {
      if (inList) { htmlChunks.push("</ul>"); inList = false; }
      if (inNumberedList) { htmlChunks.push("</ol>"); inNumberedList = false; }
      htmlChunks.push(`<blockquote>${formatInline(trimmed.slice(2))}</blockquote>`);
      continue;
    }

    // Unordered list / Checkbox
    const listMatch = trimmed.match(/^[-*•]\s+(.*)$/);
    if (listMatch) {
      if (inNumberedList) { htmlChunks.push("</ol>"); inNumberedList = false; }
      if (!inList) { htmlChunks.push("<ul>"); inList = true; }

      let content = listMatch[1];
      if (content.startsWith("[x] ") || content.startsWith("[X] ")) {
        content = `<input type="checkbox" checked disabled style="margin-right: 6px;" /> ${content.slice(4)}`;
      } else if (content.startsWith("[ ] ")) {
        content = `<input type="checkbox" disabled style="margin-right: 6px;" /> ${content.slice(4)}`;
      }

      htmlChunks.push(`<li>${formatInline(content)}</li>`);
      continue;
    }

    // Numbered list
    const numMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
    if (numMatch) {
      if (inList) { htmlChunks.push("</ul>"); inList = false; }
      if (!inNumberedList) { htmlChunks.push("<ol>"); inNumberedList = true; }
      htmlChunks.push(`<li>${formatInline(numMatch[2])}</li>`);
      continue;
    }

    // Paragraph
    if (inList) { htmlChunks.push("</ul>"); inList = false; }
    if (inNumberedList) { htmlChunks.push("</ol>"); inNumberedList = false; }
    htmlChunks.push(`<p>${formatInline(trimmed)}</p>`);
  }

  if (inList) htmlChunks.push("</ul>");
  if (inNumberedList) htmlChunks.push("</ol>");
  if (inCodeBlock) htmlChunks.push(`<pre><code>${escapeHtml(codeBlockContent.join("\n"))}</code></pre>`);

  return htmlChunks.join("\n");
}

export function exportNoteAsPdf(note: Note, categoryColor: string = "#6366f1"): void {
  if (typeof window === "undefined") return;

  const dateStr = note.updatedAt
    ? new Date(note.updatedAt).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "";

  const printWindow = window.open("", "_blank");
  if (!printWindow) return;

  const sanitizedTitle = escapeHtml(note.title || "Untitled");
  const renderedContent = renderMarkdownToCleanHtml(note.body || "");
  const color = categoryColor.startsWith("var") ? "#6366f1" : categoryColor;

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>${sanitizedTitle}</title>
        <meta charset="utf-8" />
        <style>
          @page {
            margin: 18mm 20mm 18mm 20mm;
            size: auto;
          }
          *, *::before, *::after {
            box-sizing: border-box;
          }
          html, body {
            margin: 0;
            padding: 0;
            background: #ffffff;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            color: #1e293b;
            line-height: 1.65;
            max-width: 100%;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .header {
            margin-top: 0;
            margin-bottom: 20px;
            padding-bottom: 12px;
            border-bottom: 1.5px solid #e2e8f0;
            break-after: avoid;
            page-break-after: avoid;
          }
          .badge {
            display: inline-block;
            background: ${color};
            color: #ffffff;
            padding: 2.5px 9px;
            border-radius: 9999px;
            font-size: 11px;
            font-weight: 600;
            letter-spacing: 0.02em;
            margin-bottom: 8px;
            text-transform: uppercase;
          }
          h1 {
            font-size: 24px;
            font-weight: 700;
            line-height: 1.25;
            margin: 0 0 6px 0;
            color: #0f172a;
            break-after: avoid;
            page-break-after: avoid;
          }
          .meta {
            font-size: 12px;
            color: #64748b;
            margin-top: 4px;
          }
          .content {
            font-size: 13.5px;
            color: #334155;
          }
          .content p {
            margin: 0 0 11px 0;
            break-inside: avoid;
            page-break-inside: avoid;
          }
          .content h2 {
            font-size: 17px;
            font-weight: 700;
            color: #0f172a;
            margin: 20px 0 8px 0;
            padding-bottom: 4px;
            border-bottom: 1px solid #f1f5f9;
            break-after: avoid;
            page-break-after: avoid;
          }
          .content h3 {
            font-size: 14.5px;
            font-weight: 600;
            color: #1e293b;
            margin: 16px 0 6px 0;
            break-after: avoid;
            page-break-after: avoid;
          }
          .content ul, .content ol {
            margin: 0 0 12px 0;
            padding-left: 20px;
          }
          .content li {
            margin-bottom: 5px;
            break-inside: avoid;
            page-break-inside: avoid;
          }
          .content blockquote {
            margin: 12px 0;
            padding: 8px 14px;
            border-left: 3.5px solid ${color};
            background: #f8fafc;
            color: #475569;
            font-style: italic;
            border-radius: 0 6px 6px 0;
            break-inside: avoid;
            page-break-inside: avoid;
          }
          .content code {
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            font-size: 12px;
            background: #f1f5f9;
            color: #0f172a;
            padding: 2px 5px;
            border-radius: 4px;
          }
          .content pre {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            padding: 12px 14px;
            border-radius: 8px;
            overflow-x: auto;
            margin: 12px 0;
            break-inside: avoid;
            page-break-inside: avoid;
          }
          .content pre code {
            background: transparent;
            padding: 0;
          }
          .content strong {
            color: #0f172a;
            font-weight: 600;
          }
          .content a {
            color: #2563eb;
            text-decoration: underline;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <span class="badge">${note.tag || "General"}</span>
          <h1>${sanitizedTitle}</h1>
          <div class="meta">
            ${note.author ? `<span>By ${escapeHtml(note.author)} • </span>` : ""}
            ${dateStr ? `<span>${dateStr}</span>` : ""}
          </div>
        </div>
        <div class="content">${renderedContent}</div>
        <script>
          window.onload = function() {
            window.print();
            window.onafterprint = function() { window.close(); };
          };
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
}
