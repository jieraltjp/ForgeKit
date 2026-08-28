import { spawn } from 'child_process';
import { resolve } from 'path';
import chalk from 'chalk';

export async function runApp(options: { app: string }) {
  const appPath = resolve(process.cwd(), options.app);
  const distIndex = resolve(appPath, 'dist/index.js');

  console.log(chalk.blue(`\nStarting ForgeKit app: ${options.app}\n`));

  const child = spawn('node', [distIndex], {
    cwd: appPath,
    stdio: 'inherit',
    shell: true,
  });

  child.on('exit', (code) => {
    process.exit(code ?? 0);
  });
}
