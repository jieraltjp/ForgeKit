import { readFileSync } from 'fs';
import { resolve } from 'path';
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

interface YamlManifest {
  name: string;
  version: string;
  description?: string;
  entry: string;
  dependencies?: string[];
  provides?: string[];
  events?: string[];
}

export class PluginRegistry {
  private manifests = new Map<string, PluginManifest>();

  constructor(
    private manifestPath: string,
    private logger: LoggerPluginAPI,
  ) {}

  async loadManifests(): Promise<void> {
    const forgeJson = JSON.parse(readFileSync(this.manifestPath, 'utf-8'));
    const plugins = forgeJson.plugins ?? [];

    for (const plugin of plugins) {
      if (!plugin.enabled) continue;
      const yamlPath = resolve(plugin.source, 'plugin.yaml');
      try {
        const yaml = await import('fs').then(m => m.readFileSync(yamlPath, 'utf-8'));
        const parsed = this.parseYaml(yaml) as unknown as YamlManifest;
        if (this.manifests.has(parsed.name)) {
          this.logger.warn(`Duplicate plugin manifest: ${parsed.name}`);
        }
        this.manifests.set(parsed.name, {
          name: parsed.name,
          version: parsed.version,
          entry: resolve(plugin.source, parsed.entry),
          dependencies: parsed.dependencies ?? [],
          provides: parsed.provides ?? [],
          events: parsed.events ?? [],
        });
      } catch (e) {
        throw new ForgeError(ForgeErrors.PLUGIN_LOAD_FAILED, `Failed to load manifest for ${plugin.name}: ${String(e)}`);
      }
    }
  }

  private parseYaml(yaml: string): Record<string, unknown> {
    // Minimal YAML parser for the known plugin.yaml structure
    const result: Record<string, unknown> = {};
    const lines = yaml.split('\n');
    let currentKey = '';
    let currentArray: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      if (trimmed.startsWith('entry:')) { result['entry'] = trimmed.slice(6).trim(); continue; }
      if (trimmed.startsWith('name:')) { result['name'] = trimmed.slice(5).trim(); continue; }
      if (trimmed.startsWith('version:')) { result['version'] = trimmed.slice(8).trim(); continue; }
      if (trimmed.startsWith('description:')) { result['description'] = trimmed.slice(12).trim(); continue; }
      if (trimmed.startsWith('dependencies:')) { currentKey = 'dependencies'; currentArray = []; continue; }
      if (trimmed.startsWith('provides:')) { currentKey = 'provides'; currentArray = []; continue; }
      if (trimmed.startsWith('events:')) { currentKey = 'events'; currentArray = []; continue; }
      if (trimmed.startsWith('- ')) { currentArray.push(trimmed.slice(2)); continue; }
      if (currentKey && currentArray.length > 0 && !trimmed.startsWith('-')) {
        result[currentKey] = currentArray;
        currentKey = '';
      }
    }
    if (currentKey && currentArray.length > 0) result[currentKey] = currentArray;
    return result;
  }

  getManifest(name: string): PluginManifest | undefined {
    return this.manifests.get(name);
  }

  getLoadOrder(): string[] {
    this.validateDependencies();
    const visited = new Set<string>();
    const temp = new Set<string>();
    const order: string[] = [];

    const visit = (name: string) => {
      if (visited.has(name)) return;
      if (temp.has(name)) throw new ForgeError(ForgeErrors.PLUGIN_DEP_CYCLE, `Cycle detected involving plugin: ${name}`);
      temp.add(name);
      const manifest = this.manifests.get(name);
      if (!manifest) return;
      for (const dep of manifest.dependencies) {
        visit(dep);
      }
      temp.delete(name);
      visited.add(name);
      order.push(name);
    };

    for (const name of this.manifests.keys()) {
      visit(name);
    }

    return order;
  }

  validateDependencies(): void {
    for (const [name, manifest] of this.manifests) {
      for (const dep of manifest.dependencies) {
        if (!this.manifests.has(dep)) {
          throw new ForgeError(
            ForgeErrors.PLUGIN_DEP_MISSING,
            `Plugin "${name}" depends on "${dep}" but it is not available`,
            name,
          );
        }
      }
    }
  }
}
