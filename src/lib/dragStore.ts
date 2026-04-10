/**
 * WKWebView (macOS) does not return custom MIME-type data from
 * dataTransfer.getData() inside a drop handler.  We work around this by
 * keeping the payload in a module-level variable that is written on dragstart
 * and read on drop.
 */

export type DragPayload = {
  entries: Array<{ path: string; isDir: boolean }>;
  source: "local" | "remote";
};

let current: DragPayload | null = null;

export function setDragPayload(payload: DragPayload): void {
  current = payload;
}

export function getDragPayload(): DragPayload | null {
  return current;
}

export function clearDragPayload(): void {
  current = null;
}
