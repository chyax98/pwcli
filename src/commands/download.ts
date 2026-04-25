import type { Command } from 'commander';
import { managedDownload } from '../core/managed.js';
import { printCommandError, printCommandResult } from '../utils/output.js';

export function registerDownloadCommand(program: Command): void {
  program
    .command('download [ref]')
    .description('Trigger a download from an aria ref or selector')
    .option('--selector <selector>', 'Selector target')
    .option('--path <path>', 'Optional output path')
    .action(async (ref: string | undefined, options: { selector?: string; path?: string }) => {
      try {
        printCommandResult(
          'download',
          await managedDownload({
            ref,
            selector: options.selector,
            path: options.path,
          }),
        );
      } catch (error) {
        printCommandError('download', {
          code: 'DOWNLOAD_FAILED',
          message: error instanceof Error ? error.message : 'download failed',
          suggestions: ['Use `pw download e6 --path ./file.bin` or selector mode'],
        });
        process.exitCode = 1;
      }
    });
}
