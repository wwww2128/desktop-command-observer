import { readFileSync } from "node:fs";

import {
  buildComputerUseBridgeReport,
  ComputerUseBridgeParseError,
  parseComputerUseWindows,
  parseObserverBridgeInput,
} from "../src/computerUseBridge.ts";

type BridgeCliOptions = {
  readonly observerFile: string;
  readonly computerUseFile: string;
};

type BridgeInputLabel = "observer" | "Computer Use";

class BridgeCliInputError extends Error {
  readonly name = "BridgeCliInputError";
}

try {
  main();
} catch (error) {
  if (
    error instanceof BridgeCliInputError ||
    error instanceof ComputerUseBridgeParseError
  ) {
    console.error(error.message);
    process.exitCode = 1;
  } else {
    throw error;
  }
}

function main(): void {
  const options = parseArgs(process.argv.slice(2));
  const observerInput = readJsonFile(options.observerFile, "observer");
  const computerUseInput = readJsonFile(options.computerUseFile, "Computer Use");
  const report = buildComputerUseBridgeReport(
    parseObserverBridgeInput(observerInput),
    parseComputerUseWindows(computerUseInput),
  );
  console.log(JSON.stringify(report));
}

function parseArgs(args: readonly string[]): BridgeCliOptions {
  return {
    observerFile: readRequiredOption(args, "--observer-file"),
    computerUseFile: readRequiredOption(args, "--computer-use-file"),
  };
}

function readJsonFile(path: string, label: BridgeInputLabel): unknown {
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch (error) {
    if (error instanceof Error) {
      throw new BridgeCliInputError(`${label} file could not be read`);
    }
    throw error;
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new BridgeCliInputError(`${label} file contains invalid JSON`);
    }
    throw error;
  }
}

function readRequiredOption(args: readonly string[], name: string): string {
  const index = args.indexOf(name);
  if (index === -1) {
    throw new BridgeCliInputError(`${name} is required`);
  }

  const value = args.at(index + 1);
  if (value === undefined) {
    throw new BridgeCliInputError(`${name} needs a value`);
  }
  return value;
}
