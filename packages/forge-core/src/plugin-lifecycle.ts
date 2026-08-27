import type { ForgePlugin, PluginContext, HealthStatus } from '@forge/spec';
import { ForgeError, ForgeErrors } from '@forge/spec';
import type { LoggerPluginAPI } from '@forge/spec';

export class PluginLifecycle {
  private initialized = new Set<string>();

  constructor(
    private bus: import('./plugin-bus.js').PluginBus,
    private logger: LoggerPluginAPI,
  ) {}

  async init(plugins: ForgePlugin[], ctx: PluginContext): Promise<void> {
    for (const plugin of plugins) {
      if (this.initialized.has(plugin.name)) {
        throw new ForgeError(ForgeErrors.PLUGIN_INIT_FAILED, 'Plugin already initialized', plugin.name);
      }
      const start = Date.now();
      try {
        await plugin.init(ctx);
        this.initialized.add(plugin.name);
        this.bus.emit('plugin:init', { plugin: plugin.name, version: plugin.version, duration: Date.now() - start });
      } catch (e) {
        this.bus.emit('plugin:error', { plugin: plugin.name, version: plugin.version, error: String(e) });
        throw new ForgeError(ForgeErrors.PLUGIN_INIT_FAILED, `Plugin "${plugin.name}" init failed: ${String(e)}`, plugin.name, e);
      }
    }
  }

  async start(plugins: ForgePlugin[]): Promise<void> {
    for (const plugin of plugins) {
      const start = Date.now();
      try {
        await plugin.start();
        this.bus.emit('plugin:started', { plugin: plugin.name, version: plugin.version, duration: Date.now() - start });
      } catch (e) {
        this.bus.emit('plugin:error', { plugin: plugin.name, version: plugin.version, error: String(e) });
        throw new ForgeError(ForgeErrors.PLUGIN_START_FAILED, `Plugin "${plugin.name}" start failed: ${String(e)}`, plugin.name, e);
      }
    }
  }

  async stop(plugins: ForgePlugin[]): Promise<void> {
    for (const plugin of [...plugins].reverse()) {
      const start = Date.now();
      try {
        await plugin.stop();
        this.bus.emit('plugin:stopped', { plugin: plugin.name, version: plugin.version, duration: Date.now() - start });
      } catch (e) {
        this.bus.emit('plugin:error', { plugin: plugin.name, version: plugin.version, error: String(e) });
        throw new ForgeError(ForgeErrors.PLUGIN_STOP_FAILED, `Plugin "${plugin.name}" stop failed: ${String(e)}`, plugin.name, e);
      }
    }
  }

  async runHealthChecks(plugins: ForgePlugin[]): Promise<Map<string, HealthStatus>> {
    const results = new Map<string, HealthStatus>();
    await Promise.all(
      plugins.map(async (plugin) => {
        try {
          results.set(plugin.name, await plugin.healthCheck());
        } catch (e) {
          results.set(plugin.name, {
            status: 'unhealthy',
            plugin: plugin.name,
            version: plugin.version,
            uptime: 0,
          });
        }
      }),
    );
    return results;
  }

  async execute(plugins: ForgePlugin[], ctx: PluginContext): Promise<void> {
    await this.init(plugins, ctx);
    await this.start(plugins);

    const stop = async () => {
      await this.stop(plugins);
    };
    process.once('SIGINT', stop);
    process.once('SIGTERM', stop);
  }
}
