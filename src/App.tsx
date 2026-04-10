import { useCallback, useEffect, useRef, useState } from "react";
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
import type {
  ConnectionConfig,
  LogEntry,
  Profile,
  TransferStatus,
} from "./types";

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
  const [splitPct, setSplitPct] = useState(50);
  const splitContainerRef = useRef<HTMLDivElement>(null);

  const startResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const container = splitContainerRef.current;
    if (!container) return;
    const onMove = (ev: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const pct = Math.min(
        80,
        Math.max(20, ((ev.clientX - rect.left) / rect.width) * 100),
      );
      setSplitPct(pct);
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, []);

  const [messages, setMessages] = useState<LogEntry[]>([]);
  const [logCollapsed, setLogCollapsed] = useState(false);
  const [logHeight, setLogHeight] = useState(112);
  const [queueHeight, setQueueHeight] = useState(160);
  const [queueCollapsed, setQueueCollapsed] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Transfer options
  const [resumable, setResumable] = useState(true);
  const [checksum, setChecksum] = useState(false);
  const [localNetwork, setLocalNetwork] = useState(false);
  const [cacheRemoteDirs, setCacheRemoteDirs] = useState(true);
  const [smartTraverse, setSmartTraverse] = useState(true);

  const { queue, startTransfer, cancelTransfer, clearCompleted } =
    useTransfer();
  const { profiles, saveProfile, deleteProfile } = useProfiles();

  const startLogResize = (e: React.MouseEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const startH = logHeight;
    const onMove = (ev: MouseEvent) => {
      setLogHeight(Math.min(400, Math.max(56, startH + (ev.clientY - startY))));
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const startQueueResize = (e: React.MouseEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const startH = queueHeight;
    const onMove = (ev: MouseEvent) => {
      setQueueHeight(
        Math.min(400, Math.max(56, startH - (ev.clientY - startY))),
      );
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const addLog = useCallback((msg: string, type: LogEntry["type"] = "info") => {
    setMessages((prev) => [
      ...prev,
      { text: `[${new Date().toLocaleTimeString()}] ${msg}`, type },
    ]);
  }, []);

  // Log transfer status transitions (completed → green, cancelled → yellow, failed → red)
  const prevStatusRef = useRef<Map<string, TransferStatus>>(new Map());
  useEffect(() => {
    for (const item of queue) {
      const prev = prevStatusRef.current.get(item.id);
      if (prev !== undefined && prev !== item.status) {
        const dest = item.config.destination;
        const dir = item.config.direction;
        if (item.status === "completed") {
          const msg =
            dir === "upload"
              ? `Transfer complete: uploaded to ${dest}`
              : `Transfer complete: downloaded to ${item.config.localDestination ?? dest}`;
          addLog(msg, "success");
        } else if (item.status === "cancelled") {
          addLog(
            `Transfer cancelled: ${dir === "upload" ? dest : dest}`,
            "warning",
          );
        } else if (item.status === "failed") {
          addLog(`Transfer failed: ${item.message ?? dest}`, "error");
        }
      }
    }
    prevStatusRef.current = new Map(
      queue.map((item) => [item.id, item.status]),
    );
  }, [queue, addLog]);

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
      addLog(`Connected to ${connection.user}@${connection.host}`, "success");
      setLogCollapsed(true);
    } catch (err) {
      addLog(`Error: ${String(err)}`, "error");
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
    setResumable(p.resumable ?? true);
    setChecksum(p.checksum);
    setLocalNetwork(p.localNetwork ?? false);
  };

  // Called when local files are dropped onto the remote pane → upload
  const handleUpload = (
    entries: Array<{ path: string; isDir: boolean }>,
    remoteDest?: string,
  ) => {
    if (!connected || entries.length === 0) return;
    const destination = remoteDest
      ? `${connection.user}@${connection.host}:${remoteDest}/`
      : `${connection.user}@${connection.host}:${remotePath}/`;
    addLog(`Uploading ${entries.length} item(s) → ${destination}`);
    startTransfer({
      files: entries.map((e) => e.path),
      destination,
      sshKey: connection.sshKey,
      passphrase: connection.passphrase || null,
      resumable,
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
  const handleDownload = (
    entries: Array<{ path: string; isDir: boolean }>,
    localDest?: string,
  ) => {
    if (!connected || entries.length === 0) return;
    const dest = localDest ?? localPath;
    for (const { path } of entries) {
      const source = `${connection.user}@${connection.host}:${path}`;
      addLog(`Downloading ${source}`);
      startTransfer({
        files: [],
        destination: source,
        sshKey: connection.sshKey,
        passphrase: connection.passphrase || null,
        resumable,
        checksum,
        localNetwork,
        basePath: null,
        direction: "download",
        localDestination: dest,
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
      <div
        className="shrink-0 overflow-hidden"
        style={{ height: logCollapsed ? 28 : logHeight }}
      >
        <MessageLog
          messages={messages}
          collapsed={logCollapsed}
          onToggle={() => setLogCollapsed((v) => !v)}
        />
      </div>

      {/* Log ↔ browser resize handle */}
      {!logCollapsed && (
        <div
          onMouseDown={startLogResize}
          className="h-1 shrink-0 bg-slate-700 hover:bg-blue-500 active:bg-blue-400 cursor-row-resize transition-colors"
        />
      )}

      {/* Dual pane file browser */}
      <div
        ref={splitContainerRef}
        className="flex flex-1 min-h-0 overflow-hidden"
      >
        <div
          className="min-w-0 overflow-hidden"
          style={{ width: `${splitPct}%` }}
        >
          <LocalBrowser
            onDropRemote={handleDownload}
            onLocalPathChange={setLocalPath}
            onUpload={handleUpload}
            onLog={addLog}
          />
        </div>

        {/* Resize handle */}
        <div
          onMouseDown={startResize}
          className="w-1 shrink-0 bg-slate-700 hover:bg-blue-500 active:bg-blue-400 cursor-col-resize transition-colors"
          title="Drag to resize"
        />

        <div className="min-w-0 overflow-hidden flex-1">
          <RemoteBrowserPane
            connected={connected}
            connection={connection}
            cacheEnabled={cacheRemoteDirs}
            smartTraverse={smartTraverse}
            onDropLocal={handleUpload}
            onPathChange={setRemotePath}
            onDownload={handleDownload}
            onLog={addLog}
          />
        </div>
      </div>

      {/* Browser ↔ queue resize handle */}
      {!queueCollapsed && (
        <div
          onMouseDown={startQueueResize}
          className="h-1 shrink-0 bg-slate-700 hover:bg-blue-500 active:bg-blue-400 cursor-row-resize transition-colors"
        />
      )}

      {/* Transfer queue */}
      <div
        className="shrink-0 overflow-hidden"
        style={{ height: queueCollapsed ? 28 : queueHeight }}
      >
        <TransferQueue
          queue={queue}
          onCancel={cancelTransfer}
          onClearCompleted={clearCompleted}
          collapsed={queueCollapsed}
          onToggle={() => setQueueCollapsed((v) => !v)}
        />
      </div>

      {/* Settings modal */}
      {showSettings && (
        <SettingsModal
          resumable={resumable}
          checksum={checksum}
          localNetwork={localNetwork}
          cacheRemoteDirs={cacheRemoteDirs}
          smartTraverse={smartTraverse}
          onResumableChange={setResumable}
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
