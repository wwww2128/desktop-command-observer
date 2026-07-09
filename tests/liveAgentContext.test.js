import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

import {
  readLiveAgentContextReport,
  watchLiveAgentContext,
} from "../src/liveAgentContext.ts";
import { windowId } from "../src/diff.ts";

test("readLiveAgentContextReport builds context from live providers", async () => {
  // Given: observer and Computer Use providers with one shared native window id.
  const provider = {
    readObserverWindows: () => [
      observerWindow("501", "Private Live Window", "Code", 0),
    ],
    captureComputerUseWindows: async () => [
      { id: 501, app: "Visual Studio Code", hasTitle: true },
    ],
  };

  // When: live agent context is read once.
  const report = await readLiveAgentContextReport(provider);

  // Then: the context includes a ranked target without leaking the observer title.
  assert.equal(report.kind, "desktop-agent.context");
  assert.equal(report.bridge.sharedWindowCount, 1);
  assert.equal(report.recommendedTargets.length, 1);
  assert.equal(report.recommendedTargets[0].app, "Visual Studio Code");
  assert.doesNotMatch(JSON.stringify(report), /Private Live Window/);
});

test("watchLiveAgentContext emits bounded JSON lines", async () => {
  // Given: a bounded live watch loop and fake providers.
  const lines = [];
  const provider = {
    readObserverWindows: () => [
      observerWindow("601", "Private Watch Window", "WindowsTerminal", 0),
    ],
    captureComputerUseWindows: async () => [
      { id: 601, app: "Windows Terminal", hasTitle: true },
    ],
  };

  // When: two live context ticks are emitted.
  await watchLiveAgentContext({
    provider,
    intervalMs: 1,
    limit: 2,
    writeLine: (line) => lines.push(line),
    wait: async () => {},
  });

  // Then: each line is compact context JSON.
  assert.equal(lines.length, 2);
  for (const line of lines) {
    assert.doesNotMatch(line, /^\s|\s$/);
    const report = JSON.parse(line);
    assert.equal(report.kind, "desktop-agent.context");
    assert.equal(report.bridge.sharedWindowCount, 1);
  }
  assert.doesNotMatch(lines.join("\n"), /Private Watch Window/);
});

test("live agent context CLI reports missing Computer Use runtime", () => {
  // Given: no active Codex Computer Use sky runtime in a plain Node process.
  const result = spawnSync(
    "node",
    ["./scripts/live-agent-context.ts", "--limit", "1"],
    { cwd: process.cwd(), encoding: "utf8" },
  );

  // When: the live CLI starts.
  // Then: it returns a stable runtime error without PowerShell or stack internals.
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Computer Use live agent context requires the Codex Computer Use runtime/);
  assert.doesNotMatch(result.stderr, /ReferenceError|WindowsObserverParseError|powershell|at /i);
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
