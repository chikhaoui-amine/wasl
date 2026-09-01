import { describe, expect, it } from "vitest";
import {
  successResult,
  validationErrorResult,
  withStructuredValidation,
} from "../src/result-contracts";
import { z } from "zod";
import { WASL_TOOLS } from "../src/tool-definitions";

describe("WASL Local MCP structured result contracts", () => {
  it("exposes the V2 retrieval families without legacy bulk note/topic retrieval", () => {
    const names = new Set(WASL_TOOLS.map((tool) => tool.name));
    for (const domain of [
      "notes", "tasks", "goals", "habits", "topics", "calendar", "journal",
      "transactions", "workouts", "recurring",
    ]) {
      expect(names).toContain(`${domain}_list`);
      expect(names).toContain(`${domain}_search`);
      expect(names).toContain(`${domain}_get`);
    }
    expect(names).toContain("trash_list");
    expect(names).toContain("trash_get");
    expect(names).not.toContain("get_notes_topics");
    expect(names).not.toContain("get_notes");
  });

  it.each([
    ["tasks_list", { items: [{ id: "task-1" }] }],
    ["goals_list", { items: [{ id: "goal-1" }] }],
    ["notes_list", { items: [{ id: "note-1" }] }],
  ])("returns native structured read data for %s", (action, data) => {
    const result = successResult(action, data);
    const text = result.content[0]?.type === "text" ? result.content[0].text : "";

    expect(result.structuredContent).toEqual({ ok: true, data });
    expect(result.content[0]).toEqual({
      type: "text",
      text: `${action} returned structured data.`,
    });
    expect(text).not.toContain(JSON.stringify(data));
  });

  it.each([
    ["add_task", { success: true, task: { id: "task-new", title: "New" } }, "task-new"],
    ["update_task", { success: true, task: { id: "task-1", title: "Updated" } }, "task-1"],
  ])("returns a mutation receipt for %s", (action, data, id) => {
    const result = successResult(action, data, 42);

    expect(result.structuredContent).toMatchObject({
      ok: true,
      data: { id, task: { id } },
      operation: { action, requestId: 42 },
    });
  });

  it("keeps missing required arguments available for structured validation", () => {
    const strictSchema = z.object({ title: z.string().min(1) });
    const transportSchema = withStructuredValidation(strictSchema);
    const transported = transportSchema.safeParse({});

    expect(transported).toEqual({ success: true, data: {} });
    expect(strictSchema.safeParse(transported.data).success).toBe(false);

    const result = validationErrorResult("add_task", {
      __waslInvalidArguments: true,
      issues: [{ code: "invalid_type", message: "Expected string", path: ["title"] }],
    });
    expect(result.structuredContent).toMatchObject({
      ok: false,
      error: { code: "VALIDATION_ERROR", retryable: false },
    });
  });
});
