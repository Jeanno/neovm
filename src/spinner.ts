const FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
const INTERVAL_MS = 80;
const HIDE = "\x1B[?25l";
const SHOW = "\x1B[?25h";
const CLEAR = "\r\x1B[2K";

export interface Spinner {
  stop(finalMsg?: string, ok?: boolean): void;
}

const active = new Set<{ timer: Timer }>();
let exitHookInstalled = false;

function installExitHook() {
  if (exitHookInstalled) return;
  exitHookInstalled = true;
  const cleanup = () => {
    for (const s of active) clearInterval(s.timer);
    active.clear();
    if (process.stdout.isTTY) process.stdout.write(CLEAR + SHOW);
  };
  process.on("exit", cleanup);
  for (const sig of ["SIGINT", "SIGTERM", "SIGHUP"] as const) {
    process.on(sig, () => {
      cleanup();
      process.exit(1);
    });
  }
}

export function spinner(label: string): Spinner {
  if (!process.stdout.isTTY) {
    console.log(label + "…");
    return {
      stop(finalMsg?: string) {
        if (finalMsg) console.log(finalMsg);
      },
    };
  }

  installExitHook();
  let i = 0;
  process.stdout.write(HIDE);
  const render = () => {
    const frame = FRAMES[i = (i + 1) % FRAMES.length];
    process.stdout.write(`${CLEAR}${frame} ${label}`);
  };
  render();
  const entry = { timer: setInterval(render, INTERVAL_MS) };
  active.add(entry);

  return {
    stop(finalMsg?: string, ok = true) {
      clearInterval(entry.timer);
      active.delete(entry);
      process.stdout.write(CLEAR + SHOW);
      if (finalMsg) console.log(`${ok ? "✓" : "✗"} ${finalMsg}`);
    },
  };
}

export async function withSpinner<T>(
  label: string,
  successMsg: string,
  failMsg: string,
  fn: () => Promise<T>,
): Promise<T> {
  const spin = spinner(label);
  try {
    const result = await fn();
    spin.stop(successMsg);
    return result;
  } catch (err) {
    spin.stop(failMsg, false);
    throw err;
  }
}
