import type { Command } from 'commander';
import { managedPress } from '../core/managed.js';
import { printCommandError, printCommandResult } from '../utils/output.js';

export function registerPressCommand(program: Command): void {
  program
    .command('press <key>')
    .description('Press a keyboard key in the default managed session')
    .action(async (key: string) => {
      try {
        printCommandResult('press', await managedPress(key));
      } catch (error) {
        printCommandError('press', {
          code: 'PRESS_FAILED',
          message: error instanceof Error ? error.message : 'press failed',
          suggestions: ['Use keys like Enter, Tab, ArrowDown, Escape'],
        });
        process.exitCode = 1;
      }
    });
}
