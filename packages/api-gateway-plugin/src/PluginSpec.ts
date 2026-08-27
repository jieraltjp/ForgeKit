import type { PluginSpec } from '@forge/spec';

export const apiGatewayPluginSpec: PluginSpec = {
  tier: 'core',
  api: [
    {
      name: 'http.registerRoute',
      description: 'Register an HTTP route that dispatches to a plugin handler.',
      parameters: [
        { name: 'route', type: 'RouteDefinition', required: true, description: 'Route definition (method, path, handler name)' },
        { name: 'handler', type: 'RouteHandler', required: true, description: 'Async function(req, params) => unknown' },
      ],
      returns: 'void',
    },
    {
      name: 'http.start',
      description: 'Start the HTTP server on the configured port.',
      returns: 'Promise<void>',
    },
    {
      name: 'http.stop',
      description: 'Stop the HTTP server.',
      returns: 'Promise<void>',
    },
  ],
  dataModels: [],
  events: [
    {
      name: 'http:request',
      description: 'Emitted on the plugin bus for every incoming HTTP request.',
      payloadType: '{ method: string; path: string; plugin?: string }',
    },
    {
      name: 'http:response',
      description: 'Emitted after every HTTP response is sent.',
      payloadType: '{ method: string; path: string; statusCode: number; duration_ms: number }',
    },
  ],
  dependencies: [
    {
      plugin: '@forge/config-plugin',
      type: 'required',
      integration: 'Access server.port and server.host via ctx.config.get()',
      example: `const port = ctx.config.get<number>('server.port', 3000);`,
    },
    {
      plugin: '@forge/logger-plugin',
      type: 'required',
      integration: 'Log all HTTP requests and errors via ctx.logger',
      example: `ctx.logger.info('HTTP request', { method, path, statusCode });`,
    },
  ],
  usageExamples: [
    {
      title: 'Register a plugin route',
      description: 'Register an HTTP endpoint during plugin init.',
      code: `export class MyPlugin implements ForgePlugin {
  routes: RouteDefinition[] = [
    { method: 'GET', path: '/hello', handler: 'getHello', description: 'Say hello' },
  ];

  async init(ctx: PluginContext) {
    const http = ctx.config.get('@forge/api-gateway-plugin');
    // Route registration happens via the plugin.routes property automatically
  }
}`,
    },
    {
      title: 'Read health endpoint',
      description: 'Query the aggregate health of all running plugins.',
      code: `// GET /health
// Response:
{
  "status": "healthy",
  "plugins": [
    { "plugin": "@forge/config-plugin", "status": "healthy", "uptime": 120 },
    { "plugin": "@forge/logger-plugin", "status": "healthy", "uptime": 120 }
  ]
}`,
    },
  ],
};
