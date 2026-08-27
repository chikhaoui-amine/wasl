# Notes: Clean Source Editor & Reference Markdown Images Implementation Plan

## Proposed Changes

### 1. Image Reference Utilities (`lib/images.ts`)
- Add helper `parseNoteMarkdown(rawMarkdown: string)`:
  - Extracts reference definitions `[img-X]: data:...` from the end of the markdown into an `ImageReferenceMap` (`Record<string, string>`).
  - Converts any inline base64 images (`![alt](data:image/...)`) into reference tags `![alt][img-N]` and adds them to the reference map.
  - Returns `{ cleanBody: string, references: Record<string, string>, nextId: number }`.
- Add helper `composeNoteMarkdown(cleanBody: string, references: Record<string, string>)`:
  - Joins the clean body with formatted reference definitions at the end (`[refKey]: dataUri`).
- Add tests in `lib/images.test.ts` to guarantee 100% roundtrip lossless serialization.

### 2. Attached Photos Management Component (`components/notes/AttachedPhotosBar.tsx`)
- Displays a clean visual gallery of all attached images below the textarea:
  - Compact thumbnail preview with lightbox zoom on click.
  - Ref tag pill: `[img-1]`, `[img-2]`.
  - Caption and alignment/size badges.
  - "Insert into text" button (if not already present in the text body).
  - "Remove" button (removes the image and any reference tags in the text).

### 3. Note Form & Toolbar Updates (`components/forms/NoteForm.tsx`)
- Remove the "Live" tab from the tab switcher, keeping only **Source** (Write) and **Read** (Preview).
- In Source mode:
  - Textarea displays only clean markdown (`cleanBody`).
  - Toolbar buttons apply markdown formatting directly around selection.
  - Image insertion (via "Photo" button, drop, or paste) compresses the image, assigns a clean `img-N` reference, adds to the reference map, and inserts `![caption | align | size][img-N]` at the cursor.
  - Auto-save composes the full markdown (`composeNoteMarkdown(cleanBody, references)`) and saves it seamlessly.
- In Read mode:
  - Renders the composed markdown with `MarkdownRenderer`.

### 4. Edition Parity & Verification
- Replicate all changes between `wasl-cloud` and `wasl-local`.
- Run `npm test`, `npm run lint`, `npx tsc --noEmit`, `npm run build:local`, `npm run build:cloud`, and `npm run build`.
