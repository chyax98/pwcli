export const sessionArg = {
  session: { type: "string", alias: "s", description: "Target managed session", valueHint: "name" },
} as const;

export const outputArg = {
  output: { type: "string", description: "Output format: text|json", default: "text" },
  "content-boundaries": {
    type: "boolean",
    description: "Wrap page-sourced output in boundary markers for LLM safety",
  },
} as const;

export const locatorArgs = {
  ref: { type: "string", description: "Snapshot aria ref" },
  selector: { type: "string", description: "CSS selector", valueHint: "css" },
  text: { type: "string", description: "Text content locator", valueHint: "text" },
  role: { type: "string", description: "ARIA role", valueHint: "role" },
  name: { type: "string", description: "Accessible name", valueHint: "name" },
  label: { type: "string", description: "Label text", valueHint: "text" },
  placeholder: { type: "string", description: "Placeholder text", valueHint: "text" },
  "test-id": {
    type: "string",
    description: "data-testid value",
    valueHint: "id",
    alias: ["testid"],
  },
  nth: { type: "string", description: "Element index (1-based)", default: "1" },
} as const;

export const sharedArgs = { ...sessionArg, ...outputArg } as const;
export const actionArgs = {
  ...sharedArgs,
  ...locatorArgs,
} as const;
export const interactiveActionArgs = {
  ...actionArgs,
  "snap-diff": {
    type: "boolean",
    description: "Return accessibility tree diff after action",
    alias: ["diff"],
  },
} as const;
