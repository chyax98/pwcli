export type SemanticTarget =
  | { kind: "role"; role: string; name?: string; nth?: number }
  | { kind: "text"; text: string; nth?: number }
  | { kind: "label"; label: string; nth?: number }
  | { kind: "placeholder"; placeholder: string; nth?: number }
  | { kind: "testid"; testid: string; nth?: number };

export type NormalizedSemanticTarget = SemanticTarget & { nth: number };

export function normalizeSemanticTarget(target: SemanticTarget): NormalizedSemanticTarget {
  return {
    ...target,
    nth: Math.max(1, Math.floor(Number(target.nth ?? 1))),
  };
}

export function semanticLocatorExpression(target: NormalizedSemanticTarget): string {
  return target.kind === "role"
    ? `page.getByRole(${JSON.stringify(target.role)}, ${
        target.name ? `{ name: ${JSON.stringify(target.name)}, exact: false }` : "undefined"
      })`
    : target.kind === "text"
      ? `page.getByText(${JSON.stringify(target.text)}, { exact: false })`
      : target.kind === "label"
        ? `page.getByLabel(${JSON.stringify(target.label)}, { exact: false })`
        : target.kind === "placeholder"
          ? `page.getByPlaceholder(${JSON.stringify(target.placeholder)}, { exact: false })`
          : `page.getByTestId(${JSON.stringify((target as { kind: "testid"; testid: string; nth: number }).testid)})`;
}
