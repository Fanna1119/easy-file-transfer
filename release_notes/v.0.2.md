# v0.2.0 — 10 April 2026

## New Features

### File Operations

- **Delete** — right-click any file or folder to delete it. Supports multi-selection: if items are selected, the entire selection is deleted at once. A confirmation dialog shows the item count before proceeding. Works on both local and remote panes.
- **Rename** — inline rename directly in the file browser via right-click context menu.
- **Create Folder** — right-click on empty space in either pane to create a new folder inline.
- **Drop onto a specific folder** — dragging files onto a subfolder row now targets that folder as the destination, rather than always uploading/downloading to the current directory. The target folder highlights on hover.

### Context Menu

- Right-clicking a file or folder shows: **Rename**, **Upload to remote** / **Download to local**, and **Delete**.
- Right-clicking empty space shows: **New Folder**.

### Message Log

- All significant actions are now logged with timestamps and color-coded by severity:
  - **Green** — transfer completed, connected successfully
  - **Yellow** — transfer cancelled, file(s) deleted
  - **Red** — transfer failed, errors
  - **White** — informational (connecting, downloading, uploading, disconnected)
- Delete operations (local and remote) are logged with path and item count.
- Transfer completions, cancellations, and failures are automatically logged when queue status changes.

### Resizable Layout

- A **draggable horizontal divider** between the message log and the file browser lets you resize the log area (56–400 px).
- A **draggable horizontal divider** between the file browser and the transfer queue lets you resize the queue area (56–400 px).
- Both dividers turn blue on hover/drag, consistent with the existing vertical pane divider.

### Transfer Queue — Collapsible

- The Transfer Queue header is now clickable and collapses/expands the queue, matching the existing Messages panel behaviour.
- "Clear (N)" button is preserved in the collapsed header and does not accidentally trigger the collapse toggle.

### Resumable Transfers

- Transfers use `--partial-dir=.rsync-partial` when the **Resumable** option is enabled, so interrupted transfers save progress and can be resumed rather than starting over.
- Cancel sends `SIGTERM` (previously `SIGKILL`) so rsync gracefully moves partial data to the partial directory before exiting.

## Changes

- `dryRun` option removed — it was confusing and not particularly useful at this stage.
- Message log colour detection is now driven by explicit log entry types (`info` | `success` | `warning` | `error`) rather than keyword-matching on the message string.
- Transfer Queue header is now a consistent interactive element (hover style, cursor) rather than a plain label.

## Bug Fixes

- Fixed an unused `mut` compiler warning on `child` in the Rust `cancel_transfer` handler.
