import { setTimeout as delay } from "node:timers/promises";

import {
  buildAgentContextReport,
  type AgentContextReport,
} from "./agentContext.ts";
import type { ComputerUseWindow } from "./computerUseBridge.ts";
import { createSnapshot, type DesktopWindow } from "./diff.ts";

export type LiveAgentContextProvider = {
  readonly readObserverWindows: () => readonly DesktopWindow[];
  readonly captureComputerUseWindows: () => Promise<readonly ComputerUseWindow[]>;
};

export type LiveAgentContextWatchInput = {
  readonly provider: LiveAgentContextProvider;
  readonly intervalMs: number;
  readonly limit: number | null;
  readonly writeLine: (line: string) => void;
  readonly wait?: (intervalMs: number) => Promise<void>;
};

export async function readLiveAgentContextReport(
  provider: LiveAgentContextProvider,
): Promise<AgentContextReport> {
  const observerSnapshot = createSnapshot(provider.readObserverWindows());
  const computerUseWindows = await provider.captureComputerUseWindows();
  return buildAgentContextReport(observerSnapshot, computerUseWindows);
}

export async function watchLiveAgentContext(
  input: LiveAgentContextWatchInput,
): Promise<void> {
  const wait = input.wait ?? delay;
  let emittedReports = 0;
  while (input.limit === null || emittedReports < input.limit) {
    input.writeLine(JSON.stringify(await readLiveAgentContextReport(input.provider)));
    emittedReports += 1;

    if (input.limit !== null && emittedReports >= input.limit) {
      return;
    }
    await wait(input.intervalMs);
  }
}
