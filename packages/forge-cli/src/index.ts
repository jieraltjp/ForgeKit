#!/usr/bin/env node
import { Command } from 'commander';
import { newPlugin } from './commands/new-plugin.js';
import { checkPlugin } from './commands/check.js';
import { generateComponent } from './commands/generate.js';
import { listPlugins } from './commands/list.js';
import { runApp } from './commands/run.js';

const program = new Command();

program
  .name('forge')
  .description('ForgeKit CLI — AI-native plugin scaffolding and management')
  .version('0.2.0');

program
  .command('new <name>')
  .description('Scaffold a new ForgeKit plugin in packages/<name>/')
  .option('-d, --description <desc>', 'Plugin description', 'A ForgeKit plugin')
  .option('-t, --tier <tier>', 'Plugin tier: core|extension|community', 'extension')
  .action(newPlugin);

program
  .command('check')
  .description('Validate plugin.yaml and PluginSpec.ts consistency for a plugin')
  .requiredOption('-p, --plugin <path>', 'Path to plugin directory or package name')
  .option('-o, --output <format>', 'Output format: text|json', 'text')
  .action(checkPlugin);

program
  .command('generate <plugin> <component>')
  .description('Generate src/handlers/<component>.ts with a RouteHandler stub')
  .option('-r, --route <path>', 'HTTP route path, e.g. /posts/:slug', '')
  .option('-m, --method <method>', 'HTTP method: GET|POST|PUT|DELETE|PATCH', 'GET')
  .action(generateComponent);

program
  .command('list')
  .description('Read forge.json and print a table of registered plugins')
  .option('-f, --forge-json <path>', 'Path to forge.json', './forge.json')
  .action(listPlugins);

program
  .command('run')
  .description('Execute the minimal-app dist/index.js (or custom app via --app)')
  .option('-a, --app <path>', 'Path to app directory', './examples/minimal-app')
  .action(runApp);

program.parse();
