import type { Command } from 'commander';
import { managedOpen } from '../core/managed.js';
import { printCommandError, printCommandResult } from '../utils/output.js';

export function registerOpenCommand(program: Command): void {
  program
    .command('open <url>')
    .description('Open a URL in the default managed browser session')
    .option('--headed', 'Launch a visible browser window')
    .option('--profile <path>', 'Use a persistent browser profile')
    .option('--persistent', 'Use a persistent browser profile')
    .action(async (url: string, options: { headed?: boolean; profile?: string; persistent?: boolean }) => {
      try {
        printCommandResult(
          'open',
          await managedOpen(url, {
            headed: options.headed,
            profile: options.profile,
            persistent: options.persistent || Boolean(options.profile),
          }),
        );
      } catch (error) {
        printCommandError('open', {
          code: 'OPEN_FAILED',
          message: error instanceof Error ? error.message : 'open failed',
          suggestions: [
            'Verify the URL is reachable',
            'Verify the local Playwright browser can launch normally',
          ],
        });
        process.exitCode = 1;
      }
    });
}
