export interface GcloudResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export async function gcloud(args: string[]): Promise<GcloudResult> {
  const proc = Bun.spawn(["gcloud", ...args], {
    stdout: "pipe",
    stderr: "pipe",
  });

  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();
  const exitCode = await proc.exited;

  if (exitCode !== 0) {
    throw new GcloudError(args, exitCode, stderr.trim());
  }

  return { stdout: stdout.trim(), stderr: stderr.trim(), exitCode };
}

export async function gcloudJson<T = unknown>(args: string[]): Promise<T> {
  const result = await gcloud([...args, "--format=json"]);
  return JSON.parse(result.stdout) as T;
}

export async function gcloudInteractive(args: string[]): Promise<number> {
  const proc = Bun.spawn(["gcloud", ...args], {
    stdout: "inherit",
    stderr: "inherit",
    stdin: "inherit",
  });
  return proc.exited;
}

export async function checkGcloud(): Promise<boolean> {
  try {
    const proc = Bun.spawn(["gcloud", "version"], {
      stdout: "pipe",
      stderr: "pipe",
    });
    await proc.exited;
    return true;
  } catch {
    return false;
  }
}

export class GcloudError extends Error {
  constructor(
    public args: string[],
    public exitCode: number,
    public stderr: string,
  ) {
    super(`gcloud ${args.join(" ")} failed (exit ${exitCode}): ${stderr}`);
    this.name = "GcloudError";
  }
}
