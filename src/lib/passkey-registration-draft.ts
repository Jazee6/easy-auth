const STORAGE_KEY = "passkey-registration-draft";
const MAX_AGE_MS = 15 * 60 * 1000;

type DraftStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function savePasskeyRegistrationDraft(
  storage: DraftStorage,
  userId: string,
  name: string,
  now = Date.now(),
) {
  storage.setItem(STORAGE_KEY, JSON.stringify({ userId, name, createdAt: now }));
}

/** Consume once, and never restore another account's or an expired draft. */
export function consumePasskeyRegistrationDraft(
  storage: DraftStorage,
  userId: string,
  now = Date.now(),
): string | null {
  const raw = storage.getItem(STORAGE_KEY);
  storage.removeItem(STORAGE_KEY);
  if (!raw) return null;

  try {
    const draft = JSON.parse(raw);
    if (
      draft?.userId !== userId ||
      typeof draft.name !== "string" ||
      draft.name.length > 64 ||
      typeof draft.createdAt !== "number" ||
      !Number.isFinite(draft.createdAt) ||
      now < draft.createdAt ||
      now - draft.createdAt > MAX_AGE_MS
    ) {
      return null;
    }
    return draft.name;
  } catch {
    return null;
  }
}
