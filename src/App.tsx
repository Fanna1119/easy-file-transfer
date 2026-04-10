import { useCallback, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Radio } from "lucide-react";
import { useTransfer } from "./hooks/useTransfer";
import { useProfiles } from "./hooks/useProfiles";
import { ConnectionBar } from "./components/ConnectionBar";
import { MessageLog } from "./components/MessageLog";
import { LocalBrowser } from "./components/LocalBrowser";
import { RemoteBrowserPane } from "./components/RemoteBrowserPane";
import { TransferQueue } from "./components/TransferQueue";
import { SettingsModal } from "./components/SettingsModal";
import "./App.css";
import type { ConnectionConfig, Profile } from "./types";

export default function App() {
  const [connection, setConnection] = useState<ConnectionConfig>({
    user: "",
    host: "",
    port: null,
    sshKey: null,
    passphrase: "",
  });
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [remotePath, setRemotePath] = useState("~");
  const [localPath, setLocalPath] = useState("~");
  const [messages, setMessages] = useState<string[]>([]);
  const [logCollapsed, setLogCollapsed] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Transfer options
  const [dryRun, setDryRun] = useState(false);
  const [checksum, setChecksum] = useState(false);
  const [localNetwork, setLocalNetwork] = useState(false);
  const [cacheRemoteDirs, setCacheRemoteDirs] = useState(true);
  const [smartTraverse, setSmartTraverse] = useState(true);

  const { queue, startTransfer, cancelTransfer, clearCompleted } =
    useTransfer();
  const { profiles, saveProfile, deleteProfile } = useProfiles();

  const addLog = useCallback((msg: string) => {
    setMessages((prev) => [
      ...prev,
      `[${new Date().toLocaleTimeString()}] ${msg}`,
    ]);
  }, []);

  const handleConnect = async () => {
    if (!connection.host.trim() || !connection.user.trim()) return;
    setConnecting(true);
    addLog(`Connecting to ${connection.user}@${connection.host}…`);
    try {
      await invoke("test_ssh_connection", {
        params: {
          user: connection.user,
          host: connection.host,
          port: connection.port,
          path: "~",
          sshKey: connection.sshKey,
          passphrase: connection.passphrase || null,
          maxDepth: 1,
        },
      });
      setConnected(true);
      addLog(`Connected to ${connection.user}@${connection.host}`);
      setLogCollapsed(true);
    } catch (err) {
      addLog(`Error: ${String(err)}`);
      setLogCollapsed(false);
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = () => {
    setConnected(false);
    addLog("Disconnected.");
  };

  const loadProfile = (p: Profile) => {
    const match = p.destination.match(/^([^@]+)@([^:/]+)(?::(\d+))?/);
    setConnection((prev) => ({
      ...prev,
      user: match?.[1] ?? prev.user,
      host: match?.[2] ?? prev.host,
      port: match?.[3] ? Number(match[3]) : prev.port,
      sshKey: p.sshKey,
    }));
    setDryRun(p.dryRun);
    setChecksum(p.checksum);
    setLocalNetwork(p.localNetwork ?? false);
  };

  // Called when local files are dropped onto the remote pane → upload
  const handleUpload = (entries: Array<{ path: string; isDir: boolean }>) => {
    if (!connected || entries.length === 0) return;
    const destination = `${connection.user}@${connection.host}:${remotePath}/`;
    addLog(`Uploading ${entries.length} item(s) → ${destination}`);
    startTransfer({
      files: entries.map((e) => e.path),
      destination,
      sshKey: connection.sshKey,
      passphrase: connection.passphrase || null,
      dryRun,
      checksum,
      localNetwork,
      basePath:
        entries.length === 1 && entries[0].isDir ? entries[0].path : null,
      direction: "upload",
      localDestination: null,
      port: connection.port,
    });
  };

  // Called when remote files are dropped onto the local pane → download
  const handleDownload = (entries: Array<{ path: string; isDir: boolean }>) => {
    if (!connected || entries.length === 0) return;
    for (const { path } of entries) {
      const source = `${connection.user}@${connection.host}:${path}`;
      addLog(`Downloading ${source}`);
      startTransfer({
        files: [],
        destination: source,
        sshKey: connection.sshKey,
        passphrase: connection.passphrase || null,
        dryRun,
        checksum,
        localNetwork,
        basePath: null,
        direction: "download",
        localDestination: localPath,
        port: connection.port,
      });
    }
  };

  return (
    <div className="h-screen bg-slate-900 text-slate-100 flex flex-col overflow-hidden">
      {/* Title bar */}
      <header className="flex items-center gap-2 px-4 h-9 bg-slate-900 border-b border-slate-700/60 shrink-0 select-none">
        <Radio size={14} className="text-slate-500 shrink-0" />
        <span className="text-xs font-semibold text-slate-400 tracking-tight">
          Easy File Transfer
        </span>
        {dryRun && (
          <span className="ml-2 text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded-full">
            DRY RUN
          </span>
        )}
      </header>

      {/* Connection bar */}
      <ConnectionBar
        config={connection}
        connected={connected}
        connecting={connecting}
        profiles={profiles}
        onConfigChange={setConnection}
        onConnect={handleConnect}
        onDisconnect={handleDisconnect}
        onOpenSettings={() => setShowSettings(true)}
      />

      {/* Message log */}
      <MessageLog
        messages={messages}
        collapsed={logCollapsed}
        onToggle={() => setLogCollapsed((v) => !v)}
      />

      {/* Dual pane file browser */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <div className="flex-1 min-w-0 overflow-hidden">
          <LocalBrowser
            onDropRemote={handleDownload}
            onLocalPathChange={setLocalPath}
          />
        </div>
        <div className="flex-1 min-w-0 overflow-hidden">
          <RemoteBrowserPane
            connected={connected}
            connection={connection}
            cacheEnabled={cacheRemoteDirs}
            smartTraverse={smartTraverse}
            onDropLocal={handleUpload}
            onPathChange={setRemotePath}
          />
        </div>
      </div>

      {/* Transfer queue */}
      <div className="h-40 shrink-0">
        <TransferQueue
          queue={queue}
          onCancel={cancelTransfer}
          onClearCompleted={clearCompleted}
        />
      </div>

      {/* Settings modal */}
      {showSettings && (
        <SettingsModal
          dryRun={dryRun}
          checksum={checksum}
          localNetwork={localNetwork}
          cacheRemoteDirs={cacheRemoteDirs}
          smartTraverse={smartTraverse}
          onDryRunChange={setDryRun}
          onChecksumChange={setChecksum}
          onLocalNetworkChange={setLocalNetwork}
          onCacheRemoteDirsChange={setCacheRemoteDirs}
          onSmartTraverseChange={setSmartTraverse}
          profiles={profiles}
          connection={connection}
          direction="upload"
          localDestination={null}
          onSaveProfile={saveProfile}
          onDeleteProfile={deleteProfile}
          onLoadProfile={loadProfile}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}
