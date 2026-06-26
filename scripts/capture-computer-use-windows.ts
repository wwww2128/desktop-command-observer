import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import {
  captureComputerUseWindows,
  ComputerUseCaptureError,
  createComputerUseWindowLister,
} from "../src/computerUseCapture.ts";
import {
  ComputerUseBridgeParseError,
  sanitizeComputerUseWindows,
  type SanitizedComputerUseWindow,
} from "../src/computerUseBridge.ts";

type CaptureCliOptions = {
  readonly inputFile: string | null;
  readonly outFile: string | null;
  readonly pluginRoot: string | null;
};

class CaptureCliInputError extends Error {
  readonly name = "CaptureCliInputError";
}

main().catch((error: unknown) => {
  if (
    error instanceof CaptureCliInputError ||
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
  const capturedWindows =
    options.inputFile === null
      ? await captureLiveComputerUseWindows(resolvePluginRoot(options.pluginRoot))
      : sanitizeComputerUseWindows(readJsonFile(options.inputFile));
  writeOutput(capturedWindows, options.outFile);
}

function parseArgs(args: readonly string[]): CaptureCliOptions {
  return {
    inputFile: readOptionalOption(args, "--input-file"),
    outFile: readOptionalOption(args, "--out-file"),
    pluginRoot: readOptionalOption(args, "--plugin-root"),
  };
}

function readJsonFile(path: string): unknown {
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch (error) {
    if (error instanceof Error) {
      throw new CaptureCliInputError("Computer Use input file could not be read");
    }
    throw error;
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new CaptureCliInputError("Computer Use input file contains invalid JSON");
    }
    throw error;
  }
}

async function captureLiveComputerUseWindows(
  pluginRoot: string,
): Promise<readonly SanitizedComputerUseWindow[]> {
  const clientPath = join(pluginRoot, "scripts", "computer-use-client.mjs");
  if (!existsSync(clientPath)) {
    throw new CaptureCliInputError("Computer Use client module could not be found");
  }

  let clientModule: unknown;
  try {
    clientModule = await import(pathToFileURL(clientPath).href);
  } catch (error) {
    if (error instanceof Error) {
      throw new CaptureCliInputError(
        "Computer Use live capture requires the Codex Computer Use runtime",
      );
    }
    throw error;
  }
  if (!isRecord(clientModule)) {
    throw new CaptureCliInputError("Computer Use client module is invalid");
  }

  const setupComputerUseRuntime = clientModule["setupComputerUseRuntime"];
  if (typeof setupComputerUseRuntime !== "function") {
    throw new CaptureCliInputError("Computer Use runtime setup is unavailable");
  }
  try {
    await setupComputerUseRuntime({ globals: globalThis });
  } catch (error) {
    if (error instanceof Error) {
      throw new CaptureCliInputError(
        "Computer Use live capture requires the Codex Computer Use runtime",
      );
    }
    throw error;
  }

  const sky = Reflect.get(globalThis, "sky");
  try {
    return await captureComputerUseWindows(createComputerUseWindowLister(sky));
  } catch (error) {
    if (error instanceof ComputerUseCaptureError) {
      throw new CaptureCliInputError(error.message);
    }
    if (error instanceof ComputerUseBridgeParseError) {
      throw error;
    }
    if (error instanceof Error) {
      throw new CaptureCliInputError("Computer Use live capture failed");
    }
    throw error;
  }
}

function resolvePluginRoot(pluginRoot: string | null): string {
  return pluginRoot ?? findDefaultComputerUsePluginRoot();
}

function findDefaultComputerUsePluginRoot(): string {
  const userProfile = process.env["USERPROFILE"];
  if (userProfile === undefined || userProfile.length === 0) {
    throw new CaptureCliInputError("USERPROFILE is required to find Computer Use");
  }

  const pluginBase = join(
    userProfile,
    ".codex",
    "plugins",
    "cache",
    "openai-bundled",
    "computer-use",
  );
  let versionNames: readonly string[];
  try {
    versionNames = readdirSync(pluginBase, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
  } catch (error) {
    if (error instanceof Error) {
      throw new CaptureCliInputError("Computer Use plugin root could not be found");
    }
    throw error;
  }

  const pluginRoot = versionNames
    .map((versionName) => join(pluginBase, versionName))
    .filter((candidate) =>
      existsSync(join(candidate, "scripts", "computer-use-client.mjs")),
    )
    .at(-1);
  if (pluginRoot === undefined) {
    throw new CaptureCliInputError("Computer Use client module could not be found");
  }
  return pluginRoot;
}

function writeOutput(value: unknown, outFile: string | null): void {
  const text = JSON.stringify(value);
  if (outFile === null) {
    console.log(text);
    return;
  }
  writeFileSync(outFile, `${text}\n`, "utf8");
}

function readOptionalOption(args: readonly string[], name: string): string | null {
  const index = args.indexOf(name);
  if (index === -1) {
    return null;
  }

  const value = args.at(index + 1);
  if (value === undefined) {
    throw new CaptureCliInputError(`${name} needs a value`);
  }
  return value;
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null;
}
