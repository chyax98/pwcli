import type { Command } from 'commander';
import { printCommandError, printCommandResult } from '../utils/output.js';
import { managedSnapshot } from '../core/managed.js';

export function registerSnapshotCommand(program: Command): void {
  program
    .command('snapshot')
    .description('Capture an AI-friendly page snapshot')
    .option('--mode <mode>', 'Snapshot mode: ai|default')
    .action(async (_options: { mode?: 'ai' | 'default' }) => {
      try {
        printCommandResult('snapshot', await managedSnapshot());
      } catch (error) {
        printCommandError('snapshot', {
          code: 'SNAPSHOT_FAILED',
          message: error instanceof Error ? error.message : 'snapshot failed',
          suggestions: ['Run `pw open <url>` before taking a snapshot'],
        });
        process.exitCode = 1;
      }
    });
}
