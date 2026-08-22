// Guards the package manifest against the publish-time normalizer.
//
// npm 11 silently DELETES any `bin` entry whose value starts with "./". The
// package still packs, installs and tests fine; it just ships with no binaries,
// so `npx orchestkit` resolves to nothing. Measured on npm 11.19.0:
//
//   {"x":"./dist/cli.js"}                    -> 1 entry stripped
//   {"x":"./dist/cli.js","ork":"./dist/..."} -> 2 entries stripped
//   {"x":"dist/cli.js"}                      -> 0 stripped
//   {"x":"dist/cli.js","ork":"dist/cli.js"}  -> 0 stripped
//   "./dist/cli.js" (string form)            -> 1 stripped
//
// The trap is that NOTHING local catches it. `npm pack` keeps the field intact
// in the tarball, our spawn tests run ./dist/cli.js directly, and CI never
// publishes. Only `npm publish` (even --dry-run) prints the warning, and only as
// a `npm warn`, so a successful publish would have exited 0 with no binaries.

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const pkg = JSON.parse(
	readFileSync(resolve(__dirname, "../package.json"), "utf8"),
) as {
	name: string;
	bin?: Record<string, string>;
	files?: string[];
	engines?: { node?: string };
};

describe("bin entries survive npm's publish-time normalizer", () => {
	it("declares both binaries", () => {
		expect(Object.keys(pkg.bin ?? {}).sort()).toEqual(["orchestkit", "ork"]);
	});

	it("no bin value starts with ./ (npm 11 deletes those on publish)", () => {
		for (const [name, target] of Object.entries(pkg.bin ?? {})) {
			expect(
				target.startsWith("./"),
				`bin["${name}"] = "${target}" would be stripped at publish; drop the leading "./"`,
			).toBe(false);
		}
	});

	it("no bin value is absolute or escapes the package", () => {
		for (const [name, target] of Object.entries(pkg.bin ?? {})) {
			expect(target.startsWith("/"), `bin["${name}"] is absolute`).toBe(false);
			expect(target.includes(".."), `bin["${name}"] escapes the package`).toBe(false);
		}
	});

	it("every bin target is inside a published directory", () => {
		// A bin pointing outside `files` publishes a manifest whose binary is
		// absent from the tarball: install succeeds, the command does not exist.
		for (const [name, target] of Object.entries(pkg.bin ?? {})) {
			const top = target.split("/")[0] as string;
			expect(pkg.files ?? [], `bin["${name}"] target not in files[]`).toContain(top);
		}
	});

	it("every bin target exists once the package is built", () => {
		const dist = resolve(__dirname, "../dist");
		if (!existsSync(dist)) return; // unbuilt tree; the build test covers this
		for (const [name, target] of Object.entries(pkg.bin ?? {})) {
			expect(
				existsSync(resolve(__dirname, "..", target)),
				`bin["${name}"] -> ${target} missing from a built tree`,
			).toBe(true);
		}
	});

	it("the built binary keeps its shebang", () => {
		const cli = resolve(__dirname, "../dist/cli.js");
		if (!existsSync(cli)) return;
		expect(readFileSync(cli, "utf8").startsWith("#!/usr/bin/env node")).toBe(true);
	});
});
