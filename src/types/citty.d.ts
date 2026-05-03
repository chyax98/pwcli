declare module "citty" {
  export type CommandDefinition = {
    meta?: {
      name?: string;
      version?: string;
      description?: string;
    };
    args?: Record<string, unknown>;
    subCommands?: Record<string, CommandDefinition | (() => Promise<unknown>)>;
    run?: (context: { args: Record<string, unknown>; rawArgs?: string[] }) => void | Promise<void>;
  };

  export function defineCommand<T extends CommandDefinition>(definition: T): T;
  export function runMain(command: CommandDefinition): Promise<void>;
  export function runCommand(
    command: CommandDefinition,
    options?: { rawArgs?: string[] },
  ): Promise<void>;
  export function renderUsage(
    command: CommandDefinition,
    parent?: CommandDefinition,
  ): Promise<string>;
}
