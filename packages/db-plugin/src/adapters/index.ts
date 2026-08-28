import initSqlJs from 'sql.js';
import { MongoClient, Collection } from 'mongodb';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';

export interface DbAdapter {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  query<T = unknown>(sql: string, params?: unknown[]): Promise<T[]>;
  find<T = unknown>(collection: string, filter: Record<string, unknown>): Promise<T[]>;
  findOne<T = unknown>(collection: string, filter: Record<string, unknown>): Promise<T | null>;
  insert<T = unknown>(collection: string, data: Record<string, unknown>): Promise<T>;
  update(collection: string, filter: Record<string, unknown>, data: Record<string, unknown>): Promise<number>;
  delete(collection: string, filter: Record<string, unknown>): Promise<number>;
  migrate(ddl: string): Promise<void>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SqlJsDatabase = any;

export class SqliteAdapter implements DbAdapter {
  private db: SqlJsDatabase | null = null;
  private readonly filename: string;

  constructor(filename: string = 'data/forge.db') {
    this.filename = filename;
  }

  async connect(): Promise<void> {
    // Ensure data directory exists (skip for in-memory DB)
    if (this.filename !== ':memory:') {
      mkdirSync(this.filename.replace(/[/\\][^/\\]+$/, ''), { recursive: true });
    }

    const SQL = await initSqlJs();

    if (this.filename === ':memory:') {
      this.db = new SQL.Database();
    } else if (existsSync(this.filename)) {
      const fileBuffer = readFileSync(this.filename);
      this.db = new SQL.Database(fileBuffer);
    } else {
      this.db = new SQL.Database();
    }
  }

  private persist(): void {
    if (!this.db || this.filename === ':memory:') return;
    const data = this.db.export();
    const buffer = Buffer.from(data);
    writeFileSync(this.filename, buffer);
  }

  async disconnect(): Promise<void> {
    if (this.db) {
      this.persist();
      this.db.close();
      this.db = null;
    }
  }

  async query<T = unknown>(sql: string, params: unknown[] = []): Promise<T[]> {
    if (!this.db) throw new Error('DB not connected');
    const stmt = this.db.prepare(sql);
    if (params.length > 0) stmt.bind(params);
    const results: T[] = [];
    while (stmt.step()) {
      const row = stmt.getAsObject();
      results.push(row as T);
    }
    stmt.free();
    return results;
  }

  async find<T = unknown>(collection: string, filter: Record<string, unknown> = {}): Promise<T[]> {
    const conditions = Object.entries(filter)
      .map(([k]) => `${k} = ?`)
      .join(' AND ');
    const where = conditions ? `WHERE ${conditions}` : '';
    const sql = `SELECT * FROM ${collection} ${where}`;
    const params = Object.values(filter);
    return this.query<T>(sql, params);
  }

  async findOne<T = unknown>(collection: string, filter: Record<string, unknown> = {}): Promise<T | null> {
    const results = await this.find<T>(collection, filter);
    return results[0] ?? null;
  }

  async insert<T = unknown>(collection: string, data: Record<string, unknown>): Promise<T> {
    if (!this.db) throw new Error('DB not connected');
    const keys = Object.keys(data);
    const values = Object.values(data);
    const placeholders = keys.map(() => '?').join(', ');
    const sql = `INSERT INTO ${collection} (${keys.join(', ')}) VALUES (${placeholders})`;
    this.db.run(sql, values);
    // Get last inserted row id
    const lastIdResult = this.db.exec('SELECT last_insert_rowid() as id');
    const lastId = lastIdResult[0]?.values[0]?.[0] ?? null;
    this.persist();
    return { ...data, id: lastId } as T;
  }

  async update(collection: string, filter: Record<string, unknown>, data: Record<string, unknown>): Promise<number> {
    if (!this.db) throw new Error('DB not connected');
    const setParts = Object.keys(data).map(k => `${k} = ?`);
    const whereParts = Object.keys(filter).map(k => `${k} = ?`);
    const sql = `UPDATE ${collection} SET ${setParts.join(', ')} WHERE ${whereParts.join(' AND ')}`;
    this.db.run(sql, [...Object.values(data), ...Object.values(filter)]);
    const changesResult = this.db.exec('SELECT changes() as n');
    const n = changesResult[0]?.values[0]?.[0] as number ?? 0;
    this.persist();
    return n;
  }

  async delete(collection: string, filter: Record<string, unknown>): Promise<number> {
    if (!this.db) throw new Error('DB not connected');
    const whereParts = Object.keys(filter).map(k => `${k} = ?`);
    const sql = `DELETE FROM ${collection} WHERE ${whereParts.join(' AND ')}`;
    this.db.run(sql, [...Object.values(filter)]);
    const changesResult = this.db.exec('SELECT changes() as n');
    const n = changesResult[0]?.values[0]?.[0] as number ?? 0;
    this.persist();
    return n;
  }

  async migrate(ddl: string): Promise<void> {
    if (!this.db) throw new Error('DB not connected');
    this.db.run(ddl);
    this.persist();
  }
}

export class MongoAdapter implements DbAdapter {
  private client: MongoClient | null = null;
  private dbName = 'forge';
  private collections = new Map<string, Collection>();

  constructor(private connectionString: string) {}

  async connect(): Promise<void> {
    this.client = new MongoClient(this.connectionString);
    await this.client.connect();
    this.dbName = new URL(this.connectionString).pathname.replace(/^\//, '') || 'forge';
  }

  async disconnect(): Promise<void> {
    await this.client?.close();
    this.client = null;
  }

  private getCollection(name: string): Collection {
    if (!this.client) throw new Error('DB not connected');
    return this.client.db(this.dbName).collection(name);
  }

  async query<T = unknown>(_sql: string, _params?: unknown[]): Promise<T[]> {
    throw new Error('query() is not supported in MongoDB adapter — use find() instead');
  }

  async find<T = unknown>(collection: string, filter: Record<string, unknown> = {}): Promise<T[]> {
    const col = this.getCollection(collection);
    const cursor = col.find(filter);
    return cursor.toArray() as Promise<T[]>;
  }

  async findOne<T = unknown>(collection: string, filter: Record<string, unknown> = {}): Promise<T | null> {
    const col = this.getCollection(collection);
    return col.findOne(filter) as Promise<T | null>;
  }

  async insert<T = unknown>(collection: string, data: Record<string, unknown>): Promise<T> {
    const col = this.getCollection(collection);
    const result = await col.insertOne(data);
    return { ...data, _id: result.insertedId } as T;
  }

  async update(collection: string, filter: Record<string, unknown>, data: Record<string, unknown>): Promise<number> {
    const col = this.getCollection(collection);
    const result = await col.updateMany(filter, { $set: data });
    return result.modifiedCount;
  }

  async delete(collection: string, filter: Record<string, unknown>): Promise<number> {
    const col = this.getCollection(collection);
    const result = await col.deleteMany(filter);
    return result.deletedCount;
  }

  async migrate(_ddl: string): Promise<void> {
    // MongoDB uses dynamic schemas — no migrations needed
  }
}
