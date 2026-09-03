"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useDataAdapter, useDataEdition, useDataUserId } from "../../query/provider";
import { queryKeys } from "../../query/keys";
import { useSerializedMutations } from "../../query/mutation-queue";
import type { TopicsPersistedState } from "../../types";
import {
  createDefaultTopicsState,
  normalizeTopicsState,
  addTopicOperation,
  updateTopicOperation,
  deleteTopicOperation,
  addStepOperation,
  updateStepTitleOperation,
  toggleStepOperation,
  toggleStepCollapsedOperation,
  deleteStepOperation,
  addSubstepOperation,
  updateSubstepTitleOperation,
  toggleSubstepOperation,
  deleteSubstepOperation,
  addResourceOperation,
  toggleResourceOperation,
  deleteResourceOperation,
  addNoteOperation,
  updateNoteOperation,
  deleteNoteOperation,
  toggleNotePinOperation,
  type Topic,
  type TopicInput,
  type TopicStep,
  type TopicSubstep,
  type TopicResource,
  type TopicNote,
} from "./operations";

const STORE_KEY = "lifeos-topics" as const;

export function useTopicsData() {
  const adapter = useDataAdapter();
  const edition = useDataEdition();
  const userId = useDataUserId();
  const queryClient = useQueryClient();
  const queryKey = queryKeys.store(edition, userId, STORE_KEY);
  const enqueue = useSerializedMutations();

  const { data, isLoading, error } = useQuery<TopicsPersistedState, Error>({
    queryKey,
    queryFn: async () => {
      if (!adapter) {
        return createDefaultTopicsState();
      }
      const doc = await adapter.getStore(STORE_KEY);
      return normalizeTopicsState(doc?.state);
    },
    enabled: !!adapter,
  });

  const mutation = useMutation<
    TopicsPersistedState,
    Error,
    (current: TopicsPersistedState) => TopicsPersistedState
  >({
    mutationFn: async (updater) => {
      if (!adapter) {
        throw new Error("No data adapter available for topics mutation.");
      }
      return enqueue(async () => {
        const res = await adapter.mutateStore(STORE_KEY, (prev) => {
          const base = normalizeTopicsState(prev);
          return updater(base);
        });
        return normalizeTopicsState(res.state);
      });
    },
    onSuccess: (nextState) => {
      queryClient.setQueryData(queryKey, nextState);
    },
  });

  const state = data ?? createDefaultTopicsState();

  const addTopic = async (input: TopicInput): Promise<Topic> => {
    const now = Date.now();
    const newTopic: Topic = {
      id: crypto.randomUUID(),
      roadmap: [],
      resources: [],
      notes: [],
      createdAt: now,
      touchedAt: now,
      ...input,
    };
    await mutation.mutateAsync((current) => addTopicOperation(current, newTopic));
    return newTopic;
  };

  const updateTopic = async (id: string, patch: Partial<TopicInput>): Promise<void> => {
    const now = Date.now();
    await mutation.mutateAsync((current) => updateTopicOperation(current, id, patch, now));
  };

  const deleteTopic = async (id: string): Promise<void> => {
    await mutation.mutateAsync((current) => deleteTopicOperation(current, id));
  };

  const addStep = async (topicId: string, title: string): Promise<void> => {
    const now = Date.now();
    const newStep: TopicStep = {
      id: crypto.randomUUID(),
      title,
      done: false,
      collapsed: false,
      substeps: [],
    };
    await mutation.mutateAsync((current) => addStepOperation(current, topicId, newStep, now));
  };

  const updateStepTitle = async (topicId: string, id: string, title: string): Promise<void> => {
    const now = Date.now();
    await mutation.mutateAsync((current) => updateStepTitleOperation(current, topicId, id, title, now));
  };

  const toggleStep = async (topicId: string, id: string): Promise<void> => {
    const now = Date.now();
    await mutation.mutateAsync((current) => toggleStepOperation(current, topicId, id, now));
  };

  const toggleStepCollapsed = async (topicId: string, id: string): Promise<void> => {
    const now = Date.now();
    await mutation.mutateAsync((current) => toggleStepCollapsedOperation(current, topicId, id, now));
  };

  const deleteStep = async (topicId: string, id: string): Promise<void> => {
    const now = Date.now();
    await mutation.mutateAsync((current) => deleteStepOperation(current, topicId, id, now));
  };

  const addSubstep = async (topicId: string, stepId: string, title: string): Promise<void> => {
    const now = Date.now();
    const newSubstep: TopicSubstep = {
      id: crypto.randomUUID(),
      title,
      done: false,
    };
    await mutation.mutateAsync((current) => addSubstepOperation(current, topicId, stepId, newSubstep, now));
  };

  const updateSubstepTitle = async (
    topicId: string,
    stepId: string,
    substepId: string,
    title: string,
  ): Promise<void> => {
    const now = Date.now();
    await mutation.mutateAsync((current) =>
      updateSubstepTitleOperation(current, topicId, stepId, substepId, title, now),
    );
  };

  const toggleSubstep = async (
    topicId: string,
    stepId: string,
    substepId: string,
  ): Promise<void> => {
    const now = Date.now();
    await mutation.mutateAsync((current) =>
      toggleSubstepOperation(current, topicId, stepId, substepId, now),
    );
  };

  const deleteSubstep = async (
    topicId: string,
    stepId: string,
    substepId: string,
  ): Promise<void> => {
    const now = Date.now();
    await mutation.mutateAsync((current) =>
      deleteSubstepOperation(current, topicId, stepId, substepId, now),
    );
  };

  const addResource = async (topicId: string, title: string, url?: string): Promise<void> => {
    const now = Date.now();
    const newResource: TopicResource = {
      id: crypto.randomUUID(),
      title,
      url,
      done: false,
    };
    await mutation.mutateAsync((current) => addResourceOperation(current, topicId, newResource, now));
  };

  const toggleResource = async (topicId: string, id: string): Promise<void> => {
    const now = Date.now();
    await mutation.mutateAsync((current) => toggleResourceOperation(current, topicId, id, now));
  };

  const deleteResource = async (topicId: string, id: string): Promise<void> => {
    const now = Date.now();
    await mutation.mutateAsync((current) => deleteResourceOperation(current, topicId, id, now));
  };

  const addNote = async (topicId: string, title: string, text: string, metadata: Partial<TopicNote> = {}): Promise<TopicNote> => {
    const now = Date.now();
    const newNote: TopicNote = {
      id: crypto.randomUUID(),
      title,
      text,
      createdAt: now,
      updatedAt: now,
      pinned: false,
      contentType: "note",
      ...metadata,
    };
    await mutation.mutateAsync((current) => addNoteOperation(current, topicId, newNote, now));
    return newNote;
  };

  const updateNote = async (
    topicId: string,
    noteId: string,
    title: string,
    text: string,
    patch: Partial<TopicNote> = {},
  ): Promise<void> => {
    const now = Date.now();
    await mutation.mutateAsync((current) =>
      updateNoteOperation(current, topicId, noteId, title, text, now, patch),
    );
  };

  const deleteNote = async (topicId: string, id: string): Promise<void> => {
    const now = Date.now();
    await mutation.mutateAsync((current) => deleteNoteOperation(current, topicId, id, now));
  };

  const toggleNotePin = async (topicId: string, id: string): Promise<void> => {
    const now = Date.now();
    await mutation.mutateAsync((current) => toggleNotePinOperation(current, topicId, id, now));
  };

  return {
    topics: state.topics,
    isLoading,
    error,
    addTopic,
    updateTopic,
    deleteTopic,
    addStep,
    updateStepTitle,
    toggleStep,
    toggleStepCollapsed,
    deleteStep,
    addSubstep,
    updateSubstepTitle,
    toggleSubstep,
    deleteSubstep,
    addResource,
    toggleResource,
    deleteResource,
    addNote,
    updateNote,
    deleteNote,
    toggleNotePin,
  };
}
