import { useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { Key, Server, User, Hash, Plug, PlugZap, Settings, ChevronDown } from "lucide-react";
import type { ConnectionConfig, Profile } from "../types";

interface ConnectionBarProps {
  config: ConnectionConfig;
  connected: boolean;
  connecting: boolean;
  profiles: Profile[];
  onConfigChange: (c: ConnectionConfig) => void;
  onConnect: () => void;
  onDisconnect: () => void;
  onOpenSettings: () => void;
}

export function ConnectionBar({
  config,
  connected,
  connecting,
  profiles,
  onConfigChange,
  onConnect,
  onDisconnect,
  onOpenSettings,
}: ConnectionBarProps) {
  const [showProfiles, setShowProfiles] = useState(false);

  const set = (patch: Partial<ConnectionConfig>) =>
    onConfigChange({ ...config, ...patch });

  const pickKey = async () => {
    const selected = await open({ multiple: false });
    if (typeof selected === "string") set({ sshKey: selected });
  };

  const loadProfile = (p: Profile) => {
    // Parse "user@host:/path" or "user@host"
    const match = p.destination.match(/^([^@]+)@([^:/]+)(?::(.*))?$/);
    if (match) {
      set({ user: match[1] ?? "", host: match[2] ?? "", sshKey: p.sshKey });
    }
    setShowProfiles(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !connected && !connecting) onConnect();
  };

  return (
    <div className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 border-b border-slate-700 select-none">
      {/* Host */}
      <div className="flex items-center gap-1 bg-slate-700 rounded px-2 py-1 text-xs min-w-0 flex-[2]">
        <Server size={11} className="text-slate-400 shrink-0" />
        <input
          value={config.host}
          onChange={(e) => set({ host: e.target.value })}
          onKeyDown={handleKeyDown}
          placeholder="Host"
          className="bg-transparent outline-none min-w-0 flex-1 text-slate-100 placeholder:text-slate-500"
        />
      </div>

      {/* User */}
      <div className="flex items-center gap-1 bg-slate-700 rounded px-2 py-1 text-xs min-w-0 flex-[1.5]">
        <User size={11} className="text-slate-400 shrink-0" />
        <input
          value={config.user}
          onChange={(e) => set({ user: e.target.value })}
          onKeyDown={handleKeyDown}
          placeholder="Username"
          className="bg-transparent outline-none min-w-0 flex-1 text-slate-100 placeholder:text-slate-500"
        />
      </div>

      {/* Port */}
      <div className="flex items-center gap-1 bg-slate-700 rounded px-2 py-1 text-xs w-[72px] shrink-0">
        <Hash size={11} className="text-slate-400 shrink-0" />
        <input
          value={config.port ?? ""}
          onChange={(e) =>
            set({ port: e.target.value ? Number(e.target.value) : null })
          }
          onKeyDown={handleKeyDown}
          placeholder="22"
          type="number"
          min={1}
          max={65535}
          className="bg-transparent outline-none min-w-0 w-full text-slate-100 placeholder:text-slate-500"
        />
      </div>

      {/* SSH Key */}
      <button
        onClick={pickKey}
        title={config.sshKey ?? "No key selected"}
        className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors shrink-0 ${
          config.sshKey
            ? "bg-blue-700/40 text-blue-300 hover:bg-blue-700/60"
            : "bg-slate-700 text-slate-400 hover:bg-slate-600"
        }`}
      >
        <Key size={11} />
        {config.sshKey
          ? config.sshKey.split("/").pop()?.slice(-16) ?? "Key"
          : "Key…"}
      </button>

      {/* Passphrase */}
      <div className="flex items-center gap-1 bg-slate-700 rounded px-2 py-1 text-xs flex-1 min-w-0">
        <input
          value={config.passphrase}
          onChange={(e) => set({ passphrase: e.target.value })}
          onKeyDown={handleKeyDown}
          placeholder="Passphrase"
          type="password"
          className="bg-transparent outline-none min-w-0 flex-1 text-slate-100 placeholder:text-slate-500"
        />
      </div>

      {/* Profiles quick-fill */}
      {profiles.length > 0 && (
        <div className="relative shrink-0">
          <button
            onClick={() => setShowProfiles((v) => !v)}
            className="flex items-center gap-0.5 px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded text-xs text-slate-300 transition-colors"
          >
            <ChevronDown size={12} />
          </button>
          {showProfiles && (
            <div className="absolute top-full right-0 mt-1 z-50 bg-slate-800 border border-slate-600 rounded shadow-lg min-w-[160px]">
              {profiles.map((p) => (
                <button
                  key={p.id}
                  onClick={() => loadProfile(p)}
                  className="w-full text-left px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-700 transition-colors truncate"
                >
                  {p.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Connect / Disconnect */}
      {connected ? (
        <button
          onClick={onDisconnect}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-red-700/50 hover:bg-red-600/60 text-red-300 rounded text-xs font-medium transition-colors shrink-0"
        >
          <PlugZap size={12} />
          Disconnect
        </button>
      ) : (
        <button
          onClick={onConnect}
          disabled={connecting || !config.host.trim() || !config.user.trim()}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded text-xs font-medium transition-colors shrink-0"
        >
          <Plug size={12} />
          {connecting ? "Connecting…" : "Connect"}
        </button>
      )}

      {/* Settings gear */}
      <button
        onClick={onOpenSettings}
        className="p-1.5 text-slate-400 hover:text-slate-200 rounded hover:bg-slate-700 transition-colors shrink-0"
        title="Transfer settings & profiles"
      >
        <Settings size={14} />
      </button>
    </div>
  );
}
