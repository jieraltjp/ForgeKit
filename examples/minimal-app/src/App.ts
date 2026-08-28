import { readFileSync } from 'fs';
import { resolve } from 'path';
import { PluginBus } from '@forge/core';
import { PluginLoader, type ForgeJson } from '@forge/core';
import { ConfigPlugin } from '@forge/config-plugin';
import { LoggerPlugin } from '@forge/logger-plugin';
import { HotReloadManager } from './hot-reload.js';
import type { ForgePlugin, PluginContext, ConfigPluginAPI, LoggerPluginAPI, PluginBusAPI } from '@forge/spec';

export interface AppHandle {
  bus: PluginBusAPI;
  ctx: PluginContext;
  plugins: ForgePlugin[];
  stop(): Promise<void>;
  hotReload?: HotReloadManager;
}

export interface BuildAppOptions {
  hotReload?: boolean;
}

export async function buildApp(
  forgeJsonPath: string,
  options: BuildAppOptions = {}
): Promise<AppHandle> {
  // 1. Load forge.json
  const forgeJson: ForgeJson = JSON.parse(readFileSync(forgeJsonPath, 'utf-8'));

  // 2. Load all plugins via PluginLoader
  const appRoot = resolve(forgeJsonPath, '..');
  const loader = new PluginLoader(appRoot);
  const plugins = await loader.loadAllFromForgeJson(forgeJson);

  // 3. Core plugins always available (even if not in forge.json for backwards compat)
  const configPlugin = new ConfigPlugin(forgeJson.globalConfig);
  const loggerPlugin = new LoggerPlugin();
  const bus = new PluginBus();

  // Prepend core plugins (they are always required)
  const allPlugins: ForgePlugin[] = [configPlugin, loggerPlugin, ...plugins];

  const ctx: PluginContext = {
    config: configPlugin as unknown as ConfigPluginAPI,
    logger: loggerPlugin as unknown as LoggerPluginAPI,
    bus: bus as unknown as PluginBusAPI,
  };

  // 4. Init all plugins
  for (const plugin of allPlugins) {
    await plugin.init(ctx);
  }

  // 5. Start all plugins
  for (const plugin of allPlugins) {
    await plugin.start();
  }

  loggerPlugin.info('ForgeKit app started', {
    app: forgeJson.name,
    plugins: allPlugins.map(p => p.name),
  });

  bus.emit('forge:ready', { app: forgeJson.name });

  let hotReload: HotReloadManager | undefined;
  const enableHotReload = options.hotReload ?? false;

  if (enableHotReload) {
    hotReload = new HotReloadManager(appRoot, loader, bus, {
      debounceMs: 500,
      emitOnBus: true,
    });

    // Subscribe to plugin:reloaded to re-wire routes
    bus.on('plugin:reloaded', async (payload: unknown) => {
      const { plugin } = payload as { plugin: string; appRoot: string };
      console.log(`[App] plugin:reloaded — ${plugin}, re-initializing...`);
      // TODO: use PluginRegistry to swap out old plugin instance
    });

    hotReload.start();
  }

  return {
    bus,
    ctx,
    plugins: allPlugins,
    hotReload,
    async stop() {
      bus.emit('forge:stopping', {});
      await hotReload?.stop();
      for (const plugin of [...allPlugins].reverse()) {
        await plugin.stop();
      }
      bus.emit('forge:stopped', {});
    },
  };
}
