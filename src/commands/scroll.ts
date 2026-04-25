import type { Command } from 'commander';
import { managedScroll } from '../core/managed.js';
import { printCommandError, printCommandResult } from '../utils/output.js';

export function registerScrollCommand(program: Command): void {
  program
    .command('scroll <direction> [distance]')
    .description('Scroll the current page by direction')
    .action(async (direction: 'up' | 'down' | 'left' | 'right', distance?: string) => {
      try {
        printCommandResult(
          'scroll',
          await managedScroll({
            direction,
            distance: distance ? Number(distance) : undefined,
          }),
        );
      } catch (error) {
        printCommandError('scroll', {
          code: 'SCROLL_FAILED',
          message: error instanceof Error ? error.message : 'scroll failed',
          suggestions: ['Use `pw scroll down` or `pw scroll right 240`'],
        });
        process.exitCode = 1;
      }
    });
}
