import * as SecureStore from 'expo-secure-store';

// SecureStore keeps these encrypted in the iOS Keychain / Android Keystore.
const KEYS = {
  token: 'ig_token',
  userId: 'ig_user_id',
  username: 'ig_username',
  accountType: 'ig_account_type',
  expiresAt: 'ig_expires_at',
};

export async function loadCreds() {
  const [token, userId, username, accountType, expiresAt] = await Promise.all([
    SecureStore.getItemAsync(KEYS.token),
    SecureStore.getItemAsync(KEYS.userId),
    SecureStore.getItemAsync(KEYS.username),
    SecureStore.getItemAsync(KEYS.accountType),
    SecureStore.getItemAsync(KEYS.expiresAt),
  ]);
  return { token, userId, username, accountType, expiresAt };
}

export async function saveCreds(partial) {
  const ops = [];
  const set = (k, v) =>
    ops.push(v == null ? SecureStore.deleteItemAsync(k) : SecureStore.setItemAsync(k, String(v)));
  if (partial.token !== undefined) set(KEYS.token, partial.token);
  if (partial.userId !== undefined) set(KEYS.userId, partial.userId);
  if (partial.username !== undefined) set(KEYS.username, partial.username);
  if (partial.accountType !== undefined) set(KEYS.accountType, partial.accountType);
  if (partial.expiresAt !== undefined) set(KEYS.expiresAt, partial.expiresAt);
  await Promise.all(ops);
}

export async function clearCreds() {
  await Promise.all(Object.values(KEYS).map((k) => SecureStore.deleteItemAsync(k)));
}
