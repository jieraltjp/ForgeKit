// Lifecycle events (emitted by forge-core)
export const CoreEvents = {
  FORGE_INIT: 'forge:init',
  FORGE_READY: 'forge:ready',
  FORGE_STOPPING: 'forge:stopping',
  FORGE_STOPPED: 'forge:stopped',
  PLUGIN_INIT: 'plugin:init',
  PLUGIN_STARTED: 'plugin:started',
  PLUGIN_STOPPED: 'plugin:stopped',
  PLUGIN_ERROR: 'plugin:error',
} as const;

// Lifecycle event payload types
export interface PluginLifecyclePayload {
  plugin: string;
  version: string;
  duration?: number;
  error?: string;
}
