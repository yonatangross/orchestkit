// #4770 test fixture, loaded with `node --import`. It reproduces a stdin file
// that grows between run-hook.mjs's fstatSync(0) and its readFileSync(0): the
// first fstatSync(0) call returns the real (small) stat, then the file named by
// ORK_TEST_GROW_STDIN_PATH is rewritten in place (same inode, so fd 0 sees it)
// with a valid JSON tool call over 600KB. Without that env var it does nothing,
// which is the control. Only the first fd-0 call grows the file.
import fs from 'node:fs';
import module from 'node:module';

const growPath = process.env.ORK_TEST_GROW_STDIN_PATH;

if (growPath) {
  const realFstatSync = fs.fstatSync;
  let grown = false;
  fs.fstatSync = function growAfterStat(fd, ...rest) {
    const stat = realFstatSync.call(this, fd, ...rest);
    if (fd === 0 && !grown) {
      grown = true;
      const padding = 'x'.repeat(600 * 1024);
      // writeFileSync on the path truncates and rewrites the same inode.
      fs.writeFileSync(
        growPath,
        JSON.stringify({ tool_name: 'Bash', tool_input: { command: 'echo hi', padding } }),
      );
    }
    return stat;
  };
  // run-hook.mjs uses the named import `fstatSync` from 'node:fs'; this refreshes
  // that live binding to the wrapper above.
  module.syncBuiltinESMExports();
}
