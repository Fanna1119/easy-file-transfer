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
  Home,
  Pencil,
  Upload,
  FolderPlus,
  Trash2,
} from "lucide-react";
import type { FileEntry, LogType } from "../types";
import {
  setDragPayload,
  getDragPayload,
  clearDragPayload,
} from "../lib/dragStore";
import { ContextMenu } from "./ContextMenu";
import type { ContextMenuEntry } from "./ContextMenu";
import { ConfirmDialog } from "./ConfirmDialog";

interface LocalBrowserProps {
  /** Notify parent when the user drops remote entries here (download). */
  onDropRemote: (
    entries: Array<{ path: string; isDir: boolean }>,
    localDest?: string,
  ) => void;
  /** Notify parent whenever the current local directory changes. */
  onLocalPathChange: (path: string) => void;
  /** Context-menu "Upload to remote" action. */
  onUpload?: (entries: Array<{ path: string; isDir: boolean }>) => void;
  /** Append a message to the global log. */
  onLog?: (msg: string, type?: LogType) => void;
}

export function LocalBrowser({
  onDropRemote,
  onLocalPathChange,
  onUpload,
  onLog,
}: LocalBrowserProps) {
  const homeDir = useRef<string | null>(null);
  const [currentPath, setCurrentPath] = useState<string>("~");
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [future, setFuture] = useState<string[]>([]);
  const [editingPath, setEditingPath] = useState(false);
  const [editValue, setEditValue] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [folderDragOver, setFolderDragOver] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const anchorIdxRef = useRef<number | null>(null);

  // Context menu
  type CtxState = { x: number; y: number; entry: FileEntry | null } | null;
  const [ctxMenu, setCtxMenu] = useState<CtxState>(null);

  // Inline rename
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  // Create folder
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("New Folder");

  // Delete
  const [confirmDelete, setConfirmDelete] = useState<{
    paths: string[];
    count: number;
  } | null>(null);

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
        const ta = Number(a.modified);
        const tb = Number(b.modified);
        cmp =
          Number.isFinite(ta) && Number.isFinite(tb)
            ? ta - tb
            : a.modified.localeCompare(b.modified);
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

  const navigate = useCallback(
    (path: string, pushHistory = true) => {
      if (pushHistory) {
        setHistory((h) => [...h, currentPath]);
        setFuture([]);
      }
      setCurrentPath(path);
      setSelected(new Set());
      anchorIdxRef.current = null;
      onLocalPathChange(path);
    },
    [currentPath, onLocalPathChange],
  );

  const load = useCallback(async (path: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await invoke<FileEntry[]>("list_local_dir", { path });
      setEntries(result);
      // Resolve ~ to actual path
      if (path === "~" && result.length > 0 && homeDir.current === null) {
        const first = result[0]?.path;
        if (first) {
          const parent = first.split("/").slice(0, -1).join("/");
          homeDir.current = parent;
          onLocalPathChange(parent);
        }
      }
    } catch (e) {
      setError(String(e));
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(currentPath);
  }, [currentPath, load]);

  const goUp = () => {
    if (currentPath === "/" || currentPath === "~") return;
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
  };

  const goForward = () => {
    const next = future[0];
    if (!next) return;
    setFuture((f) => f.slice(1));
    setHistory((h) => [...h, currentPath]);
    setCurrentPath(next);
  };

  const goHome = () => navigate(homeDir.current ?? "~");

  const commitRename = async (entry: FileEntry) => {
    const newName = renameValue.trim();
    setRenaming(null);
    if (!newName || newName === entry.name) return;
    try {
      await invoke("rename_local", { from: entry.path, to: newName });
      load(currentPath);
    } catch (e) {
      console.error("rename_local failed:", e);
    }
  };

  const commitCreateFolder = async () => {
    const name = newFolderName.trim();
    setCreatingFolder(false);
    setNewFolderName("New Folder");
    if (!name) return;
    try {
      await invoke("create_local_dir", { path: currentPath, name });
      load(currentPath);
    } catch (e) {
      console.error("create_local_dir failed:", e);
    }
  };

  const handleDelete = async (paths: string[]) => {
    try {
      await invoke("delete_local", { paths });
      setSelected(new Set());
      load(currentPath);
      onLog?.(
        `Deleted ${paths.length} item${paths.length === 1 ? "" : "s"} from ${currentPath}`,
        "warning",
      );
    } catch (e) {
      console.error("delete_local failed:", e);
      onLog?.(`Delete failed: ${String(e)}`, "error");
    }
  };

  const openContextMenu = (e: React.MouseEvent, entry: FileEntry | null) => {
    e.preventDefault();
    e.stopPropagation();
    if (entry) {
      setSelected((prev) =>
        prev.has(entry.path) ? prev : new Set([entry.path]),
      );
    }
    setCtxMenu({ x: e.clientX, y: e.clientY, entry });
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

  // Drag source: local files being dragged to remote pane
  const handleDragStart = (e: React.DragEvent, entry: FileEntry) => {
    const toTransfer = selected.has(entry.path)
      ? sortedEntries
          .filter((en) => selected.has(en.path))
          .map((en) => ({ path: en.path, isDir: en.isDir }))
      : [{ path: entry.path, isDir: entry.isDir }];
    const payload = { entries: toTransfer, source: "local" as const };
    setDragPayload(payload);
    e.dataTransfer.setData("application/x-eft", JSON.stringify(payload));
    e.dataTransfer.effectAllowed = "copy";
  };

  // Pane-level drop: remote → current directory
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    setFolderDragOver(null);
    const payload = getDragPayload();
    clearDragPayload();
    if (!payload || payload.source !== "remote" || payload.entries.length === 0)
      return;
    onDropRemote(payload.entries);
  };

  // Drop onto a specific folder row
  const handleFolderDrop = (e: React.DragEvent, targetFolder: FileEntry) => {
    e.preventDefault();
    e.stopPropagation();
    setFolderDragOver(null);
    setDragOver(false);
    const payload = getDragPayload();
    clearDragPayload();
    if (!payload || payload.source !== "remote" || payload.entries.length === 0)
      return;
    onDropRemote(payload.entries, targetFolder.path);
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
      className={`flex flex-col h-full min-h-0 border-r border-slate-700 ${
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
      onContextMenu={(e) => openContextMenu(e, null)}
    >
      {/* Header */}
      <div className="flex items-center gap-1 px-2 py-1.5 bg-slate-800 border-b border-slate-700 shrink-0">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest mr-1 shrink-0">
          Local
        </span>
        <button
          onClick={goBack}
          disabled={history.length === 0}
          className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          title="Back"
        >
          <ChevronLeft size={13} />
        </button>
        <button
          onClick={goForward}
          disabled={future.length === 0}
          className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          title="Forward"
        >
          <ChevronRight size={13} />
        </button>
        <button
          onClick={goUp}
          disabled={currentPath === "/" || currentPath === "~"}
          className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          title="Up"
        >
          <ChevronUp size={13} />
        </button>
        <button
          onClick={goHome}
          className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-colors"
          title="Home"
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
            onClick={startEditPath}
            className="flex-1 mx-1 px-2 py-0.5 text-xs text-left bg-slate-900/50 hover:bg-slate-900 border border-slate-700 rounded text-slate-300 font-mono truncate transition-colors"
            title={currentPath}
          >
            {currentPath}
          </button>
        )}

        <button
          onClick={() => load(currentPath)}
          disabled={loading}
          className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-700 disabled:opacity-30 transition-colors"
          title="Refresh"
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
        {error ? (
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
                onContextMenu={(e) => openContextMenu(e, entry)}
                onDragStart={(e) => handleDragStart(e, entry)}
                onDoubleClick={() => {
                  if (entry.isDir) navigate(entry.path);
                }}
                onDragEnter={
                  entry.isDir
                    ? (e) => {
                        e.preventDefault();
                        setFolderDragOver(entry.path);
                      }
                    : undefined
                }
                onDragOver={
                  entry.isDir
                    ? (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        e.dataTransfer.dropEffect = "copy";
                      }
                    : undefined
                }
                onDragLeave={
                  entry.isDir
                    ? (e) => {
                        if (!e.currentTarget.contains(e.relatedTarget as Node))
                          setFolderDragOver(null);
                      }
                    : undefined
                }
                onDrop={
                  entry.isDir ? (e) => handleFolderDrop(e, entry) : undefined
                }
                className={`flex items-center gap-2 px-2 py-[3px] text-xs cursor-default select-none border-l-2 ${
                  folderDragOver === entry.path
                    ? "bg-blue-700/30 border-blue-400"
                    : selected.has(entry.path)
                      ? "bg-blue-600/25 text-white border-blue-500"
                      : "text-slate-200 hover:bg-slate-800 border-transparent"
                }`}
              >
                {entry.isDir ? (
                  <Folder size={13} className="text-yellow-500 shrink-0" />
                ) : (
                  <File size={13} className="text-slate-500 shrink-0" />
                )}
                {renaming === entry.path ? (
                  <input
                    autoFocus
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onBlur={() => commitRename(entry)}
                    onKeyDown={(e) => {
                      e.stopPropagation();
                      if (e.key === "Enter") commitRename(entry);
                      if (e.key === "Escape") setRenaming(null);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="flex-1 min-w-0 px-1 bg-slate-700 border border-blue-500 rounded outline-none text-slate-100 font-mono"
                  />
                ) : (
                  <span className="flex-1 min-w-0 truncate" title={entry.name}>
                    {entry.name}
                  </span>
                )}
                <span className="w-20 text-right shrink-0 text-slate-400">
                  {entry.isDir ? "" : formatSize(entry.size)}
                </span>
                <span className="w-28 text-right shrink-0 text-slate-500 pr-1">
                  {formatDate(entry.modified)}
                </span>
              </div>
            ))}

            {/* Inline new-folder row */}
            {creatingFolder && (
              <div className="flex items-center gap-2 px-2 py-[3px] text-xs border-l-2 border-blue-500 bg-blue-600/10">
                <Folder size={13} className="text-yellow-500 shrink-0" />
                <input
                  autoFocus
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  onBlur={commitCreateFolder}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitCreateFolder();
                    if (e.key === "Escape") {
                      setCreatingFolder(false);
                      setNewFolderName("New Folder");
                    }
                  }}
                  className="flex-1 min-w-0 px-1 bg-slate-700 border border-blue-500 rounded outline-none text-slate-100 font-mono"
                />
              </div>
            )}

            {entries.length === 0 && !loading && !creatingFolder && (
              <div className="p-3 text-xs text-slate-600">Empty folder</div>
            )}
          </>
        )}
      </div>

      {/* Context menu */}
      {confirmDelete && (
        <ConfirmDialog
          message={`Are you sure you want to delete ${confirmDelete.count} item${confirmDelete.count === 1 ? "" : "s"}?`}
          onConfirm={() => {
            const paths = confirmDelete.paths;
            setConfirmDelete(null);
            handleDelete(paths);
          }}
          onCancel={() => setConfirmDelete(null)}
        />
      )}

      {ctxMenu && (
        <ContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          onClose={() => setCtxMenu(null)}
          items={
            ctxMenu.entry
              ? ([
                  {
                    label: "Rename",
                    icon: <Pencil size={12} />,
                    onClick: () => {
                      setRenameValue(ctxMenu.entry!.name);
                      setRenaming(ctxMenu.entry!.path);
                    },
                  },
                  ...(onUpload
                    ? [
                        { separator: true } as ContextMenuEntry,
                        {
                          label: "Upload to remote",
                          icon: <Upload size={12} />,
                          onClick: () => {
                            const selEntries =
                              selected.size > 0
                                ? sortedEntries
                                    .filter((en) => selected.has(en.path))
                                    .map((en) => ({
                                      path: en.path,
                                      isDir: en.isDir,
                                    }))
                                : [
                                    {
                                      path: ctxMenu.entry!.path,
                                      isDir: ctxMenu.entry!.isDir,
                                    },
                                  ];
                            onUpload(selEntries);
                          },
                        } as ContextMenuEntry,
                      ]
                    : []),
                  { separator: true } as ContextMenuEntry,
                  {
                    label: "Delete",
                    icon: <Trash2 size={12} />,
                    danger: true,
                    onClick: () => {
                      const toDelete =
                        selected.size > 0
                          ? sortedEntries
                              .filter((en) => selected.has(en.path))
                              .map((en) => en.path)
                          : [ctxMenu.entry!.path];
                      setConfirmDelete({
                        paths: toDelete,
                        count: toDelete.length,
                      });
                    },
                  } as ContextMenuEntry,
                ] as ContextMenuEntry[])
              : ([
                  {
                    label: "New Folder",
                    icon: <FolderPlus size={12} />,
                    onClick: () => {
                      setNewFolderName("New Folder");
                      setCreatingFolder(true);
                    },
                  },
                ] as ContextMenuEntry[])
          }
        />
      )}
    </div>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

function formatDate(modified: string): string {
  const ts = Number(modified);
  if (!Number.isNaN(ts) && ts > 0) {
    const d = new Date(ts * 1000);
    return (
      d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) +
      " " +
      d.toLocaleTimeString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      })
    );
  }
  return modified;
}
