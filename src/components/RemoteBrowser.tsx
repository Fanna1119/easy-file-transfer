import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Loader2, ChevronDown, ChevronRight, Folder } from "lucide-react";
import type { RemoteTreeNode } from "../types";

interface RemoteBrowserProps {
  host: string;
  initialPath: string;
  sshKey: string | null;
  onSelect: (path: string) => void;
  onClose: () => void;
}

function TreeNode({
  node,
  onExpand,
  onSelect,
  selectedPath,
}: {
  node: RemoteTreeNode;
  onExpand: (node: RemoteTreeNode) => void;
  onSelect: (path: string) => void;
  selectedPath: string;
}) {
  const isSelected = node.path === selectedPath;

  return (
    <div className="ml-3">
      <div
        className={`flex items-center gap-1.5 px-2 py-1 rounded cursor-pointer text-sm select-none hover:bg-slate-600/60 ${
          isSelected ? "bg-blue-600/30 text-blue-300" : "text-slate-200"
        }`}
        onClick={() => onSelect(node.path)}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            onExpand(node);
          }}
          className="w-4 h-4 flex items-center justify-center text-slate-400 hover:text-white shrink-0"
        >
          {node.loading ? (
            <Loader2 size={12} className="animate-spin" />
          ) : node.expanded ? (
            <ChevronDown size={12} />
          ) : (
            <ChevronRight size={12} />
          )}
        </button>
        <Folder size={13} className="text-yellow-400 shrink-0" />
        <span className="truncate font-mono text-xs">{node.name}</span>
      </div>

      {node.expanded && node.children.length > 0 && (
        <div className="border-l border-slate-600/50 ml-3">
          {node.children.map((child) => (
            <TreeNode
              key={child.path}
              node={child}
              onExpand={onExpand}
              onSelect={onSelect}
              selectedPath={selectedPath}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function RemoteBrowser({
  host,
  initialPath,
  sshKey,
  onSelect,
  onClose,
}: RemoteBrowserProps) {
  const [roots, setRoots] = useState<RemoteTreeNode[]>([]);
  const [selectedPath, setSelectedPath] = useState(initialPath);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchDirs = useCallback(
    async (path: string): Promise<RemoteTreeNode[]> => {
      const dirs = await invoke<{ path: string; name: string }[]>(
        "list_remote_dirs",
        {
          params: {
            host,
            path,
            sshKey,
            maxDepth: 1,
          },
        },
      );
      return dirs.map((d) => ({
        path: d.path,
        name: d.name,
        expanded: false,
        loading: false,
        children: [],
      }));
    },
    [host, sshKey],
  );

  useEffect(() => {
    fetchDirs(initialPath)
      .then((nodes) => {
        setRoots(nodes);
        setLoading(false);
      })
      .catch((e) => {
        setError(String(e));
        setLoading(false);
      });
  }, [fetchDirs, initialPath]);

  const handleExpand = useCallback(
    async (target: RemoteTreeNode) => {
      // Collapse: just toggle expanded off, no fetch needed.
      if (target.expanded) {
        const collapse = (nodes: RemoteTreeNode[]): RemoteTreeNode[] =>
          nodes.map((n) => {
            if (n.path === target.path) return { ...n, expanded: false };
            return { ...n, children: collapse(n.children) };
          });
        setRoots((prev) => collapse(prev));
        return;
      }

      // Expand: show loading spinner then fetch children.
      const setLoading = (nodes: RemoteTreeNode[]): RemoteTreeNode[] =>
        nodes.map((n) => {
          if (n.path === target.path) return { ...n, loading: true };
          return { ...n, children: setLoading(n.children) };
        });
      setRoots((prev) => setLoading(prev));

      try {
        const children = await fetchDirs(target.path);
        const setLoaded = (nodes: RemoteTreeNode[]): RemoteTreeNode[] =>
          nodes.map((n) => {
            if (n.path === target.path) {
              return { ...n, loading: false, expanded: true, children };
            }
            return { ...n, children: setLoaded(n.children) };
          });
        setRoots((prev) => setLoaded(prev));
      } catch (e) {
        setError(String(e));
      }
    },
    [fetchDirs],
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-800 border border-slate-600 rounded-xl shadow-2xl w-[520px] max-h-[600px] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
          <div>
            <h3 className="font-semibold text-slate-100 text-sm">
              Browse Remote Directory
            </h3>
            <p className="text-xs text-slate-400 font-mono mt-0.5">{host}</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-lg leading-none"
          >
            ✕
          </button>
        </div>

        {/* Selected path bar */}
        <div className="px-4 py-2 bg-slate-700/50 border-b border-slate-700 text-xs font-mono text-blue-300 truncate">
          {selectedPath || initialPath}
        </div>

        {/* Tree */}
        <div className="flex-1 overflow-y-auto p-3 min-h-0">
          {loading && (
            <p className="text-slate-400 text-sm text-center py-8">Loading…</p>
          )}
          {error && (
            <p className="text-red-400 text-xs p-2 bg-red-900/20 rounded">
              {error}
            </p>
          )}
          {!loading && roots.length === 0 && !error && (
            <p className="text-slate-500 text-sm text-center py-8">
              No subdirectories found
            </p>
          )}
          {roots.map((node) => (
            <TreeNode
              key={node.path}
              node={node}
              onExpand={handleExpand}
              onSelect={setSelectedPath}
              selectedPath={selectedPath}
            />
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-slate-700">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-sm text-slate-300 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onSelect(selectedPath)}
            className="px-4 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            Select Directory
          </button>
        </div>
      </div>
    </div>
  );
}
