import { useSyncExternalStore } from "react";
import { getPwaState, subscribePwaState, applyServiceWorkerUpdate, type PwaState } from "./service-worker";

const SERVER_SNAPSHOT: PwaState = {
  isOffline: false,
  updateAvailable: false,
  waitingWorker: null,
  registration: null,
};

export function usePwa() {
  const state = useSyncExternalStore(
    subscribePwaState,
    getPwaState,
    () => SERVER_SNAPSHOT,
  );

  return {
    ...state,
    applyUpdate: applyServiceWorkerUpdate,
  };
}
