import type { TransferItem as TItem } from "../types";
import { TransferItem } from "./TransferItem";
import { Inbox } from "lucide-react";

interface TransferQueueProps {
  queue: TItem[];
  onCancel: (id: string) => void;
  onClearCompleted: () => void;
}

export function TransferQueue({
  queue,
  onCancel,
  onClearCompleted,
}: TransferQueueProps) {
  const completedCount = queue.filter(
    (i) =>
      i.status === "completed" ||
      i.status === "failed" ||
      i.status === "cancelled",
  ).length;

  const runningCount = queue.filter((i) => i.status === "running").length;

  // Overall progress across all items
  const overallPercent =
    queue.length === 0
      ? 0
      : Math.round(queue.reduce((sum, i) => sum + i.percent, 0) / queue.length);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-200">
            Transfer Queue
          </h2>
          {queue.length > 0 && (
            <p className="text-xs text-slate-500">
              {runningCount > 0 ? `${runningCount} running · ` : ""}
              {queue.length} total
            </p>
          )}
        </div>
        {completedCount > 0 && (
          <button
            onClick={onClearCompleted}
            className="text-xs text-slate-400 hover:text-slate-200 transition-colors"
          >
            Clear completed ({completedCount})
          </button>
        )}
      </div>

      {/* Overall progress */}
      {runningCount > 0 && queue.length > 1 && (
        <div className="mb-3 space-y-1">
          <div className="flex justify-between text-xs text-slate-400">
            <span>Overall</span>
            <span>{overallPercent}%</span>
          </div>
          <div className="w-full bg-slate-700 rounded-full h-1.5">
            <div
              className="bg-blue-400 h-full rounded-full transition-all duration-300"
              style={{ width: `${overallPercent}%` }}
            />
          </div>
        </div>
      )}

      {/* Items */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-0">
        {queue.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-500 select-none py-16">
            <Inbox size={40} className="mb-3" />
            <p className="text-sm">No transfers yet</p>
            <p className="text-xs mt-1">Select files and hit Start Transfer</p>
          </div>
        ) : (
          queue.map((item) => (
            <TransferItem key={item.id} item={item} onCancel={onCancel} />
          ))
        )}
      </div>
    </div>
  );
}
