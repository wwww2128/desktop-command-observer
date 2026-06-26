import { type DesktopSnapshot, type DesktopWindow, windowId } from "./diff.ts";

const BRIDGE_KIND = "computer-use.bridge" as const;
const MASKED_TITLE_POLICY = "masked" as const;

export type ComputerUseWindow = {
  readonly id: number;
  readonly app: string;
  readonly title?: string;
};

export type ComputerUseBridgeSharedWindow = {
  readonly id: number;
  readonly observerApp: string;
  readonly computerUseApp: string;
};

export type ComputerUseBridgeReport = {
  readonly kind: typeof BRIDGE_KIND;
  readonly titlePolicy: typeof MASKED_TITLE_POLICY;
  readonly observerWindowCount: number;
  readonly computerUseWindowCount: number;
  readonly sharedWindowCount: number;
  readonly sharedWindows: readonly ComputerUseBridgeSharedWindow[];
};

export function buildComputerUseBridgeReport(
  observerInput: DesktopSnapshot | readonly DesktopWindow[],
  computerUseWindows: readonly ComputerUseWindow[],
): ComputerUseBridgeReport {
  const observerWindows = Array.isArray(observerInput)
    ? observerInput
    : observerInput.windows;
  const observerByNativeId = new Map(
    observerWindows.map((observerWindow) => [observerWindow.id, observerWindow]),
  );
  const sharedWindows = computerUseWindows.flatMap((computerUseWindow) => {
    const observerWindow = observerByNativeId.get(String(computerUseWindow.id));
    if (observerWindow === undefined) {
      return [];
    }
    return [
      {
        id: computerUseWindow.id,
        observerApp: appLabel(observerWindow.app),
        computerUseApp: appLabel(computerUseWindow.app),
      },
    ];
  });

  return {
    kind: BRIDGE_KIND,
    titlePolicy: MASKED_TITLE_POLICY,
    observerWindowCount: observerWindows.length,
    computerUseWindowCount: computerUseWindows.length,
    sharedWindowCount: sharedWindows.length,
    sharedWindows,
  };
}

export function parseObserverBridgeInput(
  value: unknown,
): readonly DesktopWindow[] {
  if (isRecord(value)) {
    const windows = value["windows"];
    if (Array.isArray(windows)) {
      return parseObserverWindows(windows);
    }
  }
  if (Array.isArray(value)) {
    return parseObserverWindows(value);
  }
  throw new ComputerUseBridgeParseError("observer JSON must be a snapshot or window array");
}

export function parseComputerUseWindows(
  value: unknown,
): readonly ComputerUseWindow[] {
  if (!Array.isArray(value)) {
    throw new ComputerUseBridgeParseError("Computer Use JSON must be a window array");
  }
  return value.map(parseComputerUseWindow);
}

function parseObserverWindows(value: readonly unknown[]): readonly DesktopWindow[] {
  return value.map(parseObserverWindow);
}

function parseObserverWindow(value: unknown): DesktopWindow {
  if (!isRecord(value)) {
    throw new ComputerUseBridgeParseError("observer window must be an object");
  }

  const bounds = value["bounds"];
  if (!isObserverBounds(bounds)) {
    throw new ComputerUseBridgeParseError("observer window bounds are invalid");
  }

  const id = value["id"];
  const title = value["title"];
  const app = value["app"];
  const processId = value["processId"];
  const zOrder = value["zOrder"];
  const isActive = value["isActive"];
  const isMinimized = value["isMinimized"];
  if (
    typeof id !== "string" ||
    typeof title !== "string" ||
    typeof app !== "string" ||
    typeof processId !== "number" ||
    typeof zOrder !== "number" ||
    typeof isActive !== "boolean" ||
    typeof isMinimized !== "boolean"
  ) {
    throw new ComputerUseBridgeParseError("observer window fields are invalid");
  }

  return {
    id: windowId(id),
    title,
    app,
    processId,
    bounds,
    zOrder,
    isActive,
    isMinimized,
  };
}

function parseComputerUseWindow(value: unknown): ComputerUseWindow {
  if (!isRecord(value)) {
    throw new ComputerUseBridgeParseError("Computer Use window must be an object");
  }

  const id = value["id"];
  const app = value["app"];
  const title = value["title"];
  if (typeof id !== "number" || typeof app !== "string") {
    throw new ComputerUseBridgeParseError("Computer Use window fields are invalid");
  }
  if (typeof title === "string") {
    return { id, app, title };
  }
  return { id, app };
}

function isObserverBounds(value: unknown): value is DesktopWindow["bounds"] {
  return (
    isRecord(value) &&
    typeof value["x"] === "number" &&
    typeof value["y"] === "number" &&
    typeof value["width"] === "number" &&
    typeof value["height"] === "number"
  );
}

function appLabel(value: string): string {
  const normalized = value.startsWith("process:") ? value.slice("process:".length) : value;
  const parts = normalized.split(/[\\/]/);
  return parts.at(-1) ?? normalized;
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null;
}

export class ComputerUseBridgeParseError extends Error {
  readonly name = "ComputerUseBridgeParseError";
}
