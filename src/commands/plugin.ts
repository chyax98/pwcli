import type { Command } from 'commander';
import { listPluginNames, resolvePluginPath } from '../plugins/resolve.js';
import { printCommandError, printCommandResult } from '../utils/output.js';

export function registerPluginCommand(program: Command): void {
  const plugin = program.command('plugin').description('Inspect local pwcli plugins');

  plugin
    .command('list')
    .description('List discovered local plugins')
    .action(() => {
      printCommandResult('plugin list', {
        data: {
          plugins: listPluginNames(),
        },
      });
    });

  plugin
    .command('path <name>')
    .description('Show resolved local plugin path')
    .action((name: string) => {
      const path = resolvePluginPath(name);
      if (!path) {
        printCommandError('plugin path', {
          code: 'PLUGIN_NOT_FOUND',
          message: `plugin '${name}' not found`,
          suggestions: ['Create plugins/<name>.js or ~/.pwcli/plugins/<name>.js'],
        });
        process.exitCode = 1;
        return;
      }

      printCommandResult('plugin path', {
        data: {
          name,
          path,
        },
      });
    });
}
