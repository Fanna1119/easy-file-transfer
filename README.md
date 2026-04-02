# Easy File Transfer

A lightweight desktop app for transferring files over SSH using `rsync`. Built with [Tauri](https://tauri.app) (Rust) and React + TypeScript.

## Features

- **File selection** — pick individual files or whole directories from your local machine
- **SSH destination** — specify a remote target in standard `user@host:/path` format
- **SSH key auth** — select a key file and optionally provide a passphrase
- **Transfer options** — dry-run preview and checksum verification modes
- **Transfer queue** — run multiple transfers concurrently with live progress, speed, and ETA
- **Profiles** — save and reuse destination + key configurations

## Prerequisites

- [rsync](https://rsync.samba.org) must be installed and available in `$PATH`
- [Bun](https://bun.sh) (for development)
- [Rust](https://rustup.rs) toolchain

## Pre built mac binaries
see [Releases](https://github.com/Fanna1119/easy-file-transfer/releases)

## Development

```bash
bun install
bun run tauri dev
```

## Build

```bash
bun run tauri build
```

The distributable app bundle is placed in `src-tauri/target/release/bundle/`.

## macOS Distribution (unsigned)

The app is built and shipped as an unsigned `.dmg`. It works, but macOS Gatekeeper will block the first launch.

### What happens without signing

- Gatekeeper flags the app as from an unidentified developer
- User sees: _"cannot be opened because the developer cannot be verified"_
- The app is not broken — it is quarantined, not damaged

### First-launch bypass (choose one)

**Method 1 — right-click (fastest)**

1. Right-click the app → **Open**
2. Click **Open** in the dialog

Gatekeeper creates a permanent whitelist entry for that app.

**Method 2 — System Settings**

1. Try to open the app (it fails)
2. Go to **System Settings → Privacy & Security**
3. Click **Open Anyway**

### Installing from the .dmg

1. Download and open the `.dmg`
2. Drag the app to **Applications**
3. Right-click the app → **Open**
4. Confirm **Open**

> This is required because the app is not signed.

### Remove the quarantine flag (power users)

If you trust the binary and want to skip the prompt entirely:

```bash
xattr -rd com.apple.quarantine /Applications/EasyFileTransfer.app
```

---

## Tech Stack

| Layer    | Technology                       |
| -------- | -------------------------------- |
| Shell    | Tauri 2 (Rust)                   |
| Backend  | Tokio, `rsync` subprocess        |
| Frontend | React 19, TypeScript, Tailwind 4 |
| Bundler  | Vite 7                           |
