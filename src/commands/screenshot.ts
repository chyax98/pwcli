import type { Command } from 'commander';
import { managedScreenshot } from '../core/managed.js';
import { printCommandError, printCommandResult } from '../utils/output.js';

export function registerScreenshotCommand(program: Command): void {
  program
    .command('screenshot [ref]')
    .description('Capture a screenshot of the page or an aria-ref target')
    .option('--selector <selector>', 'Selector target')
    .option('--path <path>', 'Output file path')
    .option('--full-page', 'Capture the full page')
    .action(async (ref: string | undefined, options: { selector?: string; path?: string; fullPage?: boolean }) => {
      try {
        printCommandResult(
          'screenshot',
          await managedScreenshot({
            ref,
            selector: options.selector,
            path: options.path,
            fullPage: options.fullPage,
          }),
        );
      } catch (error) {
        printCommandError('screenshot', {
          code: 'SCREENSHOT_FAILED',
          message: error instanceof Error ? error.message : 'screenshot failed',
          suggestions: ['Use `pw screenshot` or `pw screenshot e6 --path out.png`'],
        });
        process.exitCode = 1;
      }
    });
}
