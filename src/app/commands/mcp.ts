import type { Command } from "commander";
import { runMcpServer } from "../../infra/mcp/server.js";
import { printCommandError, printCommandResult } from "../output.js";

export function registerMcpCommand(program: Command): void {
  const mcp = program.command("mcp").description("Expose pwcli as a minimal MCP stdio server");

  mcp
    .command("schema")
    .description("Show MCP server availability and transport")
    .action(() => {
      printCommandResult("mcp schema", {
        data: {
          transport: "stdio",
          command: "pw mcp serve",
          server: "pwcli",
          protocol: "MCP",
        },
      });
    });

  mcp
    .command("serve")
    .description("Start the pwcli MCP stdio server")
    .action(async () => {
      try {
        await runMcpServer();
      } catch (error) {
        printCommandError("mcp serve", {
          code: "MCP_SERVER_FAILED",
          message: error instanceof Error ? error.message : "mcp serve failed",
        });
        process.exitCode = 1;
      }
    });
}
