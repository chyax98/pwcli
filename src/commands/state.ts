import type { Command } from 'commander';
import { managedStateLoad, managedStateSave } from '../core/managed.js';
import { printCommandError, printCommandResult } from '../utils/output.js';

export function registerStateCommand(program: Command): void {
  program
    .command('state <action> [file]')
    .description('Save or load storage state for the default managed session')
    .action(async (action: string, file?: string) => {
      try {
        if (action === 'save') {
          printCommandResult('state save', await managedStateSave(file));
          return;
        }
        if (action === 'load' && file) {
          printCommandResult('state load', await managedStateLoad(file));
          return;
        }
        throw new Error('state requires `save [file]` or `load <file>`');
      } catch (error) {
        printCommandError('state', {
          code: 'STATE_FAILED',
          message: error instanceof Error ? error.message : 'state failed',
          suggestions: ['Use `pw state save auth.json` or `pw state load auth.json`'],
        });
        process.exitCode = 1;
      }
    });
}
