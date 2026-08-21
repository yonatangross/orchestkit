// Bin entry. Owns argv, the streams and the exit code; all behavior lives in
// cli-core.ts so it can be tested without spawning a process.
import { readFileSync } from "node:fs";
import { run } from "./cli-core.js";

function packageVersion(): string {
	try {
		const url = new URL("../package.json", import.meta.url);
		const pkg = JSON.parse(readFileSync(url, "utf8")) as { version?: string };
		return pkg.version ?? "0.0.0";
	} catch {
		return "0.0.0";
	}
}

const result = await run(process.argv.slice(2), { version: packageVersion() });
if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
process.exitCode = result.exitCode;
