# SoloGram — a post-only, self-only Instagram app

A phone app that shows **only your own Instagram posts** and the comments on them.
There is no feed of anyone else's content — by design, the app never calls any
endpoint that returns other people's posts. You can:

- Browse your own posts in a grid
- Open a post to see its comments (and their replies)
- Reply to comments, add comments, hide/unhide, and delete comments
- Publish a new photo post (from your camera roll or a public image URL)

> Note on "liking": the Instagram API has **no endpoint to like** a post or a
> comment, so liking isn't possible from any third-party app. "Interacting"
> here means commenting, replying, and moderating.

---

## 1. One-time Instagram setup (≈15 min, required)

The old personal-account API (Basic Display) was shut down in Dec 2024, so this
uses **"Instagram API with Instagram Login."** You need a free Meta developer app.

1. **Make your IG account a Business or Creator account**
   Instagram app → Settings → *Account type and tools* → Switch to professional.
2. **Create a Meta app** at <https://developers.facebook.com> → *My Apps → Create App*.
   Add the product **Instagram** → **"API setup with Instagram login."**
3. **Add yourself as a tester** and accept the invite from your IG account.
   Keep the app in **Development mode** — no App Review is needed to act on your
   *own* account.
4. **Request these scopes** when generating a token:
   `instagram_business_basic`, `instagram_business_manage_comments`,
   `instagram_business_content_publish`.
5. **Get a long-lived (60-day) token** and copy it. In the app's **Settings**
   tab, paste it and tap **Connect**. The app refreshes the token for you (tap
   *Refresh token* before 60 days, or it auto-refreshes on launch when close to
   expiry).

Docs: <https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/business-login>

---

## 2. Run it on your phone (the easy way — Expo Go)

This is built on **Expo SDK 54**, which works with the **Expo Go** app from the
App Store / Play Store (no Xcode/Android Studio needed).

```bash
cd /Users/bensmacmini/dev/sologram
npx expo start
```

- **iPhone:** install **Expo Go** from the App Store, then scan the QR code in
  the terminal with the **Camera** app.
- **Android:** install **Expo Go** from the Play Store, open it, and scan the QR
  from inside the app.
- Phone and computer must be on the **same Wi-Fi**. If your network blocks it,
  run `npx expo start --tunnel` instead.

Then open the **Settings** tab, paste your token, tap **Connect**, and your
posts appear under the **My Posts** tab.

---

## 3. Project layout

```
App.js                     Navigation (Posts / Create / Settings tabs + Post detail)
src/
  api.js                   Instagram Graph API client (graph.instagram.com)
  auth.js                  Token state + auto-refresh (React context)
  storage.js               Encrypted token storage (expo-secure-store)
  theme.js                 Dark color palette
  screens/
    PostsScreen.js         Grid of your own posts
    PostDetailScreen.js    One post + comments + reply/hide/delete + composer
    CreateScreen.js        Publish a photo (camera roll or public URL)
    SettingsScreen.js      Connect token, refresh, disconnect, setup guide
```

## Notes & limitations

- **Photos must be JPEG served from a public URL.** Instagram's API can't accept
  a raw upload, so camera-roll photos are auto-uploaded to a free public host
  (catbox.moe) and that URL is handed to Instagram. For full control, paste your
  own hosted JPEG URL (e.g. S3/Cloudinary) on the Create screen.
- **Video/Reels posting** isn't included in this build (it needs a longer
  upload+polling flow); photos and carousel viewing work.
- **Rate limits** are generous for one user (~200 calls/hour) and 100 published
  posts / 24h — fine for personal use.
- The token lives only in your device's secure keychain; there is no backend.
