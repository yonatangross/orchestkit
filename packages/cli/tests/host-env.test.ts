import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { realHostEnv } from "../src/host-env.js";
import { detectHosts } from "../src/hosts.js";

const windows = process.platform === "win32";
const binName = windows ? "claude.exe" : "claude";

describe("host detection on PATH", () => {
	let dir: string;

	beforeEach(() => {
		dir = mkdtempSync(join(tmpdir(), "orchestkit-host-env-"));
	});

	afterEach(() => {
		rmSync(dir, { recursive: true, force: true });
	});

	function detect(path = dir) {
		return detectHosts(realHostEnv({ PATH: path, PATHEXT: ".exe" }));
	}

	it("ignores a directory named after a host binary", () => {
		mkdirSync(join(dir, binName), { mode: 0o755 });
		expect(detect()).toEqual([]);
	});

	it("detects an executable file in a later PATH entry", () => {
		mkdirSync(join(dir, binName), { mode: 0o755 });
		const later = join(dir, "later");
		mkdirSync(later);
		writeFileSync(join(later, binName), "", { mode: 0o755 });
		expect(detect([dir, later].join(delimiter))).toEqual(["claude"]);
	});

	it.skipIf(windows)("ignores a regular file without execute permission", () => {
		writeFileSync(join(dir, binName), "", { mode: 0o644 });
		expect(detect()).toEqual([]);
	});

	it.skipIf(windows)("detects a symlink to an executable file", () => {
		writeFileSync(join(dir, "actual-command"), "", { mode: 0o755 });
		symlinkSync("actual-command", join(dir, binName));
		expect(detect()).toEqual(["claude"]);
	});

	it.skipIf(windows)("ignores a symlink to a directory", () => {
		mkdirSync(join(dir, "target"), { mode: 0o755 });
		symlinkSync("target", join(dir, binName));
		expect(detect()).toEqual([]);
	});
});
