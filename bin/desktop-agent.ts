#!/usr/bin/env node
import { CliUsageError, parseCommand, runCommand } from "../src/cli.ts";

try {
  await runCommand(parseCommand(process.argv.slice(2)));
} catch (error) {
  if (error instanceof CliUsageError) {
    console.error(error.message);
    process.exitCode = 2;
  } else {
    throw error;
  }
}
