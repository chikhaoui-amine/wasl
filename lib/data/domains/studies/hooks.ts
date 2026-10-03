"use client";

import { useCallback } from "react";
import {
  useQuery,
  useMutation,
  useQueryClient,
  useDataAdapter,
  useDataEdition,
  useDataUserId,
} from "../../query/provider";
import { queryKeys } from "../../query/keys";
import { useSerializedMutations } from "../../query/mutation-queue";
import { createDefaultStudiesState, normalizeStudiesState } from "./constants";
import {
  setAcademicProfile as setAcademicProfileOp,
  addStudyModule as addStudyModuleOp,
  updateStudyModule as updateStudyModuleOp,
  deleteStudyModule as deleteStudyModuleOp,
  toggleChecklistItem as toggleChecklistItemOp,
  addChecklistItem as addChecklistItemOp,
  deleteChecklistItem as deleteChecklistItemOp,
  logAbsence as logAbsenceOp,
  deleteAbsence as deleteAbsenceOp,
  loadPresetCurriculum as loadPresetCurriculumOp,
} from "./operations";
import type {
  StudiesState,
  StudyModule,
  StudyAbsenceRecord,
  AcademicProfile,
  AddStudyModuleInput,
  AddStudyChecklistItemInput,
} from "./types";

export function useStudiesData() {
  const adapter = useDataAdapter();
  const edition = useDataEdition();
  const userId = useDataUserId();
  const queryClient = useQueryClient();
  const queryKey = queryKeys.store(edition, userId, "lifeos-studies");
  const enqueue = useSerializedMutations();

  const query = useQuery({
    queryKey,
    enabled: !!adapter,
    queryFn: async () => {
      if (!adapter) return createDefaultStudiesState();
      const doc = await adapter.getStore("lifeos-studies");
      return normalizeStudiesState(doc?.state);
    },
  });

  const state: StudiesState = normalizeStudiesState(query.data);

  const mutation = useMutation({
    mutationFn: async (updater: (current: StudiesState) => StudiesState) => {
      if (!adapter) {
        const curr = queryClient.getQueryData<StudiesState>(queryKey) || createDefaultStudiesState();
        return updater(normalizeStudiesState(curr));
      }
      return enqueue(async () => {
        const doc = await adapter.mutateStore("lifeos-studies", (prev) => {
          const base = normalizeStudiesState(prev);
          return updater(base);
        });
        return normalizeStudiesState(doc.state);
      });
    },
    onMutate: async (updater) => {
      await queryClient.cancelQueries({ queryKey });
      const previousState = queryClient.getQueryData<StudiesState>(queryKey) || createDefaultStudiesState();
      const nextState = updater(normalizeStudiesState(previousState));
      queryClient.setQueryData(queryKey, nextState);
      return { previousState };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousState) {
        queryClient.setQueryData(queryKey, context.previousState);
      }
    },
    onSuccess: (newState) => {
      queryClient.setQueryData(queryKey, newState);
    },
  });

  const setProfile = useCallback(
    async (profileUpdates: Partial<AcademicProfile>) => {
      await mutation.mutateAsync((curr) => setAcademicProfileOp(curr, profileUpdates));
    },
    [mutation],
  );

  const addModule = useCallback(
    async (input: AddStudyModuleInput) => {
      await mutation.mutateAsync((curr) => addStudyModuleOp(curr, input));
    },
    [mutation],
  );

  const updateModule = useCallback(
    async (moduleId: string, updates: Partial<Omit<StudyModule, "id" | "createdAt">>) => {
      await mutation.mutateAsync((curr) => updateStudyModuleOp(curr, moduleId, updates));
    },
    [mutation],
  );

  const deleteModule = useCallback(
    async (moduleId: string) => {
      await mutation.mutateAsync((curr) => deleteStudyModuleOp(curr, moduleId));
    },
    [mutation],
  );

  const toggleChecklist = useCallback(
    async (itemId: string) => {
      await mutation.mutateAsync((curr) => toggleChecklistItemOp(curr, itemId));
    },
    [mutation],
  );

  const addChecklist = useCallback(
    async (input: AddStudyChecklistItemInput) => {
      await mutation.mutateAsync((curr) => addChecklistItemOp(curr, input));
    },
    [mutation],
  );

  const deleteChecklist = useCallback(
    async (itemId: string) => {
      await mutation.mutateAsync((curr) => deleteChecklistItemOp(curr, itemId));
    },
    [mutation],
  );

  const addAbsence = useCallback(
    async (input: Omit<StudyAbsenceRecord, "id"> & { id?: string }) => {
      await mutation.mutateAsync((curr) => logAbsenceOp(curr, input));
    },
    [mutation],
  );

  const removeAbsence = useCallback(
    async (recordId: string) => {
      await mutation.mutateAsync((curr) => deleteAbsenceOp(curr, recordId));
    },
    [mutation],
  );

  const loadPreset = useCallback(
    async (level: string, semester: string, mode: "replace" | "merge" = "merge") => {
      await mutation.mutateAsync((curr) => loadPresetCurriculumOp(curr, level, semester, mode));
    },
    [mutation],
  );

  return {
    state,
    isLoading: query.isLoading,
    profile: state.profile,
    modules: state.modules,
    checklist: state.checklist,
    absences: state.absences,
    setProfile,
    addModule,
    updateModule,
    deleteModule,
    toggleChecklist,
    addChecklist,
    deleteChecklist,
    addAbsence,
    removeAbsence,
    loadPreset,
  };
}
