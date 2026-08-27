export {
  createDefaultTrashState,
  normalizeTrashItem,
  normalizeTrashState,
  moveToTrashOperation,
  restoreItemOperation,
  deletePermanentlyOperation,
  emptyTrashOperation,
  type TrashItem,
  type TrashItemInput,
  type TrashItemType,
  type TrashedEntityData,
} from "./operations";

export {
  deleteEntityWithTrash,
  restoreEntityFromTrash,
  restoreDefaultProgramsService,
  TrashConflictError,
} from "./service";

export { CURRENT_TRASH_VERSION, migrateTrashSnapshot } from "./migrations";
export { useTrashData } from "./hooks";
