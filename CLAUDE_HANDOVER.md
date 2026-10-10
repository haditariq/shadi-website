# Claude Handover — Hadi Tariq & Mariam Ahmed Wedding Website

## Assignment
Take over, verify, improve and prepare for deployment the **single React + Vite static wedding website** in this repository. Keep it backend-free unless the owner explicitly approves a backend. Preserve the existing invitation images, guest gating, admin functionality, event location tools, and QR photo-sharing experience. Treat existing code as a starting implementation, **not production-verified**.

## Confirmed requirements
- Couple: **Hadi Tariq** and **Mariam Ahmed**.
- **23 March:** Nikkah at **4:30 PM**, Barat at **6:00 PM** (same combined invitation/card).
- **25 March:** Walima. Walima time, event year, venue names, addresses, and official Maps URLs remain **unconfirmed**; request these rather than making up information. The artwork may have unverified weekday labels: inspect and correct after the year is confirmed.
- Design reference: user-provided wedding inspiration screenshots; look for them in the conversation assets if available. Desired aesthetic is warm cream/blush/beige, elegant floral stage / South Asian wedding invitation style.
- Guest-specific invitations: admin enters name and phone number, assigns Nikkah/Barat and/or Walima independently, generates unique code and shareable link. Guest enters name plus code to unlock only invited events.
- JSON instead of a backend/database. Admin edits locally, exports private editable guest JSON for backup and publishes encrypted public invitation JSON for redeploy.
- Separate venues for Barat/Nikkah and Walima, each with `Open in Maps` and `Copy location` on authorized invitation cards.
- One public photo QR/link; ask uploader for their name, then allow up to **10 photos per browser/device**; ultimately upload to owner's S3 bucket under guest-name-related keys. AWS details to be supplied later. Never embed long-term AWS secret access keys in frontend code.

## Repository layout
```
wedding-invite-react/
  package.json                 # React 19, Vite 6, AWS SDK, QRCode, Lucide
  index.html
  src/main.jsx                # entry + hash routing; Admin and PhotoUpload load on demand
  src/GuestPortal.jsx         # guest unlock form, event cards, Maps/copy buttons
  src/Admin.jsx               # local admin: vault, guest table, venues, publish/export
  src/PhotoUpload.jsx         # photo form, Cognito-authenticated S3 uploads
  src/PhotoShare.jsx          # photo QR/link block shown in admin
  src/Brand.jsx               # header logo
  src/locations.js            # the three events (nikkah/barat/walima), venue/time/contact defaults, loaders
  src/clipboard.js            # copy helper with fallback
  vite.config.js              # dev-only endpoint that lets admin write into public/
  src/crypto.js               # code generation, hash, PBKDF2/AES-GCM, publication
  src/style.css               # UI theme and responsive styles
  test/crypto.test.js         # `npm test` (node --test): publish/unlock and vault round trips
  public/images/nikkah-barat.png
  public/images/walima.png
  public/invitations.json     # published encrypted guest access data; initially empty
  public/event-locations.json # public venues config, initially blank
  public/photo-config.json    # S3 client settings, currently demo mode
  private/guest-list.example.json # example schema; private guest JSON NOT for deployment
  README.md
  CLAUDE_HANDOVER.md
```

## Routes and current behavior
- `/` — guest portal. Reads `?code=XXXX` from URL; guest **must enter their name** as well. Fetches `public/invitations.json`, finds the SHA-256 code-hash record and decrypts its event permissions with normalized name + code. Shows Barat/Nikkah and/or Walima invitation image and event details accordingly.
- `/#admin` — local admin dashboard. First-use admin password (minimum 10 characters) encrypts a guest list stored in browser `localStorage`; not a remotely authenticated server admin. Add/import/edit/delete guests, select event flags, generate/regenerate codes, copy individualized links, share via WhatsApp. Export private guest JSON; export `invitations.json` for public site. Set/export venue JSON. Generate public photo QR/link.
- `/#photos` — name prompt; select up to 10 image files per browser (12 MB maximum per image); locally recorded upload count; AWS S3 upload when configured. Does not actually upload in demo mode.

## JSON schemas
Private guest list (must never be placed in `public/` or committed with real PII):
```json
{
  "guests": [
    {"id":"uuid", "name":"Example Guest", "phone":"+923001234567", "code":"RANDOM16CHARCODE", "barat":true, "walima":false}
  ]
}
```
Published `public/invitations.json` is generated via `publishRows()` in `src/crypto.js` and holds SHA-256 code hashes and AES-GCM ciphertext for each name + permission record. Never manually place private guest rows in this public file.

`public/event-locations.json`:
```json
{
  "barat":{"venue":"","address":"","mapsUrl":""},
  "walima":{"venue":"","address":"","mapsUrl":""}
}
```
`public/photo-config.json`:
```json
{
  "mode":"demo",
  "region":"ap-south-1",
  "bucket":"",
  "identityPoolId":"",
  "prefix":"hadi-mariam-photos"
}
```
For live photos, configure a narrow-permission **AWS Cognito Identity Pool** and S3 client (`mode: "s3"`), with appropriate S3 bucket CORS and carefully scoped IAM permissions. Configuration of AWS resources is still pending.

