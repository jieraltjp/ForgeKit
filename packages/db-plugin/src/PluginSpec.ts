import type { PluginSpec } from '@forge/spec';

export const dbPluginSpec: PluginSpec = {
  tier: 'core',
  api: [
    {
      name: 'db.find',
      description: 'Find all records matching a filter. SQL adapters: SELECT * FROM table WHERE ...; MongoDB: collection.find(filter).',
      parameters: [
        { name: 'collection', type: 'string', required: true, description: 'Table name (SQL) or collection name (MongoDB)' },
        { name: 'filter', type: 'Record<string, unknown>', required: false, description: 'WHERE conditions (SQL) or query document (MongoDB). Defaults to all rows.' },
      ],
      returns: 'Promise<T[]>',
      example: `const posts = await db.find('posts', { authorId: 1 });`,
    },
    {
      name: 'db.findOne',
      description: 'Find the first record matching a filter.',
      parameters: [
        { name: 'collection', type: 'string', required: true, description: 'Table/collection name' },
        { name: 'filter', type: 'Record<string, unknown>', required: false, description: 'Query conditions' },
      ],
      returns: 'Promise<T | null>',
      example: `const post = await db.findOne('posts', { slug: 'my-first-post' });`,
    },
    {
      name: 'db.insert',
      description: 'Insert a new record. Auto-generates id (SQLite: lastInsertRowid; MongoDB: ObjectId).',
      parameters: [
        { name: 'collection', type: 'string', required: true, description: 'Table/collection name' },
        { name: 'data', type: 'Record<string, unknown>', required: true, description: 'Record data to insert' },
      ],
      returns: 'Promise<T> — the inserted record with generated id',
      example: `const newPost = await db.insert('posts', { title: 'Hello', slug: 'hello', content: '...', authorId: 1 });`,
    },
    {
      name: 'db.update',
      description: 'Update all records matching a filter.',
      parameters: [
        { name: 'collection', type: 'string', required: true, description: 'Table/collection name' },
        { name: 'filter', type: 'Record<string, unknown>', required: true, description: 'WHERE conditions' },
        { name: 'data', type: 'Record<string, unknown>', required: true, description: 'Fields to update' },
      ],
      returns: 'Promise<number> — count of updated rows',
      example: `const updated = await db.update('posts', { id: 1 }, { title: 'Updated!' });`,
    },
    {
      name: 'db.delete',
      description: 'Delete all records matching a filter.',
      parameters: [
        { name: 'collection', type: 'string', required: true, description: 'Table/collection name' },
        { name: 'filter', type: 'Record<string, unknown>', required: true, description: 'WHERE conditions' },
      ],
      returns: 'Promise<number> — count of deleted rows',
      example: `const deleted = await db.delete('posts', { id: 1 });`,
    },
    {
      name: 'db.migrate',
      description: 'Run DDL migration statements. For SQLite/PG: raw SQL exec. For MongoDB: no-op (dynamic schema).',
      parameters: [
        { name: 'ddl', type: 'string', required: true, description: 'SQL DDL statements or MongoDB migration script' },
      ],
      returns: 'Promise<void>',
      example: `await db.migrate('CREATE TABLE IF NOT EXISTS posts (id INTEGER PRIMARY KEY, title TEXT)');`,
    },
  ],
  dataModels: [
    {
      name: 'DbRecord',
      description: 'Base type for all database records',
      fields: [
        { name: 'id', type: 'number', description: 'Auto-increment integer ID (SQLite) or ObjectId string (MongoDB)' },
      ],
    },
  ],
  events: [
    { name: 'db:query', description: 'Emitted after every database query', payloadType: '{ sql?: string; collection: string; duration_ms: number }' },
    { name: 'db:connected', description: 'Emitted when database connection is established', payloadType: '{ driver: string }' },
    { name: 'db:error', description: 'Emitted on database error', payloadType: '{ error: string; collection?: string }' },
  ],
  dependencies: [
    {
      plugin: '@forge/config-plugin',
      type: 'required',
      integration: 'Reads db.driver, db.connectionString, db.filename from ctx.config',
      example: `const driver = ctx.config.get('db.driver', 'sqlite');`,
    },
  ],
  usageExamples: [
    {
      title: 'AI: insert a blog post',
      description: 'AI generates this from PluginSpec — no need to know the underlying DB driver.',
      code: `// AI generates this code automatically from PluginSpec
const post = await ctx.db.insert('posts', {
  title: 'My First Post',
  slug: 'my-first-post',
  content: 'Hello world from the AI agent!',
  authorId: ctx.state.currentUserId,
  createdAt: new Date().toISOString(),
});
// Works with SQLite, PostgreSQL, or MongoDB — driver is pluggable`,
    },
    {
      title: 'AI: find posts by slug',
      description: 'Single line query — AI does not need to know SQL syntax.',
      code: `const post = await ctx.db.findOne('posts', { slug: req.params.slug });
if (!post) throw new HttpError(404, 'Post not found');`,
    },
    {
      title: 'AI: migrate database schema',
      description: 'DDL migrations run via db.migrate().',
      code: `await ctx.db.migrate(\`
  CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    content TEXT NOT NULL,
    authorId INTEGER NOT NULL,
    createdAt TEXT NOT NULL
  );
\`);`,
    },
  ],
};
