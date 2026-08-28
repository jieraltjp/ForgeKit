import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import chalk from 'chalk';
import YAML from 'yaml';

export interface CheckResult {
  valid: boolean;
  plugin: string;
  errors: Array<{ field: string; message: string }>;
  warnings: Array<{ field: string; message: string }>;
}

export async function checkPlugin(options: { plugin: string; output: string }) {
  const pluginPath = resolve(process.cwd(), 'packages', options.plugin.replace('@forge/', ''));

  // Try workspace path first, then current dir
  const resolvedPath = existsSync(resolve(pluginPath, 'package.json'))
    ? pluginPath
    : resolve(process.cwd(), options.plugin);

  if (!existsSync(resolvedPath)) {
    const result: CheckResult = {
      valid: false,
      plugin: options.plugin,
      errors: [{ field: 'path', message: `Plugin path not found: ${resolvedPath}` }],
      warnings: [],
    };
    output(result, options.output);
    process.exit(1);
  }

  const errors: CheckResult['errors'] = [];
  const warnings: CheckResult['warnings'] = [];

  // 1. Validate plugin.yaml
  const yamlPath = resolve(resolvedPath, 'plugin.yaml');
  if (existsSync(yamlPath)) {
    try {
      const yamlContent = readFileSync(yamlPath, 'utf-8');
      const parsed = YAML.parse(yamlContent);

      for (const required of ['name', 'version', 'tier', 'entry']) {
        if (!parsed[required]) {
          errors.push({ field: `plugin.yaml.${required}`, message: `Missing required field: ${required}` });
        }
      }

      if (parsed.tier && !['core', 'extension', 'community'].includes(parsed.tier)) {
        errors.push({ field: 'plugin.yaml.tier', message: `Invalid tier: ${parsed.tier}. Must be core|extension|community.` });
      }
    } catch (e) {
      errors.push({ field: 'plugin.yaml', message: `YAML parse error: ${e}` });
    }
  } else {
    warnings.push({ field: 'plugin.yaml', message: 'plugin.yaml not found — will be auto-generated' });
  }

  // 2. Validate PluginSpec.ts exists and is valid JS
  const specPath = resolve(resolvedPath, 'src/PluginSpec.ts');
  if (!existsSync(specPath)) {
    errors.push({ field: 'PluginSpec.ts', message: 'src/PluginSpec.ts not found' });
  } else {
    try {
      const specContent = readFileSync(specPath, 'utf-8');

      // Structural checks
      const requiredFields = ['tier', 'api', 'dataModels', 'events', 'dependencies', 'usageExamples'];
      for (const field of requiredFields) {
        if (!specContent.includes(`${field}:`) && !specContent.includes(`${field} =`)) {
          errors.push({ field: `PluginSpec.ts.${field}`, message: `Missing or empty: ${field}` });
        }
      }

      // Tier field validation
      const tierMatch = specContent.match(/tier:\s*['"](core|extension|community)['"]/);
      if (!tierMatch) {
        warnings.push({ field: 'PluginSpec.ts.tier', message: 'tier field missing or invalid in PluginSpec' });
      }

      // Check api entries have name + description
      const apiEntries = specContent.matchAll(/name:\s*['"]([^'"]+)['"][\s\S]*?description:\s*['"]([^'"]+)['"]/g);
      for (const match of apiEntries) {
        if (!match[1]) errors.push({ field: 'PluginSpec.ts.api', message: 'API entry missing name' });
        if (!match[2]) errors.push({ field: 'PluginSpec.ts.api', message: 'API entry missing description' });
      }

      if (errors.length === 0 && warnings.length === 0) {
        warnings.push({ field: 'PluginSpec.ts', message: 'PluginSpec is valid but may need manual review of usageExamples' });
      }
    } catch (e) {
      errors.push({ field: 'PluginSpec.ts', message: `Error reading PluginSpec.ts: ${e}` });
    }
  }

  // 3. Validate index.ts exports
  const indexPath = resolve(resolvedPath, 'src/index.ts');
  if (!existsSync(indexPath)) {
    errors.push({ field: 'src/index.ts', message: 'src/index.ts not found' });
  } else {
    const indexContent = readFileSync(indexPath, 'utf-8');
    if (!indexContent.includes('ForgePlugin')) {
      errors.push({ field: 'src/index.ts', message: 'Does not implement ForgePlugin interface' });
    }
    if (!indexContent.includes('createPlugin') && !indexContent.includes('export default')) {
      warnings.push({ field: 'src/index.ts', message: 'No default export factory found — may break PluginLoader' });
    }
  }

  const result: CheckResult = {
    valid: errors.length === 0,
    plugin: options.plugin,
    errors,
    warnings,
  };

  output(result, options.output);
  if (!result.valid) process.exit(1);
}

function output(result: CheckResult, format: string) {
  if (format === 'json') {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(chalk.bold(`\nForgeKit Plugin Check — ${result.plugin}\n`));
    if (result.valid) {
      console.log(chalk.green(`  PASS — ${result.errors.length} errors, ${result.warnings.length} warnings`));
    } else {
      console.log(chalk.red(`  FAIL — ${result.errors.length} errors, ${result.warnings.length} warnings`));
    }
    if (result.errors.length > 0) {
      console.log(chalk.red('\n  ERRORS:'));
      for (const e of result.errors) {
        console.log(`    [${e.field}] ${e.message}`);
      }
    }
    if (result.warnings.length > 0) {
      console.log(chalk.yellow('\n  WARNINGS:'));
      for (const w of result.warnings) {
        console.log(`    [${w.field}] ${w.message}`);
      }
    }
  }
}