## Publishing operations (critical)
1. Run `npm install`, `npm run dev` for local development; verify `npm run build` before any launch.
2. Admin uses `/#admin` on a trusted browser and creates password, enters/imports guests, then exports `guest-list.json` as a **private, offline backup**.
3. Admin exports `invitations.json`; developer replaces `public/invitations.json` with it, rebuilds and redeploys. Admin changes alone do **not** propagate to a hosted static site.
4. Admin edits event venues; downloads `event-locations.json`, replaces matching public file, rebuilds/redeploys.
5. Generate and distribute only hosted `https://YOURDOMAIN/?code=CODE` links; advise each guest which exact name to enter. Print `https://YOURDOMAIN/#photos` QR code for photo contributions.
6. Deploy `dist/` only to static hosting with HTTPS; do **not** publish `private/`, local private guest backups, AWS secrets or admin password.

## Important security and product constraints
- This is **not secure centralized admin authentication**. Local password encryption protects only the browser-local vault. Any person controlling static deployment files can change guest data. No cloud sync of guest records.
- Guest's name/code can be shared; no identity verification beyond that. Published code-hash records leak guest count; random 16-character codes make brute force impractical, but avoid calling the site fully private or access impossible to share.
- **10-image limit is browser-localStorage-based only**, so it can be bypassed via another device, private window or cleared data. To strictly enforce a per-person/device quota globally, add trusted server-side enforcement or an approved equivalent with a backend/service.
- For S3, **do not use permanent AWS access keys in browser**. The current uploader uses `fromCognitoIdentityPool` + `PutObjectCommand` with public client configuration. Thoroughly audit IAM least privilege and S3 bucket policy before activation; direct client write access can be abused if unauthenticated access is too broad.
- No photo moderation, malware scanning, server-side max count, rate limiting, human verification or duplicate control currently exists. Validate format/size, object paths and total AWS costs as part of hardening.
- Consider host-approved uploads versus anyone with photo QR/link. The public photo route is intentionally accessible independently from invitation access.
- No event year given; do not add a guessed year or weekday. Walima time is unconfirmed.

## First tasks for Claude (priority order)
1. **Run and inspect**: `npm install`, `npm run build`, run local browser/smoke tests. Previous attempt did **not verify a successful production build**. Fix any package/API/import/runtime errors.
2. Verify all flows: admin new password/login; adding/editing/removing/importing/exporting guests; publishing; sample Barat-only, Walima-only, both, wrong name/code; WhatsApp links; clipboard; venues JSON; Maps links; responsive mobile photo page; QR path and content.
3. Inspect invitation PNGs for **incorrect weekday/year, missing/unconfirmed venue or timing, typography/legibility**, and align on final wedding details before editing imagery.
4. Test actual client-side S3 upload in a safe AWS test environment once bucket, region and Cognito ID are supplied. Harden least-privilege credentials, object naming, errors, retries, MIME/type/size, CORS and upload progress. Ensure prefixes safely associate uploaded names without revealing unnecessary PII publicly.
5. Check localStorage save race behavior for rapid guest edits; test export→import and live redeploy update end-to-end. Add tests and validation where reasonable.
6. Improve deployment instructions for host (Netlify/Vercel/S3+CloudFront), static cache invalidation for JSON/image changes, and production readiness. Do not falsely mark S3 uploads “working” until real credentials and end-to-end tests succeed.

## Questions for owner before final rollout
- Wedding **year**? Walima **time**? Exact venue names, full addresses and Maps links for both events?
- Hosting provider and domain? Is HTTPS configured?
- AWS region/bucket/Cognito Identity Pool details; should photo uploads be open to anyone with QR or restricted to invited guests? Any budget, retention or content moderation requirements?
- Does the owner accept a **best-effort 10 images per browser** instead of an enforceable cross-device quota and manually republishing JSON for every change?

## Acceptance checklist
- [ ] Production build passes and preview runs on mobile and desktop.
- [ ] Private admin data never appears in `dist/`.
- [ ] Generated guest code/link unlocks exactly assigned events.
- [ ] Changes to public JSON are visible after actual redeploy.
- [ ] Venue buttons open correct real locations and copy text correctly.
- [ ] Photo QR resolves to live site; name is requested; UI respects 10-per-browser limit.
- [ ] Demo upload disabled until AWS configured, and live S3 upload tested securely later.
- [ ] Images and dates match owner-confirmed details; no invented venues/times/years.
- [ ] Backup and recovery instructions validated; limitations communicated to owner.

## Start commands
```bash
cd wedding-invite-react
npm install
npm run dev
npm run build
npm run preview
```

**Instruction to Claude:** Continue from the included source. Make concrete code changes and report test results clearly; don't claim tests, security guarantees, or AWS integration success without verifying them.
