import {
  sanitizeComputerUseWindows,
  type SanitizedComputerUseWindow,
} from "./computerUseBridge.ts";

export type ComputerUseWindowLister = {
  readonly listWindows: () => Promise<unknown>;
};

export async function captureComputerUseWindows(
  lister: ComputerUseWindowLister,
): Promise<readonly SanitizedComputerUseWindow[]> {
  return sanitizeComputerUseWindows(await lister.listWindows());
}

export function createComputerUseWindowLister(
  value: unknown,
): ComputerUseWindowLister {
  if (!isRecord(value)) {
    throw new ComputerUseCaptureError("Computer Use window lister is invalid");
  }

  const listWindows = value["list_windows"];
  if (typeof listWindows !== "function") {
    throw new ComputerUseCaptureError("Computer Use list_windows is unavailable");
  }

  return {
    listWindows: () => listWindows.call(value),
  };
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null;
}

export class ComputerUseCaptureError extends Error {
  readonly name = "ComputerUseCaptureError";
}
