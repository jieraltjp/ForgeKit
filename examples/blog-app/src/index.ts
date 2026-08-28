import { buildApp } from './App.js';
import { resolve } from 'path';
import { runMigrations } from './migrate.js';
import process from 'node:process';

const appRoot = resolve(import.meta.dirname, '..');

async function main() {
  // Run DB migrations first
  await runMigrations(appRoot);

  // Build and start the app
  const app = await buildApp(resolve(appRoot, 'forge.json'));

  app.bus.emit('blog:started', { port: 3000 });

  process.on('SIGINT', async () => {
    console.log('\nShutting down...');
    await app.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    await app.stop();
    process.exit(0);
  });
}

main().catch(console.error);
