import type { Command } from 'commander';
import { managedReadText } from '../core/managed.js';
import { printCommandError, printCommandResult } from '../utils/output.js';

export function registerReadTextCommand(program: Command): void {
  program
    .command('read-text')
    .description('Read visible text from the current page or a selector')
    .option('--selector <selector>', 'Read text from a specific selector')
    .option('--max-chars <count>', 'Limit output length')
    .action(async (options: { selector?: string; maxChars?: string }) => {
      try {
        printCommandResult(
          'read-text',
          await managedReadText({
          selector: options.selector,
          maxChars: options.maxChars ? Number(options.maxChars) : undefined,
          }),
        );
      } catch (error) {
        printCommandError('read-text', {
          code: 'READ_TEXT_FAILED',
          message: error instanceof Error ? error.message : 'read-text failed',
          suggestions: ['Run `pw open <url>` before reading page text'],
        });
        process.exitCode = 1;
      }
    });
}
