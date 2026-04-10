import { useEffect, useRef } from "react";
import { ChevronDown, ChevronUp, Terminal } from "lucide-react";

interface MessageLogProps {
  messages: string[];
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

  return (
    <div
      className={`flex flex-col border-b border-slate-700 bg-slate-950 transition-all ${
        collapsed ? "h-7" : "h-28"
      }`}
    >
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
            messages.map((msg, i) => (
              <div
                key={i}
                className={`leading-5 ${
                  msg.toLowerCase().includes("error") ||
                  msg.toLowerCase().includes("failed") ||
                  msg.toLowerCase().includes("denied")
                    ? "text-red-400"
                    : msg.toLowerCase().includes("connected") ||
                        msg.toLowerCase().includes("success")
                      ? "text-green-400"
                      : "text-slate-300"
                }`}
              >
                {msg}
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>
      )}
    </div>
  );
}
