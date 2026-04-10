interface TransferOptionsProps {
  dryRun: boolean;
  checksum: boolean;
  localNetwork: boolean;
  onDryRunChange: (v: boolean) => void;
  onChecksumChange: (v: boolean) => void;
  onLocalNetworkChange: (v: boolean) => void;
}

function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 cursor-pointer group">
      <div>
        <span className="text-sm text-slate-200 group-hover:text-white transition-colors">
          {label}
        </span>
        <p className="text-xs text-slate-500">{description}</p>
      </div>
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative w-10 h-5 rounded-full transition-colors shrink-0 ${
          checked ? "bg-blue-600" : "bg-slate-600"
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
    </label>
  );
}

export function TransferOptions({
  dryRun,
  checksum,
  localNetwork,
  onDryRunChange,
  onChecksumChange,
  onLocalNetworkChange,
}: TransferOptionsProps) {
  return (
    <div className="space-y-3">
      <Toggle
        label="Dry run"
        description="Preview what would be transferred — no files are actually sent"
        checked={dryRun}
        onChange={onDryRunChange}
      />
      <Toggle
        label="Checksum verification"
        description="Use --checksum: compare file checksums instead of mod-time+size"
        checked={checksum}
        onChange={onChecksumChange}
      />
      <Toggle
        label="Local Network Transfer (speed optimize)"
        description="Disables delta sync and sends full files to maximize speed on fast local networks."
        checked={localNetwork}
        onChange={onLocalNetworkChange}
      />
    </div>
  );
}
