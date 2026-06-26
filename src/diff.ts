const PATCH_TYPE = "desktop.patch" as const;
const SNAPSHOT_TYPE = "desktop.snapshot" as const;

export type WindowId = string;

export type Bounds = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

export type DesktopWindow = {
  readonly id: WindowId;
  readonly title: string;
  readonly app: string;
  readonly processId: number;
  readonly bounds: Bounds;
  readonly zOrder: number;
  readonly isActive: boolean;
  readonly isMinimized: boolean;
};

export type DesktopSnapshot = {
  readonly type: typeof SNAPSHOT_TYPE;
  readonly capturedAt: string;
  readonly activeWindowId: WindowId | null;
  readonly windows: readonly DesktopWindow[];
};

export type UpdatedWindow = {
  readonly id: WindowId;
  readonly before: DesktopWindow;
  readonly after: DesktopWindow;
};

export type DesktopPatch = {
  readonly type: typeof PATCH_TYPE;
  readonly capturedAt: string;
  readonly previousActiveWindowId: WindowId | null;
  readonly activeWindowId: WindowId | null;
  readonly added: readonly DesktopWindow[];
  readonly removed: readonly DesktopWindow[];
  readonly updated: readonly UpdatedWindow[];
};

export function createSnapshot(
  windows: readonly DesktopWindow[],
  now = new Date(),
): DesktopSnapshot {
  const ordered = [...windows].sort(compareWindows);
  return {
    type: SNAPSHOT_TYPE,
    capturedAt: now.toISOString(),
    activeWindowId: findActiveWindowId(ordered),
    windows: ordered,
  };
}

export function diffSnapshots(
  previous: DesktopSnapshot,
  next: DesktopSnapshot,
): DesktopPatch {
  const previousById = indexById(previous.windows);
  const nextById = indexById(next.windows);

  const added = next.windows.filter((window) => !previousById.has(window.id));
  const removed = previous.windows.filter((window) => !nextById.has(window.id));
  const updated = next.windows.flatMap((after) => {
    const before = previousById.get(after.id);
    if (before === undefined || windowsEqual(before, after)) {
      return [];
    }
    return [{ id: after.id, before, after }];
  });

  return {
    type: PATCH_TYPE,
    capturedAt: next.capturedAt,
    previousActiveWindowId: previous.activeWindowId,
    activeWindowId: next.activeWindowId,
    added,
    removed,
    updated,
  };
}

export function hasChanges(patch: DesktopPatch): boolean {
  return (
    patch.added.length > 0 ||
    patch.removed.length > 0 ||
    patch.updated.length > 0 ||
    patch.previousActiveWindowId !== patch.activeWindowId
  );
}

export function windowId(value: string): WindowId {
  return value;
}

function indexById(
  windows: readonly DesktopWindow[],
): ReadonlyMap<WindowId, DesktopWindow> {
  return new Map(windows.map((window) => [window.id, window]));
}

function findActiveWindowId(windows: readonly DesktopWindow[]): WindowId | null {
  const active = windows.find((window) => window.isActive);
  return active?.id ?? null;
}

function compareWindows(left: DesktopWindow, right: DesktopWindow): number {
  if (left.zOrder !== right.zOrder) {
    return left.zOrder - right.zOrder;
  }
  return left.id.localeCompare(right.id);
}

function windowsEqual(left: DesktopWindow, right: DesktopWindow): boolean {
  return (
    left.title === right.title &&
    left.app === right.app &&
    left.processId === right.processId &&
    left.zOrder === right.zOrder &&
    left.isActive === right.isActive &&
    left.isMinimized === right.isMinimized &&
    boundsEqual(left.bounds, right.bounds)
  );
}

function boundsEqual(left: Bounds, right: Bounds): boolean {
  return (
    left.x === right.x &&
    left.y === right.y &&
    left.width === right.width &&
    left.height === right.height
  );
}
