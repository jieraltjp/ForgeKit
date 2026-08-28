import { describe, it, expect } from 'vitest';
import { PluginLoader, type ForgeJson } from './plugin-loader.js';

describe('PluginLoader', () => {
  describe('loadAllFromForgeJson', () => {
    it('should load all enabled plugins from forge.json', async () => {
      const forgeJson: ForgeJson = {
        name: 'test-app',
        version: '0.1.0',
        plugins: [
          { name: '@forge/config-plugin', source: '../../packages/config-plugin', enabled: true },
          { name: '@forge/logger-plugin', source: '../../packages/logger-plugin', enabled: true },
        ],
        globalConfig: {},
      };

      const loader = new PluginLoader('./examples/minimal-app');
      const plugins = await loader.loadAllFromForgeJson(forgeJson);
      expect(plugins.length).toBeGreaterThanOrEqual(2);
      expect(plugins.map(p => p.name)).toContain('@forge/config-plugin');
      expect(plugins.map(p => p.name)).toContain('@forge/logger-plugin');
    });

    it('should skip disabled plugins', async () => {
      const forgeJson: ForgeJson = {
        name: 'test-app',
        version: '0.1.0',
        plugins: [
          { name: '@forge/config-plugin', source: '../../packages/config-plugin', enabled: true },
          { name: '@forge/logger-plugin', source: '../../packages/logger-plugin', enabled: false },
        ],
        globalConfig: {},
      };

      const loader = new PluginLoader('./examples/minimal-app');
      const plugins = await loader.loadAllFromForgeJson(forgeJson);
      expect(plugins.map(p => p.name)).not.toContain('@forge/logger-plugin');
    });

    it('should throw for non-existent plugin path', async () => {
      const forgeJson: ForgeJson = {
        name: 'test-app',
        version: '0.1.0',
        plugins: [
          { name: 'fake-plugin', source: '../../packages/nonexistent', enabled: true },
        ],
        globalConfig: {},
      };

      const loader = new PluginLoader('./examples/minimal-app');
      await expect(loader.loadAllFromForgeJson(forgeJson)).rejects.toThrow();
    });
  });
});
