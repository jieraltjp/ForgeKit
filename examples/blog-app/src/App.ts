import { readFileSync } from 'fs';
import { resolve } from 'path';
import { PluginBus } from '@forge/core';
import { PluginLoader, type ForgeJson } from '@forge/core';
import { ConfigPlugin } from '@forge/config-plugin';
import { LoggerPlugin } from '@forge/logger-plugin';
import { ApiGatewayPlugin } from '@forge/api-gateway-plugin';
import { DbPlugin } from '@forge/db-plugin';
import { AuthPlugin } from '@forge/auth-plugin';
import { EventsPlugin } from '@forge/events-plugin';
import { registerHandlers } from './handlers/index.js';
import type { ForgePlugin, PluginContext, ConfigPluginAPI, LoggerPluginAPI, PluginBusAPI } from '@forge/spec';

export async function buildApp(forgeJsonPath: string) {
  const forgeJson: ForgeJson = JSON.parse(readFileSync(forgeJsonPath, 'utf-8'));

  const appRoot = resolve(forgeJsonPath, '..');

  // Core plugins (always needed — not listed in forge.json)
  const configPlugin = new ConfigPlugin(forgeJson.globalConfig);
  const loggerPlugin = new LoggerPlugin();
  const bus = new PluginBus();
  const eventsPlugin = new EventsPlugin() as unknown as ForgePlugin;
  const dbPlugin = new DbPlugin();
  const authPlugin = new AuthPlugin();
  const apiGatewayPlugin = new ApiGatewayPlugin();

  // Loaded plugins from forge.json (may include duplicates of the above — deduplicate by name)
  const loader = new PluginLoader(appRoot);
  const loadedPlugins = await loader.loadAllFromForgeJson(forgeJson);

  const loadedNames = new Set(loadedPlugins.map(p => p.name));

  const corePlugins: ForgePlugin[] = [
    configPlugin, loggerPlugin, eventsPlugin, dbPlugin, authPlugin, apiGatewayPlugin,
  ].filter(p => !loadedNames.has(p.name));

  const allPlugins: ForgePlugin[] = [
    configPlugin, loggerPlugin, eventsPlugin, dbPlugin, authPlugin, apiGatewayPlugin,
    ...loadedPlugins,
  ];

  const ctx: PluginContext = {
    config: configPlugin as unknown as ConfigPluginAPI,
    logger: loggerPlugin as unknown as LoggerPluginAPI,
    bus: bus as unknown as PluginBusAPI,
  };

  // Wire db and auth into ctx
  (ctx as any).db = dbPlugin;
  (ctx as any).auth = authPlugin;

  for (const plugin of allPlugins) {
    await plugin.init(ctx);
  }

  // Register blog routes
  registerHandlers(apiGatewayPlugin, dbPlugin, authPlugin, bus);

  for (const plugin of allPlugins) {
    await plugin.start();
  }

  loggerPlugin.info('Blog app started', { plugins: allPlugins.map(p => p.name) });
  bus.emit('forge:ready', { app: forgeJson.name });

  return {
    bus, ctx, plugins: allPlugins,
    async stop() {
      bus.emit('forge:stopping', {});
      for (const plugin of [...allPlugins].reverse()) {
        await plugin.stop();
      }
      bus.emit('forge:stopped', {});
    },
  };
}
