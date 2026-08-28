import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import chalk from 'chalk';

export async function listPlugins(options: { forgeJson: string }) {
  const forgeJsonPath = resolve(process.cwd(), options.forgeJson);
  if (!existsSync(forgeJsonPath)) {
    console.error(chalk.red(`Error: forge.json not found at ${forgeJsonPath}`));
    process.exit(1);
  }

  const forgeJson = JSON.parse(readFileSync(forgeJsonPath, 'utf-8'));
  const plugins = forgeJson.plugins ?? [];

  console.log(chalk.bold(`\nForgeKit Plugins — ${forgeJson.name} (${forgeJson.version})\n`));
  console.log(
    chalk.bold('  NAME'.padEnd(35)) +
    chalk.bold('SOURCE'.padEnd(30)) +
    chalk.bold('ENABLED')
  );
  console.log('  ' + '-'.repeat(75));

  for (const plugin of plugins) {
    const name = (plugin.name ?? '').padEnd(33);
    const source = (plugin.source ?? '').padEnd(28);
    const enabled = plugin.enabled ? chalk.green('yes') : chalk.red('no');
    console.log(`  ${name} ${source} ${enabled}`);
  }

  console.log(`\n  ${plugins.length} plugin(s) registered`);
  console.log(`  Forge version: ${forgeJson.forgeVersion ?? 'unspecified'}\n`);
}
