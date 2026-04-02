// ── Transfer types ────────────────────────────────────────────────────────────

export interface TransferConfig {
  files: string[];
  destination: string;
  sshKey: string | null;
  passphrase: string | null;
  dryRun: boolean;
  checksum: boolean;
  basePath: string | null;
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

// ── SSH / remote browser ──────────────────────────────────────────────────────

export interface RemoteBrowseParams {
  host: string;
  path: string;
  sshKey: string | null;
  maxDepth: number;
}

export interface RemoteDir {
  path: string;
  name: string;
}

// A tree node used in RemoteBrowser
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
  dryRun: boolean;
  checksum: boolean;
}
