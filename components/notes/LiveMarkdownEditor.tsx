"use client";

import React, {
  useRef,
  useEffect,
  useImperativeHandle,
  forwardRef,
  useState,
  useCallback,
} from "react";
import { parseImageMarkdown, formatImageMarkdown, compressImage, type ImageAlignment, type ImageSize } from "@/lib/images";
import { isRtlText } from "@/components/ui/MarkdownRenderer";
import { ImageLightbox } from "@/components/ui/ImageLightbox";
import { cn } from "@/lib/utils";

export interface LiveMarkdownEditorRef {
  insertSnippet: (snippet: string) => void;
  applyFormatting: (prefix: string, suffix?: string) => void;
  formatBlock: (tag: "h1" | "h2" | "h3" | "p" | "blockquote" | "ul" | "ol" | "task" | "code") => void;
  focus: () => void;
}

interface LiveMarkdownEditorProps {
  value: string;
  onChange: (newValue: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function inlineMarkdownToHtml(text: string): string {
  let html = escapeHtml(text);
  // Bold **text** or __text__
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/__(.+?)__/g, "<strong>$1</strong>");
  // Strikethrough ~~text~~
  html = html.replace(/~~(.+?)~~/g, "<del>$1</del>");
  // Italic *text* or _text_
  html = html.replace(/\*([^*]+?)\*/g, "<em>$1</em>");
  html = html.replace(/_([^_]+?)_/g, "<em>$1</em>");
  // Inline code `code`
  html = html.replace(/`([^`]+?)`/g, '<code class="rounded-md border border-border/60 bg-surface-2 px-1.5 py-0.5 font-mono text-[13px] text-accent font-medium">$1</code>');
  // Links [text](url)
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-accent underline font-semibold">$1</a>');
  return html;
}

function getImageClasses(align: ImageAlignment, size: ImageSize): string {
  const sizeCls =
    size === "small"
      ? "max-w-[260px] w-full sm:w-auto"
      : size === "medium"
        ? "max-w-[460px] w-full sm:w-auto"
        : "w-full";

  if (align === "left") {
    return cn("my-3 sm:my-2 float-none sm:float-left sm:mr-6 sm:mb-4 sm:max-w-[48%] clear-none text-left", sizeCls);
  }
  if (align === "right") {
    return cn("my-3 sm:my-2 float-none sm:float-right sm:ml-6 sm:mb-4 sm:max-w-[48%] clear-none text-right", sizeCls);
  }
  if (align === "full") {
    return "my-5 w-full block clear-both";
  }
  return cn("my-5 mx-auto block clear-both", sizeCls);
}

/**
 * Converts Markdown string into clean semantic HTML for contentEditable canvas
 */
export function markdownToHtml(markdown: string): string {
  if (!markdown || !markdown.trim()) {
    return "<p><br></p>";
  }

  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const htmlParts: string[] = [];
  let inCodeBlock = false;
  let codeBlockLines: string[] = [];
  let currentListType: "ul" | "ol" | null = null;
  let listItems: string[] = [];

  const flushList = () => {
    if (currentListType && listItems.length > 0) {
      const tag = currentListType;
      const listCls = tag === "ul" ? "list-disc ml-6 my-3 space-y-1 text-text/90" : "list-decimal ml-6 my-3 space-y-1 text-text/90";
      htmlParts.push(`<${tag} class="${listCls}">${listItems.map((li) => `<li class="leading-relaxed">${li}</li>`).join("")}</${tag}>`);
      listItems = [];
      currentListType = null;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Code block ```
    if (trimmed.startsWith("```")) {
      flushList();
      if (inCodeBlock) {
        const code = codeBlockLines.map(escapeHtml).join("\n");
        htmlParts.push(`<pre dir="ltr" class="my-4 overflow-x-auto rounded-xl border border-border/80 bg-surface-2 p-4 font-mono text-xs sm:text-sm text-text shadow-inner"><code>${code}</code></pre>`);
        codeBlockLines = [];
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
        codeBlockLines = [];
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockLines.push(line);
      continue;
    }

    // Blank line
    if (!trimmed) {
      flushList();
      continue;
    }

    // Task item: - [ ] or - [x]
    const taskMatch = line.match(/^-\s+\[([ xX])\]\s*(.*)$/);
    if (taskMatch) {
      flushList();
      const checked = taskMatch[1].toLowerCase() === "x";
      const taskBody = inlineMarkdownToHtml(taskMatch[2]);
      htmlParts.push(
        `<div data-type="task" data-checked="${checked ? "true" : "false"}" class="flex items-start gap-2.5 my-1.5 group select-none">` +
          `<input type="checkbox" ${checked ? "checked" : ""} class="mt-1 h-4 w-4 rounded accent-accent cursor-pointer shrink-0" />` +
          `<span class="task-text flex-1 outline-none text-base leading-relaxed ${checked ? "text-faint line-through" : "text-text"}">${taskBody || "<br>"}</span>` +
        `</div>`
      );
      continue;
    }

    // Bullet List: - item or * item
    const bulletMatch = line.match(/^[-*]\s+(.*)$/);
    if (bulletMatch) {
      if (currentListType !== "ul") {
        flushList();
        currentListType = "ul";
      }
      listItems.push(inlineMarkdownToHtml(bulletMatch[1]));
      continue;
    }

    // Numbered List: 1. item
    const numMatch = line.match(/^\d+\.\s+(.*)$/);
    if (numMatch) {
      if (currentListType !== "ol") {
        flushList();
        currentListType = "ol";
      }
      listItems.push(inlineMarkdownToHtml(numMatch[1]));
      continue;
    }

    flushList();

    // Headings
    if (trimmed.startsWith("### ")) {
      htmlParts.push(`<h3 class="font-display text-lg sm:text-xl font-semibold text-text mt-4 mb-2">${inlineMarkdownToHtml(trimmed.slice(4))}</h3>`);
      continue;
    }
    if (trimmed.startsWith("## ")) {
      htmlParts.push(`<h2 class="font-display text-xl sm:text-2xl font-bold tracking-tight text-text mt-5 mb-2.5">${inlineMarkdownToHtml(trimmed.slice(3))}</h2>`);
      continue;
    }
    if (trimmed.startsWith("# ")) {
      htmlParts.push(`<h1 class="font-display text-2xl sm:text-3xl font-bold tracking-tight text-text mt-6 mb-3 border-b border-border/50 pb-2">${inlineMarkdownToHtml(trimmed.slice(2))}</h1>`);
      continue;
    }

    // Blockquote: > text
    if (trimmed.startsWith("> ")) {
      htmlParts.push(`<blockquote class="my-4 border-l-4 border-accent rounded-r-xl bg-accent/5 px-4 py-3 text-base italic text-muted">${inlineMarkdownToHtml(trimmed.slice(2))}</blockquote>`);
      continue;
    }

    // Image: ![alt](url)
    const imgMatch = trimmed.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (imgMatch) {
      const { caption, align, size } = parseImageMarkdown(imgMatch[1] || "");
      const containerCls = getImageClasses(align, size);
      htmlParts.push(
        `<figure data-type="image" data-rawalt="${escapeHtml(imgMatch[1] || "")}" data-src="${escapeHtml(imgMatch[2])}" class="${containerCls} inline-block group not-prose cursor-zoom-in">` +
          `<div class="relative overflow-hidden rounded-xl border border-border/80 bg-surface-2/40 shadow-sm transition-all hover:border-accent/50 hover:shadow-md">` +
            `<img src="${escapeHtml(imgMatch[2])}" alt="${escapeHtml(caption || "Note photo")}" class="h-auto w-full max-h-[550px] object-contain rounded-xl" />` +
          `</div>` +
          (caption ? `<figcaption class="mt-1.5 text-center text-xs font-medium italic text-faint">${escapeHtml(caption)}</figcaption>` : "") +
        `</figure>`
      );
      continue;
    }

    // Standard Paragraph
    htmlParts.push(`<p class="text-base leading-relaxed text-text/90 my-2 font-normal whitespace-pre-wrap">${inlineMarkdownToHtml(line)}</p>`);
  }

