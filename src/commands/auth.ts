import type { Command } from 'commander';
import { managedRunCode } from '../core/managed.js';
import { loadPluginSource, parseKeyValueArgs, resolvePluginPath } from '../plugins/resolve.js';
import { printCommandError, printCommandResult } from '../utils/output.js';

function buildPluginInvocationSource(pluginSource: string, pluginArgs: Record<string, string>) {
  return `async page => {
    const plugin = (${pluginSource});
    return await plugin(page, ${JSON.stringify(pluginArgs)});
  }`;
}

export function registerAuthCommand(program: Command): void {
  program
    .command('auth <plugin>')
    .description('Run a local auth plugin inside the default managed session')
    .option('--arg <key=value>', 'Plugin argument', (value, acc) => {
      acc.push(value);
      return acc;
    }, [] as string[])
    .action(async (plugin: string, options: { arg?: string[] }) => {
      try {
        const path = resolvePluginPath(plugin);
        if (!path) {
          throw new Error(`plugin '${plugin}' not found`);
        }

        const pluginSource = loadPluginSource(path);
        const args = parseKeyValueArgs(options.arg);
        const result = await managedRunCode({
          source: buildPluginInvocationSource(pluginSource, args),
        });

        printCommandResult('auth', {
          session: result.session,
          page: result.page,
          data: {
            plugin,
            pluginPath: path,
            result: result.data.result,
            output: result.data.output,
          },
        });
      } catch (error) {
        printCommandError('auth', {
          code: 'AUTH_FAILED',
          message: error instanceof Error ? error.message : 'auth failed',
          suggestions: [
            'Create plugins/<name>.js or ~/.pwcli/plugins/<name>.js',
            'Export a function like: async (page, args) => { ... }',
          ],
        });
        process.exitCode = 1;
      }
    });
}
