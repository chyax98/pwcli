import type { Command } from 'commander';
import {
  getPackagedSkillInfo,
  installPackagedSkill,
} from '../core/skill-path.js';
import { printJson, printSuccess } from '../utils/output.js';

export function registerSkillCommand(program: Command): void {
  const skill = program.command('skill').description('Inspect and install packaged pwcli skills');

  skill
    .command('path')
    .description('Show the packaged skill path')
    .action(() => {
      printSuccess('skill path', getPackagedSkillInfo());
    });

  skill
    .command('install <dir>')
    .description('Install the packaged skill into <dir>/pwcli')
    .action((dir: string) => {
      try {
        printSuccess('skill install', installPackagedSkill(dir));
      } catch (error) {
        printJson({
          ok: false,
          command: 'skill install',
          error: {
            code: 'SKILL_INSTALL_FAILED',
            message: error instanceof Error ? error.message : 'skill install failed',
            retryable: false,
            suggestions: [
              'Pass a writable parent directory',
              'Do not install into the packaged skill source directory',
            ],
          },
        });
        process.exitCode = 1;
      }
    });
}
