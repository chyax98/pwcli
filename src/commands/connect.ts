import type { Command } from 'commander';
import { managedOpen } from '../core/managed.js';
import { printCommandError, printCommandResult } from '../utils/output.js';

export function registerConnectCommand(program: Command): void {
  program
    .command('connect <endpoint>')
    .description('Attach the default managed session to an existing Playwright/CDP browser endpoint')
    .action(async (endpoint: string) => {
      try {
        printCommandResult(
          'connect',
          await managedOpen('about:blank', {
            reset: true,
            endpoint,
          } as any),
        );
      } catch (error) {
        printCommandError('connect', {
          code: 'CONNECT_FAILED',
          message: error instanceof Error ? error.message : 'connect failed',
          suggestions: ['Pass a reachable browser websocket/CDP endpoint'],
        });
        process.exitCode = 1;
      }
    });
}
