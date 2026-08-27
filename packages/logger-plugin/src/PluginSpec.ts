import type { PluginSpec } from '@forge/spec';

export const loggerPluginSpec: PluginSpec = {
  tier: 'core',
  api: [
    {
      name: 'logger.debug',
      description: 'Log at DEBUG level.',
      parameters: [
        { name: 'message', type: 'string', required: true, description: 'Log message' },
        { name: 'meta', type: 'Record<string, unknown>', required: false, description: 'Additional structured data' },
      ],
      returns: 'void',
    },
    {
      name: 'logger.info',
      description: 'Log at INFO level.',
      parameters: [
        { name: 'message', type: 'string', required: true, description: 'Log message' },
        { name: 'meta', type: 'Record<string, unknown>', required: false, description: 'Additional structured data' },
      ],
      returns: 'void',
    },
    {
      name: 'logger.warn',
      description: 'Log at WARN level.',
      parameters: [
        { name: 'message', type: 'string', required: true, description: 'Log message' },
        { name: 'meta', type: 'Record<string, unknown>', required: false, description: 'Additional structured data' },
      ],
      returns: 'void',
    },
    {
      name: 'logger.error',
      description: 'Log at ERROR level.',
      parameters: [
        { name: 'message', type: 'string', required: true, description: 'Log message' },
        { name: 'meta', type: 'Record<string, unknown>', required: false, description: 'Additional structured data' },
      ],
      returns: 'void',
    },
    {
      name: 'logger.child',
      description: 'Create a logger with additional persistent metadata merged in.',
      parameters: [
        { name: 'meta', type: 'Record<string, unknown>', required: true, description: 'Additional tags for every log line' },
      ],
      returns: 'LoggerPluginAPI — a new logger instance with merged tags',
    },
  ],
  dataModels: [],
  events: [],
  dependencies: [],
  usageExamples: [
    {
      title: 'Basic logging from a plugin',
      description: 'Use the logger from PluginContext to log plugin activity.',
      code: `export class MyPlugin implements ForgePlugin {
  async init(ctx: PluginContext) {
    ctx.logger.info('MyPlugin initialized', { version: this.version });
  }
}`,
    },
    {
      title: 'Tagged logger for a subsystem',
      description: 'Use child() to create a logger scoped to a subsystem.',
      code: `const dbLogger = ctx.logger.child({ subsystem: 'database' });
dbLogger.info('Query executed', { query: 'SELECT *', duration_ms: 42 });`,
    },
  ],
};
