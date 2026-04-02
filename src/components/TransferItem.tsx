import type { TransferItem as TItem } from "../types";

const STATUS_COLORS: Record<string, string> = {
  idle: "bg-slate-600 text-slate-300",
  running: "bg-blue-600/30 text-blue-300",
  completed: "bg-green-600/30 text-green-300",
  failed: "bg-red-600/30 text-red-300",
  cancelled: "bg-yellow-600/20 text-yellow-400",
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

interface TransferItemProps {
  item: TItem;
  onCancel: (id: string) => void;
}

export function TransferItem({ item, onCancel }: TransferItemProps) {
  // Derive a display label from the first file path
  const label =
    item.config.files.length === 1
      ? (item.config.files[0].split("/").pop() ?? item.config.files[0])
      : `${item.config.files.length} files`;

  const statusClass = STATUS_COLORS[item.status] ?? STATUS_COLORS.idle;
  const isRunning = item.status === "running";

  return (
    <div className="bg-slate-700/50 border border-slate-600/50 rounded-lg p-3 space-y-2">
      {/* Top row */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${statusClass}`}
          >
            {item.status}
          </span>
          <span
            className="text-sm text-slate-200 font-medium truncate"
            title={label}
          >
            {label}
          </span>
          {item.config.dryRun && (
            <span className="shrink-0 text-xs text-yellow-400 italic">
              (dry run)
            </span>
          )}
        </div>
        {isRunning && (
          <button
            onClick={() => onCancel(item.id)}
            className="shrink-0 text-xs px-2 py-1 bg-red-700/50 hover:bg-red-600/60 text-red-300 rounded transition-colors"
          >
            Cancel
          </button>
        )}
      </div>

      {/* Progress bar */}
      {(isRunning || item.status === "completed") && (
        <div className="w-full bg-slate-600 rounded-full h-1.5 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              item.status === "completed" ? "bg-green-500" : "bg-blue-500"
            }`}
            style={{ width: `${item.percent}%` }}
          />
        </div>
      )}

      {/* Stats row */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-0.5 text-xs text-slate-400">
        {item.bytesTransferred > 0 && (
          <span>
            {formatBytes(item.bytesTransferred)}
            {item.totalBytes > 0 && ` / ${formatBytes(item.totalBytes)}`}
          </span>
        )}
        {item.percent > 0 && <span>{item.percent}%</span>}
        {item.speed && <span>{item.speed}</span>}
        {item.eta && item.status === "running" && <span>ETA {item.eta}</span>}
        {item.xfrCurrent != null && item.xfrTotal != null && (
          <span>
            file {item.xfrCurrent}/{item.xfrTotal}
          </span>
        )}
      </div>

      {/* Current file */}
      {item.currentFile && isRunning && (
        <p
          className="text-xs text-slate-500 font-mono truncate"
          title={item.currentFile}
        >
          ↳ {item.currentFile}
        </p>
      )}

      {/* Error / message */}
      {item.message && item.status !== "running" && item.status !== "idle" && (
        <p
          className={`text-xs ${
            item.status === "completed"
              ? "text-green-400"
              : item.status === "cancelled"
                ? "text-yellow-400"
                : "text-red-400"
          }`}
        >
          {item.message}
        </p>
      )}

      {/* Destination */}
      <p className="text-xs text-slate-600 font-mono truncate">
        {item.config.destination}
      </p>
    </div>
  );
}
