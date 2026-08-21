// The bin entry has to be executable AND carry a shebang. tsc emits neither, so
// this runs after every build. Without it `npx orchestkit` fails with EACCES on
// a fresh install, a failure that only appears once the package is published.
import { chmodSync, readFileSync, writeFileSync } from "node:fs";

const target = new URL("../dist/cli.js", import.meta.url);
const source = readFileSync(target, "utf8");
if (!source.startsWith("#!")) {
	writeFileSync(target, `#!/usr/bin/env node\n${source}`);
}
chmodSync(target, 0o755);
