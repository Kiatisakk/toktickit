const STORAGE_KEY = "toktickit.developmentRequesterId";

/**
 * Persists which Development Requester is current, by id only.
 *
 * The name is deliberately not stored. Reading it back and rendering it would
 * be faster, but it would also mean the shell can display a requester who has
 * since been deactivated or renamed. Storing the id and re-resolving it against
 * the API on load costs one request and makes BR-07 hold across a reload: a
 * stored id that is no longer active fails to resolve and the selection screen
 * comes back.
 *
 * Every access is guarded. `localStorage` throws rather than returning null in
 * a private window or when site data is blocked, and a storage setting is not
 * worth failing the application over.
 */

export const readStoredRequesterId = (): number | null => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);

    if (!raw || !/^\d+$/.test(raw)) {
      return null;
    }

    return Number.parseInt(raw, 10);
  } catch {
    return null;
  }
};

export const writeStoredRequesterId = (id: number): void => {
  try {
    window.localStorage.setItem(STORAGE_KEY, String(id));
  } catch {
    // A session that cannot persist its selection still works; it just starts
    // at the selection screen next time.
  }
};

export const clearStoredRequesterId = (): void => {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to recover from — the value either went away or was never there.
  }
};
