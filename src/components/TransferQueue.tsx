import type { TransferItem as TItem } from "../types";
import { TransferItem } from "./TransferItem";
import { ArrowDownUp } from "lucide-react";

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

  return (
    <div className="flex flex-col h-full border-t border-slate-700 bg-slate-900">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 h-7 bg-slate-800 border-b border-slate-700 shrink-0">
        <ArrowDownUp size={11} className="text-slate-400" />
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
          Transfer Queue
        </span>
        {queue.length > 0 && (
          <span className="text-xs text-slate-600">
            {runningCount > 0 && `${runningCount} running · `}
            {queue.length} total
          </span>
        )}
        {completedCount > 0 && (
          <button
            onClick={onClearCompleted}
            className="ml-auto text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            Clear ({completedCount})
          </button>
        )}
      </div>

      {/* Items */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {queue.length === 0 ? (
          <div className="flex items-center justify-center h-full text-xs text-slate-700">
            Drag files between panes to start a transfer
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
