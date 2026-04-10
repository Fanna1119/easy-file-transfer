import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Folder,
  File,
  RefreshCw,
  AlertCircle,
  WifiOff,
  Home,
} from "lucide-react";
import type { ConnectionConfig, FileEntry } from "../types";
import {
  setDragPayload,
  getDragPayload,
  clearDragPayload,
} from "../lib/dragStore";

interface RemoteBrowserPaneProps {
  connected: boolean;
  connection: ConnectionConfig;
  /** Cache directory listings to speed up navigation. */
  cacheEnabled: boolean;
  /** Pre-fetch one level into visible subdirectories for instant navigation. Requires cacheEnabled. */
  smartTraverse: boolean;
  /** Called when the user drops local entries here (upload). */
  onDropLocal: (entries: Array<{ path: string; isDir: boolean }>) => void;
  /** Parent is notified whenever the current remote path changes. */
  onPathChange: (path: string) => void;
}

export function RemoteBrowserPane({
  connected,
  connection,
  cacheEnabled,
  smartTraverse,
  onDropLocal,
  onPathChange,
}: RemoteBrowserPaneProps) {
  const [currentPath, setCurrentPath] = useState<string>("/");
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [future, setFuture] = useState<string[]>([]);
  const [editingPath, setEditingPath] = useState(false);
  const [editValue, setEditValue] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const anchorIdxRef = useRef<number | null>(null);

  type SortCol = "name" | "size" | "modified";
  const [sortCol, setSortCol] = useState<SortCol>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const sortedEntries = useMemo(() => {
    return [...entries].sort((a, b) => {
      if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
      let cmp = 0;
      if (sortCol === "name") {
        cmp = a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
      } else if (sortCol === "size") {
        cmp = a.size - b.size;
      } else {
        cmp = a.modified.localeCompare(b.modified);
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [entries, sortCol, sortDir]);

  const handleSort = (col: SortCol) => {
    if (col === sortCol) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortCol(col);
      setSortDir("asc");
    }
  };
  // In-memory cache: connection key → (path → entries)
  const cache = useRef<Map<string, FileEntry[]>>(new Map());
  const connectionKey = `${connection.user}@${connection.host}:${connection.port ?? 22}/${connection.sshKey ?? ""}`;
  // Track in-flight prefetch paths to avoid duplicate SSH calls
  const prefetching = useRef<Set<string>>(new Set());

  const navigate = useCallback(
    (path: string, pushHistory = true) => {
      if (pushHistory) {
        setHistory((h) => [...h, currentPath]);
        setFuture([]);
      }
      setCurrentPath(path);
      onPathChange(path);
      setSelected(new Set());
      anchorIdxRef.current = null;
    },
    [currentPath, onPathChange],
  );

  const fetchRemote = useCallback(
    async (path: string): Promise<FileEntry[]> => {
      return invoke<FileEntry[]>("list_remote_dir", {
        params: {
          user: connection.user,
          host: connection.host,
          port: connection.port,
          path,
          sshKey: connection.sshKey,
          passphrase: connection.passphrase || null,
          maxDepth: 1,
        },
      });
    },
    [connection],
  );

  // Pre-fetch one level into each subdirectory, max 3 concurrent SSH calls.
  // Stored in a ref so `load` can call it without a circular dependency.
  const prefetchChildrenRef = useRef<(entries: FileEntry[]) => void>(() => {});

  const prefetchChildren = useCallback(
    (parentEntries: FileEntry[]) => {
      if (!cacheEnabled || !smartTraverse) return;
      const dirs = parentEntries.filter((e) => e.isDir);
      const queue = dirs.map((d) => d.path);

      const run = async (paths: string[]) => {
        // Process in chunks of 3 to avoid flooding the SSH connection
        for (let i = 0; i < paths.length; i += 3) {
          const chunk = paths.slice(i, i + 3);
          await Promise.all(
            chunk.map(async (dirPath) => {
              const ck = `${connectionKey}::${dirPath}`;
              if (cache.current.has(ck) || prefetching.current.has(ck)) return;
              prefetching.current.add(ck);
              try {
                const result = await fetchRemote(dirPath);
                cache.current.set(ck, result);
              } catch {
                // ignore prefetch errors silently
              } finally {
                prefetching.current.delete(ck);
              }
            }),
          );
        }
      };

      void run(queue);
    },
    [cacheEnabled, smartTraverse, connectionKey, fetchRemote],
  );

  // Keep ref up-to-date so load() always calls the latest version
  prefetchChildrenRef.current = prefetchChildren;

  const load = useCallback(
    async (path: string, bustCache = false) => {
      if (!connected) return;
      const cacheKey = `${connectionKey}::${path}`;

      // Serve from cache immediately (stale-while-revalidate)
      if (cacheEnabled && !bustCache && cache.current.has(cacheKey)) {
        setEntries(cache.current.get(cacheKey)!);
        // Silently refresh in background
        fetchRemote(path)
          .then((fresh) => {
            cache.current.set(cacheKey, fresh);
            setEntries(fresh);
            prefetchChildrenRef.current(fresh);
          })
          .catch(() => {
            /* keep stale data on background error */
          });
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const result = await fetchRemote(path);
        if (cacheEnabled) cache.current.set(cacheKey, result);
        setEntries(result);
        prefetchChildrenRef.current(result);
      } catch (e) {
        setError(String(e));
        setEntries([]);
      } finally {
        setLoading(false);
      }
    },
    [connected, connectionKey, cacheEnabled, fetchRemote],
  );

  // Reload when connection changes or path changes
  useEffect(() => {
    if (connected) {
      load(currentPath);
    } else {
      // Clear cache when disconnecting so stale data isn't served on next connect
      cache.current.clear();
      setEntries([]);
      setCurrentPath("/");
      setHistory([]);
      setFuture([]);
      setSelected(new Set());
      anchorIdxRef.current = null;
    }
  }, [connected, connection, currentPath, load]);

  const goUp = () => {
    if (currentPath === "/") return;
    const parts = currentPath.split("/");
    const parent = parts.slice(0, -1).join("/") || "/";
    navigate(parent);
  };

  const goBack = () => {
    const prev = history[history.length - 1];
    if (!prev) return;
    setHistory((h) => h.slice(0, -1));
    setFuture((f) => [currentPath, ...f]);
    setCurrentPath(prev);
    onPathChange(prev);
  };

  const goForward = () => {
    const next = future[0];
    if (!next) return;
    setFuture((f) => f.slice(1));
    setHistory((h) => [...h, currentPath]);
    setCurrentPath(next);
    onPathChange(next);
  };

  const handleRowClick = (
    e: React.MouseEvent,
    entry: FileEntry,
    idx: number,
  ) => {
    if (e.shiftKey && anchorIdxRef.current !== null) {
      const lo = Math.min(anchorIdxRef.current, idx);
      const hi = Math.max(anchorIdxRef.current, idx);
      setSelected((prev) => {
        const next = new Set(prev);
        entries.slice(lo, hi + 1).forEach((en) => next.add(en.path));
        return next;
      });
    } else if (e.metaKey || e.ctrlKey) {
      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(entry.path)) next.delete(entry.path);
        else next.add(entry.path);
        return next;
      });
      anchorIdxRef.current = idx;
    } else {
      setSelected(new Set([entry.path]));
      anchorIdxRef.current = idx;
    }
  };

  // Drag source: remote files being dragged to local pane
  const handleDragStart = (e: React.DragEvent, entry: FileEntry) => {
    const toTransfer = selected.has(entry.path)
      ? sortedEntries
          .filter((en) => selected.has(en.path))
          .map((en) => ({ path: en.path, isDir: en.isDir }))
      : [{ path: entry.path, isDir: entry.isDir }];
    const payload = { entries: toTransfer, source: "remote" as const };
    setDragPayload(payload);
    e.dataTransfer.setData("application/x-eft", JSON.stringify(payload));
    e.dataTransfer.effectAllowed = "copy";
  };

  // Drop target: accept local files dragged from the local pane
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const storePayload = getDragPayload();
    const rawDT = e.dataTransfer.getData("application/x-eft");
    let payload = storePayload;
    clearDragPayload();
    if (!payload) {
      try {
        if (rawDT) payload = JSON.parse(rawDT);
      } catch {
        /* ignore */
      }
    }
    if (!payload || payload.source !== "local" || payload.entries.length === 0)
      return;
    onDropLocal(payload.entries);
  };

  const startEditPath = () => {
    setEditValue(currentPath);
    setEditingPath(true);
  };

  const commitEditPath = () => {
    setEditingPath(false);
    if (editValue.trim() && editValue !== currentPath) {
      navigate(editValue.trim());
    }
  };

  return (
    <div
      className={`flex flex-col h-full min-h-0 ${
        dragOver ? "bg-blue-900/20" : "bg-slate-900"
      }`}
      onDragEnter={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node))
          setDragOver(false);
      }}
      onDrop={handleDrop}
    >
      {/* Header */}
      <div className="flex items-center gap-1 px-2 py-1.5 bg-slate-800 border-b border-slate-700 shrink-0">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest mr-1 shrink-0">
          Remote
        </span>
        <button
          onClick={goBack}
          disabled={!connected || history.length === 0}
          className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft size={13} />
        </button>
        <button
          onClick={goForward}
          disabled={!connected || future.length === 0}
          className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronRight size={13} />
        </button>
        <button
          onClick={goUp}
          disabled={!connected || currentPath === "/"}
          className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronUp size={13} />
        </button>
        <button
          onClick={() => navigate("/")}
          disabled={!connected}
          className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-700 disabled:opacity-30 transition-colors"
        >
          <Home size={13} />
        </button>

        {/* Path bar */}
        {editingPath ? (
          <input
            autoFocus
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={commitEditPath}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitEditPath();
              if (e.key === "Escape") setEditingPath(false);
            }}
            className="flex-1 mx-1 px-2 py-0.5 text-xs bg-slate-900 border border-blue-500 rounded outline-none text-slate-100 font-mono"
          />
        ) : (
          <button
            onClick={connected ? startEditPath : undefined}
            disabled={!connected}
            className="flex-1 mx-1 px-2 py-0.5 text-xs text-left bg-slate-900/50 hover:bg-slate-900 border border-slate-700 rounded text-slate-300 font-mono truncate transition-colors disabled:cursor-default"
            title={currentPath}
          >
            {connected ? currentPath : "—"}
          </button>
        )}

        <button
          onClick={() => load(currentPath, true)}
          disabled={!connected || loading}
          className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-700 disabled:opacity-30 transition-colors"
        >
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {/* Column headers */}
      <div className="flex text-xs text-slate-500 font-medium px-2 py-1 bg-slate-800/50 border-b border-slate-700/50 shrink-0 select-none">
        <button
          onClick={() => handleSort("name")}
          className="flex-1 min-w-0 text-left flex items-center gap-1 hover:text-slate-300 transition-colors"
        >
          Filename{" "}
          <span className="opacity-60">
            {sortCol === "name" ? (sortDir === "asc" ? "▲" : "▼") : "⇅"}
          </span>
        </button>
        <button
          onClick={() => handleSort("size")}
          className="w-20 flex items-center justify-end gap-1 shrink-0 hover:text-slate-300 transition-colors"
        >
          <span className="opacity-60">
            {sortCol === "size" ? (sortDir === "asc" ? "▲" : "▼") : "⇅"}
          </span>{" "}
          Size
        </button>
        <button
          onClick={() => handleSort("modified")}
          className="w-28 flex items-center justify-end gap-1 shrink-0 pr-1 hover:text-slate-300 transition-colors"
        >
          <span className="opacity-60">
            {sortCol === "modified" ? (sortDir === "asc" ? "▲" : "▼") : "⇅"}
          </span>{" "}
          Modified
        </button>
      </div>

      {/* File list */}
      <div
        className="flex-1 overflow-y-auto min-h-0 outline-none"
        tabIndex={0}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "a") {
            e.preventDefault();
            setSelected(new Set(entries.map((en) => en.path)));
          } else if (e.key === "Escape") {
            setSelected(new Set());
          }
        }}
      >
        {!connected ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-600 gap-3">
            <WifiOff size={32} className="text-slate-700" />
            <p className="text-sm">Not connected</p>
            <p className="text-xs text-slate-700">
              Enter server details above and click Connect
            </p>
          </div>
        ) : error ? (
          <div className="flex items-center gap-2 p-3 text-xs text-red-400">
            <AlertCircle size={14} className="shrink-0" />
            {error}
          </div>
        ) : loading ? (
          <div className="p-3 text-xs text-slate-500">Loading…</div>
        ) : (
          <>
            {/* Parent dir row */}
            {currentPath !== "/" && (
              <div
                className="flex items-center gap-2 px-2 py-1 text-xs text-slate-400 hover:bg-slate-800 cursor-pointer"
                onDoubleClick={goUp}
              >
                <Folder size={13} className="text-yellow-500 shrink-0" />
                <span className="flex-1">..</span>
              </div>
            )}

            {sortedEntries.map((entry, idx) => (
              <div
                key={entry.path}
                draggable
                onClick={(e) => handleRowClick(e, entry, idx)}
                onDragStart={(e) => handleDragStart(e, entry)}
                onDoubleClick={() => {
                  if (entry.isDir) navigate(entry.path);
                }}
                className={`flex items-center gap-2 px-2 py-[3px] text-xs cursor-default select-none ${
                  selected.has(entry.path)
                    ? "bg-blue-600/25 text-white border-l-2 border-blue-500"
                    : "text-slate-200 hover:bg-slate-800"
                }`}
              >
                {entry.isDir ? (
                  <Folder size={13} className="text-yellow-500 shrink-0" />
                ) : (
                  <File size={13} className="text-slate-500 shrink-0" />
                )}
                <span className="flex-1 min-w-0 truncate" title={entry.name}>
                  {entry.name}
                </span>
                <span className="w-20 text-right shrink-0 text-slate-400">
                  {entry.isDir ? "" : formatSize(entry.size)}
                </span>
                <span className="w-28 text-right shrink-0 text-slate-500 pr-1">
                  {entry.modified}
                </span>
              </div>
            ))}

            {entries.length === 0 && !loading && (
              <div className="p-3 text-xs text-slate-600">Empty folder</div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}
