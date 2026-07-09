import { setTimeout as delay } from "node:timers/promises";

import { createSnapshot, diffSnapshots, hasChanges } from "./diff.ts";
import { readWindows } from "./windowsObserver.ts";

const DEFAULT_INTERVAL_MS = 500;
const USAGE_TEXT = [
  "Usage: cu-observer <command> [options]",
  "",
  "Commands:",
  "  snapshot                         Emit one desktop snapshot as JSON.",
  "  watch --interval-ms 500          Emit snapshot and patch JSON lines.",
  "  help                             Show this help.",
].join("\n");

type SnapshotCommand = {
  readonly command: "snapshot";
};

type WatchCommand = {
  readonly command: "watch";
  readonly intervalMs: number;
  readonly limit: number | null;
};

type HelpCommand = {
  readonly command: "help";
};

export type CliCommand = SnapshotCommand | WatchCommand | HelpCommand;

export function parseCommand(argv: readonly string[]): CliCommand {
  const [command = "snapshot", ...rest] = argv;

  switch (command) {
    case "snapshot":
      return { command: "snapshot" };
    case "watch":
      return {
        command: "watch",
        intervalMs: readNumberOption(rest, "--interval-ms", DEFAULT_INTERVAL_MS),
        limit: readNullableNumberOption(rest, "--limit"),
      };
    case "help":
    case "--help":
    case "-h":
      return { command: "help" };
    default:
      throw new CliUsageError(`unknown command: ${command}`);
  }
}

export async function runCommand(
  command: CliCommand,
  writeLine: (line: string) => void = console.log,
): Promise<void> {
  switch (command.command) {
    case "snapshot":
      writeLine(toJsonLine(createSnapshot(readWindows())));
      return;
    case "watch":
      await watchDesktop(command, writeLine);
      return;
    case "help":
      writeLine(USAGE_TEXT);
      return;
    default:
      assertNeverCommand(command);
  }
}

function assertNeverCommand(command: never): never {
  throw new CliUsageError(`unhandled command: ${JSON.stringify(command)}`);
}

async function watchDesktop(
  command: WatchCommand,
  writeLine: (line: string) => void,
): Promise<void> {
  let previous = createSnapshot(readWindows());
  writeLine(toJsonLine(previous));

  let observedTicks = 0;
  while (command.limit === null || observedTicks < command.limit) {
    await delay(command.intervalMs);
    observedTicks += 1;

    const next = createSnapshot(readWindows());
    const patch = diffSnapshots(previous, next);
    previous = next;

    if (!hasChanges(patch)) {
      continue;
    }

    writeLine(toJsonLine(patch));
  }
}

export function toJsonLine(value: unknown): string {
  return JSON.stringify(value);
}

function readNumberOption(
  args: readonly string[],
  name: string,
  fallback: number,
): number {
  const value = readOption(args, name);
  if (value === null) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new CliUsageError(`${name} must be a positive integer`);
  }
  return parsed;
}

function readNullableNumberOption(
  args: readonly string[],
  name: string,
): number | null {
  const value = readOption(args, name);
  if (value === null) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new CliUsageError(`${name} must be a positive integer`);
  }
  return parsed;
}

function readOption(args: readonly string[], name: string): string | null {
  const index = args.indexOf(name);
  if (index === -1) {
    return null;
  }

  const value = args.at(index + 1);
  if (value === undefined) {
    throw new CliUsageError(`${name} needs a value`);
  }
  return value;
}

export class CliUsageError extends Error {
  readonly name = "CliUsageError";
}
