import { stdin as input, stdout as output } from "node:process";
import { managedDiagnosticsDigest } from "../../domain/diagnostics/service.js";
import { managedExtractRun } from "../../domain/extraction/service.js";
import { managedAuthProbe } from "../../domain/identity-state/service.js";
import {
  applySessionDefaults,
  getManagedSessionStatus,
  getSessionDefaults,
  listAttachableBrowserServers,
  listManagedSessions,
  managedOpen,
} from "../../domain/session/service.js";
import { managedReadText, managedSnapshot } from "../../domain/interaction/service.js";
import { managedPageAssess } from "../../domain/workspace/service.js";

type JsonRpcMessage = {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: Record<string, unknown>;
  result?: unknown;
  error?: { code: number; message: string };
};

type McpTool = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
};

const PROTOCOL_VERSION = "2024-11-05";

const TOOLS: McpTool[] = [
  {
    name: "session_create",
    description: "Create or reset a managed pwcli session",
    inputSchema: {
      type: "object",
      properties: {
        sessionName: { type: "string" },
        url: { type: "string" },
        headed: { type: "boolean" },
      },
      required: ["sessionName"],
    },
  },
  {
    name: "session_list",
    description: "List managed sessions",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "session_status",
    description: "Inspect one managed session status",
    inputSchema: {
      type: "object",
      properties: {
        sessionName: { type: "string" },
      },
      required: ["sessionName"],
    },
  },
  {
    name: "session_attachable_list",
    description: "List attachable browser servers in the current workspace",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "open",
    description: "Navigate an existing session to a URL",
    inputSchema: {
      type: "object",
      properties: {
        sessionName: { type: "string" },
        url: { type: "string" },
      },
      required: ["sessionName", "url"],
    },
  },
  {
    name: "page_assess",
    description: "Read-only page assessment summary",
    inputSchema: {
      type: "object",
      properties: {
        sessionName: { type: "string" },
      },
      required: ["sessionName"],
    },
  },
  {
    name: "auth_probe",
    description: "Read-only auth state probe",
    inputSchema: {
      type: "object",
      properties: {
        sessionName: { type: "string" },
        url: { type: "string" },
      },
      required: ["sessionName"],
    },
  },
  {
    name: "read_text",
    description: "Read visible text from the active page",
    inputSchema: {
      type: "object",
      properties: {
        sessionName: { type: "string" },
        maxChars: { type: "number" },
      },
      required: ["sessionName"],
    },
  },
  {
    name: "snapshot_interactive",
    description: "Read interactive snapshot",
    inputSchema: {
      type: "object",
      properties: {
        sessionName: { type: "string" },
      },
      required: ["sessionName"],
    },
  },
  {
    name: "diagnostics_digest",
    description: "Read session diagnostics digest",
    inputSchema: {
      type: "object",
      properties: {
        sessionName: { type: "string" },
        limit: { type: "number" },
      },
      required: ["sessionName"],
    },
  },
  {
    name: "extract_run",
    description: "Run one structured extraction recipe",
    inputSchema: {
      type: "object",
      properties: {
        sessionName: { type: "string" },
        recipePath: { type: "string" },
        out: { type: "string" },
      },
      required: ["sessionName", "recipePath"],
    },
  },
];

function writeMessage(message: JsonRpcMessage) {
  const body = JSON.stringify(message);
  output.write(`Content-Length: ${Buffer.byteLength(body, "utf8")}\r\n\r\n${body}`);
}

function writeResult(id: string | number | null | undefined, result: unknown) {
  writeMessage({
    jsonrpc: "2.0",
    id: id ?? null,
    result,
  });
}

function writeError(id: string | number | null | undefined, code: number, message: string) {
  writeMessage({
    jsonrpc: "2.0",
    id: id ?? null,
    error: { code, message },
  });
}

