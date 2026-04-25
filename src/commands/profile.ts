import { existsSync } from 'node:fs';
import type { Command } from 'commander';
import { managedOpen } from '../core/managed.js';
import { printCommandError, printCommandResult } from '../utils/output.js';

export function registerProfileCommand(program: Command): void {
  const profile = program.command('profile').description('Inspect or use browser profiles');

  profile
    .command('inspect <path>')
    .description('Inspect a profile path')
    .action((path: string) => {
      printCommandResult('profile inspect', {
        data: {
          path,
          exists: existsSync(path),
        },
      });
    });

  profile
    .command('open <path> <url>')
    .description('Open a URL with a persistent browser profile')
    .action(async (path: string, url: string) => {
      try {
        printCommandResult(
          'profile open',
          await managedOpen(url, {
            profile: path,
            persistent: true,
            reset: true,
          }),
        );
      } catch (error) {
        printCommandError('profile open', {
          code: 'PROFILE_OPEN_FAILED',
          message: error instanceof Error ? error.message : 'profile open failed',
          suggestions: ['Pass an existing writable browser profile path'],
        });
        process.exitCode = 1;
      }
    });
}
