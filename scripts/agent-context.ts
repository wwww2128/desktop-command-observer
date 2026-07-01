import { readFileSync } from "node:fs";

import { buildAgentContextReport } from "../src/agentContext.ts";
import {
  ComputerUseBridgeParseError,
  parseComputerUseWindows,
  parseObserverBridgeInput,
} from "../src/computerUseBridge.ts";

type AgentContextCliOptions = {
  readonly observerFile: string;
  readonly computerUseFile: string;
};

type AgentContextInputLabel = "observer" | "Computer Use";

class AgentContextCliInputError extends Error {
  readonly name = "AgentContextCliInputError";
}

try {
  main();
} catch (error) {
  if (
    error instanceof AgentContextCliInputError ||
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
  const report = buildAgentContextReport(
    parseObserverBridgeInput(observerInput),
    parseComputerUseWindows(computerUseInput),
  );
  console.log(JSON.stringify(report));
}

function parseArgs(args: readonly string[]): AgentContextCliOptions {
  return {
    observerFile: readRequiredOption(args, "--observer-file"),
    computerUseFile: readRequiredOption(args, "--computer-use-file"),
  };
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
