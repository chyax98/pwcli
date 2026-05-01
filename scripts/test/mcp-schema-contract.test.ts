import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { resolve } from "node:path";

type CliResult = {
  code: number | null;
  stdout: string;
  stderr: string;
  json: unknown;
};

const repoRoot = resolve(import.meta.dirname, "..", "..");
const cliPath = resolve(repoRoot, "dist", "cli.js");

function runPw(args: string[]) {
  return new Promise<CliResult>((resolveResult, reject) => {
    const child = spawn(process.execPath, [cliPath, ...args], {
      cwd: repoRoot,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      const trimmed = stdout.trim();
      let json: unknown = null;
      if (trimmed) {
        try {
          json = JSON.parse(trimmed);
        } catch (error) {
          reject(
            new Error(
              `Failed to parse JSON output for ${args.join(" ")}: ${
                error instanceof Error ? error.message : String(error)
              }\nstdout=${stdout}\nstderr=${stderr}`,
            ),
          );
          return;
        }
      }
      resolveResult({ code, stdout, stderr, json });
    });
  });
}

const result = await runPw(["mcp", "schema", "--output", "json"]);
assert.equal(result.code, 0, `mcp schema failed: ${JSON.stringify(result)}`);

const envelope = result.json as {
  ok: boolean;
  command: string;
  data: {
    protocol: {
      name: string;
      version: string;
    };
    server: {
      name: string;
      version: string;
    };
    transport: {
      type: string;
      command: string;
      args: string[];
    };
    capabilities: {
      tools: {
        listChanged: boolean;
      };
    };
    surface: {
      contractVersion: number;
      kind: string;
      authoritativeSurface: string;
      commandParity: string;
      lanes: string[];
      toolCount: number;
      tools: Array<{
        name: string;
        boundary: string;
        lane: string;
        authoritativeCommand: string;
        readOnly: boolean;
        inputSchema: {
          additionalProperties: boolean;
        };
      }>;
    };
  };
};

assert.equal(envelope.ok, true);
assert.equal(envelope.command, "mcp schema");
assert.deepEqual(envelope.data.protocol, {
  name: "MCP",
  version: "2024-11-05",
});
assert.deepEqual(envelope.data.server, {
  name: "pwcli",
  version: "0.0.0-dev",
});
assert.deepEqual(envelope.data.transport, {
  type: "stdio",
  command: "pw",
  args: ["mcp", "serve"],
});
assert.deepEqual(envelope.data.capabilities, {
  tools: {
    listChanged: false,
  },
});
assert.equal(envelope.data.surface.contractVersion, 1);
assert.equal(envelope.data.surface.kind, "thin-wrapper");
assert.equal(envelope.data.surface.authoritativeSurface, "cli");
assert.equal(envelope.data.surface.commandParity, "subset");
assert.ok(envelope.data.surface.lanes.includes("session"));
assert.ok(envelope.data.surface.lanes.includes("diagnostics"));
assert.equal(envelope.data.surface.toolCount, envelope.data.surface.tools.length);

const sessionCreate = envelope.data.surface.tools.find((tool) => tool.name === "session_create");
assert.ok(sessionCreate);
assert.equal(sessionCreate.boundary, "thin-wrapper");
assert.equal(sessionCreate.lane, "session");
assert.equal(sessionCreate.authoritativeCommand, "pw session create");
assert.equal(sessionCreate.readOnly, false);
assert.equal(sessionCreate.inputSchema.additionalProperties, false);

const sessionList = envelope.data.surface.tools.find((tool) => tool.name === "session_list");
assert.ok(sessionList);
assert.equal(sessionList.boundary, "thin-wrapper");
assert.equal(sessionList.lane, "session");
assert.equal(sessionList.authoritativeCommand, "pw session list");
assert.equal(sessionList.readOnly, true);
assert.equal(sessionList.inputSchema.additionalProperties, false);
