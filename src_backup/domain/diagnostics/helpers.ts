export type SignalRecord = {
  kind: string;
  timestamp: string | null;
  summary: string;
  details: Record<string, unknown>;
};

export type RunEventRecord = Record<string, unknown>;
export type ProjectionField = {
  raw: string;
  sourcePath: string;
  targetPath: string;
};
export type DiagnosticsExportSection =
  | "all"
  | "workspace"
  | "console"
  | "network"
  | "errors"
  | "routes"
  | "bootstrap";

export function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

export function asArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? (value.filter((item) => item && typeof item === "object") as Record<string, unknown>[])
    : [];
}

export function asString(value: unknown): string | null {
  return typeof value === "string" && value ? value : null;
}

export function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function normalizeSince(since?: string) {
  const value = since?.trim();
  if (!value) {
    return null;
  }
  const time = Date.parse(value);
  if (Number.isNaN(time)) {
    throw new Error(`INVALID_SINCE:${value}`);
  }
  return { raw: value, time };
}

export function timestampAtOrAfter(value: unknown, since?: { raw: string; time: number } | null) {
  if (!since) {
    return true;
  }
  const timestamp = asString(value);
  if (!timestamp) {
    return false;
  }
  const time = Date.parse(timestamp);
  return !Number.isNaN(time) && time >= since.time;
}

export function normalizeFieldList(fields?: string) {
  const value = fields?.trim();
  if (!value) {
    return [];
  }
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      const separatorIndex = item.indexOf("=");
      if (separatorIndex === -1) {
        return {
          raw: item,
          sourcePath: item,
          targetPath: item,
        };
      }
      const targetPath = item.slice(0, separatorIndex).trim();
      const sourcePath = item.slice(separatorIndex + 1).trim();
      if (!targetPath || !sourcePath) {
        throw new Error(`INVALID_FIELDS:${item}`);
      }
      return {
        raw: `${targetPath}=${sourcePath}`,
        sourcePath,
        targetPath,
      };
    });
}

export function pickFieldPath(record: Record<string, unknown>, path: string) {
  const parts = path.split(".").filter(Boolean);
  let current: unknown = record;
  for (const part of parts) {
    if (!current || typeof current !== "object" || !(part in current)) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

export function setFieldPath(target: Record<string, unknown>, path: string, value: unknown) {
  const parts = path.split(".").filter(Boolean);
  if (parts.length === 0) {
    return;
  }
  let current = target;
  for (let index = 0; index < parts.length - 1; index += 1) {
    const part = parts[index];
    const next = current[part];
    if (!next || typeof next !== "object" || Array.isArray(next)) {
      current[part] = {};
    }
    current = current[part] as Record<string, unknown>;
  }
  current[parts.at(-1) as string] = value;
}

export function projectRecord(record: Record<string, unknown>, fields: ProjectionField[]) {
  if (fields.length === 0) {
    return record;
  }
  const projected: Record<string, unknown> = {};
  for (const field of fields) {
    const value = pickFieldPath(record, field.sourcePath);
    if (value !== undefined) {
      setFieldPath(projected, field.targetPath, value);
    }
  }
  return projected;
}

export function recordContainsText(record: unknown, text?: string | null) {
  if (!text) {
    return true;
  }
  return String(JSON.stringify(record) ?? "").includes(text);
}

export function sortSignals(signals: SignalRecord[]) {
  return [...signals].sort((left, right) => {
    if (!left.timestamp && !right.timestamp) {
      return 0;
    }
    if (!left.timestamp) {
      return 1;
    }
    if (!right.timestamp) {
      return -1;
    }
    return right.timestamp.localeCompare(left.timestamp);
  });
}

export function limitSignals(signals: SignalRecord[], limit: number) {
  return sortSignals(signals).slice(0, Math.max(1, limit));
}

export function limitTail<T>(items: T[], limit: number | undefined) {
  if (!limit || limit <= 0) {
    return items;
  }
  return items.slice(-limit);
}

export function shellArg(value: string) {
  return `'${value.replace(/'/g, "'\\''")}'`;
}
