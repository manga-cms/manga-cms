import { mkdirSync, rmSync, statSync } from "node:fs";
import { dirname } from "node:path";

export interface FileLockOptions {
    timeoutMs?: number;
    staleMs?: number;
}

function sleepSync(ms: number): void {
    const view = new Int32Array(new SharedArrayBuffer(4));
    Atomics.wait(view, 0, 0, ms);
}

export function withFileLock<T>(
    targetFilePath: string,
    fn: () => T,
    options: FileLockOptions = {},
): T {
    const timeoutMs = options.timeoutMs ?? 5000;
    const staleMs = options.staleMs ?? 30000;
    const lockPath = `${targetFilePath}.lock`;
    const start = Date.now();
    mkdirSync(dirname(targetFilePath), { recursive: true });

    while (true) {
        try {
            mkdirSync(lockPath);
            break;
        } catch (error) {
            const code = (error as NodeJS.ErrnoException).code;
            if (code !== "EEXIST") throw error;

            try {
                const ageMs = Date.now() - statSync(lockPath).mtimeMs;
                if (ageMs > staleMs) {
                    rmSync(lockPath, { recursive: true, force: true });
                    continue;
                }
            } catch {
                continue;
            }

            if (Date.now() - start > timeoutMs) {
                throw new Error(`Timed out waiting for file lock: ${lockPath}`);
            }
            sleepSync(25);
        }
    }

    try {
        return fn();
    } finally {
        rmSync(lockPath, { recursive: true, force: true });
    }
}
