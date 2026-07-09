import {
  captureComputerUseWindows,
  ComputerUseCaptureError,
  createComputerUseWindowLister,
} from "../src/computerUseCapture.ts";
import {
  watchLiveAgentContext,
  type LiveAgentContextProvider,
} from "../src/liveAgentContext.ts";
import { readWindows, WindowsObserverParseError } from "../src/windowsObserver.ts";

const DEFAULT_INTERVAL_MS = 500;

type LiveAgentContextCliOptions = {
  readonly intervalMs: number;
  readonly limit: number | null;
};

class LiveAgentContextCliInputError extends Error {
  readonly name = "LiveAgentContextCliInputError";
}

main().catch((error: unknown) => {
  if (
    error instanceof LiveAgentContextCliInputError ||
    error instanceof ComputerUseCaptureError ||
    error instanceof WindowsObserverParseError
  ) {
    console.error(error.message);
    process.exitCode = 1;
    return;
  }
  throw error;
});

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  await watchLiveAgentContext({
    provider: createLiveAgentContextProvider(),
    intervalMs: options.intervalMs,
    limit: options.limit,
    writeLine: console.log,
  });
}

function createLiveAgentContextProvider(): LiveAgentContextProvider {
  const sky = readGlobalValue("sky");
  try {
    const lister = createComputerUseWindowLister(sky);
    return {
      readObserverWindows: readWindows,
      captureComputerUseWindows: () => captureComputerUseWindows(lister),
    };
  } catch (error) {
    if (error instanceof ComputerUseCaptureError) {
      throw new LiveAgentContextCliInputError(
        "Computer Use live agent context requires the Codex Computer Use runtime",
      );
    }
    throw error;
  }
}

function parseArgs(args: readonly string[]): LiveAgentContextCliOptions {
  return {
    intervalMs: readNumberOption(args, "--interval-ms", DEFAULT_INTERVAL_MS),
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
    throw new LiveAgentContextCliInputError(`${name} must be a positive integer`);
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
    throw new LiveAgentContextCliInputError(`${name} needs a value`);
  }
  return value;
}

function readGlobalValue(name: string): unknown {
  return Object.getOwnPropertyDescriptor(globalThis, name)?.value;
}
