import assert from "node:assert/strict";
import test from "node:test";

import { createSnapshot, windowId } from "../src/diff.ts";
import { formatObserverSummary } from "../src/summary.ts";

test("formatObserverSummary masks titles by default", () => {
  const snapshot = createSnapshot([
    {
      id: windowId("active"),
      title: "Private Mail Subject",
      app: "OUTLOOK",
      processId: 10,
      bounds: { x: 1, y: 2, width: 300, height: 200 },
      zOrder: 0,
      isActive: true,
      isMinimized: false,
    },
  ]);

  const summary = formatObserverSummary(snapshot);

  assert.match(summary, /activeWindow: app=OUTLOOK/);
  assert.doesNotMatch(summary, /Private Mail Subject/);
});

test("formatObserverSummary can include titles when explicitly requested", () => {
  const snapshot = createSnapshot([
    {
      id: windowId("active"),
      title: "Codex",
      app: "Codex",
      processId: 11,
      bounds: { x: 10, y: 20, width: 800, height: 600 },
      zOrder: 0,
      isActive: true,
      isMinimized: false,
    },
  ]);

  const summary = formatObserverSummary(snapshot, { includeTitles: true });

  assert.match(summary, /title="Codex"/);
});