  flushList();
  if (inCodeBlock && codeBlockLines.length > 0) {
    const code = codeBlockLines.map(escapeHtml).join("\n");
    htmlParts.push(`<pre dir="ltr" class="my-4 overflow-x-auto rounded-xl border border-border/80 bg-surface-2 p-4 font-mono text-xs sm:text-sm text-text shadow-inner"><code>${code}</code></pre>`);
  }

  return htmlParts.join("");
}

/**
 * Converts DOM tree inside contentEditable back into clean GitHub-Flavored Markdown
 */
export function htmlToMarkdown(container: HTMLElement): string {
  if (!container) return "";

  const extractInline = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent || "";
    }
    if (node.nodeType !== Node.ELEMENT_NODE) {
      return "";
    }

    const el = node as HTMLElement;
    const tagName = el.tagName.toLowerCase();

    // Nested children
    let childrenText = "";
    for (let i = 0; i < el.childNodes.length; i++) {
      childrenText += extractInline(el.childNodes[i]);
    }

    if (tagName === "strong" || tagName === "b") {
      return `**${childrenText}**`;
    }
    if (tagName === "em" || tagName === "i") {
      return `*${childrenText}*`;
    }
    if (tagName === "u") {
      return `<u>${childrenText}</u>`;
    }
    if (tagName === "del" || tagName === "s" || tagName === "strike") {
      return `~~${childrenText}~~`;
    }
    if (tagName === "code" && el.parentElement?.tagName.toLowerCase() !== "pre") {
      return `\`${childrenText}\``;
    }
    if (tagName === "a") {
      const href = el.getAttribute("href") || "";
      return `[${childrenText}](${href})`;
    }
    if (tagName === "br") {
      return "\n";
    }

    return childrenText;
  };

  const blocks: string[] = [];

  for (let i = 0; i < container.childNodes.length; i++) {
    const node = container.childNodes[i];
    if (node.nodeType === Node.TEXT_NODE) {
      const text = (node.textContent || "").trim();
      if (text) {
        blocks.push(text);
      }
      continue;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) continue;
    const el = node as HTMLElement;
    const tagName = el.tagName.toLowerCase();

    // Image Figure
    if (el.getAttribute("data-type") === "image" || tagName === "figure") {
      const rawAlt = el.getAttribute("data-rawalt") || el.querySelector("img")?.getAttribute("alt") || "";
      const src = el.getAttribute("data-src") || el.querySelector("img")?.getAttribute("src") || "";
      if (src) {
        blocks.push(`![${rawAlt}](${src})`);
      }
      continue;
    }

    // Direct img
    if (tagName === "img") {
      const alt = el.getAttribute("alt") || "";
      const src = el.getAttribute("src") || "";
      if (src) {
        blocks.push(`![${alt}](${src})`);
      }
      continue;
    }

    // Task item
    if (el.getAttribute("data-type") === "task" || el.classList.contains("task-item")) {
      const checkbox = el.querySelector('input[type="checkbox"]') as HTMLInputElement | null;
      const isChecked = checkbox ? checkbox.checked : el.getAttribute("data-checked") === "true";
      const textEl = el.querySelector(".task-text") || el;
      const text = extractInline(textEl).trim();
      blocks.push(`- [${isChecked ? "x" : " "}] ${text}`);
      continue;
    }

    // Headings
    if (tagName === "h1") {
      const text = extractInline(el).trim();
      if (text) blocks.push(`# ${text}`);
      continue;
    }
    if (tagName === "h2") {
      const text = extractInline(el).trim();
      if (text) blocks.push(`## ${text}`);
      continue;
    }
    if (tagName === "h3") {
      const text = extractInline(el).trim();
      if (text) blocks.push(`### ${text}`);
      continue;
    }
    if (tagName === "h4" || tagName === "h5" || tagName === "h6") {
      const text = extractInline(el).trim();
      if (text) blocks.push(`#### ${text}`);
      continue;
    }

    // Unordered list
    if (tagName === "ul") {
      const lis = el.querySelectorAll(":scope > li");
      const listTexts: string[] = [];
      lis.forEach((li) => {
        const liText = extractInline(li).trim();
        if (liText) listTexts.push(`- ${liText}`);
      });
      if (listTexts.length > 0) {
        blocks.push(listTexts.join("\n"));
      }
      continue;
    }

    // Ordered list
    if (tagName === "ol") {
      const lis = el.querySelectorAll(":scope > li");
      const listTexts: string[] = [];
      lis.forEach((li, idx) => {
        const liText = extractInline(li).trim();
        if (liText) listTexts.push(`${idx + 1}. ${liText}`);
      });
      if (listTexts.length > 0) {
        blocks.push(listTexts.join("\n"));
      }
      continue;
    }

    // Blockquote
    if (tagName === "blockquote") {
      const text = extractInline(el).trim();
      if (text) blocks.push(`> ${text}`);
      continue;
    }

    // Code block
    if (tagName === "pre") {
      const code = el.textContent || "";
      blocks.push(`\`\`\`\n${code.replace(/\n$/, "")}\n\`\`\``);
      continue;
    }

    // Paragraph / Div
    const text = extractInline(el).trim();
    if (text) {
      blocks.push(text);
    }
  }

  return blocks.join("\n\n");
}

