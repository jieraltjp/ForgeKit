import type {
  ForgePlugin, PluginContext, HealthStatus,
  RouteDefinition, RouteHandler,
} from '@forge/spec';
import { apiGatewayPluginSpec } from './PluginSpec.js';

export class ApiGatewayPlugin implements ForgePlugin {
  readonly name = '@forge/api-gateway-plugin';
  readonly version = '0.1.0';
  readonly description = 'Unified HTTP entry point for ForgeKit';
  readonly dependencies = ['@forge/config-plugin', '@forge/logger-plugin'];
  readonly provides: string[] = ['http-server'];
  readonly events: string[] = ['http:request', 'http:response'];
  readonly spec = apiGatewayPluginSpec;

  private routeMap = new Map<string, { route: RouteDefinition; handler: RouteHandler }>();
  private server: import('http').Server | null = null;
  private port = 3000;
  private host = '0.0.0.0';
  private ctx!: PluginContext;
  private startTime = 0;

  async init(ctx: PluginContext): Promise<void> {
    this.ctx = ctx;
    this.port = ctx.config.get<number>('server.port') ?? 3000;
    this.host = ctx.config.get<string>('server.host') ?? '0.0.0.0';
  }

  async start(): Promise<void> {
    this.startTime = Date.now();
    await this.startServer();
  }

  async stop(): Promise<void> {
    if (this.server) {
      await new Promise<void>((res) => this.server!.close(() => res()));
      this.server = null;
    }
  }

  async healthCheck(): Promise<HealthStatus> {
    return {
      status: 'healthy',
      plugin: this.name,
      version: this.version,
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
    };
  }

  // Called by app bootstrap to register routes from all plugins
  registerRoute(route: RouteDefinition, handler: RouteHandler): void {
    const key = `${route.method} ${route.path}`;
    this.routeMap.set(key, { route, handler });
  }

  private async startServer(): Promise<void> {
    const http = await import('http');

    this.server = http.createServer(async (req, res) => {
      const start = Date.now();
      const url = new URL(req.url!, `http://${req.headers.host}`);
      const method = (req.method ?? 'GET').toUpperCase() as RouteDefinition['method'];
      const path = url.pathname;

      this.ctx.bus.emit('http:request', { method, path });

      // Build context
      const params: Record<string, string> = {};
      const query: Record<string, string> = Object.fromEntries(url.searchParams);
      let body: unknown = undefined;
      if (['POST', 'PUT', 'PATCH'].includes(method)) {
        const raw = await new Promise<string>((res, rej) => {
          let d = '';
          req.on('data', (c) => (d += c));
          req.on('end', () => res(d));
          req.on('error', rej);
        });
        try { body = JSON.parse(raw); } catch { body = raw; }
      }

      // Find route
      const key = `${method} ${path}`;
      let routeData = this.routeMap.get(key);
      if (!routeData) {
        // Try parametric: /config/:key
        for (const [k, v] of this.routeMap) {
          const [m, p] = k.split(' ');
          if (m !== method) continue;
          const paramNames = [...p.matchAll(/:([^/]+)/g)].map(([, n]) => n);
          const regex = new RegExp(`^${p.replace(/:[^/]+/g, '([^/]+)')}$`);
          const match = path.match(regex);
          if (match) {
            for (let i = 0; i < paramNames.length; i++) params[paramNames[i]] = match[i + 1];
            routeData = v;
            break;
          }
        }
      }

      // Built-in endpoints — always take precedence
      if (method === 'GET' && path === '/health') {
        const healthData = { status: 'healthy', uptime: Math.floor((Date.now() - this.startTime) / 1000) };
        res.setHeader('Content-Type', 'application/json');
        res.statusCode = 200;
        res.end(JSON.stringify({ data: healthData, statusCode: 200 }));
        this.ctx.bus.emit('http:response', { method, path, statusCode: 200, duration_ms: Date.now() - start });
        return;
      }
      if (method === 'GET' && path === '/routes') {
        const routesData = {
          routes: [...this.routeMap.values()].map(({ route }) => ({
            method: route.method,
            path: route.path,
            description: route.description,
          })),
        };
        res.setHeader('Content-Type', 'application/json');
        res.statusCode = 200;
        res.end(JSON.stringify({ data: routesData, statusCode: 200 }));
        this.ctx.bus.emit('http:response', { method, path, statusCode: 200, duration_ms: Date.now() - start });
        return;
      }

      let statusCode = 200;
      let responseData: unknown;

      if (!routeData) {
        statusCode = 404;
        responseData = { error: { code: 'FORGE011', message: `Route ${method} ${path} not found` }, statusCode: 404 };
      } else {
        try {
          responseData = await routeData.handler(params, body, query);
        } catch (e) {
          statusCode = 500;
          responseData = { error: { code: 'FORGE001', message: String(e) }, statusCode: 500 };
        }
      }

      res.setHeader('Content-Type', 'application/json');
      res.statusCode = statusCode;
      res.end(JSON.stringify({ data: responseData, statusCode }));

      this.ctx.bus.emit('http:response', {
        method, path, statusCode, duration_ms: Date.now() - start,
      });
    });

    await new Promise<void>((res) => this.server!.listen(this.port, this.host, () => {
      this.ctx.logger.info(`API Gateway listening on ${this.host}:${this.port}`);
      res();
    }));
  }
}

export default function createPlugin(_logger: unknown): ForgePlugin {
  return new ApiGatewayPlugin();
}
