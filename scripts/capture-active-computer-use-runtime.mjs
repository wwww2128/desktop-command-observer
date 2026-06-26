import { writeFileSync } from "node:fs";

export async function captureComputerUseWindowsFromSky(sky) {
  const listWindows = readListWindows(sky);
  return sanitizeWindows(await listWindows());
}

export async function writeComputerUseCaptureFromSky(options) {
  if (!isRecord(options)) {
    throw new ComputerUseRuntimeCaptureError("capture options must be an object");
  }

  const outFile = options.outFile;
  if (typeof outFile !== "string" || outFile.length === 0) {
    throw new ComputerUseRuntimeCaptureError("outFile must be a non-empty string");
  }

  const windows = await captureComputerUseWindowsFromSky(options.sky);
  writeFileSync(outFile, `${JSON.stringify(windows, null, 2)}\n`, "utf8");
  return windows;
}

function readListWindows(value) {
  if (!isRecord(value)) {
    throw new ComputerUseRuntimeCaptureError("Computer Use sky runtime is invalid");
  }

  const listWindows = value.list_windows;
  if (typeof listWindows !== "function") {
    throw new ComputerUseRuntimeCaptureError("Computer Use list_windows is unavailable");
  }

  return () => listWindows.call(value);
}

function sanitizeWindows(value) {
  if (!Array.isArray(value)) {
    throw new ComputerUseRuntimeCaptureError("Computer Use JSON must be a window array");
  }
  return value.map(sanitizeWindow);
}

function sanitizeWindow(value) {
  if (!isRecord(value)) {
    throw new ComputerUseRuntimeCaptureError("Computer Use window must be an object");
  }

  const id = value.id;
  const app = value.app;
  const title = value.title;
  if (typeof id !== "number" || typeof app !== "string") {
    throw new ComputerUseRuntimeCaptureError("Computer Use window fields are invalid");
  }

  return {
    id,
    app: appLabel(app),
    hasTitle: typeof title === "string" && title.length > 0,
  };
}

function appLabel(value) {
  const normalized = value.startsWith("process:") ? value.slice("process:".length) : value;
  const parts = normalized.split(/[\\/]/);
  return parts.at(-1) ?? normalized;
}

function isRecord(value) {
  return typeof value === "object" && value !== null;
}

export class ComputerUseRuntimeCaptureError extends Error {
  name = "ComputerUseRuntimeCaptureError";
}
