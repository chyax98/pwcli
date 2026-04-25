import type { Command } from 'commander';
import { managedWait } from '../core/managed.js';
import { printCommandError, printCommandResult } from '../utils/output.js';

export function registerWaitCommand(program: Command): void {
  program
    .command('wait [target]')
    .description('Wait for a ref, text, selector, networkidle, request, response, or delay')
    .option('--text <text>', 'Wait for exact text to appear')
    .option('--selector <selector>', 'Wait for selector')
    .option('--networkidle', 'Wait until the page reaches networkidle')
    .option('--request <url>', 'Wait for a matching request')
    .option('--response <url>', 'Wait for a matching response')
    .option('--method <method>', 'Restrict request/response by method')
    .option('--status <code>', 'Restrict response by status')
    .action(async (target: string | undefined, options: Record<string, string | boolean>) => {
      try {
        printCommandResult(
          'wait',
          await managedWait({
            target:
              target === 'networkIdle' || target === 'networkidle' ? undefined : target,
            text: typeof options.text === 'string' ? options.text : undefined,
            selector: typeof options.selector === 'string' ? options.selector : undefined,
            networkidle:
              Boolean(options.networkidle) ||
              target === 'networkIdle' ||
              target === 'networkidle',
          }),
        );
      } catch (error) {
        printCommandError('wait', {
          code: 'WAIT_FAILED',
          message: error instanceof Error ? error.message : 'wait failed',
          suggestions: [
            'Pass exactly one condition',
            'Use `pw wait 2000`, `pw wait e6`, `pw wait --selector main`, or `pw wait --networkidle`',
          ],
        });
        process.exitCode = 1;
      }
    });
}
