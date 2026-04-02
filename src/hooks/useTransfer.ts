import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type {
  CompleteEvent,
  ProgressEvent,
  TransferConfig,
  TransferItem,
} from "../types";

export function useTransfer() {
  const [queue, setQueue] = useState<TransferItem[]>([]);
  // Map transferId → cleanup function for event listeners
  const listeners = useRef<Map<string, UnlistenFn[]>>(new Map());

  /** Start a single transfer and wire up progress/complete listeners. */
  const startTransfer = useCallback(async (config: TransferConfig) => {
    // Resolve total size before starting so we can show X / Y in the UI.
    const totalBytes = await invoke<number>("get_file_sizes", {
      paths: config.files,
    }).catch(() => 0);

    // Optimistic placeholder
    const placeholder: TransferItem = {
      id: "__pending__" + Date.now(),
      config,
      status: "running",
      percent: 0,
      bytesTransferred: 0,
      totalBytes,
      speed: "",
      eta: "",
      currentFile: null,
      xfrCurrent: null,
      xfrTotal: null,
      message: null,
    };

    setQueue((q) => [...q, placeholder]);

    let transferId: string;
    try {
      transferId = await invoke<string>("start_transfer", { cfg: config });
    } catch (err) {
      setQueue((q) =>
        q.map((item) =>
          item.id === placeholder.id
            ? { ...item, status: "failed", message: String(err) }
            : item,
        ),
      );
      return;
    }

    // Replace placeholder id with real id
    setQueue((q) =>
      q.map((item) =>
        item.id === placeholder.id ? { ...item, id: transferId } : item,
      ),
    );

    // Subscribe to progress and completion events
    const progressUn = await listen<ProgressEvent>(
      `transfer://progress/${transferId}`,
      (event) => {
        const ev = event.payload;
        setQueue((q) =>
          q.map((item) =>
            item.id === transferId
              ? {
                  ...item,
                  percent: ev.percent,
                  bytesTransferred: ev.bytesTransferred,
                  speed: ev.speed,
                  eta: ev.eta,
                  currentFile: ev.currentFile ?? item.currentFile,
                  xfrCurrent: ev.xfrCurrent ?? item.xfrCurrent,
                  xfrTotal: ev.xfrTotal ?? item.xfrTotal,
                }
              : item,
          ),
        );
      },
    );

    const completeUn = await listen<CompleteEvent>(
      `transfer://complete/${transferId}`,
      (event) => {
        const ev = event.payload;
        setQueue((q) =>
          q.map((item) => {
            if (item.id !== transferId) return item;
            // Don't overwrite a user-initiated cancel with the rsync exit error.
            if (item.status === "cancelled") return item;
            return {
              ...item,
              status: ev.success ? "completed" : "failed",
              percent: ev.success ? 100 : item.percent,
              message: ev.message,
            };
          }),
        );
        // Cleanup listeners
        const fns = listeners.current.get(transferId) ?? [];
        fns.forEach((fn) => fn());
        listeners.current.delete(transferId);
      },
    );

    listeners.current.set(transferId, [progressUn, completeUn]);
  }, []);

  /** Cancel an in-flight transfer. */
  const cancelTransfer = useCallback(async (transferId: string) => {
    try {
      await invoke("cancel_transfer", { transferId });
    } catch (_) {
      // ignore — process may have already exited
    }
    setQueue((q) =>
      q.map((item) =>
        item.id === transferId && item.status === "running"
          ? { ...item, status: "cancelled", message: "Cancelled by user" }
          : item,
      ),
    );
  }, []);

  /** Remove all completed/failed/cancelled items from the queue. */
  const clearCompleted = useCallback(() => {
    setQueue((q) =>
      q.filter(
        (item) =>
          item.status !== "completed" &&
          item.status !== "failed" &&
          item.status !== "cancelled",
      ),
    );
  }, []);

  // Cleanup all listeners on unmount
  useEffect(() => {
    return () => {
      listeners.current.forEach((fns) => fns.forEach((fn) => fn()));
    };
  }, []);

  return { queue, startTransfer, cancelTransfer, clearCompleted };
}
