# WASL Notes: Clean Source Markdown & Image References Design

## 1. Overview & Objective
Replace the experimental live editor with a polished, distraction-free **Source** (Write) and **Read** (Preview) dual-mode system. Eliminate the problem of massive base64 image strings cluttering the Markdown editing area by adopting standard CommonMark reference-style images (`![Caption | left | medium][img-1]`) with an **Attached Photos** bar below the textarea.

---

## 2. Key Requirements & Architecture

### 2.1 View Modes: Source and Read Only
- In [NoteForm.tsx](file:///home/amine/wasl-local/components/forms/NoteForm.tsx), remove the "Live" tab.
- Tab switcher has two states:
  - **Source** (default): Clean Markdown editor with full selection formatting toolbar and drop/paste support.
  - **Read**: Rich rendered view with full typography, left/right float wrapping, interactive lightbox zoom, and code highlights.

### 2.2 Image Reference Storage & Separation
- **Standard CommonMark Syntax**:
  - In-text reference: `![Caption | align | size][img-1]`
  - Reference definition at document end: `[img-1]: data:image/webp;base64,...`
- **Editor Cleanliness**:
  - The textarea displays only the clean human-readable Markdown text (`![My Photo | left | medium][img-1]`).
  - The base64 payloads are maintained in a structured `ImageReferenceMap` state (`Record<string, string>`) during editing and appended on save.
- **Legacy Compatibility & Automatic Normalization**:
  - On loading any note, `parseNoteMarkdown(rawMarkdown)` parses:
    1. Existing reference definitions (`[img-X]: url`).
    2. Legacy inline base64 images (`![alt](data:image/...)`), automatically transforming them into clean reference tags (`![alt][img-N]`) and moving the data URI to the reference map.
  - On save, `composeNoteMarkdown(cleanBody, references)` creates the canonical GFM string.
- **Attached Photos Management Bar**:
  - Displayed below the textarea when images exist:
    - Thumbnail preview card.
    - Reference badge (`[img-1]`).
    - Caption, alignment (`left`, `right`, `center`, `full`), and size (`small`, `medium`, `full`).
    - Quick actions: "Insert at cursor", "Edit alignment/caption", and "Remove photo".

### 2.3 Formatting Toolbar & Interactions
- Toolbar buttons in `NoteForm.tsx`:
  - `H1`, `H2`, `H3`: Prefix lines with `# `, `## `, `### `.
  - `Bold`, `Italic`, `Underline`, `Strikethrough`: Wrap selection in `**...**`, `*...*`, `<u>...</u>`, `~~...~~`.
  - `Bulleted List`, `Task List`: Prefix lines with `- `, `- [ ] `.
  - `Quote`, `Code`: Wrap/prefix with `> ` or ````...````.
  - `Photo`: Opens `ImageInsertModal`, which compresses the uploaded image, adds `[img-N]`, and inserts `![caption | align | size][img-N]` at the cursor.
- **Drag & Drop / Paste**:
  - Dropping or pasting an image onto the textarea compresses the image, assigns `[img-N]`, and inserts `![Photo | center | full][img-N]` at the cursor.

---

## 3. Data Integrity & Parity
- **No Database Schema Changes**: Note `body` remains a standard string in both Local (`wasl-local` / Dexie) and Cloud (`wasl-cloud` / Supabase).
- **Parity Guarantee**: Identical behavior and components in both `wasl-cloud` and `wasl-local`.
