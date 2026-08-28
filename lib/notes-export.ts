import type { Note } from "./data/domains/notes";

export function formatNoteAsMarkdownString(note: Note): string {
  const dateStr = note.updatedAt ? new Date(note.updatedAt).toISOString().split("T")[0] : "";
  const lines = [
    "---",
    `title: ${JSON.stringify(note.title || "Untitled")}`,
    `tag: ${JSON.stringify(note.tag || "General")}`,
  ];

  if (note.contentType) lines.push(`contentType: ${JSON.stringify(note.contentType)}`);
  if (note.author) lines.push(`author: ${JSON.stringify(note.author)}`);
  if (note.sourceUrl) lines.push(`sourceUrl: ${JSON.stringify(note.sourceUrl)}`);
  if (dateStr) lines.push(`updated: ${JSON.stringify(dateStr)}`);
  if (note.pinned) lines.push(`pinned: true`);

  lines.push("---");
  lines.push("");
  lines.push(note.body || "");

  return lines.join("\n");
}

export function exportNoteAsMarkdown(note: Note): void {
  if (typeof window === "undefined") return;

  const content = formatNoteAsMarkdownString(note);
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const sanitizedTitle = (note.title || "note").replace(/[/\\?%*:|"<>]/g, "-").trim();

  a.href = url;
  a.download = `${sanitizedTitle || "note"}.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
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

    // Code blocks
    if (rawLine.trim().startsWith("```")) {
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

    const trimmed = rawLine.trim();

    if (!trimmed) {
      if (inList) { htmlChunks.push("</ul>"); inList = false; }
      if (inNumberedList) { htmlChunks.push("</ol>"); inNumberedList = false; }
      continue;
    }

    // Format inline markdown (bold, italic, code, links)
    const formatInline = (str: string) => {
      let res = escapeHtml(str);
      // Bold + Italic
      res = res.replace(/\*\*\*(.*?)\*\*\*/g, "<strong><em>$1</em></strong>");
      // Bold
      res = res.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
      res = res.replace(/__(.*?)__/g, "<strong>$1</strong>");
      // Italic
      res = res.replace(/\*(.*?)\*/g, "<em>$1</em>");
      res = res.replace(/_(.*?)_/g, "<em>$1</em>");
      // Inline Code
      res = res.replace(/`([^`]+)`/g, "<code>$1</code>");
      // Links
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
