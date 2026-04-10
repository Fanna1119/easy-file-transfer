import { useEffect, useRef } from "react";
import { ChevronDown, ChevronUp, Terminal } from "lucide-react";
import type { LogEntry } from "../types";

interface MessageLogProps {
  messages: LogEntry[];
  collapsed: boolean;
  onToggle: () => void;
}

export function MessageLog({ messages, collapsed, onToggle }: MessageLogProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!collapsed) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, collapsed]);

  const colorClass = (type: LogEntry["type"]) => {
    switch (type) {
      case "success":
        return "text-green-400";
      case "warning":
        return "text-yellow-400";
      case "error":
        return "text-red-400";
      default:
        return "text-slate-300";
    }
  };

  return (
    <div className="flex flex-col bg-slate-950 overflow-hidden h-full">
      {/* Header bar */}
      <button
        onClick={onToggle}
        className="flex items-center gap-2 px-3 h-7 text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 transition-colors shrink-0 w-full text-left"
      >
        <Terminal size={11} />
        <span className="font-medium">Messages</span>
        {messages.length > 0 && (
          <span className="ml-1 text-slate-500">({messages.length})</span>
        )}
        <span className="ml-auto">
          {collapsed ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
        </span>
      </button>

      {/* Log content */}
      {!collapsed && (
        <div className="flex-1 overflow-y-auto px-3 py-1 font-mono text-xs text-slate-300 min-h-0">
          {messages.length === 0 ? (
            <span className="text-slate-600">No messages yet.</span>
          ) : (
            messages.map((entry, i) => (
              <div key={i} className={`leading-5 ${colorClass(entry.type)}`}>
                {entry.text}
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>
      )}
    </div>
  );
}
