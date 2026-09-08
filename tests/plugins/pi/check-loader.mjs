// Run pi's OWN resolver against this tree. Only runs when pi is installed.
//
// Two pi entry points, because they can disagree and each failure is silent on
// its own: DefaultPackageManager.collectPackageResources is the `pi install`
// path (which files pi registers, i.e. what `pi list` shows) and
// loadSkillsFromDir is the parser (which of those files becomes a skill the
// model can see). A file that registers but does not parse is invisible with no
// error; a diagnostic-free load of the wrong count is the #4001 bug itself.
//
// Env: PI_PKG (pi package root), REPO (repo root), EXPECTED (skill count).

const pi = process.env.PI_PKG;
const repo = process.env.REPO;
const expected = Number(process.env.EXPECTED);

const { DefaultPackageManager } = await import(`${pi}/dist/core/package-manager.js`);
const { loadSkillsFromDir } = await import(`${pi}/dist/core/skills.js`);
const { readPiManifest } = await import(`${pi}/dist/core/pi-manifest.js`);

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exit(1);
}

const manifest = readPiManifest(`${repo}/package.json`);
if (!manifest || !Array.isArray(manifest.skills)) {
  fail("pi's own readPiManifest returned no skills for this package root");
}

// settingsManager is unused on this code path; collectPackageResources reads
// only the package root and the accumulator.
const pm = new DefaultPackageManager({ cwd: repo, agentDir: repo, settingsManager: {} });
const acc = {
  extensions: new Map(),
  skills: new Map(),
  prompts: new Map(),
  themes: new Map(),
};
const resolved = pm.collectPackageResources(repo, acc, undefined, {
  source: "git",
  scope: "user",
  origin: "package",
  baseDir: repo,
});

if (!resolved) {
  fail("pi resolved 0 resources from this package root");
}
if (acc.skills.size !== expected) {
  fail(`pi registered ${acc.skills.size} skill files, tree has ${expected}`);
}

for (const entry of manifest.skills.filter((e) => !/^[!+-]/.test(e))) {
  const result = loadSkillsFromDir({ dir: `${repo}/${entry}`, source: "path" });
  if (result.diagnostics.length > 0) {
    console.error(JSON.stringify(result.diagnostics.slice(0, 5), null, 2));
    fail(`${entry} produced ${result.diagnostics.length} pi diagnostics`);
  }
  if (result.skills.length !== expected) {
    fail(`${entry} parsed ${result.skills.length} skills, tree has ${expected}`);
  }
}
