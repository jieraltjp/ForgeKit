import type { LoggerPluginAPI } from '@forge/spec';
import { ForgeError, ForgeErrors } from '@forge/spec';

export interface PluginManifest {
  name: string;
  version: string;
  entry: string;
  dependencies: string[];
  provides: string[];
  events: string[];
}

export class PluginLoader {
  constructor(private basePath: string) {}

  async loadPlugin(manifest: PluginManifest): Promise<import('@forge/spec').ForgePlugin> {
    try {
      const mod = await import(manifest.entry);
      const factory = mod.default ?? mod.createPlugin;
      if (typeof factory !== 'function') {
        throw new ForgeError(
          ForgeErrors.PLUGIN_LOAD_FAILED,
          `Plugin "${manifest.name}" entry does not export a factory function (default or createPlugin)`,
        );
      }
      try {
        return factory({} as LoggerPluginAPI);
      } catch (e) {
        throw new ForgeError(ForgeErrors.PLUGIN_INIT_FAILED, `Plugin "${manifest.name}" init failed: ${String(e)}`, manifest.name, e);
      }
    } catch (e) {
      if (e instanceof ForgeError) throw e;
      throw new ForgeError(ForgeErrors.PLUGIN_LOAD_FAILED, `Failed to load plugin "${manifest.name}": ${String(e)}`, manifest.name, e);
    }
  }

  async loadAll(manifests: PluginManifest[]): Promise<import('@forge/spec').ForgePlugin[]> {
    const plugins: import('@forge/spec').ForgePlugin[] = [];
    for (const manifest of manifests) {
      plugins.push(await this.loadPlugin(manifest));
    }
    return plugins;
  }
}
