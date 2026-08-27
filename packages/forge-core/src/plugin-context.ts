import type { PluginContext, ConfigPluginAPI, LoggerPluginAPI, PluginBusAPI } from '@forge/spec';

export interface PluginContextOptions {
  configAPI: ConfigPluginAPI;
  loggerAPI: LoggerPluginAPI;
  busAPI: PluginBusAPI;
}

export function createPluginContext(opts: PluginContextOptions): PluginContext {
  return {
    config: opts.configAPI,
    logger: opts.loggerAPI,
    bus: opts.busAPI,
  };
}
