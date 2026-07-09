# Computer Use Observer Layer

An unofficial observer layer for OpenAI Computer Use that tracks Windows desktop
context, focus, bounds, and state changes.

The first version does one narrow job: keep the agent from repeatedly
rediscovering which windows are open, where they are, and which one is active.
It emits an initial desktop snapshot, then command-mode style patches when the
window topology changes. It is a companion layer, not a replacement for the
official Computer Use plugin.

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
snapshot and a sanitized Computer Use window list. In a host that already
exposes the active Computer Use `sky` runtime, use the importable runtime shim:

```javascript
import { writeComputerUseCaptureFromSky } from "./scripts/capture-active-computer-use-runtime.mjs";

await writeComputerUseCaptureFromSky({
  sky,
  outFile: "./.omo/ulw-loop/evidence/computer-use-live.json",
});
```

If the host can import TypeScript directly, the typed provider API is:

```typescript
import {
  captureComputerUseWindows,
  createComputerUseWindowLister,
} from "./src/computerUseCapture.ts";

const windows = await captureComputerUseWindows(
  createComputerUseWindowLister(sky),
);
```

If the host exports raw `list_windows()` JSON, sanitize it through the CLI:

```powershell
node .\scripts\capture-computer-use-windows.ts `
  --input-file .\.omo\ulw-loop\evidence\computer-use-raw.private.json `
  --out-file .\.omo\ulw-loop\evidence\computer-use-live.json
```

Then compare both surfaces:

```powershell
node .\scripts\computer-use-bridge.ts `
  --observer-file .\.omo\ulw-loop\evidence\observer-real.json `
  --computer-use-file .\.omo\ulw-loop\evidence\computer-use-live.json
```

To emit one integrated agent context, including shared target windows ranked by
active/frontmost/minimized state:

```powershell
node .\scripts\agent-context.ts `
  --observer-file .\.omo\ulw-loop\evidence\observer-real.json `
  --computer-use-file .\.omo\ulw-loop\evidence\computer-use-live.json
```

To stream that context as JSON Lines for an agent loop:

```powershell
npm run context:watch -- `
  --observer-file .\.omo\ulw-loop\evidence\observer-real.json `
  --computer-use-file .\.omo\ulw-loop\evidence\computer-use-live.json `
  --interval-ms 500
```

When running inside a Codex host that exposes the active Computer Use `sky`
runtime, stream live observer and Computer Use context directly:

```powershell
npm run context:live -- --interval-ms 500 --limit 5
```

The capture step stores only native window ids, basename app labels, and whether
a title existed. The bridge matches by native window id and masks titles by
default.

## CI

GitHub Actions runs `npm test` on every push and pull request to `main` using
Node.js 24.

## License

MIT. This permits reuse, modification, distribution, and private or commercial
use, as long as the copyright and license notice are preserved. The software is
provided without warranty.

## Shape

```text
src/diff.ts             pure snapshot and patch logic
src/windowsObserver.ts  Windows EnumWindows adapter via PowerShell/Add-Type
src/cli.ts              CLI command parsing and JSON-line output
src/computerUseBridge.ts native id bridge for Codex Computer Use window data
src/agentContext.ts     integrated observer and Computer Use context output
src/liveAgentContext.ts live agent context stream core
bin/desktop-agent.ts    executable entrypoint
scripts/                bridge helper commands
tests/                  node:test coverage for pure behavior
```

This is intentionally not an LLM agent yet. It is the low-latency observation
layer an agent can subscribe to before deciding whether to use screenshots,
accessibility data, or direct input actions.
