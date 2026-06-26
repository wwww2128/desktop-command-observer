import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { buildComputerUseBridgeReport } from "../src/computerUseBridge.ts";
import { createSnapshot, windowId } from "../src/diff.ts";

test("buildComputerUseBridgeReport matches native ids and masks titles by default", () => {
  // Given: observer and Computer Use windows that share one native window id.
  const snapshot = createSnapshot([
    observerWindow("101", "Private Mail Subject", "OUTLOOK", 0),
    observerWindow("202", "Build Logs", "WindowsTerminal", 1),
  ]);
  const computerUseWindows = [
    { id: 101, app: "Outlook", title: "Private Mail Subject" },
    { id: 303, app: "Browser", title: "Search Results" },
  ];

  // When: the bridge report is built.
  const report = buildComputerUseBridgeReport(snapshot, computerUseWindows);

  // Then: the shared native id is reported without raw title fields.
  assert.equal(report.kind, "computer-use.bridge");
  assert.equal(report.titlePolicy, "masked");
  assert.equal(report.observerWindowCount, 2);
  assert.equal(report.computerUseWindowCount, 2);
  assert.equal(report.sharedWindowCount, 1);
  assert.deepEqual(report.sharedWindows, [
    { id: 101, observerApp: "OUTLOOK", computerUseApp: "Outlook" },
  ]);
  assert.doesNotMatch(JSON.stringify(report), /Private Mail Subject/);
  assert.doesNotMatch(JSON.stringify(report), /Search Results/);
});

test("buildComputerUseBridgeReport reports zero shared windows when ids differ", () => {
  // Given: observer and Computer Use windows with no shared native ids.
  const observerWindows = [observerWindow("404", "Notes", "Notepad", 0)];
  const computerUseWindows = [{ id: 405, app: "Notepad", title: "Notes" }];

  // When: the bridge report is built.
  const report = buildComputerUseBridgeReport(observerWindows, computerUseWindows);

  // Then: a title match does not count as a bridge match.
  assert.equal(report.sharedWindowCount, 0);
  assert.deepEqual(report.sharedWindows, []);
});

test("buildComputerUseBridgeReport masks process paths in app labels", () => {
  const snapshot = createSnapshot([
    observerWindow("505", "Editor", "Code", 0),
  ]);
  const computerUseWindows = [
    {
      id: 505,
      app: String.raw`process:C:\Users\STC\AppData\Local\Programs\Microsoft VS Code\Code.exe`,
      title: "Editor",
    },
  ];

  const report = buildComputerUseBridgeReport(snapshot, computerUseWindows);

  assert.deepEqual(report.sharedWindows, [
    { id: 505, observerApp: "Code", computerUseApp: "Code.exe" },
  ]);
  assert.doesNotMatch(JSON.stringify(report), /Users/);
  assert.doesNotMatch(JSON.stringify(report), /AppData/);
});

test("computer use bridge CLI reads observer and Computer Use JSON files", () => {
  // Given: file inputs containing a snapshot and raw Computer Use windows.
  const directory = mkdtempSync(join(tmpdir(), "computer-use-bridge-"));
  const observerFile = join(directory, "observer.json");
  const computerUseFile = join(directory, "computer-use.json");
  const snapshot = createSnapshot([
    observerWindow("12", "Sensitive Ticket", "Code", 0),
  ]);
  writeFileSync(observerFile, JSON.stringify(snapshot), "utf8");
  writeFileSync(
    computerUseFile,
    JSON.stringify([{ id: 12, app: "Visual Studio Code", title: "Sensitive Ticket" }]),
    "utf8",
  );

  // When: the bridge CLI is run.
  const result = spawnSync(
    "node",
    [
      "./scripts/computer-use-bridge.ts",
      "--observer-file",
      observerFile,
      "--computer-use-file",
      computerUseFile,
    ],
    { cwd: process.cwd(), encoding: "utf8" },
  );
  rmSync(directory, { recursive: true, force: true });

  // Then: compact JSON is written to stdout without raw titles.
  assert.equal(result.status, 0);
  assert.equal(result.stderr, "");
  assert.doesNotMatch(result.stdout, /\n\s/);
  const report = JSON.parse(result.stdout);
  assert.equal(report.kind, "computer-use.bridge");
  assert.equal(report.sharedWindowCount, 1);
  assert.deepEqual(report.sharedWindows, [
    { id: 12, observerApp: "Code", computerUseApp: "Visual Studio Code" },
  ]);
  assert.doesNotMatch(result.stdout, /Sensitive Ticket/);
});

