import { useState } from "react";
import type { Profile } from "../types";
import { RemoteBrowser } from "./RemoteBrowser";

interface DestinationConfigProps {
  destination: string;
  sshKey: string | null;
  profiles: Profile[];
  onChange: (destination: string) => void;
  onLoadProfile: (profile: Profile) => void;
}

export function DestinationConfig({
  destination,
  sshKey,
  profiles,
  onChange,
  onLoadProfile,
}: DestinationConfigProps) {
  const [showBrowser, setShowBrowser] = useState(false);

  // Extract host and path from `user@host:/path`
  const parseDestination = (dest: string) => {
    const colonIdx = dest.indexOf(":");
    if (colonIdx === -1) return { host: dest, path: "/" };
    return {
      host: dest.slice(0, colonIdx),
      path: dest.slice(colonIdx + 1) || "/",
    };
  };

  const handleBrowseSelect = (path: string) => {
    const { host } = parseDestination(destination);
    onChange(`${host}:${path}`);
    setShowBrowser(false);
  };

  const { host } = parseDestination(destination);
  const hasHost = host.includes("@");

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          className="flex-1 px-3 py-2 text-sm bg-slate-700 border border-slate-600 rounded-lg text-slate-100 placeholder-slate-500 font-mono focus:outline-none focus:border-blue-500"
          value={destination}
          onChange={(e) => onChange(e.target.value)}
          placeholder="user@host:/remote/path"
        />
        <button
          onClick={() => setShowBrowser(true)}
          disabled={!hasHost}
          title={
            hasHost ? "Browse remote directories" : "Enter user@host first"
          }
          className="px-3 py-2 text-sm bg-slate-600 hover:bg-slate-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
        >
          Browse
        </button>
      </div>

      {profiles.length > 0 && (
        <select
          className="w-full px-3 py-1.5 text-xs bg-slate-700 border border-slate-600 rounded-lg text-slate-300 focus:outline-none focus:border-blue-500"
          defaultValue=""
          onChange={(e) => {
            const p = profiles.find((x) => x.id === e.target.value);
            if (p) onLoadProfile(p);
            e.target.value = "";
          }}
        >
          <option value="" disabled>
            Load saved profile…
          </option>
          {profiles.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} — {p.destination}
            </option>
          ))}
        </select>
      )}

      {showBrowser && hasHost && (
        <RemoteBrowser
          host={host}
          initialPath={parseDestination(destination).path}
          sshKey={sshKey}
          onSelect={handleBrowseSelect}
          onClose={() => setShowBrowser(false)}
        />
      )}
    </div>
  );
}
