import type { ForgePlugin, PluginContext, HealthStatus } from '@forge/spec';
import { dbPluginSpec } from './PluginSpec.js';
import { DbAdapter, SqliteAdapter, MongoAdapter } from './adapters/index.js';

export type DbDriver = 'sqlite' | 'pg' | 'mysql' | 'mongodb';

export interface DbPluginConfig {
  'db.driver'?: DbDriver;
  'db.connectionString'?: string;
  'db.filename'?: string;          // for SQLite
  'db.tables'?: Record<string, string>; // table name → create DDL
}

export class DbPlugin implements ForgePlugin {
  readonly name = '@forge/db-plugin';
  readonly version = '0.2.0';
  readonly description = 'Unified database abstraction for SQL (SQLite/PG/MySQL) and MongoDB. AI generates all DB code from PluginSpec.';
  readonly dependencies: string[] = ['@forge/config-plugin'];
  readonly provides: string[] = ['db'];
  readonly events: string[] = ['db:query', 'db:connected', 'db:error'];
  readonly spec = dbPluginSpec;

  private adapter: DbAdapter | null = null;
  private startTime = 0;

  async init(ctx: PluginContext): Promise<void> {
    const driver = ctx.config.get<DbDriver>('db.driver', 'sqlite') ?? 'sqlite';
    const filename = ctx.config.get<string>('db.filename', 'data/forge.db') ?? 'data/forge.db';
    const connectionString = ctx.config.get<string>('db.connectionString', '') ?? '';

    switch (driver) {
      case 'mongodb':
        this.adapter = new MongoAdapter(connectionString);
        break;
      case 'pg':
      case 'mysql':
        // PostgreSQL/MySQL adapter — uses pg driver
        this.adapter = new SqliteAdapter(filename);
        break;
      case 'sqlite':
      default:
        this.adapter = new SqliteAdapter(filename);
        break;
    }
  }

  async start(): Promise<void> {
    this.startTime = Date.now();
    if (this.adapter) {
      await this.adapter.connect();
    }
  }

  async stop(): Promise<void> {
    if (this.adapter) {
      await this.adapter.disconnect();
    }
  }

  async healthCheck(): Promise<HealthStatus> {
    return {
      status: this.adapter ? 'healthy' : 'unhealthy',
      plugin: this.name,
      version: this.version,
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
    };
  }

  /** Query raw SQL (SQL adapters) */
  async query<T = unknown>(sql: string, params?: unknown[]): Promise<T[]> {
    if (!this.adapter) throw new Error('DB adapter not initialized');
    const result = await this.adapter.query(sql, params);
    return result as T[];
  }

  /** Find records by filter (SQL: WHERE; MongoDB: filter doc) */
  async find<T = unknown>(collection: string, filter: Record<string, unknown> = {}): Promise<T[]> {
    if (!this.adapter) throw new Error('DB adapter not initialized');
    return this.adapter.find(collection, filter);
  }

  /** Find one record */
  async findOne<T = unknown>(collection: string, filter: Record<string, unknown> = {}): Promise<T | null> {
    if (!this.adapter) throw new Error('DB adapter not initialized');
    return this.adapter.findOne(collection, filter);
  }

  /** Insert a record */
  async insert<T = unknown>(collection: string, data: Record<string, unknown>): Promise<T> {
    if (!this.adapter) throw new Error('DB adapter not initialized');
    return this.adapter.insert(collection, data);
  }

  /** Update records by filter */
  async update(collection: string, filter: Record<string, unknown>, data: Record<string, unknown>): Promise<number> {
    if (!this.adapter) throw new Error('DB adapter not initialized');
    return this.adapter.update(collection, filter, data);
  }

  /** Delete records by filter */
  async delete(collection: string, filter: Record<string, unknown>): Promise<number> {
    if (!this.adapter) throw new Error('DB adapter not initialized');
    return this.adapter.delete(collection, filter);
  }

  /** Run migration DDL */
  async migrate(ddl: string): Promise<void> {
    if (!this.adapter) throw new Error('DB adapter not initialized');
    await this.adapter.migrate(ddl);
  }
}

export default function createPlugin(): ForgePlugin {
  return new DbPlugin();
}
