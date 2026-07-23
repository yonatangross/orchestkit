// See all configuration options: https://remotion.dev/docs/config
// Each option also is available as a CLI flag: https://remotion.dev/docs/cli

// Note: When using the Node.JS APIs, the config file doesn't apply. Instead, pass options directly to the APIs

import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
// setExperimentalClientSideRenderingEnabled was removed upstream between
// remotion 4.0.484 and 4.0.489. Dependabot's npm-minor-patch group bumped past
// it in #2860 (2026-07-13), and because the config calls it at module load,
// EVERY render died instantly — 27 consecutive releases shipped no video before
// anyone noticed, since release-video.yml only runs after a release is already
// published. There is no replacement API: 4.0.494 exposes 93 Config keys and
// none of them is a client-side-rendering flag. The call is simply dropped.
