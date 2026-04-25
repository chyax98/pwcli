import type { Command } from 'commander';
import { managedType } from '../core/managed.js';
import { printCommandError, printCommandResult } from '../utils/output.js';

export function registerTypeCommand(program: Command): void {
  program
    .command('type [parts...]')
    .description('Type text into the focused element, aria ref, or selector')
    .option('--selector <selector>', 'Selector target when no ref is provided')
    .action(async (parts: string[], options: { selector?: string }) => {
      try {
        const values = Array.isArray(parts) ? parts : [];
        const ref = options.selector ? undefined : values.length > 1 ? values[0] : undefined;
        const value = options.selector
          ? values.join(' ')
          : values.length > 1
            ? values.slice(1).join(' ')
            : values[0];
        if (!value) {
          throw new Error('type requires a value');
        }
        printCommandResult(
          'type',
          await managedType({
            ref,
            selector: options.selector,
            value,
          }),
        );
      } catch (error) {
        printCommandError('type', {
          code: 'TYPE_FAILED',
          message: error instanceof Error ? error.message : 'type failed',
          suggestions: ['Use `pw type value` or `pw type e3 value`'],
        });
        process.exitCode = 1;
      }
    });
}
