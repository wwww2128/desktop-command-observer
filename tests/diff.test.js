import assert from "node:assert/strict";
import test from "node:test";

import {
  createSnapshot,
  diffSnapshots,
  hasChanges,
  windowId,
} from "../src/diff.ts";

test("diffSnapshots reports added removed updated and active windows", () => {
  // Given: a cached desktop snapshot with editor and browser windows.
  const previous = createSnapshot(
    [windowOf("editor", "Code", 1, true), windowOf("browser", "Chrome", 2, false)],
    new Date("2026-06-23T00:00:00.000Z"),
  );
  const next = createSnapshot(
    [
      windowOf("browser", "Chrome - Search", 1, true),
      windowOf("terminal", "Terminal", 2, false),
    ],
    new Date("2026-06-23T00:00:01.000Z"),
  );

  // When: the snapshots are compared.
  const patch = diffSnapshots(previous, next);

  // Then: only the changed topology is present in the patch.
  assert.equal(patch.previousActiveWindowId, "editor");
  assert.equal(patch.activeWindowId, "browser");
  assert.deepEqual(
    patch.added.map((window) => window.id),
    ["terminal"],
  );
  assert.deepEqual(
    patch.removed.map((window) => window.id),
    ["editor"],
  );
  assert.deepEqual(
    patch.updated.map((window) => window.id),
    ["browser"],
  );
  assert.equal(hasChanges(patch), true);
});

test("hasChanges returns false when snapshots are equivalent", () => {
  // Given: two observations of the same desktop state.
  const previous = createSnapshot(
    [windowOf("browser", "Chrome", 1, true)],
    new Date("2026-06-23T00:00:00.000Z"),
  );
  const next = createSnapshot(
    [windowOf("browser", "Chrome", 1, true)],
    new Date("2026-06-23T00:00:01.000Z"),
  );

  // When: the snapshots are compared.
  const patch = diffSnapshots(previous, next);

  // Then: no patch needs to be emitted.
  assert.equal(hasChanges(patch), false);
});

/**
 * @param {string} id
 * @param {string} title
 * @param {number} zOrder
 * @param {boolean} isActive
 * @returns {import("../src/diff.js").DesktopWindow}
 */
function windowOf(id, title, zOrder, isActive) {
  return {
    id: windowId(id),
    title,
    app: title.split(" ")[0],
    processId: zOrder + 100,
    bounds: { x: zOrder * 10, y: zOrder * 20, width: 800, height: 600 },
    zOrder,
    isActive,
    isMinimized: false,
  };
}
