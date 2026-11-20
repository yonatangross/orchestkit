export interface BandState {
  visible: boolean;
  collapsed: boolean;
  busy: boolean;
  original: string | null;
}
declare module "claude-code" {
  interface PluginState {
    "prompt-enhancer": { band: BandState };
  }
}
