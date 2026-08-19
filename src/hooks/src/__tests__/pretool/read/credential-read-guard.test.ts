// Behavioral coverage for the credential read guard.
//
// This hook shipped 2026-08-16 with ZERO tests. It is the only thing in the
// hook estate that stops a Read of ~/.ssh/id_rsa, and two of its hardest-won
// behaviours were asserted by nothing:
//
//   1. the macOS case-fold bypass — the source records ~/.SSH/id_rsa as
//      "verified as a live bypass before this branch was added, not a
//      theoretical one". On APFS it opens the same bytes as ~/.ssh/id_rsa.
//   2. dual lexical + realpath matching, so neither `..` traversal nor a
//      symlink pointing into the tree walks past the guard.
//
// Narrowing RULES or dropping the toLowerCase branch would have shipped green.
// Every DENY below is paired with an ALLOW that must not be swept up with it,
// so this suite cannot pass against a guard that simply denies everything.

import { describe, expect, it } from 'vitest';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { credentialReadGuard } from '../../../pretool/read/credential-read-guard.js';
import type { HookInput } from '../../../types.js';

const HOME = homedir();

const read = (file_path: string): HookInput =>
  ({ tool_name: 'Read', tool_input: { file_path } }) as unknown as HookInput;

const decisionOf = (file_path: string): string | undefined => {
  const r = credentialReadGuard(read(file_path)) as {
    hookSpecificOutput?: { permissionDecision?: string };
  };
  return r.hookSpecificOutput?.permissionDecision;
};

const isDenied = (file_path: string): boolean => decisionOf(file_path) === 'deny';

describe('credential-read-guard: the five guarded classes', () => {
  it.each([
    ['SSH private key', join(HOME, '.ssh', 'id_rsa')],
    ['SSH tree, any depth', join(HOME, '.ssh', 'nested', 'deep', 'key')],
    ['GPG keyring', join(HOME, '.gnupg', 'secring.gpg')],
    ['AWS credentials', join(HOME, '.aws', 'credentials')],
    ['netrc', join(HOME, '.netrc')],
    ['npmrc', join(HOME, '.npmrc')],
  ])('denies %s', (_label, p) => {
    expect(isDenied(p)).toBe(true);
  });

  it('expands a leading ~ before matching', () => {
    expect(isDenied('~/.ssh/id_rsa')).toBe(true);
    expect(isDenied('~/.netrc')).toBe(true);
  });

  it('denies a guarded path that does not exist on disk', () => {
    // resolveRealPath falls back to the lexical path, so a missing file
    // must not become an accidental allow.
    expect(isDenied(join(HOME, '.ssh', 'definitely-not-a-real-file-9c1f'))).toBe(true);
  });
});

describe('credential-read-guard: the bypasses it was written to close', () => {
  it('denies the macOS case-fold variant', () => {
    // The live bypass: on APFS this opens the same bytes as ~/.ssh/id_rsa.
    expect(isDenied(join(HOME, '.SSH', 'id_rsa'))).toBe(true);
    expect(isDenied(join(HOME, '.SSH', 'id_rsa').toUpperCase())).toBe(true);
  });

  it('denies .. traversal that lands back inside a guarded tree', () => {
    expect(isDenied(join(HOME, '.ssh', '..', '.ssh', 'id_rsa'))).toBe(true);
    expect(isDenied(`/tmp/..${join(HOME, '.ssh', 'id_rsa')}`)).toBe(true);
  });

  it('denies a mixed-case exact-file rule, not just the tree rules', () => {
    // .netrc and .npmrc are exact-match rules; the fold must apply to them too.
    expect(isDenied(join(HOME, '.NETRC'))).toBe(true);
    expect(isDenied(join(HOME, '.NpmRc'))).toBe(true);
  });
});

describe('credential-read-guard: what it must NOT sweep up', () => {
  // Paired negative controls. Without these, a guard that denied every Read
  // would pass every assertion above.
  it.each([
    ['AWS config, not credentials', join(HOME, '.aws', 'config')],
    ['a dotenv in home', join(HOME, '.env')],
    ['kube config', join(HOME, '.kube', 'config')],
    ['docker config', join(HOME, '.docker', 'config.json')],
    ['an ordinary home file', join(HOME, 'notes.md')],
  ])('allows %s', (_label, p) => {
    expect(decisionOf(p)).toBeUndefined();
  });

  it('does not match repo-local files that share a guarded basename', () => {
    // Every rule is anchored under homedir(), so a project .npmrc is fine.
    expect(decisionOf('/srv/project/.npmrc')).toBeUndefined();
    expect(decisionOf('/srv/project/ssh/id_rsa')).toBeUndefined();
    expect(decisionOf('/srv/project/.ssh/config')).toBeUndefined();
  });

  it('ignores tools that are not Read', () => {
    const r = credentialReadGuard({
      tool_name: 'Bash',
      tool_input: { command: `cat ${join(HOME, '.ssh', 'id_rsa')}` },
    } as unknown as HookInput) as { hookSpecificOutput?: { permissionDecision?: string } };
    // The Bash lane is sync-bash-dispatcher's job, not this hook's.
    expect(r.hookSpecificOutput?.permissionDecision).toBeUndefined();
  });

  it('passes through malformed input instead of failing closed', () => {
    expect(
      (credentialReadGuard({ tool_name: 'Read', tool_input: {} } as unknown as HookInput) as {
        hookSpecificOutput?: { permissionDecision?: string };
      }).hookSpecificOutput?.permissionDecision
    ).toBeUndefined();
  });
});

describe('credential-read-guard: the deny reason is actionable', () => {
  it('names the credential class and says rewriting the path will not help', () => {
    const r = credentialReadGuard(read(join(HOME, '.ssh', 'id_rsa'))) as {
      hookSpecificOutput?: { permissionDecisionReason?: string };
    };
    const reason = r.hookSpecificOutput?.permissionDecisionReason ?? '';
    expect(reason).toContain('SSH private keys');
    expect(reason).toContain('rewriting the path will not change the answer');
  });
});
