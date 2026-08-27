import { iconKeyFromLegacy } from "@/lib/icons";
import type { TopicsPersistedState } from "../../types";
import { normalizeTopicsState, type Topic } from "./operations";

export const CURRENT_TOPICS_VERSION = 4;

export function migrateTopicsSnapshot(
  rawState: unknown,
  version: number,
): TopicsPersistedState {
  if (version > CURRENT_TOPICS_VERSION) {
    throw new Error(
      `Unsupported future Topics version ${version}. Current supported version is ${CURRENT_TOPICS_VERSION}.`,
    );
  }

  if (version === CURRENT_TOPICS_VERSION) {
    return normalizeTopicsState(rawState);
  }

  // Older version migration pipeline (v1, v2, v3 -> v4)
  const old = (rawState && typeof rawState === "object" ? rawState : {}) as Record<
    string,
    unknown
  > & { topics?: Array<Record<string, unknown>> };

  const rawTopics = Array.isArray(old.topics) ? old.topics : [];
  const topics: Topic[] = rawTopics.map((t) => {
    const rawRoadmap = Array.isArray(t.roadmap) ? t.roadmap : [];
    const rawResources = Array.isArray(t.resources) ? t.resources : [];
    const rawNotes = Array.isArray(t.notes) ? t.notes : [];

    return {
      id: typeof t.id === "string" && t.id ? t.id : crypto.randomUUID(),
      name: typeof t.name === "string" ? t.name : "Untitled Topic",
      icon: typeof t.icon === "string" ? (t.icon as Topic["icon"]) : iconKeyFromLegacy(typeof t.emoji === "string" ? t.emoji : undefined),
      color: typeof t.color === "string" ? t.color : "#37c9b7",
      description: typeof t.description === "string" ? t.description : "",
      createdAt: typeof t.createdAt === "number" ? t.createdAt : Date.now(),
      touchedAt: typeof t.touchedAt === "number" ? t.touchedAt : Date.now(),
      roadmap: rawRoadmap.map((s) => ({
        id: typeof s.id === "string" && s.id ? s.id : crypto.randomUUID(),
        title: typeof s.title === "string" ? s.title : "Untitled Step",
        done: Boolean(s.done),
        collapsed: typeof s.collapsed === "boolean" ? s.collapsed : false,
        substeps: Array.isArray(s.substeps)
          ? (s.substeps as unknown[]).map((sub: unknown) => {
              const rec = (sub && typeof sub === "object" ? sub : {}) as Record<string, unknown>;
              return {
                id: typeof rec.id === "string" && rec.id ? rec.id : crypto.randomUUID(),
                title: typeof rec.title === "string" ? rec.title : "",
                done: Boolean(rec.done),
              };
            })
          : [],
      })),
      resources: rawResources.map((r) => ({
        id: typeof r.id === "string" && r.id ? r.id : crypto.randomUUID(),
        title: typeof r.title === "string" ? r.title : "",
        url: typeof r.url === "string" ? r.url : undefined,
        done: Boolean(r.done),
      })),
      notes: rawNotes.map((n) => ({
        id: typeof n.id === "string" && n.id ? n.id : crypto.randomUUID(),
        title: typeof n.title === "string" ? n.title : "",
        text: typeof n.text === "string" ? n.text : "",
        createdAt: typeof n.createdAt === "number" ? n.createdAt : Date.now(),
        updatedAt: typeof n.updatedAt === "number" ? n.updatedAt : (typeof n.createdAt === "number" ? n.createdAt : Date.now()),
      })),
    };
  });

  return {
    topics,
  };
}
