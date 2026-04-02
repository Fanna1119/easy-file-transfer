import { useCallback, useRef } from "react";
import { open } from "@tauri-apps/plugin-dialog";

interface FileSelectorProps {
  files: string[];
  basePath: string;
  onFilesChange: (files: string[]) => void;
  onBasePathChange: (base: string) => void;
}

function computeCommonBase(files: string[]): string {
  if (files.length === 0) return "";
  const parts = files.map((f) => {
    const segs = f.split("/");
    segs.pop(); // remove filename
    return segs;
  });
  const first = parts[0];
  const common: string[] = [];
  for (let i = 0; i < first.length; i++) {
    if (parts.every((p) => p[i] === first[i])) {
      common.push(first[i]);
    } else {
      break;
    }
  }
  return common.join("/") || "/";
}

export function FileSelector({
  files,
  basePath,
  onFilesChange,
  onBasePathChange,
}: FileSelectorProps) {
  const dropRef = useRef<HTMLDivElement>(null);

  const pickFiles = useCallback(async () => {
    const selected = await open({
      multiple: true,
      directory: false,
    });
    if (!selected) return;
    const paths = Array.isArray(selected) ? selected : [selected];
    const next = [...new Set([...files, ...paths])];
    onFilesChange(next);
    onBasePathChange(computeCommonBase(next));
  }, [files, onFilesChange, onBasePathChange]);

  const pickDirectory = useCallback(async () => {
    const selected = await open({
      multiple: false,
      directory: true,
    });
    if (!selected) return;
    const dir = Array.isArray(selected) ? selected[0] : selected;
    const next = [...new Set([...files, dir])];
    onFilesChange(next);
    onBasePathChange(computeCommonBase(next));
  }, [files, onFilesChange, onBasePathChange]);

  const removeFile = useCallback(
    (path: string) => {
      const next = files.filter((f) => f !== path);
      onFilesChange(next);
      onBasePathChange(computeCommonBase(next));
    },
    [files, onFilesChange, onBasePathChange],
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // On macOS/Tauri, dragged files arrive as file:// URLs
    const dropped: string[] = [];
    for (let i = 0; i < e.dataTransfer.files.length; i++) {
      const f = e.dataTransfer.files[i];
      // Tauri exposes the real path via the webkitRelativePath or name fallback
      // We use the webkitdirectory path when available, otherwise name
      const path = (f as unknown as { path?: string }).path ?? f.name;
      if (path) dropped.push(path);
    }
    if (dropped.length === 0) return;
    const next = [...new Set([...files, ...dropped])];
    onFilesChange(next);
    onBasePathChange(computeCommonBase(next));
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <button
          onClick={pickFiles}
          className="flex-1 px-3 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          + Add Files
        </button>
        <button
          onClick={pickDirectory}
          className="flex-1 px-3 py-2 text-sm font-medium bg-slate-600 hover:bg-slate-500 text-white rounded-lg transition-colors"
        >
          + Add Folder
        </button>
      </div>

      {/* Drag-and-drop zone */}
      <div
        ref={dropRef}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className="border-2 border-dashed border-slate-600 rounded-lg p-4 text-center text-sm text-slate-400 hover:border-blue-500 hover:text-blue-400 transition-colors cursor-default select-none"
      >
        Drag &amp; drop files or folders here
      </div>

      {/* Selected file list */}
      {files.length > 0 && (
        <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
          {files.map((f) => {
            const name = f.split("/").pop() ?? f;
            return (
              <div
                key={f}
                className="flex items-center justify-between gap-2 px-3 py-1.5 bg-slate-700/60 rounded text-xs group"
              >
                <span className="truncate text-slate-200" title={f}>
                  {name}
                </span>
                <button
                  onClick={() => removeFile(f)}
                  className="shrink-0 text-slate-500 hover:text-red-400 transition-colors"
                  aria-label="Remove"
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Base path display / override */}
      {files.length > 0 && (
        <div>
          <label className="block text-xs text-slate-400 mb-1">
            Base path (for --relative)
          </label>
          <input
            className="w-full px-2 py-1 text-xs bg-slate-700 border border-slate-600 rounded text-slate-200 font-mono focus:outline-none focus:border-blue-500"
            value={basePath}
            onChange={(e) => onBasePathChange(e.target.value)}
            placeholder="/common/root"
          />
        </div>
      )}
    </div>
  );
}
