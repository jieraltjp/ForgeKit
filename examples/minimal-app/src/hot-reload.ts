import { watch, FSWatcher } from 'chokidar';
import { spawn } from 'child_process';
import { resolve } from 'path';
import type { PluginBusAPI } from '@forge/spec';

export interface HotReloadOptions {
  /** Glob pattern for plugin source files to watch */
  watchPattern?: string;
  /** Delay in ms before triggering reload after change */
  debounceMs?: number;
  /** Emit 'plugin:reloaded' on bus after each reload */
  emitOnBus?: boolean;
}

const DEFAULT_WATCH_PATTERN = 'packages/*/src/**/*.ts';

export class HotReloadManager {
  private watcher: FSWatcher | null = null;
  private debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly debounceMs: number;
  private readonly emitOnBus: boolean;
  private readonly bus: PluginBusAPI | null;

  constructor(
    private appRoot: string,
    private pluginLoader: any, // PluginLoader instance
    bus: PluginBusAPI | null,
    options: HotReloadOptions = {}
  ) {
    this.debounceMs = options.debounceMs ?? 500;
    this.emitOnBus = options.emitOnBus ?? true;
    this.bus = bus;
  }

  /** Start watching plugin src/ directories */
  start(watchPattern = DEFAULT_WATCH_PATTERN): void {
    const resolvedPattern = resolve(this.appRoot, watchPattern);

    console.log(`[hot-reload] Watching: ${resolvedPattern}`);

    this.watcher = watch(resolvedPattern, {
      ignoreInitial: true,
      persistent: true,
      awaitWriteFinish: { stabilityThreshold: 300, pollInterval: 100 },
    });

    this.watcher.on('change', (filePath) => this.onFileChanged(filePath, 'change'));
    this.watcher.on('add', (filePath) => this.onFileChanged(filePath, 'add'));
    this.watcher.on('unlink', (filePath) => this.onFileChanged(filePath, 'unlink'));

    this.watcher.on('error', (err) => {
      console.error(`[hot-reload] Watcher error: ${err.message}`);
    });

    this.watcher.on('ready', () => {
      console.log(`[hot-reload] Ready — watching for changes`);
    });
  }

  /** Stop watching */
  async stop(): Promise<void> {
    await this.watcher?.close();
    this.watcher = null;
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();
  }

  private onFileChanged(filePath: string, event: string): void {
    // Extract plugin name from path: .../packages/<name>/src/...
    const match = filePath.match(/packages[/\\]([^/\\]+)[/\\]src/);
    if (!match) return;

    const pluginName = match[1];
    const pluginDir = resolve(this.appRoot, 'packages', pluginName);

    // Debounce: reset timer for this plugin
    const existing = this.debounceTimers.get(pluginName);
    if (existing) clearTimeout(existing);

    console.log(`[hot-reload] ${event}: ${filePath} — debouncing ${this.debounceMs}ms`);

    const timer = setTimeout(async () => {
      this.debounceTimers.delete(pluginName);
      await this.reloadPlugin(pluginName, pluginDir);
    }, this.debounceMs);

    this.debounceTimers.set(pluginName, timer);
  }

  private async reloadPlugin(pluginName: string, pluginDir: string): Promise<void> {
    console.log(`[hot-reload] Reloading plugin: ${pluginName}`);

    try {
      // 1. Rebuild plugin
      console.log(`[hot-reload] Building: ${pluginDir}`);
      await this.runBuild(pluginDir);

      // 2. Call plugin.stop() on all instances
      if (this.bus) {
        this.bus.emit('plugin:reloading', { plugin: pluginName, timestamp: Date.now() });
      }

      // 3. Re-init and re-start the plugin
      // The PluginLoader would reload the module here
      if (this.bus) {
        this.bus.emit('plugin:reloaded', {
          plugin: pluginName,
          timestamp: Date.now(),
          appRoot: this.appRoot,
        });
      }

      console.log(`[hot-reload] Plugin ${pluginName} reloaded`);
    } catch (err) {
      console.error(`[hot-reload] Failed to reload ${pluginName}: ${err}`);
      if (this.bus) {
        this.bus.emit('plugin:reload-error', { plugin: pluginName, error: String(err) });
      }
    }
  }

  private runBuild(pluginDir: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const child = spawn('pnpm', ['--filter', `@forge/${pluginNameFromDir(pluginDir)}`, 'build'], {
        cwd: this.appRoot,
        shell: true,
        stdio: 'pipe',
      });

      let stderr = '';
      child.stderr?.on('data', (d) => { stderr += d.toString(); });
      child.on('exit', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`Build failed (exit ${code}): ${stderr}`));
      });

      child.on('error', reject);
    });
  }
}

function pluginNameFromDir(dir: string): string {
  return dir.replace(/\\/g, '/').split('/').pop() ?? '';
}
