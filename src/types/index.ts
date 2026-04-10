// ── Transfer types ────────────────────────────────────────────────────────────

export type TransferDirection = "upload" | "download";

export interface TransferConfig {
  files: string[];
  destination: string;
  sshKey: string | null;
  passphrase: string | null;
  resumable: boolean;
  checksum: boolean;
  localNetwork: boolean;
  basePath: string | null;
  direction: TransferDirection;
  localDestination: string | null;
  /** Optional SSH port, forwarded to rsync -e "ssh -p PORT". */
  port: number | null;
}

export interface ProgressEvent {
  transferId: string;
  bytesTransferred: number;
  percent: number;
  speed: string;
  eta: string;
  xfrCurrent: number | null;
  xfrTotal: number | null;
  currentFile: string | null;
}

export interface CompleteEvent {
  transferId: string;
  success: boolean;
  message: string;
}

export type TransferStatus =
  | "idle"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export interface TransferItem {
  id: string;
  config: TransferConfig;
  status: TransferStatus;
  percent: number;
  bytesTransferred: number;
  totalBytes: number;
  speed: string;
  eta: string;
  currentFile: string | null;
  xfrCurrent: number | null;
  xfrTotal: number | null;
  message: string | null;
}

// ── File browser types ────────────────────────────────────────────────────────

/** Returned by list_local_dir and list_remote_dir. */
export interface FileEntry {
  name: string;
  path: string;
  size: number;
  /** Unix timestamp string (local) or human-readable ls date (remote). */
  modified: string;
  isDir: boolean;
  permissions: string;
}

/** Structured connection info used by ConnectionBar and browser panes. */
export interface ConnectionConfig {
  user: string;
  host: string;
  port: number | null;
  sshKey: string | null;
  passphrase: string;
}

// ── SSH / remote browser ──────────────────────────────────────────────────────

export interface RemoteBrowseParams {
  user: string;
  host: string;
  port: number | null;
  path: string;
  sshKey: string | null;
  passphrase: string | null;
  maxDepth: number;
}

export interface RemoteDir {
  path: string;
  name: string;
}

// A tree node used in legacy RemoteBrowser (kept for reference)
export interface RemoteTreeNode {
  path: string;
  name: string;
  expanded: boolean;
  loading: boolean;
  children: RemoteTreeNode[];
}

// ── Profiles ──────────────────────────────────────────────────────────────────

export interface Profile {
  id: string;
  name: string;
  destination: string;
  sshKey: string | null;
  resumable?: boolean;
  checksum: boolean;
  localNetwork?: boolean;
  direction?: TransferDirection;
  localDestination?: string | null;
}

export interface TransferConfig {
  files: string[];
  destination: string;
  sshKey: string | null;
  passphrase: string | null;
  resumable: boolean;
  checksum: boolean;
  localNetwork: boolean;
  basePath: string | null;
  direction: TransferDirection;
  localDestination: string | null;
}

export interface ProgressEvent {
  transferId: string;
  bytesTransferred: number;
  percent: number;
  speed: string;
  eta: string;
  xfrCurrent: number | null;
  xfrTotal: number | null;
  currentFile: string | null;
}

export interface CompleteEvent {
  transferId: string;
  success: boolean;
  message: string;
}
