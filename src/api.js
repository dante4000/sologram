// Instagram Platform API client — "Instagram API with Instagram Login".
// All calls hit graph.instagram.com and act ONLY on the authenticated user's
// own account (their media, their comments). There is no endpoint here that
// surfaces other people's posts — by design, this app is post-only / self-only.

const BASE = 'https://graph.instagram.com';

// Manual query builder (avoids RN's partial URLSearchParams polyfill quirks).
const q = (params = {}) =>
  Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');

async function call(path, { method = 'GET', token, params = {} } = {}) {
  const all = token ? { ...params, access_token: token } : params;
  const url = `${BASE}/${path}?${q(all)}`;
  let res;
  try {
    res = await fetch(url, { method });
  } catch (e) {
    throw new Error('Network error: ' + e.message);
  }
  let json;
  try {
    json = await res.json();
  } catch {
    json = {};
  }
  if (!res.ok || json.error) {
    throw new Error(json?.error?.message || `Request failed (HTTP ${res.status})`);
  }
  return json;
}

const MEDIA_FIELDS =
  'id,caption,media_type,media_product_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count,children{media_url,thumbnail_url,media_type}';
const COMMENT_FIELDS =
  'id,text,username,timestamp,like_count,hidden,replies{id,text,username,timestamp,like_count,hidden}';

// --- Account ---
export const getMe = (token) =>
  call('me', { token, params: { fields: 'user_id,username,account_type,media_count' } });

export const refreshToken = (token) =>
  call('refresh_access_token', { params: { grant_type: 'ig_refresh_token', access_token: token } });

// --- Read own media ---
export const getMedia = (token, after) =>
  call('me/media', { token, params: { fields: MEDIA_FIELDS, limit: 30, after } });

// --- Comments (read + moderate) ---
export const getComments = (token, mediaId) =>
  call(`${mediaId}/comments`, { token, params: { fields: COMMENT_FIELDS, limit: 50 } });

export const replyToComment = (token, commentId, message) =>
  call(`${commentId}/replies`, { method: 'POST', token, params: { message } });

export const commentOnMedia = (token, mediaId, message) =>
  call(`${mediaId}/comments`, { method: 'POST', token, params: { message } });

export const hideComment = (token, commentId, hide) =>
  call(`${commentId}`, { method: 'POST', token, params: { hide } });

export const deleteComment = (token, commentId) =>
  call(`${commentId}`, { method: 'DELETE', token });

// --- Publish a photo (two-step container + publish) ---
export async function createPhotoPost(token, userId, imageUrl, caption) {
  const container = await call(`${userId}/media`, {
    method: 'POST',
    token,
    params: { image_url: imageUrl, caption },
  });
  return call(`${userId}/media_publish`, {
    method: 'POST',
    token,
    params: { creation_id: container.id },
  });
}

// Instagram only accepts a PUBLIC image URL (no raw upload for photos), so a
// camera-roll photo is uploaded to a free no-key public host first, then its
// URL is handed to Instagram.
export async function uploadToCatbox(uri) {
  const name = (uri.split('/').pop() || 'photo.jpg').split('?')[0];
  const form = new FormData();
  form.append('reqtype', 'fileupload');
  form.append('fileToUpload', { uri, name, type: 'image/jpeg' });
  let res;
  try {
    res = await fetch('https://catbox.moe/user/api.php', { method: 'POST', body: form });
  } catch (e) {
    throw new Error('Image upload failed (network): ' + e.message);
  }
  const text = (await res.text()).trim();
  if (!res.ok || !/^https?:\/\//.test(text)) {
    throw new Error('Image host error: ' + text.slice(0, 140));
  }
  return text;
}
