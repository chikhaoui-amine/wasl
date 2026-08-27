export interface FormattingResult {
  newText: string;
  selectionStart: number;
  selectionEnd: number;
}

/**
 * Inserts markdown formatting syntax (e.g. headers, bold, lists) at cursor or surrounding selection.
 */
export function applyEditorFormatting(
  textarea: HTMLTextAreaElement | null,
  currentText: string,
  prefix: string,
  suffix: string = "",
): FormattingResult {
  if (!textarea) {
    const newText = `${currentText}${prefix}${suffix}`;
    return {
      newText,
      selectionStart: newText.length,
      selectionEnd: newText.length,
    };
  }

  const start = textarea.selectionStart ?? 0;
  const end = textarea.selectionEnd ?? 0;
  const selectedText = currentText.substring(start, end);
  const textToInsert = selectedText ? `${prefix}${selectedText}${suffix}` : `${prefix}${suffix}`;

  const newText = currentText.substring(0, start) + textToInsert + currentText.substring(end);
  const nextCursorPos = selectedText
    ? start + textToInsert.length
    : start + prefix.length;

  return {
    newText,
    selectionStart: nextCursorPos,
    selectionEnd: nextCursorPos,
  };
}
