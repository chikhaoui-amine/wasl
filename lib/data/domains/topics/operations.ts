import { iconKeyFromLegacy, type IconKey } from "@/lib/icons";
import type { TopicsPersistedState } from "../../types";

export interface TopicResource {
  id: string;
  title: string;
  url?: string;
  done: boolean;
}

export interface TopicSubstep {
  id: string;
  title: string;
  done: boolean;
}

export interface TopicStep {
  id: string;
  title: string;
  done: boolean;
  collapsed?: boolean;
  substeps?: TopicSubstep[];
}

export interface TopicNote {
  id: string;
  title: string;
  text: string;
  createdAt: number;
  updatedAt: number;
}

export interface Topic {
  id: string;
  name: string;
  icon: IconKey;
  color: string;
  description: string;
  roadmap: TopicStep[];
  resources: TopicResource[];
  notes: TopicNote[];
  createdAt: number;
  touchedAt: number;
}

export interface TopicInput {
  name: string;
  icon: IconKey;
  color: string;
  description: string;
}

export const TOPIC_COLORS = [
  "#37c9b7",
  "#7c9cf5",
  "#e0a34a",
  "#c26a44",
  "#5fb36a",
  "#b57edc",
  "#d95f6a",
];

export function createDefaultTopicsState(): TopicsPersistedState {
  const now = Date.now();
  return {
    topics: [
      {
        id: "topic-sample-1",
        name: "System Architecture & AI Agents",
        icon: "cpu",
        color: "#7c9cf5",
        description: "Mastering agentic architectures, MCP tool design, and local-first data systems.",
        createdAt: now - 86400000 * 5,
        touchedAt: now - 3600000,
        roadmap: [
          {
            id: "step-1",
            title: "Local-First Storage & Compare-and-Swap Sync",
            done: true,
            substeps: [
              { id: "sub-1", title: "IndexedDB schemas & Dexie client", done: true },
              { id: "sub-2", title: "Optimistic updates & version migrations", done: true },
            ],
          },
          {
            id: "step-2",
            title: "Model Context Protocol (MCP) Tool Design",
            done: false,
            substeps: [
              { id: "sub-3", title: "JSON-RPC tool definitions", done: true },
              { id: "sub-4", title: "Destructive operations & requireUniqueMatch guardrails", done: false },
            ],
          },
          {
            id: "step-3",
            title: "Multi-Agent Orchestration & Subagents",
            done: false,
            substeps: [],
          },
        ],
        resources: [
          { id: "res-1", title: "Model Context Protocol Specification", url: "https://modelcontextprotocol.io", done: true },
          { id: "res-2", title: "Local-First Software: You Own Your Data", url: "https://localfirstweb.dev", done: true },
        ],
        notes: [
          {
            id: "tn-1",
            title: "Key Principle: Data Ownership",
            text: "Local-first apps give users full agency over their data without third-party cloud lock-in.",
            createdAt: now - 86400000 * 3,
            updatedAt: now - 86400000 * 2,
          },
        ],
      },
      {
        id: "topic-sample-2",
        name: "Physical Performance & Longevity",
        icon: "activity",
        color: "#37c9b7",
        description: "Science-backed protocols for aerobic base, strength training, and recovery.",
        createdAt: now - 86400000 * 7,
        touchedAt: now - 86400000,
        roadmap: [
          {
            id: "step-bio-1",
            title: "Zone 2 Base Conditioning",
            done: true,
            substeps: [
              { id: "sub-bio-1", title: "Calculate aerobic heart rate range", done: true },
              { id: "sub-bio-2", title: "3x 45-min weekly runs", done: true },
            ],
          },
          {
            id: "step-bio-2",
            title: "Progressive Overload in Strength",
            done: false,
            substeps: [],
          },
        ],
        resources: [
          { id: "res-bio-1", title: "Zone 2 Physiology & Mitochondrial Function", done: true },
        ],
        notes: [],
      },
    ],
  };
}

