import type { LoggerPluginAPI, PluginBusAPI, ConfigPluginAPI } from '@forge/spec';
import { ForgeError, ForgeErrors } from '@forge/spec';
import { readFileSync, existsSync } from 'fs';
import { resolve, isAbsolute } from 'path';
import { pathToFileURL } from 'url';

export interface ForgeJson {
  name: string;
  version: string;
  forgeVersion?: string;
  plugins: ForgeJsonPlugin[];
  globalConfig: Record<string, unknown>;
}

export interface ForgeJsonPlugin {
  name: string;
  source: string;
  version?: string;
  enabled: boolean;
}

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

  /**
   * Load a plugin from a filesystem path or npm package name.
   * - Workspace paths (../../packages/x or ./packages/x) → resolved relative to cwd
   * - npm paths (@forge/x from node_modules) → resolved via node_modules resolution
   * - Absolute paths → used as-is
   */
  async loadPluginFromPath(source: string): Promise<{ plugin: import('@forge/spec').ForgePlugin; manifest: PluginManifest }> {
    const resolved = this.resolvePluginPath(source);
    const manifest = await this.loadManifest(resolved);
    const plugin = await this.loadPluginFromManifest(manifest, resolved);
    return { plugin, manifest };
  }

  /**
   * Load all enabled plugins listed in a ForgeJson manifest.
   * Respects topological order (dependencies first).
   */
  async loadAllFromForgeJson(forgeJson: ForgeJson): Promise<import('@forge/spec').ForgePlugin[]> {
    const enabled = forgeJson.plugins.filter(p => p.enabled);
    const loaded: import('@forge/spec').ForgePlugin[] = [];
    const seen = new Set<string>();

    // Simple ordering: load in forge.json order (assumes author got order right)
    // TODO: topological sort using PluginManifest.dependencies
    for (const fp of enabled) {
      if (seen.has(fp.name)) continue;
      try {
        const { plugin } = await this.loadPluginFromPath(fp.source);
        loaded.push(plugin);
        seen.add(fp.name);
      } catch (e) {
        throw new ForgeError(
          ForgeErrors.PLUGIN_LOAD_FAILED,
          `Failed to load plugin "${fp.name}" from "${fp.source}": ${String(e)}`,
          fp.name,
          e,
        );
      }
    }

    return loaded;
  }

  /** Resolve source string to an absolute path or npm package */
  private resolvePluginPath(source: string): string {
    if (isAbsolute(source)) return source;

    // npm scoped package
    if (source.startsWith('@')) {
      // Try node_modules resolution
      const nmPath = resolve(process.cwd(), 'node_modules', source);
      if (existsSync(nmPath)) return nmPath;
      throw new ForgeError(
        ForgeErrors.PLUGIN_NOT_FOUND,
        `Plugin "${source}" not found in node_modules. Run: pnpm add ${source}`,
      );
    }

    // Workspace relative path (../../packages/x, ./packages/x, packages/x)
    const normalized = source.startsWith('.') ? source : `./${source}`;
    const resolved = resolve(this.basePath, normalized);

    // Check for package.json in resolved path
    if (existsSync(resolve(resolved, 'package.json'))) return resolved;

    // Check packages/ subdirectory
    const fromCwd = resolve(process.cwd(), 'packages', source.replace(/^\.\.\/\.\.\//, ''));
    if (existsSync(resolve(fromCwd, 'package.json'))) return fromCwd;

    throw new ForgeError(
      ForgeErrors.PLUGIN_NOT_FOUND,
      `Plugin source not found: "${source}".\n` +
      `  Tried: ${resolved}\n` +
      `  Tried: ${fromCwd}\n` +
      `  Tried: node_modules/${source}`,
    );
  }

  private async loadManifest(pluginPath: string): Promise<PluginManifest> {
    const pluginYamlPath = resolve(pluginPath, 'plugin.yaml');
    const pkgPath = resolve(pluginPath, 'package.json');

    // Try package.json first
    if (existsSync(pkgPath)) {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
      return {
        name: pkg.name,
        version: pkg.version,
        entry: resolve(pluginPath, pkg.main ?? './dist/index.js'),
        dependencies: Object.keys(pkg.dependencies ?? {}).filter(d => d.startsWith('@forge/')),
        provides: [],
        events: [],
      };
    }

    throw new ForgeError(
      ForgeErrors.PLUGIN_LOAD_FAILED,
      `No package.json found for plugin at: ${pluginPath}`,
    );
  }

  private async loadPluginFromManifest(manifest: PluginManifest, pluginPath: string): Promise<import('@forge/spec').ForgePlugin> {
    try {
      // Dynamic import with file:// URL for Windows compatibility
      const entryUrl = pathToFileURL(resolve(pluginPath, 'entry' in manifest ? (manifest as any).entry : 'dist/index.js')).href;
      const mod = await import(entryUrl);
      const factory = mod.default ?? mod.createPlugin;
      if (typeof factory !== 'function') {
        throw new ForgeError(
          ForgeErrors.PLUGIN_LOAD_FAILED,
          `Plugin "${manifest.name}" entry does not export a factory (default or createPlugin)`,
        );
      }
      return factory({} as { config: ConfigPluginAPI; logger: LoggerPluginAPI; bus: PluginBusAPI });
    } catch (e) {
      if (e instanceof ForgeError) throw e;
      throw new ForgeError(
        ForgeErrors.PLUGIN_LOAD_FAILED,
        `Failed to load plugin "${manifest.name}": ${String(e)}`,
        manifest.name,
        e,
      );
    }
  }

  // Backwards-compatible loadPlugin (keeps existing API)
  async loadPlugin(manifest: PluginManifest): Promise<import('@forge/spec').ForgePlugin> {
    const { plugin } = await this.loadPluginFromPath(manifest.entry);
    return plugin;
  }

  async loadAll(manifests: PluginManifest[]): Promise<import('@forge/spec').ForgePlugin[]> {
    const plugins: import('@forge/spec').ForgePlugin[] = [];
    for (const manifest of manifests) {
      plugins.push(await this.loadPlugin(manifest));
    }
    return plugins;
  }
}
