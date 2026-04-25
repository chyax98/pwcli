import type { Command } from 'commander';
import { runBatch } from '../core/batch.js';
import { printJson } from '../utils/output.js';

export function registerBatchCommand(program: Command): void {
  program
    .command('batch <steps...>')
    .description('Run multiple semantic commands against the default managed session')
    .option('--continue-on-error', 'Continue after a failed step')
    .action(
      async (
        steps: string[],
        options: { continueOnError?: boolean },
      ) => {
        try {
          printJson({
            ok: true,
            command: 'batch',
            data: await runBatch({
              steps,
              continueOnError: options.continueOnError,
            }),
          });
        } catch (error) {
          printJson({
            ok: false,
            command: 'batch',
            error: {
              code: 'BATCH_FAILED',
              message: error instanceof Error ? error.message : 'batch failed',
              retryable: false,
              suggestions: [
                'Pass quoted steps, for example: pw batch "open https://example.com" "code async (page) => { return await page.title(); }"',
              ],
            },
          });
          process.exitCode = 1;
        }
      },
    );
}
