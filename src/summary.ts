import type { DesktopSnapshot, DesktopWindow } from "./diff.ts";

type ObserverSummaryOptions = {
  readonly includeTitles: boolean;
  readonly maxWindows: number;
};

const DEFAULT_SUMMARY_OPTIONS: ObserverSummaryOptions = {
  includeTitles: false,
  maxWindows: 12,
};

export function formatObserverSummary(
  snapshot: DesktopSnapshot,
  options: Partial<ObserverSummaryOptions> = {},
): string {
  const mergedOptions = { ...DEFAULT_SUMMARY_OPTIONS, ...options };
  const activeWindow = snapshot.windows.find((window) => window.isActive);
  const visibleWindows = snapshot.windows
    .filter((window) => !window.isMinimized)
    .slice(0, mergedOptions.maxWindows);
  const minimizedWindows = snapshot.windows
    .filter((window) => window.isMinimized)
    .slice(0, mergedOptions.maxWindows);

  return [
    "Desktop observer context:",
    `capturedAt: ${snapshot.capturedAt}`,
    `activeWindow: ${activeWindow === undefined ? "none" : formatWindow(activeWindow, mergedOptions)}`,
    "visibleWindows:",
    ...formatWindowList(visibleWindows, mergedOptions),
    "minimizedWindows:",
    ...formatWindowList(minimizedWindows, mergedOptions),
  ].join("\n");
}

function formatWindowList(
  windows: readonly DesktopWindow[],
  options: ObserverSummaryOptions,
): readonly string[] {
  if (windows.length === 0) {
    return ["- none"];
  }
  return windows.map((window) => `- ${formatWindow(window, options)}`);
}

function formatWindow(
  window: DesktopWindow,
  options: ObserverSummaryOptions,
): string {
  const title = options.includeTitles ? ` title="${window.title}"` : "";
  return [
    `app=${window.app || "unknown"}`,
    `id=${window.id}`,
    `z=${window.zOrder}`,
    `active=${window.isActive}`,
    `minimized=${window.isMinimized}`,
    `bounds=${window.bounds.x},${window.bounds.y},${window.bounds.width},${window.bounds.height}`,
    title.trim(),
  ]
    .filter((part) => part.length > 0)
    .join(" ");
}
