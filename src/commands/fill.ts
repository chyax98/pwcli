import type { Command } from 'commander';
import { managedFill } from '../core/managed.js';
import { printCommandError, printCommandResult } from '../utils/output.js';

export function registerFillCommand(program: Command): void {
  program
    .command('fill [parts...]')
    .description('Fill an input by aria ref or selector')
    .option('--selector <selector>', 'Selector target when no ref is provided')
    .action(async (parts: string[], options: { selector?: string }) => {
      try {
        const values = Array.isArray(parts) ? parts : [];
        const ref = options.selector ? undefined : values[0];
        const value = options.selector ? values.join(' ') : values.slice(1).join(' ');
        if (!value) {
          throw new Error('fill requires a value');
        }
        printCommandResult(
          'fill',
          await managedFill({
            ref,
            selector: options.selector,
            value,
          }),
        );
      } catch (error) {
        printCommandError('fill', {
          code: 'FILL_FAILED',
          message: error instanceof Error ? error.message : 'fill failed',
          suggestions: ['Use `pw fill e3 value` or `pw fill --selector input value`'],
        });
        process.exitCode = 1;
      }
    });
}
