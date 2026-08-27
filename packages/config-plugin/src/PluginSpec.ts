import type { PluginSpec } from '@forge/spec';

export const configPluginSpec: PluginSpec = {
  tier: 'core',
  api: [
    {
      name: 'config.get',
      description: 'Get a configuration value by key.',
      parameters: [
        { name: 'key', type: 'string', required: true, description: 'Dot-notation config key, e.g. "log.level"' },
        { name: 'fallback', type: 'unknown', required: false, description: 'Value returned if key is not found' },
      ],
      returns: 'unknown — the stored value, fallback, or undefined',
      example: `const level = ctx.config.get('log.level', 'info');`,
    },
    {
      name: 'config.set',
      description: 'Set a configuration value. Notifies all config subscribers.',
      parameters: [
        { name: 'key', type: 'string', required: true, description: 'Dot-notation config key' },
        { name: 'value', type: 'unknown', required: true, description: 'Value to store' },
      ],
      returns: 'void',
      example: `ctx.config.set('log.level', 'debug');`,
    },
    {
      name: 'config.has',
      description: 'Check if a configuration key exists.',
      parameters: [
        { name: 'key', type: 'string', required: true, description: 'Config key to check' },
      ],
      returns: 'boolean',
    },
    {
      name: 'config.getAll',
      description: 'Get a snapshot of all configuration as a plain object.',
      returns: 'Record<string, unknown>',
    },
    {
      name: 'config.onUpdate',
      description: 'Subscribe to configuration changes. Returns an unsubscribe function.',
      parameters: [
        { name: 'callback', type: 'function', required: true, description: 'Called on every config.set()' },
      ],
      returns: '() => void — call to unsubscribe',
    },
  ],
  dataModels: [],
  events: [
    {
      name: 'config:updated',
      description: 'Emitted on the plugin bus whenever a config value is changed via set().',
      payloadType: '{ key: string; value: unknown; plugin: string }',
    },
  ],
  dependencies: [],
  usageExamples: [
    {
      title: 'Read config at startup',
      description: 'Use config.get() inside a plugin init() to read settings.',
      code: `// my-plugin/src/impl.ts
export class MyPlugin implements ForgePlugin {
  async init(ctx: PluginContext) {
    const port = ctx.config.get<number>('server.port', 3000);
    const host = ctx.config.get<string>('server.host', '0.0.0.0');
    console.log(\`Starting on \${host}:\${port}\`);
  }
}`,
    },
    {
      title: 'Watch for config changes',
      description: 'Subscribe to runtime config updates.',
      code: `const unsubscribe = ctx.config.onUpdate((key, value) => {
  ctx.logger.info(\`Config \${key} changed to \${JSON.stringify(value)}\`);
});`,
    },
  ],
};
