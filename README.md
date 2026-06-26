# Desktop Command Observer

Windows desktop context observer for faster computer-use agents.

The first version does one narrow job: keep the agent from repeatedly
rediscovering which windows are open, where they are, and which one is active.
It emits an initial desktop snapshot, then command-mode style patches when the
window topology changes.

## Run

```powershell
node .\bin\desktop-agent.ts snapshot
node .\bin\desktop-agent.ts watch --interval-ms 500
```

For a bounded smoke run:

```powershell
node .\bin\desktop-agent.ts watch --interval-ms 250 --limit 3
```

For the local Codex Computer Use plugin bridge, first capture an observer
snapshot and a sanitized Computer Use window list, then run:

```powershell
node .\scripts\computer-use-bridge.ts `
  --observer-file .\.omo\ulw-loop\evidence\observer-real.json `
  --computer-use-file .\.omo\ulw-loop\evidence\computer-use-real.json
```

The bridge matches by native window id and masks titles by default.

## Shape

```text
src/diff.ts             pure snapshot and patch logic
src/windowsObserver.ts  Windows EnumWindows adapter via PowerShell/Add-Type
src/cli.ts              CLI command parsing and JSON-line output
src/computerUseBridge.ts native id bridge for Codex Computer Use window data
bin/desktop-agent.ts    executable entrypoint
scripts/                bridge helper commands
tests/                  node:test coverage for pure behavior
```

This is intentionally not an LLM agent yet. It is the low-latency observation
layer an agent can subscribe to before deciding whether to use screenshots,
accessibility data, or direct input actions.
