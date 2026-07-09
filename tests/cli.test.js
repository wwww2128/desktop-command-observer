import assert from "node:assert/strict";
import test from "node:test";

import { CliUsageError, parseCommand, runCommand, toJsonLine } from "../src/cli.ts";

test("parseCommand defaults to a snapshot command", () => {
  // Given: no explicit CLI arguments.
  const args = [];

  // When: the command is parsed.
  const command = parseCommand(args);

  // Then: the CLI reads one desktop snapshot.
  assert.deepEqual(command, { command: "snapshot" });
});

test("parseCommand reads watch options", () => {
  // Given: watch arguments with a bounded smoke-test limit.
  const args = ["watch", "--interval-ms", "250", "--limit", "3"];

  // When: the command is parsed.
  const command = parseCommand(args);

  // Then: the interval and limit are available to the runner.
  assert.deepEqual(command, { command: "watch", intervalMs: 250, limit: 3 });
});

test("parseCommand rejects unknown commands", () => {
  // Given: a command that is not part of the CLI surface.
  const args = ["scan"];

  // When: the command is parsed.
  const parse = () => parseCommand(args);

  // Then: the user gets a CLI usage error.
  assert.throws(parse, CliUsageError);
});

test("runCommand emits help text when requested", async () => {
  // Given: the help command and a captured output stream.
  const lines = [];
  const command = parseCommand(["--help"]);

  // When: the command is run.
  await runCommand(command, (line) => lines.push(line));

  // Then: the CLI explains the public cu-observer command.
  assert.equal(lines.length, 1);
  assert.match(lines[0], /Usage: cu-observer/);
  assert.match(lines[0], /snapshot/);
  assert.match(lines[0], /watch/);
});

test("toJsonLine emits compact JSON", () => {
  // Given: a small payload.
  const payload = { type: "desktop.patch", added: [] };

  // When: the payload is serialized.
  const line = toJsonLine(payload);

  // Then: it is ready for JSONL streaming.
  assert.equal(line, '{"type":"desktop.patch","added":[]}');
});