export function normalizeTopic(raw: unknown): Topic {
  const t = (raw && typeof raw === "object" ? raw : {}) as Partial<Topic> & Record<string, unknown>;
  const id = typeof t.id === "string" && t.id.trim() ? t.id : crypto.randomUUID();
  const name = typeof t.name === "string" && t.name.trim() ? t.name.trim() : "Untitled Topic";
  const icon = iconKeyFromLegacy(typeof t.icon === "string" ? t.icon : undefined);
  const color = typeof t.color === "string" && t.color ? t.color : TOPIC_COLORS[0];
  const description = typeof t.description === "string" ? t.description : "";
  const createdAt = typeof t.createdAt === "number" ? t.createdAt : Date.now();
  const touchedAt = typeof t.touchedAt === "number" ? t.touchedAt : createdAt;

  const rawRoadmap = Array.isArray(t.roadmap) ? (t.roadmap as unknown as Record<string, unknown>[]) : [];
  const roadmap: TopicStep[] = rawRoadmap.map((s) => ({
    id: typeof s.id === "string" && s.id ? s.id : crypto.randomUUID(),
    title: typeof s.title === "string" ? s.title : "",
    done: Boolean(s.done),
    collapsed: Boolean(s.collapsed),
    substeps: Array.isArray(s.substeps)
      ? (s.substeps as unknown as Record<string, unknown>[]).map((sub) => ({
          id: typeof sub.id === "string" && sub.id ? sub.id : crypto.randomUUID(),
          title: typeof sub.title === "string" ? sub.title : "",
          done: Boolean(sub.done),
        }))
      : [],
  }));

  const rawResources = Array.isArray(t.resources) ? (t.resources as unknown as Record<string, unknown>[]) : [];
  const resources: TopicResource[] = rawResources.map((r) => ({
    id: typeof r.id === "string" && r.id ? r.id : crypto.randomUUID(),
    title: typeof r.title === "string" ? r.title : "",
    url: typeof r.url === "string" ? r.url : undefined,
    done: Boolean(r.done),
  }));

  const rawNotes = Array.isArray(t.notes) ? (t.notes as unknown as Record<string, unknown>[]) : [];
  const notes: TopicNote[] = rawNotes.map((n) => ({
    id: typeof n.id === "string" && n.id ? n.id : crypto.randomUUID(),
    title: typeof n.title === "string" ? n.title : "",
    text: typeof n.text === "string" ? n.text : "",
    createdAt: typeof n.createdAt === "number" ? n.createdAt : Date.now(),
    updatedAt: typeof n.updatedAt === "number" ? n.updatedAt : Date.now(),
  }));

  return {
    id,
    name,
    icon,
    color,
    description,
    roadmap,
    resources,
    notes,
    createdAt,
    touchedAt,
  };
}

export function normalizeTopicsState(
  raw: unknown,
): TopicsPersistedState {
  if (!raw || typeof raw !== "object") {
    return createDefaultTopicsState();
  }
  const obj = raw as Partial<TopicsPersistedState>;
  return {
    topics: Array.isArray(obj.topics) ? obj.topics.map(normalizeTopic) : [],
  };
}

const touch = (t: Topic, now: number = Date.now()): Topic => ({
  ...t,
  touchedAt: now,
});

const mutateTopic = (
  topics: Topic[],
  id: string,
  fn: (t: Topic) => Topic,
  now: number = Date.now(),
): Topic[] => topics.map((t) => (t.id === id ? touch(fn(t), now) : t));

export function addTopicOperation(
  current: TopicsPersistedState | null | undefined,
  topic: Topic,
): TopicsPersistedState {
  const base = normalizeTopicsState(current);
  return {
    ...base,
    topics: [topic, ...base.topics],
  };
}

export function updateTopicOperation(
  current: TopicsPersistedState | null | undefined,
  id: string,
  patch: Partial<TopicInput>,
  now: number = Date.now(),
): TopicsPersistedState {
  const base = normalizeTopicsState(current);
  return {
    ...base,
    topics: mutateTopic(base.topics, id, (t) => ({ ...t, ...patch }), now),
  };
}

export function deleteTopicOperation(
  current: TopicsPersistedState | null | undefined,
  id: string,
): TopicsPersistedState {
  const base = normalizeTopicsState(current);
  return {
    ...base,
    topics: base.topics.filter((t) => t.id !== id),
  };
}

export function addStepOperation(
  current: TopicsPersistedState | null | undefined,
  topicId: string,
  step: TopicStep,
  now: number = Date.now(),
): TopicsPersistedState {
  const base = normalizeTopicsState(current);
  return {
    ...base,
    topics: mutateTopic(
      base.topics,
      topicId,
      (t) => ({
        ...t,
        roadmap: [...t.roadmap, step],
      }),
      now,
    ),
  };
}

