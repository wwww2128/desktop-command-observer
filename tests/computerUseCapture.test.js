import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  captureComputerUseWindows,
  createComputerUseWindowLister,
} from "../src/computerUseCapture.ts";
import { sanitizeComputerUseWindows } from "../src/computerUseBridge.ts";

test("sanitizeComputerUseWindows masks titles and process paths for capture evidence", () => {
  // Given: raw Computer Use windows can include private titles and full process paths.
  const rawWindows = [
    {
      id: 66096,
      app: String.raw`process:C:\Users\STC\AppData\Local\Programs\Microsoft VS Code\Code.exe`,
      title: "Private Quant Workspace",
    },
    { id: 42, app: "Calculator" },
  ];

  // When: the list is sanitized for bridge evidence.
  const sanitizedWindows = sanitizeComputerUseWindows(rawWindows);

  // Then: only native ids, basename app labels, and title presence are retained.
  assert.deepEqual(sanitizedWindows, [
    { id: 66096, app: "Code.exe", hasTitle: true },
    { id: 42, app: "Calculator", hasTitle: false },
  ]);
  assert.doesNotMatch(JSON.stringify(sanitizedWindows), /Private Quant Workspace/);
  assert.doesNotMatch(JSON.stringify(sanitizedWindows), /Users|AppData|process:/);
});

test("computer use capture CLI writes sanitized fixture windows", () => {
  // Given: a fixture shaped like Computer Use list_windows output.
  const directory = mkdtempSync(join(tmpdir(), "computer-use-capture-"));
  const inputFile = join(directory, "raw-computer-use.json");
  const outputFile = join(directory, "sanitized-computer-use.json");
  writeFileSync(
    inputFile,
    JSON.stringify([
      {
        id: 808,
        app: String.raw`process:C:\Users\STC\Desktop\private-app.exe`,
        title: "Private Window",
      },
    ]),
    "utf8",
  );

  // When: the capture CLI reads the fixture through its offline input seam.
  const result = spawnSync(
    "node",
    [
      "./scripts/capture-computer-use-windows.ts",
      "--input-file",
      inputFile,
      "--out-file",
      outputFile,
    ],
    { cwd: process.cwd(), encoding: "utf8" },
  );

  // Then: the written evidence is sanitized and stdout stays quiet.
  const outputText = existsSync(outputFile) ? readFileSync(outputFile, "utf8") : "";
  rmSync(directory, { recursive: true, force: true });
  assert.equal(result.status, 0);
  assert.equal(result.stderr, "");
  assert.equal(result.stdout, "");
  assert.deepEqual(JSON.parse(outputText), [
    { id: 808, app: "private-app.exe", hasTitle: true },
  ]);
  assert.doesNotMatch(outputText, /Private Window|Users|Desktop|process:/);
});

test("captureComputerUseWindows accepts an active sky list_windows provider", async () => {
  // Given: a provider shaped like the active Computer Use sky runtime.
  const lister = createComputerUseWindowLister({
    list_windows: async () => [
      {
        id: 909,
        app: String.raw`process:C:\Users\STC\AppData\Local\Secret.exe`,
        title: "Secret Live Window",
      },
    ],
  });

  // When: live capture reads through that provider.
  const capturedWindows = await captureComputerUseWindows(lister);

  // Then: the captured evidence is sanitized before it leaves the bridge layer.
  assert.deepEqual(capturedWindows, [
    { id: 909, app: "Secret.exe", hasTitle: true },
  ]);
  assert.doesNotMatch(JSON.stringify(capturedWindows), /Secret Live Window|Users|AppData|process:/);
});
