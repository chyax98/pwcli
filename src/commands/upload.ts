import type { Command } from 'commander';
import { managedUpload } from '../core/managed.js';
import { printCommandError, printCommandResult } from '../utils/output.js';

export function registerUploadCommand(program: Command): void {
  program
    .command('upload [parts...]')
    .description('Upload files by aria ref or selector')
    .option('--selector <selector>', 'Selector target')
    .action(async (parts: string[], options: { selector?: string }) => {
      try {
        const values = Array.isArray(parts) ? parts : [];
        const ref = options.selector ? undefined : values[0];
        const files = options.selector ? values : values.slice(1);
        if (!files.length) {
          throw new Error('upload requires at least one file');
        }
        printCommandResult(
          'upload',
          await managedUpload({
            ref,
            selector: options.selector,
            files,
          }),
        );
      } catch (error) {
        printCommandError('upload', {
          code: 'UPLOAD_FAILED',
          message: error instanceof Error ? error.message : 'upload failed',
          suggestions: [
            'Use `pw upload e7 ./file.png` or `pw upload --selector input[type=file] ./file.png`',
          ],
        });
        process.exitCode = 1;
      }
    });
}