test("computer use bridge CLI reports missing required options", () => {
  // Given: no CLI arguments.
  const result = spawnSync("node", ["./scripts/computer-use-bridge.ts"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  // When: the CLI parses the missing arguments.
  // Then: it returns a stable usage error instead of an internal exception.
  assert.equal(result.status, 1);
  assert.match(result.stderr, /--observer-file is required/);
  assert.doesNotMatch(result.stderr, /ReferenceError/);
});

test("computer use bridge CLI reports unreadable input files without path leakage", () => {
  // Given: a missing observer input file and a valid Computer Use input file.
  const directory = mkdtempSync(join(tmpdir(), "computer-use-bridge-"));
  const observerFile = join(directory, "missing-observer.json");
  const computerUseFile = join(directory, "computer-use.json");
  writeFileSync(computerUseFile, JSON.stringify([]), "utf8");

  // When: the bridge CLI tries to read the missing file.
  const result = spawnSync(
    "node",
    [
      "./scripts/computer-use-bridge.ts",
      "--observer-file",
      observerFile,
      "--computer-use-file",
      computerUseFile,
    ],
    { cwd: process.cwd(), encoding: "utf8" },
  );
  rmSync(directory, { recursive: true, force: true });

  // Then: the error is stable and does not echo the private temp path.
  assert.equal(result.status, 1);
  assert.match(result.stderr, /observer file could not be read/);
  assert.doesNotMatch(result.stderr, /ReferenceError|ENOENT|computer-use-bridge-/);
});

test("computer use bridge CLI reports invalid JSON by input label", () => {
  // Given: an invalid observer JSON file and a valid Computer Use input file.
  const directory = mkdtempSync(join(tmpdir(), "computer-use-bridge-"));
  const observerFile = join(directory, "observer.json");
  const computerUseFile = join(directory, "computer-use.json");
  writeFileSync(observerFile, "{", "utf8");
  writeFileSync(computerUseFile, JSON.stringify([]), "utf8");

  // When: the bridge CLI parses the invalid JSON.
  const result = spawnSync(
    "node",
    [
      "./scripts/computer-use-bridge.ts",
      "--observer-file",
      observerFile,
      "--computer-use-file",
      computerUseFile,
    ],
    { cwd: process.cwd(), encoding: "utf8" },
  );
  rmSync(directory, { recursive: true, force: true });

  // Then: the error identifies the logical input without leaking parser internals.
  assert.equal(result.status, 1);
  assert.match(result.stderr, /observer file contains invalid JSON/);
  assert.doesNotMatch(result.stderr, /SyntaxError|Unexpected token/);
});

test("computer use bridge CLI reports malformed input shapes", () => {
  // Given: valid JSON files with invalid bridge input shapes.
  const directory = mkdtempSync(join(tmpdir(), "computer-use-bridge-"));
  const observerFile = join(directory, "observer.json");
  const computerUseFile = join(directory, "computer-use.json");
  writeFileSync(observerFile, JSON.stringify({ notWindows: [] }), "utf8");
  writeFileSync(computerUseFile, JSON.stringify({ notAWindowArray: true }), "utf8");

  // When: each malformed input is passed through the CLI boundary.
  const observerResult = spawnSync(
    "node",
    [
      "./scripts/computer-use-bridge.ts",
      "--observer-file",
      observerFile,
      "--computer-use-file",
      computerUseFile,
    ],
    { cwd: process.cwd(), encoding: "utf8" },
  );
  writeFileSync(observerFile, JSON.stringify(createSnapshot([])), "utf8");
  const computerUseResult = spawnSync(
    "node",
    [
      "./scripts/computer-use-bridge.ts",
      "--observer-file",
      observerFile,
      "--computer-use-file",
      computerUseFile,
    ],
    { cwd: process.cwd(), encoding: "utf8" },
  );
  rmSync(directory, { recursive: true, force: true });

  // Then: malformed shapes return typed parse messages without internals.
  assert.equal(observerResult.status, 1);
  assert.match(observerResult.stderr, /observer JSON must be a snapshot or window array/);
  assert.doesNotMatch(observerResult.stderr, /ReferenceError|TypeError/);
  assert.equal(computerUseResult.status, 1);
  assert.match(computerUseResult.stderr, /Computer Use JSON must be a window array/);
  assert.doesNotMatch(computerUseResult.stderr, /ReferenceError|TypeError/);
});

/**
 * @param {string} id
 * @param {string} title
 * @param {string} app
 * @param {number} zOrder
 * @returns {import("../src/diff.js").DesktopWindow}
 */
function observerWindow(id, title, app, zOrder) {
  return {
    id: windowId(id),
    title,
    app,
    processId: zOrder + 100,
    bounds: { x: zOrder * 10, y: zOrder * 10, width: 800, height: 600 },
    zOrder,
    isActive: zOrder === 0,
    isMinimized: false,
  };
}
