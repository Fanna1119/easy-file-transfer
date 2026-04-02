import { useCallback } from "react";
import { open } from "@tauri-apps/plugin-dialog";

interface SSHConfigProps {
  sshKey: string | null;
  passphrase: string;
  onKeyChange: (key: string | null) => void;
  onPassphraseChange: (p: string) => void;
}

export function SSHConfig({
  sshKey,
  passphrase,
  onKeyChange,
  onPassphraseChange,
}: SSHConfigProps) {
  const pickKey = useCallback(async () => {
    const selected = await open({
      multiple: false,
      directory: false,
      title: "Select SSH Private Key",
    });
    if (!selected) return;
    const path = Array.isArray(selected) ? selected[0] : selected;
    onKeyChange(path);
  }, [onKeyChange]);

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <div className="flex-1 min-w-0">
          <input
            readOnly
            value={sshKey ?? ""}
            placeholder="~/.ssh/id_rsa (optional)"
            className="w-full px-3 py-2 text-xs bg-slate-700 border border-slate-600 rounded-lg text-slate-300 placeholder-slate-500 font-mono focus:outline-none cursor-default truncate"
          />
        </div>
        <button
          onClick={pickKey}
          className="shrink-0 px-3 py-2 text-sm bg-slate-600 hover:bg-slate-500 text-white rounded-lg transition-colors"
        >
          Browse
        </button>
        {sshKey && (
          <button
            onClick={() => {
              onKeyChange(null);
              onPassphraseChange("");
            }}
            className="shrink-0 px-3 py-2 text-sm bg-red-800/60 hover:bg-red-700/70 text-red-300 rounded-lg transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      {sshKey && (
        <input
          type="password"
          value={passphrase}
          onChange={(e) => onPassphraseChange(e.target.value)}
          placeholder="Key passphrase (leave empty if none)"
          className="w-full px-3 py-2 text-sm bg-slate-700 border border-slate-600 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
          autoComplete="off"
        />
      )}

      {!sshKey && (
        <p className="text-xs text-slate-500">
          No key selected — uses default{" "}
          <code className="text-slate-400">~/.ssh</code> keys
        </p>
      )}
    </div>
  );
}
