import { buildApp } from './App.js';
import { resolve } from 'path';
import process from 'node:process';

const app = await buildApp(resolve(import.meta.dirname, '../forge.json'));

process.on('SIGINT', async () => {
  console.log('\nShutting down...');
  await app.stop();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await app.stop();
  process.exit(0);
});
