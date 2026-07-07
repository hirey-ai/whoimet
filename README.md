# whoimet

**Snap a photo of the person you just met. Share one link. When they open it and register, you're connected on Hi — both ways.**

A tiny, self-contained app for turning a real-world meeting into a real, consented connection on HiRey's **Hi** platform. Two front-ends, same loop:

- **`miniprogram/`** — the **WeChat Mini Program** (native WXML/WXSS/JS). Login is **微信登录** (one-tap `getPhoneNumber` → the user's WeChat-verified Chinese phone, no OTP). This is the primary target for China. It talks to a Hi endpoint `POST /v1/auth/wechat/miniprogram/login` (in `hi-platform`) that exchanges the WeChat code + phone and mints a Hi bearer.
- **`index.html` + `claim/`** — the **H5 web** version (zero backend), for non-WeChat contexts. Login is email/phone OTP or Google.

> Live loop: you take a photo → it uploads to your Hi profile → you share (a WeChat card, or a link) → they open it, see the photo + your card, and sign in → the app opens a conversation and a friend request between you. No cold outreach, no scraping, no face recognition.

## The loop

1. **Snap** — camera or library. The photo is downscaled in-browser and uploaded to your Hi profile as a public post image (`hi.owner-images` presign → S3 PUT → finalize).
2. **Share** — the app builds a single claim link carrying your name, headline, public profile id, and the photo URL, and hands it to the native share sheet (Web Share API, with clipboard fallback).
3. **They open it** — the claim page renders the photo and your live Hi card (hydrated from your public `/owner/:id.json`).
4. **They register** — email OTP, phone OTP, or Google, right on the page (`/v1/auth/web/*` — the same auth-first web flow Hi uses everywhere; no server of ours ever holds a token).
5. **You're connected** — on registration the app calls `hi.pairings.contact_owner` (opens a conversation both of you see) **and** `hi.social-relationships.request_create` (a friend edge you confirm back in the app).

## Why it's not surveillance

- **No face recognition, ever.** A photo is never matched against anyone. The person is identified only because *they* chose to open your link and register.
- **Consent is the mechanism, not a checkbox.** Nobody becomes a node until they register themselves. The friend edge still needs your confirmation on the other side.
- **Your session is yours.** The Hi bearer token lives only in this browser's `localStorage`. There is no backend in this repo — every call goes straight to `hi.hirey.ai` over its public, CORS-open REST surface.

## Files

| File | What it is |
|---|---|
| `index.html` | The whole app — capture, sign-in, share, connections. Single file. |
| `claim/index.html` | The landing page a shared link opens — view photo + card, register, connect. Same origin as the app, so a returning user connects in one tap (shared `localStorage`). |
| `hirey-app.json` | Hub manifest (for listing on the Hirey Hub). |

## Run locally

Serve over http (not `file://`, so browser storage + the share sheet work):

```
python3 -m http.server 4180
# open http://127.0.0.1:4180/
```

The claim page derives its own base URL from wherever the app is served, so the local link (`http://127.0.0.1:4180/claim/?...`) works out of the box.

## Deploy

Pushing to `main` publishes to **GitHub Pages** via `.github/workflows/pages.yml` — the app lands at `https://<owner>.github.io/whoimet/` and claim links point at `.../whoimet/claim/`. No secrets required.

For Google sign-in on a non-`hirey.ai` origin (like GitHub Pages), the app uses the popup + poll pattern (Hi's `return_to` allowlist only covers `hirey.ai`/`hirey.com`/`localhost`), so it works anywhere without configuration.

## Platform capabilities used

`hi.owners` (profile) · `hi.owner-images` (photo upload + public display) · `hi.pairings` (conversation) · `hi.social-relationships` (friend edge) · `/v1/auth/web/*` (email / phone / Google registration).

## License

MIT
