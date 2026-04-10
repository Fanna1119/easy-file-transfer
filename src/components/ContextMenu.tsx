import { useEffect, useRef } from "react";

export interface ContextMenuItem {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
  separator?: false;
}
export interface ContextMenuSeparator {
  separator: true;
}
export type ContextMenuEntry = ContextMenuItem | ContextMenuSeparator;

interface ContextMenuProps {
  x: number;
  y: number;
  items: ContextMenuEntry[];
  onClose: () => void;
}

export function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click or Escape
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  // Clamp to viewport so the menu never renders off-screen
  const style: React.CSSProperties = {
    position: "fixed",
    top: y,
    left: x,
    zIndex: 9999,
  };

  return (
    <div
      ref={ref}
      style={style}
      className="bg-slate-800 border border-slate-600 rounded-lg shadow-2xl py-1 min-w-[180px] text-xs select-none"
    >
      {items.map((item, i) => {
        if ("separator" in item && item.separator) {
          return <div key={i} className="border-t border-slate-700 my-1" />;
        }
        const it = item as ContextMenuItem;
        return (
          <button
            key={i}
            disabled={it.disabled}
            onClick={() => {
              onClose();
              it.onClick();
            }}
            className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-left transition-colors disabled:opacity-40 disabled:cursor-default ${
              it.danger
                ? "text-red-400 hover:bg-red-500/15 hover:text-red-300"
                : "text-slate-200 hover:bg-slate-700"
            }`}
          >
            {it.icon && <span className="shrink-0 opacity-70">{it.icon}</span>}
            {it.label}
          </button>
        );
      })}
    </div>
  );
}
