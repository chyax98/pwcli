import { managedDiagnosticsDigest } from "../diagnostics/service.js";
import { managedExtractRun } from "../extraction/service.js";
import { managedAuthProbe } from "../identity-state/service.js";
import { managedReadText, managedSnapshot } from "../interaction/service.js";
import {
  applySessionDefaults,
  getManagedSessionStatus,
  getSessionDefaults,
  listAttachableBrowserServers,
  listManagedSessions,
  managedOpen,
} from "../session/service.js";
import { managedPageAssess } from "../workspace/service.js";

type ToolArgumentType = "boolean" | "number" | "string";

type McpToolSchemaProperty = {
  type: ToolArgumentType;
};

type McpToolSchema = {
  type: "object";
  properties: Record<string, McpToolSchemaProperty>;
  required?: string[];
  additionalProperties: false;
};

type McpToolAnnotations = {
  destructiveHint?: boolean;
  idempotentHint?: boolean;
  openWorldHint?: boolean;
  readOnlyHint?: boolean;
};

export type McpTool = {
  name: string;
  description: string;
  inputSchema: McpToolSchema;
  annotations?: McpToolAnnotations;
};

type McpToolLane =
  | "diagnostics"
  | "extraction"
  | "identity-state"
  | "interaction"
  | "navigation"
  | "session"
  | "workspace";

type McpToolContract = {
  tool: McpTool;
  lane: McpToolLane;
  authoritativeCommand: string;
  handler: (params: Record<string, unknown>) => Promise<unknown>;
};

type McpSchemaToolContract = McpTool & {
  authoritativeCommand: string;
  boundary: "thin-wrapper";
  lane: McpToolLane;
  readOnly: boolean;
};

export const MCP_PROTOCOL_VERSION = "2024-11-05";
export const MCP_SERVER_INFO = {
  name: "pwcli",
  version: "0.0.0-dev",
} as const;

const MCP_SURFACE_CONTRACT_VERSION = 1;

function objectSchema(
  properties: Record<string, McpToolSchemaProperty>,
  required: string[] = [],
): McpToolSchema {
  return {
    type: "object",
    properties,
    ...(required.length > 0 ? { required } : {}),
    additionalProperties: false,
  };
}

function readOnlyTool(
  name: string,
  description: string,
  inputSchema: McpToolSchema,
): McpTool {
  return {
    name,
    description,
    inputSchema,
    annotations: {
      destructiveHint: false,
      idempotentHint: true,
      readOnlyHint: true,
    },
  };
}

