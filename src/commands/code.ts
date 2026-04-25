import type { Command } from 'commander';
import { managedRunCode } from '../core/managed.js';
import { printCommandError, printCommandResult } from '../utils/output.js';

export function registerCodeCommand(program: Command): void {
  program
    .command('code [source]')
    .description('Run Playwright code in the default managed browser session')
    .option('--file <path>', 'Run code from a local file')
    .action(async (source: string | undefined, options: { file?: string }) => {
      try {
        printCommandResult(
          'code',
          await managedRunCode({
            source,
            file: options.file,
          }),
        );
      } catch (error) {
        printCommandError('code', {
          code: 'CODE_EXECUTION_FAILED',
          message: error instanceof Error ? error.message : 'code execution failed',
          suggestions: [
            'Pass inline code like: pw code "async page => { await page.goto(\'https://example.com\'); return await page.title(); }"',
            'Or pass --file <path> with code that evaluates to a function taking page',
          ],
        });
        process.exitCode = 1;
      }
    });
}
