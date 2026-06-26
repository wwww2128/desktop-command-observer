import { execFileSync } from "node:child_process";

import { type DesktopWindow, windowId } from "./diff.ts";

const WINDOWS_SCRIPT = String.raw`
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$OutputEncoding = [Console]::OutputEncoding

Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
using System.Text;

public static class NativeWindows {
    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

    [DllImport("user32.dll")]
    public static extern bool EnumWindows(EnumWindowsProc enumProc, IntPtr lParam);

    [DllImport("user32.dll")]
    public static extern bool IsWindowVisible(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern bool IsIconic(IntPtr hWnd);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern int GetWindowTextLength(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern IntPtr GetForegroundWindow();

    [DllImport("user32.dll")]
    public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);

    [DllImport("user32.dll")]
    public static extern bool GetWindowRect(IntPtr hWnd, out Rect rect);

    public struct Rect {
        public int Left;
        public int Top;
        public int Right;
        public int Bottom;
    }
}
"@

$activeHandle = [NativeWindows]::GetForegroundWindow().ToInt64()
$items = New-Object System.Collections.Generic.List[object]
$script:zOrder = 0

$callback = [NativeWindows+EnumWindowsProc]{
    param([IntPtr]$handle, [IntPtr]$lParam)

    if (-not [NativeWindows]::IsWindowVisible($handle)) {
        return $true
    }

    $titleLength = [NativeWindows]::GetWindowTextLength($handle)
    if ($titleLength -le 0) {
        return $true
    }

    $titleBuilder = New-Object System.Text.StringBuilder ($titleLength + 1)
    [void][NativeWindows]::GetWindowText($handle, $titleBuilder, $titleBuilder.Capacity)
    $title = $titleBuilder.ToString()
    if ([string]::IsNullOrWhiteSpace($title)) {
        return $true
    }

    $processId = 0
    [void][NativeWindows]::GetWindowThreadProcessId($handle, [ref]$processId)

    $rect = New-Object NativeWindows+Rect
    if (-not [NativeWindows]::GetWindowRect($handle, [ref]$rect)) {
        return $true
    }

    $width = $rect.Right - $rect.Left
    $height = $rect.Bottom - $rect.Top
    if ($width -le 0 -or $height -le 0) {
        return $true
    }

    $processName = ""
    try {
        $processName = (Get-Process -Id $processId -ErrorAction Stop).ProcessName
    } catch {
        $processName = ""
    }

    $items.Add([pscustomobject]@{
        id = $handle.ToInt64().ToString()
        title = $title
        app = $processName
        processId = [int]$processId
        bounds = [pscustomobject]@{
            x = $rect.Left
            y = $rect.Top
            width = $width
            height = $height
        }
        zOrder = $script:zOrder
        isActive = ($handle.ToInt64() -eq $activeHandle)
        isMinimized = [NativeWindows]::IsIconic($handle)
    }) | Out-Null

    $script:zOrder += 1
    return $true
}

[void][NativeWindows]::EnumWindows($callback, [IntPtr]::Zero)
ConvertTo-Json -InputObject @($items.ToArray()) -Compress -Depth 5
`;

type RawWindow = {
  readonly id: string;
  readonly title: string;
  readonly app: string;
  readonly processId: number;
  readonly bounds: {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  };
  readonly zOrder: number;
  readonly isActive: boolean;
  readonly isMinimized: boolean;
};

export function readWindows(): readonly DesktopWindow[] {
  const raw = execFileSync(
    "powershell.exe",
    ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", WINDOWS_SCRIPT],
    { encoding: "utf8", windowsHide: true },
  ).trim();

  if (raw.length === 0) {
    return [];
  }

  const parsed: unknown = JSON.parse(raw);
  const rows = parseRawWindows(parsed);
  return rows.map(normalizeWindow);
}

function parseRawWindows(value: unknown): readonly RawWindow[] {
  if (Array.isArray(value)) {
    return value.filter(isRawWindow);
  }
  if (isRawWindow(value)) {
    return [value];
  }
  throw new WindowsObserverParseError();
}

function isRawWindow(value: unknown): value is RawWindow {
  if (!isRecord(value)) {
    return false;
  }

  const bounds = value["bounds"];
  return (
    typeof value["id"] === "string" &&
    typeof value["title"] === "string" &&
    typeof value["app"] === "string" &&
    typeof value["processId"] === "number" &&
    typeof value["zOrder"] === "number" &&
    typeof value["isActive"] === "boolean" &&
    typeof value["isMinimized"] === "boolean" &&
    isRawBounds(bounds)
  );
}

function isRawBounds(value: unknown): value is RawWindow["bounds"] {
  return (
    isRecord(value) &&
    typeof value["x"] === "number" &&
    typeof value["y"] === "number" &&
    typeof value["width"] === "number" &&
    typeof value["height"] === "number"
  );
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null;
}

function normalizeWindow(row: RawWindow): DesktopWindow {
  return {
    id: windowId(row.id),
    title: row.title,
    app: row.app,
    processId: row.processId,
    bounds: {
      x: row.bounds.x,
      y: row.bounds.y,
      width: row.bounds.width,
      height: row.bounds.height,
    },
    zOrder: row.zOrder,
    isActive: row.isActive,
    isMinimized: row.isMinimized,
  };
}

export class WindowsObserverParseError extends Error {
  readonly name = "WindowsObserverParseError";

  constructor() {
    super("PowerShell window observer returned an unexpected JSON shape");
  }
}
