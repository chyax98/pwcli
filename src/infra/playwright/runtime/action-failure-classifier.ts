import { parseErrorText } from "../output-parsers.js";
import {
  refStaleFailure,
  actionTargetAmbiguousFailure,
  actionTargetIndexOutOfRangeFailure,
  actionTimeoutOrNotActionableFailure,
  actionTargetNotFoundFailure,
} from "../../../domain/interaction/errors.js";

type ManagedActionErrorContext = {
  command: string;
  sessionName?: string;
};

function isTargetNotFoundError(errorText: string) {
  if (
    /No element matches selector/i.test(errorText) ||
    /Unable to find/i.test(errorText) ||
    /(CLICK|FILL|TYPE)_SEMANTIC_NOT_FOUND/i.test(errorText) ||
    /(CLICK|FILL|TYPE|HOVER|CHECK|UNCHECK|SELECT)_SELECTOR_NOT_FOUND/i.test(errorText)
  ) {
    return true;
  }

  if (/not found/i.test(errorText) && !/\b(dialog|modal)\b/i.test(errorText)) {
    return true;
  }

  return false;
}

export function throwIfManagedActionError(text: string, context: ManagedActionErrorContext) {
  const errorText = parseErrorText(text);
  if (!errorText) {
    return;
  }

  throwManagedActionErrorText(errorText, context);
}

export function throwManagedActionErrorText(errorText: string, context: ManagedActionErrorContext) {
  const refMatch = errorText.match(
    /Ref\s+([A-Za-z0-9_-]+)\s+not found in the current page snapshot/i,
  );
  if (refMatch) {
    throw refStaleFailure(errorText, { ...context, ref: refMatch[1] });
  }

  if (/strict mode violation/i.test(errorText)) {
    throw actionTargetAmbiguousFailure(errorText, context);
  }

  if (/(CLICK|FILL|TYPE)_SEMANTIC_INDEX_OUT_OF_RANGE|INDEX_OUT_OF_RANGE/i.test(errorText)) {
    throw actionTargetIndexOutOfRangeFailure(errorText, context);
  }

  if (
    /timeout/i.test(errorText) ||
    /not visible|not enabled|not stable|receives pointer events/i.test(errorText)
  ) {
    throw actionTimeoutOrNotActionableFailure(errorText, context);
  }

  if (isTargetNotFoundError(errorText)) {
    throw actionTargetNotFoundFailure(errorText, context);
  }

  throw new Error(errorText);
}