function expectString(params: Record<string, unknown>, key: string) {
  const value = params[key];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${key} must be a non-empty string`);
  }
  return value.trim();
}

function optionalString(params: Record<string, unknown>, key: string) {
  const value = params[key];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function optionalNumber(params: Record<string, unknown>, key: string) {
  const value = params[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function optionalBoolean(params: Record<string, unknown>, key: string) {
  return typeof params[key] === "boolean" ? (params[key] as boolean) : undefined;
}

async function createSession(params: Record<string, unknown>) {
  const sessionName = expectString(params, "sessionName");
  const url = optionalString(params, "url") ?? "about:blank";
  const headed = optionalBoolean(params, "headed");
  const defaults = await getSessionDefaults();
  const result = await managedOpen("about:blank", {
    sessionName,
    headed,
    reset: true,
  });
  const appliedDefaults = await applySessionDefaults({
    sessionName,
    traceEnabled: true,
  });
  const openResult =
    url === "about:blank"
      ? result
      : await managedOpen(url, {
          sessionName,
          reset: false,
        });
  return {
    ...openResult,
    data: {
      ...openResult.data,
      created: true,
      defaults,
      appliedDefaults,
    },
  };
}

async function callTool(name: string, params: Record<string, unknown>) {
  switch (name) {
    case "session_create":
      return await createSession(params);
    case "session_list":
      return {
        data: {
          count: (await listManagedSessions()).length,
          sessions: await listManagedSessions(),
        },
      };
    case "session_status":
      return {
        data: await getManagedSessionStatus(expectString(params, "sessionName")),
      };
    case "session_attachable_list":
      return {
        data: await listAttachableBrowserServers(),
      };
    case "open":
      return await managedOpen(expectString(params, "url"), {
        sessionName: expectString(params, "sessionName"),
        reset: false,
      });
    case "page_assess":
      return await managedPageAssess({
        sessionName: expectString(params, "sessionName"),
      });
    case "auth_probe":
      return await managedAuthProbe({
        sessionName: expectString(params, "sessionName"),
        url: optionalString(params, "url"),
      });
    case "read_text":
      return await managedReadText({
        sessionName: expectString(params, "sessionName"),
        maxChars: optionalNumber(params, "maxChars"),
      });
    case "snapshot_interactive":
      return await managedSnapshot({
        sessionName: expectString(params, "sessionName"),
        interactive: true,
      });
    case "diagnostics_digest":
      return await managedDiagnosticsDigest({
        sessionName: expectString(params, "sessionName"),
        limit: optionalNumber(params, "limit") ?? 5,
      });
    case "extract_run":
      return await managedExtractRun({
        sessionName: expectString(params, "sessionName"),
        recipePath: expectString(params, "recipePath"),
        out: optionalString(params, "out"),
      });
    default:
      throw new Error(`unknown tool '${name}'`);
  }
}

export async function runMcpServer() {
  let buffer = Buffer.alloc(0);

  input.on("data", (chunk) => {
    const nextChunk = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk));
    buffer = Buffer.concat([buffer, nextChunk]);
    void consumeBuffer();
  });

  await new Promise<void>((resolve) => {
    input.on("end", () => resolve());
  });

  async function consumeBuffer() {
    while (true) {
      const headerEnd = buffer.indexOf("\r\n\r\n");
      if (headerEnd === -1) {
        return;
      }
      const headerText = buffer.subarray(0, headerEnd).toString("utf8");
      const contentLengthMatch = headerText.match(/content-length:\s*(\d+)/i);
      if (!contentLengthMatch) {
        writeError(null, -32600, "missing Content-Length header");
        buffer = buffer.subarray(headerEnd + 4);
        continue;
      }
      const contentLength = Number(contentLengthMatch[1]);
      const totalLength = headerEnd + 4 + contentLength;
      if (buffer.length < totalLength) {
        return;
      }
      const body = buffer.subarray(headerEnd + 4, totalLength).toString("utf8");
      buffer = buffer.subarray(totalLength);
      await handleMessage(body);
    }
  }
}

async function handleMessage(body: string) {
  let message: JsonRpcMessage;
  try {
    message = JSON.parse(body);
  } catch (error) {
    writeError(null, -32700, error instanceof Error ? error.message : "parse error");
    return;
  }

  if (!message.method) {
    return;
  }

  try {
    switch (message.method) {
      case "initialize":
        writeResult(message.id, {
          protocolVersion: PROTOCOL_VERSION,
          serverInfo: {
            name: "pwcli",
            version: "0.0.0-dev",
          },
          capabilities: {
            tools: {},
          },
        });
        break;
      case "notifications/initialized":
        break;
      case "ping":
        writeResult(message.id, {});
        break;
      case "tools/list":
        writeResult(message.id, { tools: TOOLS });
        break;
      case "tools/call": {
        const params = (message.params ?? {}) as Record<string, unknown>;
        const toolName = expectString(params, "name");
        const argumentsRecord =
          params.arguments && typeof params.arguments === "object" && !Array.isArray(params.arguments)
            ? (params.arguments as Record<string, unknown>)
            : {};
        const result = await callTool(toolName, argumentsRecord);
        writeResult(message.id, {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
          structuredContent: result,
        });
        break;
      }
      default:
        writeError(message.id, -32601, `unsupported MCP method '${message.method}'`);
    }
  } catch (error) {
    writeError(message.id, -32000, error instanceof Error ? error.message : "tool failed");
  }
}
