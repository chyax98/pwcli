import { stdin as input, stdout as output } from "node:process";
import {
  callMcpTool,
  getMcpServerInitializeResult,
  listMcpTools,
} from "../../domain/mcp/service.js";

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
  annotations?: Record<string, unknown>;
};

const TOOLS: McpTool[] = listMcpTools();

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
        writeResult(message.id, getMcpServerInitializeResult());
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
        const toolName = expectNonEmptyString(params.name, "name");
        const argumentsRecord = readToolArguments(params.arguments);
        const result = await callMcpTool(toolName, argumentsRecord);
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

function expectNonEmptyString(value: unknown, key: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${key} must be a non-empty string`);
  }
  return value.trim();
}

function readToolArguments(value: unknown): Record<string, unknown> {
  if (value === undefined) {
    return {};
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("tool arguments must be an object");
  }
  return value as Record<string, unknown>;
}
