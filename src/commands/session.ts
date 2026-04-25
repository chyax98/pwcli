import type { Command } from 'commander';
import { getManagedSessionStatus, stopManagedSession } from '../session/cli-client.js';
import { printCommandError, printCommandResult } from '../utils/output.js';

export function registerSessionCommand(program: Command): void {
  const session = program.command('session').description('Inspect or stop the default managed session');

  session
    .command('status')
    .description('Show default managed session status')
    .action(async () => {
      try {
        const status = await getManagedSessionStatus();
        if (!status) {
          printCommandResult('session status', {
            data: {
              active: false,
            },
          });
          return;
        }
        printCommandResult('session status', {
          session: {
            scope: 'managed',
            name: status.name,
            default: true,
          },
          data: {
            active: status.alive,
            socketPath: status.socketPath,
            version: status.version,
            workspaceDir: status.workspaceDir,
          },
        });
      } catch (error) {
        printCommandError('session status', {
          code: 'SESSION_STATUS_FAILED',
          message: error instanceof Error ? error.message : 'session status failed',
          suggestions: ['Run `pw open <url>` to create the default session'],
        });
        process.exitCode = 1;
      }
    });

  session
    .command('close')
    .description('Close the default managed session')
    .action(async () => {
      try {
        const closed = await stopManagedSession();
        printCommandResult('session close', {
          data: {
            closed,
          },
        });
      } catch (error) {
        printCommandError('session close', {
          code: 'SESSION_CLOSE_FAILED',
          message: error instanceof Error ? error.message : 'session close failed',
          suggestions: ['Retry or remove the stale session files manually'],
        });
        process.exitCode = 1;
      }
    });
}
