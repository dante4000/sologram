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

// Instagram accepts only a PUBLIC media URL (no raw upload on Instagram Login),
// so a camera-roll photo OR video is uploaded to a free no-key public host
// first, then its URL is handed to Instagram.
export async function uploadToCatbox(uri, { name, isVideo } = {}) {
  const base = (name || uri.split('/').pop() || (isVideo ? 'clip.mp4' : 'photo.jpg')).split('?')[0];
  const form = new FormData();
  form.append('reqtype', 'fileupload');
  form.append('fileToUpload', { uri, name: base, type: isVideo ? 'video/mp4' : 'image/jpeg' });
  let res;
  try {
    res = await fetch('https://catbox.moe/user/api.php', { method: 'POST', body: form });
  } catch (e) {
    throw new Error('Upload failed (network): ' + e.message);
  }
  const text = (await res.text()).trim();
  if (!res.ok || !/^https?:\/\//.test(text)) {
    throw new Error('Media host error: ' + text.slice(0, 140));
  }
  return text;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Video containers (reels, video stories, video carousel children) transcode
// server-side. Poll status_code until FINISHED before publishing.
async function waitForContainer(token, containerId, onStatus) {
  const MAX_TRIES = 60; // ~5 min at 5s
  for (let i = 0; i < MAX_TRIES; i++) {
    const r = await call(`${containerId}`, { token, params: { fields: 'status_code' } });
    if (r.status_code === 'FINISHED') return;
    if (r.status_code === 'ERROR' || r.status_code === 'EXPIRED') {
      throw new Error(`Instagram could not process the video (${r.status_code}).`);
    }
    onStatus?.(`Processing video… (${i * 5}s)`);
    await sleep(5000);
  }
  throw new Error('Timed out waiting for Instagram to process the video.');
}

async function publish(token, userId, creationId) {
  return call(`${userId}/media_publish`, { method: 'POST', token, params: { creation_id: creationId } });
}

// --- Reel ---
export async function createReel(token, userId, videoUrl, caption, { shareToFeed = true, onStatus } = {}) {
  onStatus?.('Creating reel…');
  const c = await call(`${userId}/media`, {
    method: 'POST',
    token,
    params: { media_type: 'REELS', video_url: videoUrl, caption, share_to_feed: shareToFeed },
  });
  await waitForContainer(token, c.id, onStatus);
  onStatus?.('Publishing…');
  return publish(token, userId, c.id);
}

// --- Story (photo or video) ---
export async function createStory(token, userId, { imageUrl, videoUrl, onStatus } = {}) {
  onStatus?.('Creating story…');
  const params = { media_type: 'STORIES' };
  if (videoUrl) params.video_url = videoUrl;
  else params.image_url = imageUrl;
  const c = await call(`${userId}/media`, { method: 'POST', token, params });
  if (videoUrl) await waitForContainer(token, c.id, onStatus);
  onStatus?.('Publishing…');
  return publish(token, userId, c.id);
}

// --- Carousel (2–10 mixed photo/video items) ---
// items: [{ url, isVideo }]
export async function createCarousel(token, userId, items, caption, { onStatus } = {}) {
  const childIds = [];
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    onStatus?.(`Adding item ${i + 1}/${items.length}…`);
    const params = it.isVideo
      ? { media_type: 'VIDEO', video_url: it.url, is_carousel_item: true }
      : { image_url: it.url, is_carousel_item: true };
    const c = await call(`${userId}/media`, { method: 'POST', token, params });
    if (it.isVideo) await waitForContainer(token, c.id, onStatus);
    childIds.push(c.id);
  }
  onStatus?.('Assembling carousel…');
  const parent = await call(`${userId}/media`, {
    method: 'POST',
    token,
    params: { media_type: 'CAROUSEL', children: childIds.join(','), caption },
  });
  onStatus?.('Publishing…');
  return publish(token, userId, parent.id);
}
