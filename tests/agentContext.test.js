import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { buildAgentContextReport } from "../src/agentContext.ts";
import { createSnapshot, windowId } from "../src/diff.ts";

test("buildAgentContextReport recommends shared active windows before frontmost windows", () => {
  // Given: observer and Computer Use windows sharing active, frontmost, and minimized native ids.
  const snapshot = createSnapshot([
    observerWindow({
      id: "101",
      title: "Sensitive Workspace",
      app: "Code",
      zOrder: 4,
      isActive: true,
      isMinimized: false,
    }),
    observerWindow({
      id: "202",
      title: "Trading Shell",
      app: "WindowsTerminal",
      zOrder: 0,
      isActive: false,
      isMinimized: false,
    }),
    observerWindow({
      id: "303",
      title: "Hidden Notes",
      app: "Notepad",
      zOrder: 1,
      isActive: false,
      isMinimized: true,
    }),
  ]);
  const computerUseWindows = [
    {
      id: 202,
      app: "Windows Terminal",
      title: "Trading Shell",
    },
    {
      id: 101,
      app: String.raw`process:C:\Users\STC\AppData\Local\Programs\Microsoft VS Code\Code.exe`,
      title: "Sensitive Workspace",
    },
    {
      id: 303,
      app: "Notepad",
      title: "Hidden Notes",
    },
    {
      id: 404,
      app: "Browser",
      title: "Unshared Search",
    },
  ];

  // When: the agent context report is built.
  const report = buildAgentContextReport(snapshot, computerUseWindows);

  // Then: shared targets are ranked with private titles and process paths masked.
  assert.equal(report.kind, "computer-use-observer.context");
  assert.equal(report.titlePolicy, "masked");
  assert.deepEqual(report.observer, { windowCount: 3, activeWindowId: "101" });
  assert.deepEqual(report.computerUse, { windowCount: 4 });
  assert.equal(report.bridge.sharedWindowCount, 3);
  assert.deepEqual(
    report.recommendedTargets.map((target) => target.id),
    [101, 202, 303],
  );
  assert.deepEqual(report.recommendedTargets[0], {
    id: 101,
    app: "Code.exe",
    observerApp: "Code",
    computerUseApp: "Code.exe",
    bounds: { x: 40, y: 40, width: 800, height: 600 },
    zOrder: 4,
    isActive: true,
    isMinimized: false,
    reason: "active shared window",
  });
  assert.equal(report.recommendedTargets[1].reason, "shared window with observer bounds");
  assert.equal(report.recommendedTargets[2].reason, "minimized shared window");
  assert.doesNotMatch(JSON.stringify(report), /Sensitive Workspace|Trading Shell|Hidden Notes|Unshared Search/);
  assert.doesNotMatch(JSON.stringify(report), /Users|AppData|process:/);
});

test("agent context CLI emits compact integrated context JSON", () => {
  // Given: file inputs containing one shared observer and Computer Use window.
  const directory = mkdtempSync(join(tmpdir(), "agent-context-"));
  const observerFile = join(directory, "observer.json");
  const computerUseFile = join(directory, "computer-use.json");
  const snapshot = createSnapshot([
    observerWindow({
      id: "12",
      title: "Private Ticket",
      app: "Code",
      zOrder: 0,
      isActive: true,
      isMinimized: false,
    }),
  ]);
  writeFileSync(observerFile, JSON.stringify(snapshot), "utf8");
  writeFileSync(
    computerUseFile,
    JSON.stringify([{ id: 12, app: "Visual Studio Code", title: "Private Ticket" }]),
    "utf8",
  );

  // When: the agent context CLI is run.
  const result = spawnSync(
    "node",
    [
      "./scripts/agent-context.ts",
      "--observer-file",
      observerFile,
      "--computer-use-file",
      computerUseFile,
    ],
    { cwd: process.cwd(), encoding: "utf8" },
  );
  rmSync(directory, { recursive: true, force: true });

  // Then: one compact context report is written without raw titles.
  assert.equal(result.status, 0);
  assert.equal(result.stderr, "");
  assert.doesNotMatch(result.stdout, /\n\s/);
  const report = JSON.parse(result.stdout);
  assert.equal(report.kind, "computer-use-observer.context");
  assert.equal(report.bridge.sharedWindowCount, 1);
  assert.equal(report.recommendedTargets.length, 1);
  assert.equal(report.recommendedTargets[0].app, "Visual Studio Code");
  assert.doesNotMatch(result.stdout, /Private Ticket/);
});

test("agent context CLI watches file inputs as compact JSON lines", () => {
  // Given: stable file inputs and a bounded watch command.
  const directory = mkdtempSync(join(tmpdir(), "agent-context-watch-"));
  const observerFile = join(directory, "observer.json");
  const computerUseFile = join(directory, "computer-use.json");
  const snapshot = createSnapshot([
    observerWindow({
      id: "22",
      title: "Private Stream",
      app: "WindowsTerminal",
      zOrder: 0,
      isActive: true,
      isMinimized: false,
    }),
  ]);
  writeFileSync(observerFile, JSON.stringify(snapshot), "utf8");
  writeFileSync(
    computerUseFile,
    JSON.stringify([{ id: 22, app: "Windows Terminal", title: "Private Stream" }]),
    "utf8",
  );

  // When: the agent context CLI is run in bounded watch mode.
  const result = spawnSync(
    "node",
    [
      "./scripts/agent-context.ts",
      "--observer-file",
      observerFile,
      "--computer-use-file",
      computerUseFile,
      "--watch",
      "--interval-ms",
      "1",
      "--limit",
      "2",
    ],
    { cwd: process.cwd(), encoding: "utf8", timeout: 5_000 },
  );
  rmSync(directory, { recursive: true, force: true });

  // Then: each emitted line is a compact integrated context report.
  assert.equal(result.status, 0);
  assert.equal(result.stderr, "");
  const lines = result.stdout.trimEnd().split("\n");
  assert.equal(lines.length, 2);
  for (const line of lines) {
    assert.doesNotMatch(line, /^\s|\s$/);
    const report = JSON.parse(line);
    assert.equal(report.kind, "computer-use-observer.context");
    assert.equal(report.bridge.sharedWindowCount, 1);
    assert.equal(report.recommendedTargets.length, 1);
  }
  assert.doesNotMatch(result.stdout, /Private Stream/);
});

test("agent context CLI reports missing required options", () => {
  // Given: no CLI arguments.
  const result = spawnSync("node", ["./scripts/agent-context.ts"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  // When: the CLI parses the missing arguments.
  // Then: it returns a stable usage error instead of an internal exception.
  assert.equal(result.status, 1);
  assert.match(result.stderr, /--observer-file is required/);
  assert.doesNotMatch(result.stderr, /ReferenceError/);
});

/**
 * @param {{
 *   id: string;
 *   title: string;
 *   app: string;
 *   zOrder: number;
 *   isActive: boolean;
 *   isMinimized: boolean;
 * }} input
 * @returns {import("../src/diff.js").DesktopWindow}
 */
function observerWindow(input) {
  return {
    id: windowId(input.id),
    title: input.title,
    app: input.app,
    processId: input.zOrder + 100,
    bounds: { x: input.zOrder * 10, y: input.zOrder * 10, width: 800, height: 600 },
    zOrder: input.zOrder,
    isActive: input.isActive,
    isMinimized: input.isMinimized,
  };
}
