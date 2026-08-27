export {
  getDefaultAnchor,
  createDefaultBlocksState,
  normalizeBlock,
  normalizeBlocksState,
  addBlockOperation,
  updateBlockOperation,
  deleteBlockOperation,
  setViewOperation,
  setAnchorOperation,
  type Block,
  type BlockInput,
} from "./operations";

export { CURRENT_BLOCKS_VERSION, migrateBlocksSnapshot } from "./migrations";
export { useBlocksData } from "./hooks";
