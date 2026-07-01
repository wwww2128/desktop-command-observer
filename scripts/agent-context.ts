import { readFileSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";

import {
  buildAgentContextReport,
  type AgentContextReport,
} from "../src/agentContext.ts";
import {
  ComputerUseBridgeParseError,
  parseComputerUseWindows,
  parseObserverBridgeInput,
} from "../src/computerUseBridge.ts";

type AgentContextCliOptions = {
  readonly observerFile: string;
  readonly computerUseFile: string;
  readonly watch: AgentContextWatchOptions | null;
};

type AgentContextWatchOptions = {
  readonly intervalMs: number;
  readonly limit: number | null;
};

type AgentContextInputLabel = "observer" | "Computer Use";

class AgentContextCliInputError extends Error {
  readonly name = "AgentContextCliInputError";
}

main().catch((error: unknown) => {
  if (
    error instanceof AgentContextCliInputError ||
    error instanceof ComputerUseBridgeParseError
  ) {
    console.error(error.message);
    process.exitCode = 1;
    return;
  }
  throw error;
});

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  if (options.watch === null) {
    console.log(JSON.stringify(readAgentContextReport(options)));
    return;
  }

  await watchAgentContext(options, console.log);
}

async function watchAgentContext(
  options: AgentContextCliOptions,
  writeLine: (line: string) => void,
): Promise<void> {
  let emittedReports = 0;
  while (options.watch.limit === null || emittedReports < options.watch.limit) {
    writeLine(JSON.stringify(readAgentContextReport(options)));
    emittedReports += 1;

    if (options.watch.limit !== null && emittedReports >= options.watch.limit) {
      return;
    }
    await delay(options.watch.intervalMs);
  }
}

function readAgentContextReport(
  options: AgentContextCliOptions,
): AgentContextReport {
  const observerInput = readJsonFile(options.observerFile, "observer");
  const computerUseInput = readJsonFile(options.computerUseFile, "Computer Use");
  return buildAgentContextReport(
    parseObserverBridgeInput(observerInput),
    parseComputerUseWindows(computerUseInput),
  );
}

function parseArgs(args: readonly string[]): AgentContextCliOptions {
  return {
    observerFile: readRequiredOption(args, "--observer-file"),
    computerUseFile: readRequiredOption(args, "--computer-use-file"),
    watch: readWatchOptions(args),
  };
}

function readWatchOptions(
  args: readonly string[],
): AgentContextWatchOptions | null {
  if (!args.includes("--watch")) {
    return null;
  }

  return {
    intervalMs: readNumberOption(args, "--interval-ms", 500),
    limit: readNullableNumberOption(args, "--limit"),
  };
}

function readNumberOption(
  args: readonly string[],
  name: string,
  fallback: number,
): number {
  const value = readOptionalOption(args, name);
  if (value === null) {
    return fallback;
  }

  return parsePositiveIntegerOption(name, value);
}

function readNullableNumberOption(
  args: readonly string[],
  name: string,
): number | null {
  const value = readOptionalOption(args, name);
  if (value === null) {
    return null;
  }

  return parsePositiveIntegerOption(name, value);
}

function parsePositiveIntegerOption(name: string, value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new AgentContextCliInputError(`${name} must be a positive integer`);
  }
  return parsed;
}

function readOptionalOption(args: readonly string[], name: string): string | null {
  const index = args.indexOf(name);
  if (index === -1) {
    return null;
  }

  const value = args.at(index + 1);
  if (value === undefined) {
    throw new AgentContextCliInputError(`${name} needs a value`);
  }
  return value;
}

function readJsonFile(path: string, label: AgentContextInputLabel): unknown {
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch (error) {
    if (error instanceof Error) {
      throw new AgentContextCliInputError(`${label} file could not be read`);
    }
    throw error;
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new AgentContextCliInputError(`${label} file contains invalid JSON`);
    }
    throw error;
  }
}

function readRequiredOption(args: readonly string[], name: string): string {
  const index = args.indexOf(name);
  if (index === -1) {
    throw new AgentContextCliInputError(`${name} is required`);
  }

  const value = args.at(index + 1);
  if (value === undefined) {
    throw new AgentContextCliInputError(`${name} needs a value`);
  }
  return value;
}
