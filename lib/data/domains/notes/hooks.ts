"use client";

import { useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useDataAdapter, useDataEdition, useDataUserId } from "../../query/provider";
import { queryKeys } from "../../query/keys";
import { useSerializedMutations } from "../../query/mutation-queue";
import type { NotesPersistedState } from "../../types";
import { deleteEntityWithTrash } from "../trash";
import {
  createDefaultNotesState,
  normalizeNotesState,
  addNoteOperation,
  updateNoteOperation,
  togglePinOperation,
  deleteNoteOperation,
  addCategoryOperation,
  updateCategoryOperation,
  deleteCategoryOperation,
  DEFAULT_CATEGORIES,
  type Note,
  type NoteInput,
  type NoteCategory,
} from "./operations";

const STORE_KEY = "lifeos-notes" as const;

export function useNotesData() {
  const adapter = useDataAdapter();
  const edition = useDataEdition();
  const userId = useDataUserId();
  const queryClient = useQueryClient();
  const queryKey = queryKeys.store(edition, userId, STORE_KEY);
  const enqueue = useSerializedMutations();

  // Serialization queue ref to ensure strictly ordered mutations per note/store

  const { data, isLoading, error } = useQuery<NotesPersistedState, Error>({
    queryKey,
    queryFn: async () => {
      if (!adapter) {
        return createDefaultNotesState();
      }
      const doc = await adapter.getStore(STORE_KEY);
      return normalizeNotesState(doc?.state);
    },
    enabled: !!adapter,
  });

  const mutation = useMutation<
    NotesPersistedState,
    Error,
    (current: NotesPersistedState) => NotesPersistedState
  >({
    mutationFn: async (updater) => {
      if (!adapter) {
        throw new Error("No data adapter available for notes mutation.");
      }
      // Serialize operations through promise queue
      return enqueue(async () => {
          const res = await adapter.mutateStore(STORE_KEY, (prev) => {
            const base = normalizeNotesState(prev);
            return updater(base);
          });
          return normalizeNotesState(res.state);
      });
    },
    onSuccess: (nextState) => {
      queryClient.setQueryData(queryKey, nextState);
    },
  });

  const state = data ?? createDefaultNotesState();

  const addNote = useCallback(
    async (input: NoteInput): Promise<Note> => {
      const now = Date.now();
      const newNote: Note = {
        id: crypto.randomUUID(),
        pinned: input.pinned ?? false,
        contentType: input.contentType ?? "note",
        ...input,
        updatedAt: now,
      };
      await mutation.mutateAsync((current) => addNoteOperation(current, newNote));
      return newNote;
    },
    [mutation],
  );

  const updateNote = useCallback(
    async (id: string, patch: Partial<NoteInput>): Promise<void> => {
      const now = Date.now();
      await mutation.mutateAsync((current) => updateNoteOperation(current, id, patch, now));
    },
    [mutation],
  );

  const togglePin = useCallback(
    async (id: string): Promise<void> => {
      await mutation.mutateAsync((current) => togglePinOperation(current, id));
    },
    [mutation],
  );

  const deleteNote = useCallback(
    async (id: string): Promise<void> => {
      let targetNote = state.notes.find((n) => n.id === id);
      if (!targetNote && adapter) {
        const doc = await adapter.getStore(STORE_KEY);
        const docState = normalizeNotesState(doc?.state);
        targetNote = docState.notes.find((n) => n.id === id);
      }

      if (targetNote && adapter) {
        // Moving a note to Trash is a prerequisite for deletion.
        // If Trash fails, deleteFromSource is never reached and note is preserved.
        await deleteEntityWithTrash(adapter, {
          itemType: "note",
          entity: targetNote,
          title: targetNote.title || "Untitled Note",
          description: targetNote.body?.substring(0, 80),
          originalStoreKey: STORE_KEY,
          deleteFromSource: async () => {
            await mutation.mutateAsync((current) => deleteNoteOperation(current, id));
          },
        });
      } else {
        await mutation.mutateAsync((current) => deleteNoteOperation(current, id));
      }
    },
    [state.notes, adapter, mutation],
  );

  const addCategory = useCallback(
    async (input: { name: string; color: string; icon?: string }): Promise<NoteCategory> => {
      const cat: NoteCategory = {
        id: `cat-${crypto.randomUUID()}`,
        name: input.name.trim(),
        color: input.color || "var(--accent)",
        icon: input.icon,
      };
      await mutation.mutateAsync((current) => addCategoryOperation(current, cat));
      return cat;
    },
    [mutation],
  );

  const updateCategory = useCallback(
    async (
      id: string,
      patch: { name?: string; color?: string; icon?: string },
    ): Promise<void> => {
      await mutation.mutateAsync((current) => updateCategoryOperation(current, id, patch));
    },
    [mutation],
  );

  const deleteCategory = useCallback(
    async (id: string): Promise<void> => {
      const now = Date.now();
      await mutation.mutateAsync((current) => deleteCategoryOperation(current, id, now));
    },
    [mutation],
  );

  return {
    notes: state.notes,
    categories: state.categories.length > 0 ? state.categories : DEFAULT_CATEGORIES,
    isLoading,
    error,
    edition,
    addNote,
    updateNote,
    togglePin,
    deleteNote,
    addCategory,
    updateCategory,
    deleteCategory,
  };
}
