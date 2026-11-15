// Tag every plugin's own version line in the serialized PLUGINS array with the
// release-please marker, so the generic updater bumps each plugin in place.
// Only top-level plugin keys (4-space indent inside the array) are tagged; a
// nested "version" key deeper in a plugin object is left alone.
const MARKER = '// x-release-please-version';

function tagPluginVersions(pluginsJson) {
  return pluginsJson.replace(
    /^( {4}"version": "[^"]+"),$/gm,
    (_line, head) => `${head}, ${MARKER}`,
  );
}

module.exports = { MARKER, tagPluginVersions };
