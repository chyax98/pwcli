import type { Command } from 'commander';
import { managedTrace } from '../core/managed.js';
import { printCommandError, printCommandResult } from '../utils/output.js';

export function registerTraceCommand(program: Command): void {
  program
    .command('trace <action>')
    .description('Start or stop tracing in the default managed session')
    .action(async (action: string) => {
      try {
        if (action !== 'start' && action !== 'stop') {
          throw new Error('trace requires start or stop');
        }
        printCommandResult('trace', await managedTrace(action));
      } catch (error) {
        printCommandError('trace', {
          code: 'TRACE_FAILED',
          message: error instanceof Error ? error.message : 'trace failed',
          suggestions: ['Use `pw trace start` or `pw trace stop`'],
        });
        process.exitCode = 1;
      }
    });
}
