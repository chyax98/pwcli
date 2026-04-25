import type { Command } from 'commander';
import { managedNetwork } from '../core/managed.js';
import { printCommandError, printCommandResult } from '../utils/output.js';

export function registerNetworkCommand(program: Command): void {
  program
    .command('network')
    .description('Show recent network activity from the default managed session')
    .action(async () => {
      try {
        printCommandResult('network', await managedNetwork());
      } catch (error) {
        printCommandError('network', {
          code: 'NETWORK_FAILED',
          message: error instanceof Error ? error.message : 'network failed',
          suggestions: ['Run `pw open <url>` before reading network output'],
        });
        process.exitCode = 1;
      }
    });
}
