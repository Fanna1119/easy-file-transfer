import { ArrowDown, ArrowUp, X, CheckCircle, XCircle, Ban } from "lucide-react";
import type { TransferItem as TItem } from "../types";

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
  const isUpload = item.config.direction === "upload";
  const isRunning = item.status === "running";

  const label =
    item.config.direction === "upload"
      ? item.config.files.length === 1
        ? (item.config.files[0].split("/").pop() ?? item.config.files[0])
        : `${item.config.files.length} files`
      : (item.config.destination.split("/").pop() ?? item.config.destination);

  const StatusIcon = () => {
    if (isRunning) return null;
    if (item.status === "completed")
      return <CheckCircle size={13} className="text-green-400 shrink-0" />;
    if (item.status === "failed")
      return <XCircle size={13} className="text-red-400 shrink-0" />;
    if (item.status === "cancelled")
      return <Ban size={13} className="text-slate-500 shrink-0" />;
    return null;
  };

  return (
    <div
      className={`flex flex-col gap-1 px-3 py-2 border-b border-slate-700/50 hover:bg-slate-800/30 transition-colors ${
        item.status === "failed" ? "bg-red-900/10" : ""
      }`}
    >
      {/* Main row */}
      <div className="flex items-center gap-2 min-w-0">
        {isUpload ? (
          <ArrowUp size={12} className="text-blue-400 shrink-0" />
        ) : (
          <ArrowDown size={12} className="text-green-400 shrink-0" />
        )}

        <span
          className="text-xs text-slate-200 font-medium truncate min-w-0 flex-1"
          title={label}
        >
          {label}
          {item.config.dryRun && (
            <span className="text-yellow-400 italic ml-1">(dry)</span>
          )}
        </span>

        <span className="text-xs text-slate-500 truncate max-w-[180px] shrink-0 font-mono hidden sm:block">
          {item.config.destination.split(":").pop() ?? item.config.destination}
        </span>

        <span className="text-xs text-slate-400 shrink-0">
          {isRunning
            ? `${item.percent}% · ${item.speed}`
            : item.bytesTransferred > 0
              ? formatBytes(item.bytesTransferred)
              : ""}
        </span>

        <StatusIcon />

        {isRunning && (
          <button
            onClick={() => onCancel(item.id)}
            className="shrink-0 text-slate-500 hover:text-red-400 transition-colors ml-1"
            title="Cancel"
          >
            <X size={13} />
          </button>
        )}
      </div>

      {isRunning && (
        <div className="w-full bg-slate-700 rounded-full h-1 overflow-hidden">
          <div
            className="h-full bg-blue-500 rounded-full transition-all duration-300"
            style={{ width: `${item.percent}%` }}
          />
        </div>
      )}

      {item.message && item.status === "failed" && (
        <p className="text-xs text-red-400 font-mono truncate">
          {item.message}
        </p>
      )}
    </div>
  );
}
