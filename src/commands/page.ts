import type { Command } from 'commander';
import { managedPageCurrent, managedPageFrames, managedPageList } from '../core/managed.js';
import { printCommandError, printCommandResult } from '../utils/output.js';

export function registerPageCommand(program: Command): void {
  const page = program.command('page').description('Inspect current page, tabs, and frames');

  page
    .command('current')
    .description('Show current page truth')
    .action(async () => {
      try {
        printCommandResult('page current', await managedPageCurrent());
      } catch (error) {
        printCommandError('page current', {
          code: 'PAGE_CURRENT_FAILED',
          message: error instanceof Error ? error.message : 'page current failed',
          suggestions: ['Run `pw open <url>` before inspecting the current page'],
        });
        process.exitCode = 1;
      }
    });

  page
    .command('list')
    .description('List pages in the current runtime session')
    .action(async () => {
      try {
        printCommandResult('page list', await managedPageList());
      } catch (error) {
        printCommandError('page list', {
          code: 'PAGE_LIST_FAILED',
          message: error instanceof Error ? error.message : 'page list failed',
          suggestions: ['Run `pw open <url>` before listing pages'],
        });
        process.exitCode = 1;
      }
    });

  page
    .command('frames')
    .description('List frames of the current page')
    .action(async () => {
      try {
        printCommandResult('page frames', await managedPageFrames());
      } catch (error) {
        printCommandError('page frames', {
          code: 'PAGE_FRAMES_FAILED',
          message: error instanceof Error ? error.message : 'page frames failed',
          suggestions: ['Run `pw open <url>` before listing frames'],
        });
        process.exitCode = 1;
      }
    });
}
