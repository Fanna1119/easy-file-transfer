import { useState } from "react";
import { X, Save, Trash2 } from "lucide-react";
import type { ConnectionConfig, Profile, TransferDirection } from "../types";

interface SettingsModalProps {
  // Transfer options
  dryRun: boolean;
  checksum: boolean;
  localNetwork: boolean;
  cacheRemoteDirs: boolean;
  smartTraverse: boolean;
  onDryRunChange: (v: boolean) => void;
  onChecksumChange: (v: boolean) => void;
  onLocalNetworkChange: (v: boolean) => void;
  onCacheRemoteDirsChange: (v: boolean) => void;
  onSmartTraverseChange: (v: boolean) => void;
  // Profiles
  profiles: Profile[];
  connection: ConnectionConfig;
  direction: TransferDirection;
  localDestination: string | null;
  onSaveProfile: (p: Profile) => void;
  onDeleteProfile: (id: string) => void;
  onLoadProfile: (p: Profile) => void;
  // Modal
  onClose: () => void;
}

export function SettingsModal({
  dryRun,
  checksum,
  localNetwork,
  cacheRemoteDirs,
  smartTraverse,
  onDryRunChange,
  onChecksumChange,
  onLocalNetworkChange,
  onCacheRemoteDirsChange,
  onSmartTraverseChange,
  profiles,
  connection,
  direction,
  localDestination,
  onSaveProfile,
  onDeleteProfile,
  onLoadProfile,
  onClose,
}: SettingsModalProps) {
  const [savingName, setSavingName] = useState("");
  const [showSave, setShowSave] = useState(false);

  const handleSave = () => {
    if (!savingName.trim()) return;
    const dest =
      connection.host && connection.user
        ? `${connection.user}@${connection.host}${connection.port && connection.port !== 22 ? `:${connection.port}` : ""}`
        : "";
    onSaveProfile({
      id: crypto.randomUUID(),
      name: savingName.trim(),
      destination: dest,
      sshKey: connection.sshKey,
      dryRun,
      checksum,
      localNetwork,
      direction,
      localDestination: localDestination ?? null,
    });
    setSavingName("");
    setShowSave(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-slate-800 border border-slate-700 rounded-xl shadow-2xl w-96 max-h-[80vh] flex flex-col">
        {/* Title */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
          <h2 className="text-sm font-semibold text-slate-100">
            Settings &amp; Profiles
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-5 min-h-0">
          {/* Transfer options */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3">
              Transfer Options
            </h3>
            <div className="space-y-2">
              <Toggle
                label="Dry Run"
                description="Preview only — no files transferred"
                checked={dryRun}
                onChange={onDryRunChange}
              />
              <Toggle
                label="Checksum Verification"
                description="Use checksum instead of size+time for sync"
                checked={checksum}
                onChange={onChecksumChange}
              />
              <Toggle
                label="Local Network Mode"
                description="Disable compression for LAN transfers"
                checked={localNetwork}
                onChange={onLocalNetworkChange}
              />
              <Toggle
                label="Cache Remote Directories"
                description="Remember directory listings for faster navigation; refresh button busts the cache"
                checked={cacheRemoteDirs}
                onChange={onCacheRemoteDirsChange}
              />
              <Toggle
                label="Smart Traverse"
                description="Pre-fetch one level into all visible subdirectories in the background (requires caching)"
                checked={smartTraverse}
                onChange={onSmartTraverseChange}
              />
            </div>
          </section>

          {/* Profiles */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                Profiles
              </h3>
              <button
                onClick={() => setShowSave((v) => !v)}
                className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
              >
                Save current…
              </button>
            </div>

            {showSave && (
              <div className="flex gap-2 mb-3">
                <input
                  autoFocus
                  value={savingName}
                  onChange={(e) => setSavingName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSave();
                    if (e.key === "Escape") setShowSave(false);
                  }}
                  placeholder="Profile name…"
                  className="flex-1 px-2 py-1 text-xs bg-slate-700 border border-slate-600 rounded outline-none text-slate-100 placeholder:text-slate-500 focus:border-blue-500"
                />
                <button
                  onClick={handleSave}
                  disabled={!savingName.trim()}
                  className="px-2 py-1 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white text-xs rounded transition-colors"
                >
                  <Save size={12} />
                </button>
              </div>
            )}

            {profiles.length === 0 ? (
              <p className="text-xs text-slate-600">No profiles saved yet.</p>
            ) : (
              <div className="space-y-1">
                {profiles.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between px-2 py-1.5 bg-slate-700/50 rounded hover:bg-slate-700 group"
                  >
                    <button
                      onClick={() => {
                        onLoadProfile(p);
                        onClose();
                      }}
                      className="flex-1 text-left text-xs text-slate-200 truncate"
                    >
                      <span className="font-medium">{p.name}</span>
                      {p.destination && (
                        <span className="text-slate-500 ml-2 font-mono">
                          {p.destination}
                        </span>
                      )}
                    </button>
                    <button
                      onClick={() => onDeleteProfile(p.id)}
                      className="ml-2 text-slate-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

interface ToggleProps {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}

function Toggle({ label, description, checked, onChange }: ToggleProps) {
  return (
    <label className="flex items-center justify-between gap-3 cursor-pointer">
      <div className="min-w-0">
        <div className="text-xs font-medium text-slate-200">{label}</div>
        <div className="text-xs text-slate-500 leading-tight mt-0.5">
          {description}
        </div>
      </div>
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative shrink-0 w-9 h-5 rounded-full transition-colors ${
          checked ? "bg-blue-600" : "bg-slate-600"
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
            checked ? "translate-x-4" : "translate-x-0"
          }`}
        />
      </button>
    </label>
  );
}
