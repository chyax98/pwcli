import type { Command } from 'commander';
import {
  managedEnvironmentClockInstall,
  managedEnvironmentClockResume,
  managedEnvironmentClockSet,
  managedEnvironmentGeolocationSet,
  managedEnvironmentOffline,
  managedEnvironmentPermissionsClear,
  managedEnvironmentPermissionsGrant,
} from '../../domain/environment/service.js';
import { printCommandError, printCommandResult } from '../output.js';
import {
  addSessionOption,
  printSessionAwareCommandError,
  requireSessionName,
} from './session-options.js';

function printEnvironmentCommandError(
  command: string,
  error: unknown,
  fallback: {
    code: string;
    message: string;
    suggestions: string[];
  },
) {
  const message = error instanceof Error ? error.message : String(error);
  const [code, ...rest] = message.split(':');
  if (code === 'CLOCK_LIMITATION') {
    printCommandError(command, {
      code,
      message: rest.join(':') || 'Clock emulation is unavailable on the current managed session substrate.',
      suggestions: [
        'Use offline, geolocation, or permissions controls on the current managed session.',
        'If clock emulation is required, recreate the session earlier in the flow and retry `pw environment clock install` before heavy page activity.',
      ],
    });
    return;
  }
  if (code === 'ENVIRONMENT_LIMITATION') {
    printCommandError(command, {
      code,
      message:
        rest.join(':') ||
        'The current managed session substrate did not complete this environment mutation in time.',
      suggestions: [
        'Retry on a fresh managed session with less page activity.',
        'If this keeps timing out, treat the capability as unsupported on the current managed substrate.',
      ],
    });
    return;
  }
  if (code === 'CLOCK_REQUIRES_INSTALL') {
    printCommandError(command, {
      code,
      message: rest.join(':') || 'Clock install must run before this clock command.',
      suggestions: [
        'Run `pw environment clock install --session <name>` first.',
        'Retry `clock set` or `clock resume` on the same managed session.',
      ],
    });
    return;
  }
  if (code === 'INVALID_GEOLOCATION') {
    printCommandError(command, {
      code,
      message: rest.join(':') || 'Invalid geolocation coordinates.',
      suggestions: [
        'Latitude must be between -90 and 90.',
        'Longitude must be between -180 and 180.',
      ],
    });
    return;
  }
  if (code === 'PERMISSIONS_REQUIRED') {
    printCommandError(command, {
      code,
      message: rest.join(':') || 'At least one permission is required.',
      suggestions: [
        'Pass one or more permissions, for example `pw environment permissions grant geolocation clipboard-read --session bug-a`.',
      ],
    });
    return;
  }
  printSessionAwareCommandError(command, error, fallback);
}

function parseCoordinate(value: string, label: 'lat' | 'lng') {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`INVALID_GEOLOCATION:${label} must be a finite number.`);
  }
  if (label === 'lat' && (parsed < -90 || parsed > 90)) {
    throw new Error('INVALID_GEOLOCATION:lat must be between -90 and 90.');
  }
  if (label === 'lng' && (parsed < -180 || parsed > 180)) {
    throw new Error('INVALID_GEOLOCATION:lng must be between -180 and 180.');
  }
  return parsed;
}

