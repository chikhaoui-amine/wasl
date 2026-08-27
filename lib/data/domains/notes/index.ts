export {
  DEFAULT_CATEGORIES,
  NOTE_TAGS,
  createDefaultNotesState,
  normalizeNotesState,
  addNoteOperation,
  updateNoteOperation,
  togglePinOperation,
  deleteNoteOperation,
  addCategoryOperation,
  updateCategoryOperation,
  deleteCategoryOperation,
  relTime,
  type Note,
  type NoteInput,
  type NoteCategory,
  type NoteTag,
  type NoteContentType,
} from "./operations";

export { CURRENT_NOTES_VERSION, migrateNotesSnapshot } from "./migrations";
export { useNotesData } from "./hooks";
export { CoalescingSaveQueue, type SaveStatus, type CoalescingSaveQueueOptions } from "./save-queue";
export {
  registerPendingSaveHandler,
  hasPendingNotesSaves,
  flushAllPendingNotes,
  resetPendingSavesForTesting,
  type PendingSaveHandler,
} from "./pending-saves";
