import { useState } from "react";
import {
  FolderOpen,
  Monitor,
  Key,
  Settings,
  Save,
  Search,
  Play,
  Radio,
  type LucideIcon,
} from "lucide-react";
import { useTransfer } from "./hooks/useTransfer";
import { useProfiles } from "./hooks/useProfiles";
import { FileSelector } from "./components/FileSelector";
import { DestinationConfig } from "./components/DestinationConfig";
import { SSHConfig } from "./components/SSHConfig";
import { TransferOptions } from "./components/TransferOptions";
import { TransferQueue } from "./components/TransferQueue";
import { ProfileManager } from "./components/ProfileManager";
import "./App.css";
import type { Profile } from "./types";

export default function App() {
  const [files, setFiles] = useState<string[]>([]);
  const [basePath, setBasePath] = useState("");
  const [destination, setDestination] = useState("");
  const [sshKey, setSshKey] = useState<string | null>(null);
  const [passphrase, setPassphrase] = useState("");
  const [dryRun, setDryRun] = useState(false);
  const [checksum, setChecksum] = useState(false);

  const { queue, startTransfer, cancelTransfer, clearCompleted } =
    useTransfer();
  const { profiles, saveProfile, deleteProfile } = useProfiles();

  const loadProfile = (p: Profile) => {
    setDestination(p.destination);
    setSshKey(p.sshKey);
    setDryRun(p.dryRun);
    setChecksum(p.checksum);
    setPassphrase("");
  };

  const handleStart = () => {
    if (files.length === 0 || !destination.trim()) return;
    startTransfer({
      files,
      destination: destination.trim(),
      sshKey,
      passphrase: passphrase || null,
      dryRun,
      checksum,
      basePath: basePath || null,
    });
  };

  const canStart = files.length > 0 && destination.trim().length > 0;

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col">
      <header className="px-6 py-4 border-b border-slate-700/60 flex items-center gap-3 select-none">
        <Radio size={18} className="text-slate-400 shrink-0" />
        <h1 className="text-base font-semibold tracking-tight">
          Easy File Transfer
        </h1>
        {dryRun && (
          <span className="ml-auto text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded-full">
            DRY RUN MODE
          </span>
        )}
      </header>

      <div className="flex flex-1 min-h-0 overflow-hidden">
        <aside className="w-[400px] shrink-0 flex flex-col border-r border-slate-700/60 overflow-y-auto">
          <div className="p-5 space-y-6">
            <section>
              <SectionHeader title="Files" Icon={FolderOpen} />
              <FileSelector
                files={files}
                basePath={basePath}
                onFilesChange={setFiles}
                onBasePathChange={setBasePath}
              />
            </section>

            <section>
              <SectionHeader title="Destination" Icon={Monitor} />
              <DestinationConfig
                destination={destination}
                sshKey={sshKey}
                profiles={profiles}
                onChange={setDestination}
                onLoadProfile={loadProfile}
              />
            </section>

            <section>
              <SectionHeader title="SSH Key" Icon={Key} />
              <SSHConfig
                sshKey={sshKey}
                passphrase={passphrase}
                onKeyChange={setSshKey}
                onPassphraseChange={setPassphrase}
              />
            </section>

            <section>
              <SectionHeader title="Options" Icon={Settings} />
              <TransferOptions
                dryRun={dryRun}
                checksum={checksum}
                onDryRunChange={setDryRun}
                onChecksumChange={setChecksum}
              />
            </section>

            <section>
              <SectionHeader title="Profiles" Icon={Save} />
              <ProfileManager
                profiles={profiles}
                currentDestination={destination}
                currentSshKey={sshKey}
                currentDryRun={dryRun}
                currentChecksum={checksum}
                onSave={saveProfile}
                onDelete={deleteProfile}
              />
            </section>
          </div>

          <div className="sticky bottom-0 p-4 bg-slate-900/90 backdrop-blur border-t border-slate-700/60">
            <button
              onClick={handleStart}
              disabled={!canStart}
              className="w-full py-3 text-sm font-semibold bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed text-white rounded-xl transition-colors shadow"
            >
              <span className="flex items-center justify-center gap-2">
                {dryRun ? (
                  <>
                    <Search size={15} />
                    Preview Transfer (Dry Run)
                  </>
                ) : (
                  <>
                    <Play size={15} />
                    Start Transfer
                  </>
                )}
              </span>
            </button>
          </div>
        </aside>

        <main className="flex-1 p-5 overflow-hidden flex flex-col min-w-0">
          <TransferQueue
            queue={queue}
            onCancel={cancelTransfer}
            onClearCompleted={clearCompleted}
          />
        </main>
      </div>
    </div>
  );
}

function SectionHeader({ title, Icon }: { title: string; Icon: LucideIcon }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon size={14} className="text-slate-400 shrink-0" />
      <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400">
        {title}
      </h2>
      <div className="flex-1 h-px bg-slate-700/60" />
    </div>
  );
}
