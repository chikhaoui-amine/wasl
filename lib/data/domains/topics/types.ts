import type { IconKey } from "@/lib/icons";

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
  roadmap: TopicStep[]; // what to learn, in order
  resources: TopicResource[]; // courses, videos, articles, books
  notes: TopicNote[]; // insights captured while learning
  createdAt: number;
  touchedAt: number;
}

export interface TopicInput {
  name: string;
  icon: IconKey;
  color: string;
  description: string;
}
