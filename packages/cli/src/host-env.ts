// The real machine's HostEnv: this process's environment and its PATH. Kept
// apart from hosts.ts so detection logic stays pure and testable; only the bin
// (src/cli.ts) builds this.
import { accessSync, constants } from "node:fs";
import { delimiter, join } from "node:path";
import type { HostEnv } from "./hosts.js";

export function realHostEnv(env: NodeJS.ProcessEnv = process.env): HostEnv {
	const dirs = (env.PATH ?? "").split(delimiter).filter(Boolean);
	const exts = process.platform === "win32" ? (env.PATHEXT ?? ".EXE;.CMD;.BAT").split(";") : [""];
	return {
		env,
		hasBin: (bin) =>
			dirs.some((dir) =>
				exts.some((ext) => {
					try {
						accessSync(join(dir, bin + ext), constants.X_OK);
						return true;
					} catch {
						return false;
					}
				}),
			),
	};
}
