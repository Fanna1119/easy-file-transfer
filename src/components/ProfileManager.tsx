import { useState } from "react";
import { Save, List, Trash2 } from "lucide-react";
import type { Profile, TransferDirection } from "../types";

interface ProfileManagerProps {
  profiles: Profile[];
  currentDestination: string;
  currentSshKey: string | null;
  currentDryRun: boolean;
  currentChecksum: boolean;
  currentDirection: TransferDirection;
  currentLocalDestination: string | null;
  onSave: (profile: Profile) => void;
  onDelete: (id: string) => void;
}

export function ProfileManager({
  profiles,
  currentDestination,
  currentSshKey,
  currentDryRun,
  currentChecksum,
  currentDirection,
  currentLocalDestination,
  onSave,
  onDelete,
}: ProfileManagerProps) {
  const [showSave, setShowSave] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [showList, setShowList] = useState(false);

  const handleSave = () => {
    if (!profileName.trim()) return;
    onSave({
      id: "",
      name: profileName.trim(),
      destination: currentDestination,
      sshKey: currentSshKey,
      dryRun: currentDryRun,
      checksum: currentChecksum,
      direction: currentDirection,
      localDestination: currentLocalDestination,
    });
    setProfileName("");
    setShowSave(false);
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <button
          onClick={() => {
            setShowSave((v) => !v);
            setShowList(false);
          }}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-600 hover:bg-slate-500 text-slate-200 rounded-lg transition-colors"
        >
          <Save size={12} /> Save as Profile
        </button>
        {profiles.length > 0 && (
          <button
            onClick={() => {
              setShowList((v) => !v);
              setShowSave(false);
            }}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-600 hover:bg-slate-500 text-slate-200 rounded-lg transition-colors"
          >
            <List size={12} /> Manage Profiles ({profiles.length})
          </button>
        )}
      </div>

      {/* Save form */}
      {showSave && (
        <div className="flex gap-2">
          <input
            className="flex-1 px-3 py-1.5 text-xs bg-slate-700 border border-slate-600 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
            placeholder="Profile name…"
            value={profileName}
            onChange={(e) => setProfileName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
            autoFocus
          />
          <button
            onClick={handleSave}
            disabled={!profileName.trim() || !currentDestination}
            className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
          >
            Save
          </button>
          <button
            onClick={() => setShowSave(false)}
            className="px-2 py-1.5 text-xs text-slate-400 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>
      )}

      {/* Profile list */}
      {showList && profiles.length > 0 && (
        <div className="bg-slate-700/50 border border-slate-600 rounded-lg divide-y divide-slate-600/50 max-h-48 overflow-y-auto">
          {profiles.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between gap-2 px-3 py-2"
            >
              <div className="min-w-0">
                <p className="text-xs font-medium text-slate-200 truncate">
                  {p.name}
                </p>
                <p className="text-xs text-slate-500 font-mono truncate">
                  {p.destination}
                </p>
              </div>
              <button
                onClick={() => onDelete(p.id)}
                className="shrink-0 text-xs text-slate-500 hover:text-red-400 transition-colors"
                title="Delete profile"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
