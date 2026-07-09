import {
  buildComputerUseBridgeReport,
  type ComputerUseBridgeReport,
  type ComputerUseWindow,
} from "./computerUseBridge.ts";
import type { Bounds, DesktopSnapshot, DesktopWindow, WindowId } from "./diff.ts";

const AGENT_CONTEXT_KIND = "computer-use-observer.context" as const;
const MASKED_TITLE_POLICY = "masked" as const;

export type AgentContextTargetReason =
  | "active shared window"
  | "shared window with observer bounds"
  | "minimized shared window";

export type AgentContextRecommendedTarget = {
  readonly id: number;
  readonly app: string;
  readonly observerApp: string;
  readonly computerUseApp: string;
  readonly bounds: Bounds;
  readonly zOrder: number;
  readonly isActive: boolean;
  readonly isMinimized: boolean;
  readonly reason: AgentContextTargetReason;
};

export type AgentContextReport = {
  readonly kind: typeof AGENT_CONTEXT_KIND;
  readonly titlePolicy: typeof MASKED_TITLE_POLICY;
  readonly observer: {
    readonly windowCount: number;
    readonly activeWindowId: WindowId | null;
  };
  readonly computerUse: {
    readonly windowCount: number;
  };
  readonly bridge: ComputerUseBridgeReport;
  readonly recommendedTargets: readonly AgentContextRecommendedTarget[];
};

export function buildAgentContextReport(
  observerInput: DesktopSnapshot | readonly DesktopWindow[],
  computerUseWindows: readonly ComputerUseWindow[],
): AgentContextReport {
  const observerWindows = Array.isArray(observerInput)
    ? observerInput
    : observerInput.windows;
  const bridge = buildComputerUseBridgeReport(observerWindows, computerUseWindows);
  const observerById = new Map(
    observerWindows.map((observerWindow) => [observerWindow.id, observerWindow]),
  );
  const recommendedTargets = bridge.sharedWindows
    .flatMap((sharedWindow) => {
      const observerWindow = observerById.get(String(sharedWindow.id));
      if (observerWindow === undefined) {
        return [];
      }
      return [
        {
          id: sharedWindow.id,
          app: sharedWindow.computerUseApp,
          observerApp: sharedWindow.observerApp,
          computerUseApp: sharedWindow.computerUseApp,
          bounds: observerWindow.bounds,
          zOrder: observerWindow.zOrder,
          isActive: observerWindow.isActive,
          isMinimized: observerWindow.isMinimized,
          reason: targetReason(observerWindow),
        },
      ];
    })
    .sort(compareRecommendedTargets);

  return {
    kind: AGENT_CONTEXT_KIND,
    titlePolicy: MASKED_TITLE_POLICY,
    observer: {
      windowCount: observerWindows.length,
      activeWindowId: activeWindowId(observerInput, observerWindows),
    },
    computerUse: {
      windowCount: computerUseWindows.length,
    },
    bridge,
    recommendedTargets,
  };
}

function targetReason(window: DesktopWindow): AgentContextTargetReason {
  if (window.isActive) {
    return "active shared window";
  }
  if (window.isMinimized) {
    return "minimized shared window";
  }
  return "shared window with observer bounds";
}

function activeWindowId(
  observerInput: DesktopSnapshot | readonly DesktopWindow[],
  observerWindows: readonly DesktopWindow[],
): WindowId | null {
  if (!Array.isArray(observerInput)) {
    return observerInput.activeWindowId;
  }
  const active = observerWindows.find((observerWindow) => observerWindow.isActive);
  return active?.id ?? null;
}

function compareRecommendedTargets(
  left: AgentContextRecommendedTarget,
  right: AgentContextRecommendedTarget,
): number {
  const activeDifference = Number(right.isActive) - Number(left.isActive);
  if (activeDifference !== 0) {
    return activeDifference;
  }
  const minimizedDifference = Number(left.isMinimized) - Number(right.isMinimized);
  if (minimizedDifference !== 0) {
    return minimizedDifference;
  }
  if (left.zOrder !== right.zOrder) {
    return left.zOrder - right.zOrder;
  }
  return left.id - right.id;
}
