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

## Tech Stack

| Layer    | Technology                       |
| -------- | -------------------------------- |
| Shell    | Tauri 2 (Rust)                   |
| Backend  | Tokio, `rsync` subprocess        |
| Frontend | React 19, TypeScript, Tailwind 4 |
| Bundler  | Vite 7                           |
