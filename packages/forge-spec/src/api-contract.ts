// Route definition for HTTP endpoints
export interface RouteDefinition {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS';
  path: string;            // e.g. "/config/:key"
  handler: string;         // e.g. "getConfig"
  description: string;
  parameters?: ParameterDefinition[];
  response?: ResponseDefinition;
}

// Health check result
export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  plugin: string;
  version: string;
  uptime: number;          // seconds since start()
  checks?: Record<string, boolean>;
}

// Main plugin interface — every plugin MUST implement this
export interface ForgePlugin {
  readonly name: string;           // kebab-case, unique
  readonly version: string;       // semver
  readonly description: string;
  readonly dependencies: string[]; // plugin names required
  readonly provides: string[];   // capability names this plugin provides
  readonly events: string[];     // event names this plugin emits

  init(ctx: PluginContext): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  healthCheck(): Promise<HealthStatus>;

  routes?: RouteDefinition[];     // HTTP routes exposed by this plugin
}

// Shared context passed to every plugin at init time
export interface PluginContext {
  config: ConfigPluginAPI;
  logger: LoggerPluginAPI;
  bus: PluginBusAPI;
}

// Config plugin API surface exposed via PluginContext
export interface ConfigPluginAPI {
  get<T = unknown>(key: string, fallback?: T): T | undefined;
  set(key: string, value: unknown): void;
  has(key: string): boolean;
  getAll(): Record<string, unknown>;
  onUpdate(callback: (key: string, value: unknown) => void): () => void;
}

// Logger plugin API surface exposed via PluginContext
export interface LoggerPluginAPI {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
  child(meta: Record<string, unknown>): LoggerPluginAPI;
}

// Event bus API surface exposed via PluginContext
export interface PluginBusAPI {
  emit(event: string, payload: unknown): void;
  on(event: string, handler: EventHandler): () => void;
  once(event: string, handler: EventHandler): void;
  off(event: string, handler: EventHandler): void;
}

export type EventHandler = (payload: unknown) => void | Promise<void>;

// HTTP server API for api-gateway
export interface HttpServerAPI {
  registerRoute(route: RouteDefinition, handler: RouteHandler): void;
  start(port: number): Promise<void>;
  stop(): Promise<void>;
}

export type RouteHandler = (
  params: Record<string, string>,
  body: unknown,
  query: Record<string, string>
) => unknown | Promise<unknown>;

export interface ParameterDefinition {
  name: string;
  in: 'path' | 'query' | 'body';
  required: boolean;
  type: string;
  description?: string;
}

export interface ResponseDefinition {
  statusCode: number;
  description: string;
  schema?: string;
}
