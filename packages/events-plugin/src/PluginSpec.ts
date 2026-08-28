import type { PluginSpec } from '@forge/spec';

export const eventsPluginSpec: PluginSpec = {
  tier: 'core',
  api: [
    {
      name: 'events.emit',
      description: 'Emit an event on the bus. With Redis adapter: publishes to Redis channel + emits locally.',
      parameters: [
        { name: 'event', type: 'string', required: true, description: 'Event name, e.g. "user:created"' },
        { name: 'payload', type: 'unknown', required: true, description: 'Event payload data' },
      ],
      returns: 'void',
      example: `ctx.bus.emit('user:created', { id: 1, username: 'alice' });`,
    },
    {
      name: 'events.on',
      description: 'Subscribe to an event. Returns an unsubscribe function.',
      parameters: [
        { name: 'event', type: 'string', required: true, description: 'Event name to subscribe to' },
        { name: 'handler', type: 'EventHandler', required: true, description: 'Callback function called when event is emitted' },
      ],
      returns: '() => void — unsubscribe function',
      example: `const unsub = ctx.bus.on('user:created', (payload) => { ctx.logger.info('New user', payload); });`,
    },
    {
      name: 'events.once',
      description: 'Subscribe to an event for a single invocation.',
      parameters: [
        { name: 'event', type: 'string', required: true, description: 'Event name to subscribe to' },
        { name: 'handler', type: 'EventHandler', required: true, description: 'Callback function called once when event is emitted' },
      ],
      returns: 'void',
    },
    {
      name: 'events.off',
      description: 'Unsubscribe a handler from an event.',
      parameters: [
        { name: 'event', type: 'string', required: true, description: 'Event name to unsubscribe from' },
        { name: 'handler', type: 'EventHandler', required: true, description: 'Handler function to remove' },
      ],
      returns: 'void',
    },
  ],
  dataModels: [],
  events: [
    { name: 'events:adapter-changed', description: 'Emitted when events adapter switches (e.g. Redis fail → memory)', payloadType: '{ from: string; to: string }' },
  ],
  dependencies: [
    {
      plugin: '@forge/config-plugin',
      type: 'required',
      integration: 'Reads events.adapter and events.redisUrl from ctx.config',
      example: `const adapter = ctx.config.get('events.adapter', 'memory');`,
    },
  ],
  usageExamples: [
    {
      title: 'Emit and subscribe (in-process)',
      description: 'Plugin A emits, Plugin B subscribes — standard pub/sub within the same process.',
      code: `// In Plugin A:
ctx.bus.emit('user:registered', { userId: 1, email: 'alice@example.com' });

// In Plugin B (init):
ctx.bus.on('user:registered', (payload: { userId: number; email: string }) => {
  ctx.logger.info('New user registered', payload);
});`,
    },
    {
      title: 'Unsubscribe from an event',
      description: 'Store the unsubscribe function and call it when cleaning up.',
      code: `const unsub = ctx.bus.on('config:updated', handler);
// Later, when done:
unsub();`,
    },
    {
      title: 'Cross-process events with Redis',
      description: 'Set events.adapter=redis in config to broadcast events across multiple app instances.',
      code: `// forge.json globalConfig:
{
  "events.adapter": "redis",
  "events.redisUrl": "redis://localhost:6379"
}
// All instances receive events published by any other instance`,
    },
  ],
};
