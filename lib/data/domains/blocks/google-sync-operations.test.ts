import { describe, it, expect } from "vitest";
import {
  updateBlockOperation,
  deleteBlockOperation,
  mergeGoogleEventsOperation,
  applyGooglePushOperation,
  importBlocksOperation,
  type Block,
} from "./operations";
import { hasUnpushedGoogleChanges } from "@/lib/calendar/google-sync-utils";
import type { BlocksPersistedState } from "../../types";

const linked: Block = {
  id: "b1",
  date: "2026-10-08",
  start: 9,
  end: 10,
  title: "Standup",
  color: "#7c9cf5",
  externalId: "g1",
  externalProvider: "google",
  updatedAt: "2026-10-08T09:00:00.000Z",
  externalUpdatedAt: "2026-10-08T09:00:00.000Z",
};

const state = (blocks: Block[], extra: Partial<BlocksPersistedState> = {}): BlocksPersistedState => ({
  blocks,
  view: "week",
  anchor: "2026-10-05",
  ...extra,
});

describe("blocks Google sync operations", () => {
  it("local edits bump updatedAt so they are pushed", () => {
    const next = updateBlockOperation(state([linked]), "b1", { start: 10, end: 11 });
    expect(next.blocks[0].updatedAt! > linked.updatedAt!).toBe(true);
    expect(hasUnpushedGoogleChanges(next.blocks[0])).toBe(true);
  });

  it("edits on legacy linked blocks (no externalUpdatedAt) are still detected", () => {
    const legacy = { ...linked, externalUpdatedAt: undefined };
    const next = updateBlockOperation(state([legacy]), "b1", { title: "Renamed" });
    expect(next.blocks[0].externalUpdatedAt).toBe(linked.updatedAt);
    expect(hasUnpushedGoogleChanges(next.blocks[0])).toBe(true);
  });

  it("deleting a linked block queues the Google deletion", () => {
    const next = deleteBlockOperation(state([linked]), "b1");
    expect(next.blocks).toHaveLength(0);
    expect(next.pendingGoogleDeletes).toEqual(["g1"]);
  });

  it("pull merges into current state and does not resurrect pending deletions", () => {
    const current = state([], { pendingGoogleDeletes: ["g1"] });
    const next = mergeGoogleEventsOperation(
      current,
      [{ id: "g1", updated: "2026-10-08T10:00:00.000Z", start: { dateTime: "2026-10-08T09:00:00Z" } }],
      "2026-10-08T10:00:01.000Z",
    );
    expect(next.blocks).toHaveLength(0);
    expect(next.lastSyncedAt).toBe("2026-10-08T10:00:01.000Z");
  });

  it("push confirmations link new blocks and clear confirmed deletions", () => {
    const fresh: Block = { ...linked, id: "n1", externalId: undefined, externalProvider: undefined, updatedAt: "T1", externalUpdatedAt: undefined };
    const next = applyGooglePushOperation(
      state([fresh], { pendingGoogleDeletes: ["gone", "still"] }),
      [{ id: "n1", externalId: "gn1", updatedAt: "R1", sentUpdatedAt: "T1" }],
      ["gone"],
      "S",
    );
    expect(next.blocks[0]).toMatchObject({ externalId: "gn1", externalProvider: "google", updatedAt: "R1" });
    expect(next.pendingGoogleDeletes).toEqual(["still"]);
  });

  it("ics import merges into current blocks instead of a stale snapshot", () => {
    const other: Block = { ...linked, id: "b2", externalId: undefined, externalProvider: undefined };
    const next = importBlocksOperation(state([linked, other]), [{ ...other, title: "Imported" }]);
    expect(next.blocks.map((b) => b.title)).toEqual(["Standup", "Imported"]);
  });
});
