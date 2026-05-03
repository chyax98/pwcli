export type ActionFailureCode =
  | "REF_STALE"
  | "ACTION_TARGET_NOT_FOUND"
  | "ACTION_TARGET_AMBIGUOUS"
  | "ACTION_TARGET_INDEX_OUT_OF_RANGE"
  | "ACTION_TIMEOUT_OR_NOT_ACTIONABLE"
  | "MODAL_STATE_BLOCKED";

export type ActionFailureRecovery = {
  kind: string;
  commands: string[];
};

export type ActionFailureInput = {
  code: ActionFailureCode;
  message: string;
  retryable?: boolean;
  suggestions: string[];
  recovery?: ActionFailureRecovery;
  details?: Record<string, unknown>;
};

export class ActionFailure extends Error {
  readonly code: ActionFailureCode;
  readonly retryable: boolean;
  readonly suggestions: string[];
  recovery?: ActionFailureRecovery;
  details?: Record<string, unknown>;

  constructor(input: ActionFailureInput) {
    super(input.message);
    this.name = "ActionFailure";
    this.code = input.code;
    this.retryable = Boolean(input.retryable);
    this.suggestions = input.suggestions;
    this.recovery = input.recovery;
    this.details = input.details;
  }
}

export function isActionFailure(error: unknown): error is ActionFailure {
  return error instanceof ActionFailure;
}