export function updateStepTitleOperation(
  current: TopicsPersistedState | null | undefined,
  topicId: string,
  id: string,
  title: string,
  now: number = Date.now(),
): TopicsPersistedState {
  const base = normalizeTopicsState(current);
  return {
    ...base,
    topics: mutateTopic(
      base.topics,
      topicId,
      (t) => ({
        ...t,
        roadmap: t.roadmap.map((x) => (x.id === id ? { ...x, title } : x)),
      }),
      now,
    ),
  };
}

export function toggleStepOperation(
  current: TopicsPersistedState | null | undefined,
  topicId: string,
  id: string,
  now: number = Date.now(),
): TopicsPersistedState {
  const base = normalizeTopicsState(current);
  return {
    ...base,
    topics: mutateTopic(
      base.topics,
      topicId,
      (t) => ({
        ...t,
        roadmap: t.roadmap.map((x) => {
          if (x.id !== id) return x;
          const nextDone = !x.done;
          const substeps = (x.substeps || []).map((sub) => ({ ...sub, done: nextDone }));
          return { ...x, done: nextDone, substeps };
        }),
      }),
      now,
    ),
  };
}

export function toggleStepCollapsedOperation(
  current: TopicsPersistedState | null | undefined,
  topicId: string,
  id: string,
  now: number = Date.now(),
): TopicsPersistedState {
  const base = normalizeTopicsState(current);
  return {
    ...base,
    topics: mutateTopic(
      base.topics,
      topicId,
      (t) => ({
        ...t,
        roadmap: t.roadmap.map((x) =>
          x.id === id ? { ...x, collapsed: !(x.collapsed ?? true) } : x,
        ),
      }),
      now,
    ),
  };
}

export function deleteStepOperation(
  current: TopicsPersistedState | null | undefined,
  topicId: string,
  id: string,
  now: number = Date.now(),
): TopicsPersistedState {
  const base = normalizeTopicsState(current);
  return {
    ...base,
    topics: mutateTopic(
      base.topics,
      topicId,
      (t) => ({
        ...t,
        roadmap: t.roadmap.filter((x) => x.id !== id),
      }),
      now,
    ),
  };
}

export function addSubstepOperation(
  current: TopicsPersistedState | null | undefined,
  topicId: string,
  stepId: string,
  substep: TopicSubstep,
  now: number = Date.now(),
): TopicsPersistedState {
  const base = normalizeTopicsState(current);
  return {
    ...base,
    topics: mutateTopic(
      base.topics,
      topicId,
      (t) => ({
        ...t,
        roadmap: t.roadmap.map((x) => {
          if (x.id !== stepId) return x;
          const substeps = [...(x.substeps || []), substep];
          return { ...x, done: false, collapsed: false, substeps };
        }),
      }),
      now,
    ),
  };
}

export function updateSubstepTitleOperation(
  current: TopicsPersistedState | null | undefined,
  topicId: string,
  stepId: string,
  substepId: string,
  title: string,
  now: number = Date.now(),
): TopicsPersistedState {
  const base = normalizeTopicsState(current);
  return {
    ...base,
    topics: mutateTopic(
      base.topics,
      topicId,
      (t) => ({
        ...t,
        roadmap: t.roadmap.map((x) => {
          if (x.id !== stepId) return x;
          const substeps = (x.substeps || []).map((sub) =>
            sub.id === substepId ? { ...sub, title } : sub,
          );
          return { ...x, substeps };
        }),
      }),
      now,
    ),
  };
}

export function toggleSubstepOperation(
  current: TopicsPersistedState | null | undefined,
  topicId: string,
  stepId: string,
  substepId: string,
  now: number = Date.now(),
): TopicsPersistedState {
  const base = normalizeTopicsState(current);
  return {
    ...base,
    topics: mutateTopic(
      base.topics,
      topicId,
      (t) => ({
        ...t,
        roadmap: t.roadmap.map((x) => {
          if (x.id !== stepId) return x;
          const substeps = (x.substeps || []).map((sub) =>
            sub.id === substepId ? { ...sub, done: !sub.done } : sub,
          );
          const allDone = substeps.length > 0 && substeps.every((sub) => sub.done);
          return { ...x, done: allDone, substeps };
        }),
      }),
      now,
    ),
  };
}

