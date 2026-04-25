#!/usr/bin/env node

import { Command } from 'commander';
import { registerCommands } from './commands/index.js';
import { CLI_VERSION } from './version.js';

const program = new Command();

program
  .name('pw')
  .description('Agent-first Playwright orchestration CLI for internal use')
  .version(CLI_VERSION);

registerCommands(program);

await program.parseAsync(process.argv);
