import { readFileSync } from 'fs';
import { resolve } from 'path';
import { PluginBus } from '@forge/core';
import { createPluginContext } from '@forge/core';
import { ConfigPlugin } from '@forge/config-plugin';
import { LoggerPlugin } from '@forge/logger-plugin';
import { ApiGatewayPlugin } from '@forge/api-gateway-plugin';
import type { ForgePlugin, PluginContext } from '@forge/spec';

export interface ForgeJson {
  name: string;
  plugins: { name: string; source: string; enabled: boolean }[];
  globalConfig: Record<string, unknown>;
}

export async function buildApp(forgeJsonPath: string) {
  // 1. Load forge.json
  const forgeJson: ForgeJson = JSON.parse(readFileSync(forgeJsonPath, 'utf-8'));

  // 2. Instantiate core plugins (hardcoded for Phase 1)
  //   In Phase 2+, this will be dynamic via PluginLoader + PluginRegistry
  const configPlugin = new ConfigPlugin(forgeJson.globalConfig);
  const loggerPlugin = new LoggerPlugin();
  const apiGatewayPlugin = new ApiGatewayPlugin();

  // 3. Wire plugin context (config gets logger; all three get bus)
  const bus = new PluginBus();

  const allPlugins: ForgePlugin[] = [configPlugin, loggerPlugin, apiGatewayPlugin];

  const ctx: PluginContext = {
    config: configPlugin as unknown as import('@forge/spec').ConfigPluginAPI,
    logger: loggerPlugin as unknown as import('@forge/spec').LoggerPluginAPI,
    bus: bus as unknown as import('@forge/spec').PluginBusAPI,
  };

  // 4. Register routes from api-gateway's built-in routes
  //   (Other plugins' routes would be registered here in future phases)

  // 5. Init in order: config → logger → api-gateway
  for (const plugin of allPlugins) {
    await plugin.init(ctx);
  }

  // 6. Start in order: config → logger → api-gateway
  for (const plugin of allPlugins) {
    await plugin.start();
  }

  loggerPlugin.info('ForgeKit app started', { app: forgeJson.name, plugins: allPlugins.map(p => p.name) });
  bus.emit('forge:ready', { app: forgeJson.name });

  return {
    bus,
    ctx,
    plugins: allPlugins,
    async stop() {
      bus.emit('forge:stopping', {});
      // Stop in reverse order
      for (const plugin of [...allPlugins].reverse()) {
        await plugin.stop();
      }
      bus.emit('forge:stopped', {});
    },
  };
}
