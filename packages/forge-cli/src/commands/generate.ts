import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
import { resolve } from 'path';
import chalk from 'chalk';

export async function generateComponent(
  plugin: string,
  component: string,
  options: { route?: string; method?: string }
) {
  const pluginPath = resolve(process.cwd(), 'packages', plugin.replace('@forge/', ''));
  if (!existsSync(pluginPath)) {
    console.error(chalk.red(`Error: packages/${plugin} not found.`));
    process.exit(1);
  }

  const handlersDir = resolve(pluginPath, 'src/handlers');
  mkdirSync(handlersDir, { recursive: true });

  const fileName = `${component}.ts`;
  const filePath = resolve(handlersDir, fileName);

  if (existsSync(filePath)) {
    console.error(chalk.red(`Error: src/handlers/${fileName} already exists.`));
    process.exit(1);
  }

  const handlerName = toPascalCase(component);
  const method = (options.method ?? 'GET').toUpperCase();
  const route = options.route ?? `/${plugin}/:id`;

  const content = `import type { RouteHandler } from '@forge/spec';

/**
 * Handler for ${method} ${route}
 * TODO: implement this handler
 */
export const ${handlerName}Handler: RouteHandler = async (
  params,
  _body,
  _query
) => {
  // params: ${JSON.stringify({ id: ':id' })}
  // TODO: implement handler logic

  return {
    ok: true,
    message: '${handlerName} handler stub',
    params,
  };
};
`;

  writeFileSync(filePath, content);
  console.log(chalk.green(`  created: src/handlers/${fileName}`));

  // Also update plugin.yaml routes if it exists
  const yamlPath = resolve(pluginPath, 'plugin.yaml');
  if (existsSync(yamlPath)) {
    let yamlContent = readFileSync(yamlPath, 'utf-8');
    const newRoute = `  - method: ${method}\n    path: ${route}\n    handler: ${handlerName}Handler`;
    if (!yamlContent.includes(`${method} ${route}`)) {
      yamlContent = yamlContent.replace(
        /routes:\s*\n/,
        `routes:\n${newRoute}\n`
      );
      writeFileSync(yamlPath, yamlContent);
      console.log(chalk.green(`  updated: plugin.yaml routes`));
    }
  }

  console.log(chalk.bold(`\nHandler ${handlerName}Handler created in packages/${plugin}/src/handlers/`));
  console.log(`  Route: ${method} ${route}`);
}

function toPascalCase(str: string): string {
  return str.split(/[-_]/).map(p => p.charAt(0).toUpperCase() + p.slice(1)).join('');
}
