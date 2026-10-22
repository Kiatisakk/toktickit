/** ui-spec.md section 8: the one wording for a refused stale write, on every form. */
export const STALE_MESSAGE =
  "This record was changed by someone else since you opened it. We've loaded the latest version — check it and try again.";

/** ui-spec.md section 8: the stale write was refused and the reload failed too. */
export const STALE_RELOAD_FAILED_MESSAGE =
  "This record was changed by someone else since you opened it, but the latest version could not be loaded. What you see may be out of date — reload the page before trying again.";