function statefulTool(
  name: string,
  description: string,
  inputSchema: McpToolSchema,
): McpTool {
  return {
    name,
    description,
    inputSchema,
    annotations: {
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
      readOnlyHint: false,
    },
  };
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

type AttachableBrowserServerList = Awaited<ReturnType<typeof listAttachableBrowserServers>>;
type AttachableBrowserServer = AttachableBrowserServerList["servers"][number];

function buildAttachableServerCapability(server: AttachableBrowserServer) {
  return {
    capability: "existing-browser-attach-target",
    available: Boolean(server.canConnect && server.endpoint),
    connectable: server.canConnect,
    endpointExposed: Boolean(server.endpoint),
    attachableId: server.id,
  };
}

function buildAttachableCapabilityProbe(attachable: AttachableBrowserServerList) {
  const connectableCount = attachable.servers.filter((server) => server.canConnect).length;
  const endpointCount = attachable.servers.filter((server) => Boolean(server.endpoint)).length;
  return {
    capability: "existing-browser-attach",
    supported: attachable.supported,
    available: attachable.servers.some((server) => Boolean(server.canConnect && server.endpoint)),
    attachableCount: attachable.count,
    connectableCount,
    endpointCount,
    workspaceScoped: true,
    ...(attachable.limitation ? { limitation: attachable.limitation } : {}),
  };
}

function projectAttachableBrowserServers(attachable: AttachableBrowserServerList) {
  return {
    ...attachable,
    servers: attachable.servers.map((server) => ({
      ...server,
      capability: buildAttachableServerCapability(server),
    })),
  };
}

const MCP_TOOLS: McpToolContract[] = [
  {
    tool: statefulTool(
      "session_create",
      "Create or reset a managed pwcli session",
      objectSchema(
        {
          sessionName: { type: "string" },
          url: { type: "string" },
          headed: { type: "boolean" },
        },
        ["sessionName"],
      ),
    ),
    lane: "session",
    authoritativeCommand: "pw session create",
    handler: createSession,
  },
  {
    tool: readOnlyTool(
      "session_list",
      "List managed sessions",
      objectSchema({}),
    ),
    lane: "session",
    authoritativeCommand: "pw session list",
    handler: async () => {
      const sessions = await listManagedSessions();
      return {
        data: {
          count: sessions.length,
          sessions,
        },
      };
    },
  },
  {
    tool: readOnlyTool(
      "session_status",
      "Inspect one managed session status",
      objectSchema(
        {
          sessionName: { type: "string" },
        },
        ["sessionName"],
      ),
    ),
    lane: "session",
    authoritativeCommand: "pw session status",
    handler: async (params) => {
      return {
        data: await getManagedSessionStatus(expectString(params, "sessionName")),
      };
    },
  },
  {
    tool: readOnlyTool(
      "session_attachable_list",
      "List attachable browser servers in the current workspace",
      objectSchema({}),
    ),
    lane: "session",
    authoritativeCommand: "pw session list --attachable",
    handler: async () => {
      const attachable = await listAttachableBrowserServers();
      return {
        data: {
          attachable: projectAttachableBrowserServers(attachable),
          capability: buildAttachableCapabilityProbe(attachable),
        },
      };
    },
  },
  {
    tool: statefulTool(
      "open",
      "Navigate an existing session to a URL",
      objectSchema(
        {
          sessionName: { type: "string" },
          url: { type: "string" },
        },
        ["sessionName", "url"],
      ),
    ),
    lane: "navigation",
    authoritativeCommand: "pw open",
    handler: async (params) => {
      return await managedOpen(expectString(params, "url"), {
        sessionName: expectString(params, "sessionName"),
        reset: false,
      });
    },
  },
  {
    tool: readOnlyTool(
      "page_assess",
      "Read-only page assessment summary",
      objectSchema(
        {
          sessionName: { type: "string" },
        },
        ["sessionName"],
      ),
    ),
    lane: "workspace",
    authoritativeCommand: "pw page assess",
    handler: async (params) => {
      return await managedPageAssess({
        sessionName: expectString(params, "sessionName"),
      });
    },
  },
  {
    tool: statefulTool(
      "auth_probe",
      "Read-only auth state probe",
      objectSchema(
        {
          sessionName: { type: "string" },
          url: { type: "string" },
        },
        ["sessionName"],
      ),
    ),
    lane: "identity-state",
    authoritativeCommand: "pw auth probe",
    handler: async (params) => {
      return await managedAuthProbe({
        sessionName: expectString(params, "sessionName"),
        url: optionalString(params, "url"),
      });
    },
  },
  {
    tool: readOnlyTool(
      "read_text",
      "Read visible text from the active page",
      objectSchema(
        {
          sessionName: { type: "string" },
          maxChars: { type: "number" },
        },
        ["sessionName"],
      ),
    ),
    lane: "interaction",
    authoritativeCommand: "pw read-text",
    handler: async (params) => {
      return await managedReadText({
        sessionName: expectString(params, "sessionName"),
        maxChars: optionalNumber(params, "maxChars"),
      });
    },
  },
  {
    tool: readOnlyTool(
      "snapshot_interactive",
      "Read interactive snapshot",
      objectSchema(
        {
          sessionName: { type: "string" },
        },
        ["sessionName"],
      ),
    ),
    lane: "interaction",
    authoritativeCommand: "pw snapshot -i",
    handler: async (params) => {
      return await managedSnapshot({
        sessionName: expectString(params, "sessionName"),
        interactive: true,
      });
    },
  },
  {
    tool: readOnlyTool(
      "diagnostics_digest",
      "Read session diagnostics digest",
      objectSchema(
        {
          sessionName: { type: "string" },
          limit: { type: "number" },
        },
        ["sessionName"],
      ),
    ),
    lane: "diagnostics",
    authoritativeCommand: "pw diagnostics digest",
    handler: async (params) => {
      return await managedDiagnosticsDigest({
        sessionName: expectString(params, "sessionName"),
        limit: optionalNumber(params, "limit") ?? 5,
      });
    },
  },
  {
    tool: statefulTool(
      "extract_run",
      "Run one structured extraction recipe",
      objectSchema(
        {
          sessionName: { type: "string" },
          recipePath: { type: "string" },
          out: { type: "string" },
        },
        ["sessionName", "recipePath"],
      ),
    ),
    lane: "extraction",
    authoritativeCommand: "pw extract run",
    handler: async (params) => {
      return await managedExtractRun({
        sessionName: expectString(params, "sessionName"),
        recipePath: expectString(params, "recipePath"),
        out: optionalString(params, "out"),
      });
    },
  },
];

const MCP_TOOLS_BY_NAME = new Map(MCP_TOOLS.map((tool) => [tool.tool.name, tool]));

const MCP_LANES = Array.from(new Set(MCP_TOOLS.map((tool) => tool.lane)));

function schemaToolContract(contract: McpToolContract): McpSchemaToolContract {
  return {
    ...contract.tool,
    lane: contract.lane,
    authoritativeCommand: contract.authoritativeCommand,
    boundary: "thin-wrapper",
    readOnly: Boolean(contract.tool.annotations?.readOnlyHint),
  };
}

export function getMcpSchemaContract() {
  return {
    protocol: {
      name: "MCP",
      version: MCP_PROTOCOL_VERSION,
    },
    server: MCP_SERVER_INFO,
    transport: {
      type: "stdio",
      command: "pw",
      args: ["mcp", "serve"],
    },
    capabilities: {
      tools: {
        listChanged: false,
      },
    },
    surface: {
      contractVersion: MCP_SURFACE_CONTRACT_VERSION,
      kind: "thin-wrapper",
      authoritativeSurface: "cli",
      commandParity: "subset",
      lanes: MCP_LANES,
      toolCount: MCP_TOOLS.length,
      tools: MCP_TOOLS.map(schemaToolContract),
    },
  };
}

export function getMcpServerInitializeResult() {
  return {
    protocolVersion: MCP_PROTOCOL_VERSION,
    serverInfo: MCP_SERVER_INFO,
    capabilities: {
      tools: {
        listChanged: false,
      },
    },
  };
}

export function listMcpTools(): McpTool[] {
  return MCP_TOOLS.map((contract) => contract.tool);
}

function validateToolArguments(
  toolName: string,
  params: Record<string, unknown>,
  schema: McpToolSchema,
): void {
  const properties = schema.properties;
  const unknownKeys = Object.keys(params).filter((key) => !(key in properties));
  if (unknownKeys.length > 0) {
    throw new Error(`unknown argument(s) for tool '${toolName}': ${unknownKeys.join(", ")}`);
  }

  const missingRequired = (schema.required ?? []).filter((key) => !(key in params));
  if (missingRequired.length > 0) {
    throw new Error(`missing required argument(s) for tool '${toolName}': ${missingRequired.join(", ")}`);
  }

  for (const [key, value] of Object.entries(params)) {
    const property = properties[key];
    if (!property) {
      continue;
    }
    switch (property.type) {
      case "string":
        if (typeof value !== "string" || value.trim().length === 0) {
          throw new Error(`${key} must be a non-empty string`);
        }
        break;
      case "number":
        if (typeof value !== "number" || !Number.isFinite(value)) {
          throw new Error(`${key} must be a finite number`);
        }
        break;
      case "boolean":
        if (typeof value !== "boolean") {
          throw new Error(`${key} must be a boolean`);
        }
        break;
      default:
        throw new Error(`unsupported argument schema type for '${key}'`);
    }
  }
}

export async function callMcpTool(name: string, params: Record<string, unknown>) {
  const tool = MCP_TOOLS_BY_NAME.get(name);
  if (!tool) {
    throw new Error(`unknown tool '${name}'`);
  }
  validateToolArguments(name, params, tool.tool.inputSchema);
  return await tool.handler(params);
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