export function registerEnvironmentCommand(program: Command): void {
  const environment = program
    .command('environment')
    .description('Control managed-session network, geolocation, permissions, and clock state');

  addSessionOption(
    environment
      .command('offline <mode>')
      .description('Set managed-session network offline mode'),
  ).action(async (mode: string, options: { session?: string }, command: Command) => {
    try {
      const sessionName = requireSessionName(options, command);
      if (mode !== 'on' && mode !== 'off') {
        throw new Error('environment offline requires on or off');
      }
      printCommandResult(
        'environment offline',
        await managedEnvironmentOffline(mode, { sessionName }),
      );
    } catch (error) {
      printEnvironmentCommandError('environment offline', error, {
        code: 'ENVIRONMENT_OFFLINE_FAILED',
        message: 'environment offline failed',
        suggestions: [
          'Use `pw environment offline on --session bug-a` to emulate network loss.',
          'Use `pw environment offline off --session bug-a` to restore network access.',
        ],
      });
      process.exitCode = 1;
    }
  });

  const geolocation = environment
    .command('geolocation')
    .description('Control managed-session geolocation state');

  addSessionOption(
    geolocation
      .command('set')
      .description('Set geolocation on the current BrowserContext')
      .requiredOption('--lat <lat>', 'Latitude between -90 and 90')
      .requiredOption('--lng <lng>', 'Longitude between -180 and 180')
      .option('--accuracy <accuracy>', 'Optional geolocation accuracy in meters'),
  ).action(
    async (
      options: {
        session?: string;
        lat: string;
        lng: string;
        accuracy?: string;
      },
      command: Command,
    ) => {
      try {
        const sessionName = requireSessionName(options, command);
        const latitude = parseCoordinate(options.lat, 'lat');
        const longitude = parseCoordinate(options.lng, 'lng');
        const accuracy =
          options.accuracy === undefined ? undefined : Number(options.accuracy);
        if (accuracy !== undefined && (!Number.isFinite(accuracy) || accuracy < 0)) {
          throw new Error('INVALID_GEOLOCATION:accuracy must be a non-negative number.');
        }
        printCommandResult(
          'environment geolocation set',
          await managedEnvironmentGeolocationSet({
            sessionName,
            latitude,
            longitude,
            ...(accuracy !== undefined ? { accuracy } : {}),
          }),
        );
      } catch (error) {
        printEnvironmentCommandError('environment geolocation set', error, {
          code: 'ENVIRONMENT_GEOLOCATION_SET_FAILED',
          message: 'environment geolocation set failed',
          suggestions: [
            'Use `pw environment geolocation set --session bug-a --lat 37.7749 --lng -122.4194`.',
            'Grant geolocation separately with `pw environment permissions grant geolocation --session bug-a`.',
          ],
        });
        process.exitCode = 1;
      }
    },
  );

  const permissions = environment
    .command('permissions')
    .description('Control managed-session BrowserContext permissions');

  addSessionOption(
    permissions
      .command('grant <perm...>')
      .description('Grant one or more permissions on the current BrowserContext'),
  ).action(
    async (perm: string[], options: { session?: string }, command: Command) => {
      try {
        const sessionName = requireSessionName(options, command);
        if (perm.length === 0) {
          throw new Error('PERMISSIONS_REQUIRED:grant requires at least one permission.');
        }
        printCommandResult(
          'environment permissions grant',
          await managedEnvironmentPermissionsGrant({
            sessionName,
            permissions: perm,
          }),
        );
      } catch (error) {
        printEnvironmentCommandError('environment permissions grant', error, {
          code: 'ENVIRONMENT_PERMISSIONS_GRANT_FAILED',
          message: 'environment permissions grant failed',
          suggestions: [
            'Use `pw environment permissions grant geolocation clipboard-read --session bug-a`.',
          ],
        });
        process.exitCode = 1;
      }
    },
  );

  addSessionOption(
    permissions
      .command('clear')
      .description('Clear all BrowserContext permission overrides'),
  ).action(async (options: { session?: string }, command: Command) => {
    try {
      const sessionName = requireSessionName(options, command);
      printCommandResult(
        'environment permissions clear',
        await managedEnvironmentPermissionsClear({ sessionName }),
      );
    } catch (error) {
      printEnvironmentCommandError('environment permissions clear', error, {
        code: 'ENVIRONMENT_PERMISSIONS_CLEAR_FAILED',
        message: 'environment permissions clear failed',
        suggestions: ['Use `pw environment permissions clear --session bug-a`.'],
      });
      process.exitCode = 1;
    }
  });

  const clock = environment
    .command('clock')
    .description('Control managed-session clock emulation');

  addSessionOption(
    clock.command('install').description('Install fake timers on the managed session context'),
  ).action(async (options: { session?: string }, command: Command) => {
    try {
      const sessionName = requireSessionName(options, command);
      printCommandResult(
        'environment clock install',
        await managedEnvironmentClockInstall({ sessionName }),
      );
    } catch (error) {
      printEnvironmentCommandError('environment clock install', error, {
        code: 'ENVIRONMENT_CLOCK_INSTALL_FAILED',
        message: 'environment clock install failed',
        suggestions: [
          'Run `pw environment clock install --session bug-a` before relying on clock controls.',
        ],
      });
      process.exitCode = 1;
    }
  });

  addSessionOption(
    clock
      .command('set <iso>')
      .description('Pause the managed-session clock at a target ISO timestamp'),
  ).action(async (iso: string, options: { session?: string }, command: Command) => {
    try {
      const sessionName = requireSessionName(options, command);
      const date = new Date(iso);
      if (Number.isNaN(date.getTime())) {
        throw new Error('CLOCK_LIMITATION:clock set requires a valid ISO timestamp.');
      }
      printCommandResult(
        'environment clock set',
        await managedEnvironmentClockSet(date.toISOString(), { sessionName }),
      );
    } catch (error) {
      printEnvironmentCommandError('environment clock set', error, {
        code: 'ENVIRONMENT_CLOCK_SET_FAILED',
        message: 'environment clock set failed',
        suggestions: [
          'Run `pw environment clock install --session bug-a` first.',
          'Use a valid ISO timestamp like `2026-04-26T12:00:00.000Z`.',
        ],
      });
      process.exitCode = 1;
    }
  });

  addSessionOption(
    clock.command('resume').description('Resume managed-session clock time flow'),
  ).action(async (options: { session?: string }, command: Command) => {
    try {
      const sessionName = requireSessionName(options, command);
      printCommandResult(
        'environment clock resume',
        await managedEnvironmentClockResume({ sessionName }),
      );
    } catch (error) {
      printEnvironmentCommandError('environment clock resume', error, {
        code: 'ENVIRONMENT_CLOCK_RESUME_FAILED',
        message: 'environment clock resume failed',
        suggestions: [
          'Run `pw environment clock install --session bug-a` first.',
          'If you already paused the clock, retry `pw environment clock resume --session bug-a`.',
        ],
      });
      process.exitCode = 1;
    }
  });
}
