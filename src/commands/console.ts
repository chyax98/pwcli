import type { Command } from 'commander';
import { managedConsole } from '../core/managed.js';
import { printCommandError, printCommandResult } from '../utils/output.js';

export function registerConsoleCommand(program: Command): void {
  program
    .command('console')
    .description('Show recent console messages from the default managed session')
    .option('--level <level>', 'Minimum level: info|warning|error', 'info')
    .action(async (options: { level?: string }) => {
      try {
        printCommandResult('console', await managedConsole(options.level));
      } catch (error) {
        printCommandError('console', {
          code: 'CONSOLE_FAILED',
          message: error instanceof Error ? error.message : 'console failed',
          suggestions: ['Run `pw open <url>` before reading console output'],
        });
        process.exitCode = 1;
      }
    });
}