export const LiveMarkdownEditor = forwardRef<LiveMarkdownEditorRef, LiveMarkdownEditorProps>(
  function LiveMarkdownEditor(
    { value, onChange, onBlur, placeholder = "Write your thoughts freely...", className, autoFocus },
    ref,
  ) {
    const editorRef = useRef<HTMLDivElement>(null);
    const isInternalChangeRef = useRef(false);
    const lastValueRef = useRef(value);
    const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

    // Collect all images in document for lightbox zoom
    const allImages = React.useMemo(() => {
      if (!value) return [];
      const matches = Array.from(value.matchAll(/!\[([^\]]*)\]\(([^)]+)\)/g));
      return matches.map((m) => {
        const { caption } = parseImageMarkdown(m[1] || "");
        return {
          rawAlt: m[1] || "",
          caption,
          src: m[2],
        };
      });
    }, [value]);

    // Synchronize external value to HTML inside editor
    useEffect(() => {
      if (isInternalChangeRef.current) {
        isInternalChangeRef.current = false;
        return;
      }
      if (editorRef.current) {
        const currentHtml = editorRef.current.innerHTML;
        const targetHtml = markdownToHtml(value);
        if (currentHtml !== targetHtml && value !== lastValueRef.current) {
          editorRef.current.innerHTML = targetHtml;
          lastValueRef.current = value;
        }
      }
    }, [value]);

    // Initial load
    useEffect(() => {
      if (editorRef.current && !editorRef.current.innerHTML) {
        editorRef.current.innerHTML = markdownToHtml(value);
      }
      if (autoFocus && editorRef.current) {
        editorRef.current.focus();
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps -- run only on initial mount
    }, [autoFocus]);

    const notifyChange = useCallback(() => {
      if (!editorRef.current) return;
      const md = htmlToMarkdown(editorRef.current);
      lastValueRef.current = md;
      isInternalChangeRef.current = true;
      onChange(md);
    }, [onChange]);

    // Handle interactive task checkbox clicks
    const handleEditorClick = (e: React.MouseEvent<HTMLDivElement>) => {
      const target = e.target as HTMLElement;

      // Checkbox click
      if (target.tagName.toLowerCase() === "input" && (target as HTMLInputElement).type === "checkbox") {
        const checkbox = target as HTMLInputElement;
        const taskDiv = checkbox.closest('[data-type="task"], .task-item') as HTMLElement | null;
        if (taskDiv) {
          const isChecked = checkbox.checked;
          taskDiv.setAttribute("data-checked", isChecked ? "true" : "false");
          const textSpan = taskDiv.querySelector(".task-text") as HTMLElement | null;
          if (textSpan) {
            if (isChecked) {
              textSpan.classList.add("line-through", "text-faint");
              textSpan.classList.remove("text-text");
            } else {
              textSpan.classList.remove("line-through", "text-faint");
              textSpan.classList.add("text-text");
            }
          }
          notifyChange();
        }
        return;
      }

      // Figure image click -> open lightbox
      const figure = target.closest("figure[data-type='image']") as HTMLElement | null;
      if (figure) {
        const src = figure.getAttribute("data-src") || figure.querySelector("img")?.getAttribute("src");
        if (src) {
          const idx = allImages.findIndex((img) => img.src === src);
          setLightboxIndex(idx >= 0 ? idx : 0);
        }
      }
    };

    // Real-time markdown syntax typing shortcuts
    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "Enter") {
        const sel = window.getSelection();
        if (!sel || !sel.anchorNode) return;

        const anchor = sel.anchorNode;
        const currentElement = anchor.nodeType === Node.ELEMENT_NODE ? (anchor as HTMLElement) : anchor.parentElement;
        const taskDiv = currentElement?.closest('[data-type="task"], .task-item') as HTMLElement | null;

        // If inside a task item and Enter is pressed
        if (taskDiv && editorRef.current) {
          const text = (taskDiv.textContent || "").trim();
          if (!text) {
            // Empty task item: break out to normal paragraph
            e.preventDefault();
            const p = document.createElement("p");
            p.className = "text-base leading-relaxed text-text/90 my-2 font-normal";
            p.innerHTML = "<br>";
            taskDiv.replaceWith(p);

            const range = document.createRange();
            range.setStart(p, 0);
            range.collapse(true);
            sel.removeAllRanges();
            sel.addRange(range);
            notifyChange();
            return;
          }

          // Non-empty task item: insert next task checkbox below
          e.preventDefault();
          const nextTask = document.createElement("div");
          nextTask.setAttribute("data-type", "task");
          nextTask.setAttribute("data-checked", "false");
          nextTask.className = "flex items-start gap-2.5 my-1.5 group select-none";
          nextTask.innerHTML = `<input type="checkbox" class="mt-1 h-4 w-4 rounded accent-accent cursor-pointer shrink-0" /><span class="task-text flex-1 outline-none text-base leading-relaxed text-text"><br></span>`;

          taskDiv.after(nextTask);
          const nextSpan = nextTask.querySelector(".task-text") as HTMLElement;
          const range = document.createRange();
          range.setStart(nextSpan, 0);
          range.collapse(true);
          sel.removeAllRanges();
          sel.addRange(range);
          notifyChange();
          return;
        }
      }
    };

    const handleInput = () => {
      const sel = window.getSelection();
      if (sel && sel.anchorNode) {
        const anchor = sel.anchorNode;
        const currentEl = anchor.nodeType === Node.ELEMENT_NODE ? (anchor as HTMLElement) : anchor.parentElement;

        if (currentEl && editorRef.current && currentEl.tagName.toLowerCase() === "p") {
          const text = currentEl.textContent || "";

          // Markdown shortcut `# ` -> H1
          if (text.startsWith("# ")) {
            const h1 = document.createElement("h1");
            h1.className = "font-display text-2xl sm:text-3xl font-bold tracking-tight text-text mt-6 mb-3 border-b border-border/50 pb-2";
            h1.textContent = text.slice(2);
            currentEl.replaceWith(h1);
            setSelectionToEnd(h1);
          } else if (text.startsWith("## ")) {
            const h2 = document.createElement("h2");
            h2.className = "font-display text-xl sm:text-2xl font-bold tracking-tight text-text mt-5 mb-2.5";
            h2.textContent = text.slice(3);
            currentEl.replaceWith(h2);
            setSelectionToEnd(h2);
          } else if (text.startsWith("### ")) {
            const h3 = document.createElement("h3");
            h3.className = "font-display text-lg sm:text-xl font-semibold text-text mt-4 mb-2";
            h3.textContent = text.slice(4);
            currentEl.replaceWith(h3);
            setSelectionToEnd(h3);
          } else if (text.startsWith("> ")) {
            const bq = document.createElement("blockquote");
            bq.className = "my-4 border-l-4 border-accent rounded-r-xl bg-accent/5 px-4 py-3 text-base italic text-muted";
            bq.textContent = text.slice(2);
            currentEl.replaceWith(bq);
            setSelectionToEnd(bq);
          } else if (text.startsWith("- [ ] ") || text.startsWith("[ ] ")) {
            const cleanText = text.replace(/^(-\s+)?\[\s*\]\s*/, "");
            const task = document.createElement("div");
            task.setAttribute("data-type", "task");
            task.setAttribute("data-checked", "false");
            task.className = "flex items-start gap-2.5 my-1.5 group select-none";
            task.innerHTML = `<input type="checkbox" class="mt-1 h-4 w-4 rounded accent-accent cursor-pointer shrink-0" /><span class="task-text flex-1 outline-none text-base leading-relaxed text-text">${escapeHtml(cleanText) || "<br>"}</span>`;
            currentEl.replaceWith(task);
            const textSpan = task.querySelector(".task-text") as HTMLElement;
            setSelectionToEnd(textSpan);
          } else if (text.startsWith("- ") || text.startsWith("* ")) {
            const cleanText = text.slice(2);
            const ul = document.createElement("ul");
            ul.className = "list-disc ml-6 my-3 space-y-1 text-text/90";
            const li = document.createElement("li");
            li.className = "leading-relaxed";
            li.textContent = cleanText;
            ul.appendChild(li);
            currentEl.replaceWith(ul);
            setSelectionToEnd(li);
          }
        }
      }

      notifyChange();
    };

    const setSelectionToEnd = (el: HTMLElement) => {
      const range = document.createRange();
      const sel = window.getSelection();
      range.selectNodeContents(el);
      range.collapse(false);
      sel?.removeAllRanges();
      sel?.addRange(range);
    };

    // Expose formatting ref API
    useImperativeHandle(ref, () => ({
      insertSnippet(snippet: string) {
        if (!editorRef.current) return;
        const html = markdownToHtml(snippet);
        document.execCommand("insertHTML", false, html);
        notifyChange();
      },
      applyFormatting(prefix: string, suffix: string = "") {
        if (!editorRef.current) return;
        editorRef.current.focus();

        if (prefix === "**") {
          document.execCommand("bold");
        } else if (prefix === "*") {
          document.execCommand("italic");
        } else if (prefix === "<u>") {
          document.execCommand("underline");
        } else if (prefix === "~~") {
          document.execCommand("strikeThrough");
        } else {
          document.execCommand("insertHTML", false, `${prefix}${suffix}`);
        }
        notifyChange();
      },
      formatBlock(tag: "h1" | "h2" | "h3" | "p" | "blockquote" | "ul" | "ol" | "task" | "code") {
        if (!editorRef.current) return;
        editorRef.current.focus();

        if (tag === "h1") {
          document.execCommand("formatBlock", false, "<h1>");
        } else if (tag === "h2") {
          document.execCommand("formatBlock", false, "<h2>");
        } else if (tag === "h3") {
          document.execCommand("formatBlock", false, "<h3>");
        } else if (tag === "blockquote") {
          document.execCommand("formatBlock", false, "<blockquote>");
        } else if (tag === "ul") {
          document.execCommand("insertUnorderedList");
        } else if (tag === "ol") {
          document.execCommand("insertOrderedList");
        } else if (tag === "task") {
          const taskHtml = `<div data-type="task" data-checked="false" class="flex items-start gap-2.5 my-1.5 group select-none"><input type="checkbox" class="mt-1 h-4 w-4 rounded accent-accent cursor-pointer shrink-0" /><span class="task-text flex-1 outline-none text-base leading-relaxed text-text"><br></span></div>`;
          document.execCommand("insertHTML", false, taskHtml);
        } else if (tag === "code") {
          const codeHtml = `<pre dir="ltr" class="my-4 overflow-x-auto rounded-xl border border-border/80 bg-surface-2 p-4 font-mono text-xs sm:text-sm text-text shadow-inner"><code>Code block here...</code></pre>`;
          document.execCommand("insertHTML", false, codeHtml);
        } else {
          document.execCommand("formatBlock", false, "<p>");
        }
        notifyChange();
      },
      focus() {
        if (editorRef.current) {
          editorRef.current.focus();
        }
      },
    }));

    // Handle image paste & drop directly on canvas
    const handlePaste = async (e: React.ClipboardEvent<HTMLDivElement>) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) {
            e.preventDefault();
            try {
              const compressed = await compressImage(file);
              const snippet = formatImageMarkdown(compressed, { align: "center", size: "full" });
              const html = markdownToHtml(snippet);
              document.execCommand("insertHTML", false, html);
              notifyChange();
            } catch (err) {
              console.error("Paste image error:", err);
            }
            break;
          }
        }
      }
    };

    const isRtl = isRtlText(value);

    return (
      <div className={cn("relative min-h-[450px] w-full", className)}>
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          dir={isRtl ? "rtl" : "ltr"}
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          onClick={handleEditorClick}
          onPaste={handlePaste}
          onBlur={onBlur}
          data-placeholder={placeholder}
          className={cn(
            "prose-wasl min-h-[450px] w-full outline-none leading-relaxed text-text focus:outline-none transition-colors",
            isRtl ? "text-right" : "text-left",
            // Empty placeholder styling
            "empty:before:content-[attr(data-placeholder)] empty:before:text-faint/50 empty:before:pointer-events-none empty:before:italic",
          )}
        />

        {/* Lightbox Zoom */}
        {lightboxIndex !== null && allImages[lightboxIndex] && (
          <ImageLightbox
            open={true}
            src={allImages[lightboxIndex].src}
            alt={allImages[lightboxIndex].rawAlt}
            caption={allImages[lightboxIndex].caption}
            onClose={() => setLightboxIndex(null)}
            hasPrev={lightboxIndex > 0}
            hasNext={lightboxIndex < allImages.length - 1}
            onPrev={() => setLightboxIndex((i) => (i !== null && i > 0 ? i - 1 : i))}
            onNext={() => setLightboxIndex((i) => (i !== null && i < allImages.length - 1 ? i + 1 : i))}
          />
        )}
      </div>
    );
  },
);