export function deleteSubstepOperation(
  current: TopicsPersistedState | null | undefined,
  topicId: string,
  stepId: string,
  substepId: string,
  now: number = Date.now(),
): TopicsPersistedState {
  const base = normalizeTopicsState(current);
  return {
    ...base,
    topics: mutateTopic(
      base.topics,
      topicId,
      (t) => ({
        ...t,
        roadmap: t.roadmap.map((x) => {
          if (x.id !== stepId) return x;
          const substeps = (x.substeps || []).filter((sub) => sub.id !== substepId);
          const allDone = substeps.length > 0 && substeps.every((sub) => sub.done);
          return { ...x, done: substeps.length > 0 ? allDone : x.done, substeps };
        }),
      }),
      now,
    ),
  };
}

export function addResourceOperation(
  current: TopicsPersistedState | null | undefined,
  topicId: string,
  resource: TopicResource,
  now: number = Date.now(),
): TopicsPersistedState {
  const base = normalizeTopicsState(current);
  return {
    ...base,
    topics: mutateTopic(
      base.topics,
      topicId,
      (t) => ({
        ...t,
        resources: [...t.resources, resource],
      }),
      now,
    ),
  };
}

export function toggleResourceOperation(
  current: TopicsPersistedState | null | undefined,
  topicId: string,
  id: string,
  now: number = Date.now(),
): TopicsPersistedState {
  const base = normalizeTopicsState(current);
  return {
    ...base,
    topics: mutateTopic(
      base.topics,
      topicId,
      (t) => ({
        ...t,
        resources: t.resources.map((x) => (x.id === id ? { ...x, done: !x.done } : x)),
      }),
      now,
    ),
  };
}

export function deleteResourceOperation(
  current: TopicsPersistedState | null | undefined,
  topicId: string,
  id: string,
  now: number = Date.now(),
): TopicsPersistedState {
  const base = normalizeTopicsState(current);
  return {
    ...base,
    topics: mutateTopic(
      base.topics,
      topicId,
      (t) => ({
        ...t,
        resources: t.resources.filter((x) => x.id !== id),
      }),
      now,
    ),
  };
}

export function addNoteOperation(
  current: TopicsPersistedState | null | undefined,
  topicId: string,
  note: TopicNote,
  now: number = Date.now(),
): TopicsPersistedState {
  const base = normalizeTopicsState(current);
  return {
    ...base,
    topics: mutateTopic(
      base.topics,
      topicId,
      (t) => ({
        ...t,
        notes: [note, ...t.notes],
      }),
      now,
    ),
  };
}

export function updateNoteOperation(
  current: TopicsPersistedState | null | undefined,
  topicId: string,
  noteId: string,
  title: string,
  text: string,
  now: number = Date.now(),
): TopicsPersistedState {
  const base = normalizeTopicsState(current);
  return {
    ...base,
    topics: mutateTopic(
      base.topics,
      topicId,
      (t) => ({
        ...t,
        notes: t.notes.map((n) =>
          n.id === noteId ? { ...n, title, text, updatedAt: now } : n,
        ),
      }),
      now,
    ),
  };
}

export function deleteNoteOperation(
  current: TopicsPersistedState | null | undefined,
  topicId: string,
  id: string,
  now: number = Date.now(),
): TopicsPersistedState {
  const base = normalizeTopicsState(current);
  return {
    ...base,
    topics: mutateTopic(
      base.topics,
      topicId,
      (t) => ({
        ...t,
        notes: t.notes.filter((x) => x.id !== id),
      }),
      now,
    ),
  };
}

export function topicProgress(t: Partial<Topic> | undefined | null): number {
  const roadmap = t?.roadmap ?? [];
  if (roadmap.length === 0) return 0;
  let totalUnits = 0;
  let doneUnits = 0;

  for (const step of roadmap) {
    if (!step) continue;
    const subs = step.substeps ?? [];
    if (subs.length > 0) {
      totalUnits += subs.length;
      doneUnits += subs.filter((s) => s?.done).length;
    } else {
      totalUnits += 1;
      if (step.done) doneUnits += 1;
    }
  }

  if (totalUnits === 0) return 0;
  return Math.round((doneUnits / totalUnits) * 100);
}
