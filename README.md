# Hadi & Mariam — Personal Wedding Invitations

A **React + Vite** static site. Guests enter their name and a randomly generated 16-character invitation code (or follow their unique `?code=` link) to see only their Nikkah/Barat and/or Walima invitation. Includes the wedding invitation art locally in `public/images`.

## Getting started

```bash
npm install
npm run dev
```

Open the address shown by Vite. Admin page: `/#admin`.

## Admin workflow

1. On your admin machine, open `/#admin` and set a **10+ character admin password**. It encrypts the guest list in **that browser's localStorage**. No remote login or multi-device sync is available.
2. Add guests by name on the **All guests** page; select **Nikkah & Barat (23 March, Nikkah 4:30 PM, Barat 6 PM)** and/or **Walima (25 March)**. Each guest automatically gets a random shareable code.
3. Click **Export guest list** and save `guest-list.json` somewhere private. This includes names and codes. For editable, developer-managed JSON, put it in `private/guest-list.json` (git-ignored). Use **Import guest JSON** to load it back into the browser. An example file is in `private/guest-list.example.json`.
4. Click **Publish invitation JSON**. This downloads `invitations.json`. **Replace `public/invitations.json`** with the downloaded file, and redeploy/rebuild the site. Until you do so, your added guests cannot log in from the live website. Republish after **every** guest/event/code change.
5. Click the copy-link icon to get `https://your-site.example/?name=...&code=...`. The link carries both the guest's name and code, so it opens their invitation directly; anyone the link is forwarded to can open it too. The WhatsApp button opens WhatsApp with the message ready so you can pick the contact.
6. To host: run `npm run build` and upload `dist/` to a static hosting provider (Netlify, Vercel, GitHub Pages, etc.). Configure SPA fallback if hosting on a custom route; root-path hosting works out of the box.

## Security and limitations

- **There is no secure remote admin authentication without a backend.** The password protects a local encrypted browser vault; it does not create an online user account. Anyone with website deployment access can replace the public files. Clearing browser data without your JSON backup loses the admin list.
- The public `invitations.json` contains **SHA-256 hashes of random codes and AES-GCM encrypted guest name + event flags**, not plaintext guest names. Decryption uses both name and code, PBKDF2 with a random salt. Codes are high entropy and cannot feasibly be guessed by random visitors, but **any guest who shares their name and code shares their invitation**.
- Never deploy `guest-list.json` or `private/` as public static assets; only deploy **dist/** (Vite does not copy `private/`).
- Static invitations aren't truly revocable until you redeploy updated `invitations.json`; already saved images cannot be revoked.
- **Year, venues, and Walima time** have deliberately not been filled in because the hosts have not provided them. The artwork includes a “details to follow” label and may contain an unconfirmed weekday; update assets after the year is confirmed.
- Uses Web Crypto API; deploy on HTTPS (localhost is also supported).

## Event locations (new)

In `/#admin`, find **Venues & map directions**. Enter a venue name and address for Nikkah/Barat and for Walima. Optionally paste an official Google Maps share URL for each venue. Click **Download location JSON**, replace `public/event-locations.json` with the downloaded file, and rebuild/redeploy. The JSON is public and contains **only venue details**, never guest information.

After a guest unlocks their invitation, only their invited event cards appear. Each card with a configured venue shows **Open in Maps** (Google Maps search fallback if no URL supplied) and **Copy location** buttons. Venue changes are local drafts until you redeploy. Never put AWS keys into public JSON.

## Admin pages (current)

`/#admin` has four pages. There is no Admin link on the guest site; open the address directly.

- **All guests** — search, filter by Nikkah / Barat / Walima, edit names and events, copy each guest's link (`?name=...&code=...`), share on WhatsApp, import/export, publish.
- **Add guest** — name plus the events they are invited to; each new guest gets a code and link.
- **Events & venues** — per event: time, venue, address, Maps link, two contacts (name + number) and the invitation artwork. **Save all event details** stores everything in `public/event-locations.json`.
- **Photo QR** — photo link and **Download QR code** (PNG for printing).

Nikkah, Barat and Walima are separate events. Guests see one invitation at a time and switch with tabs.

While running `npm run dev` / `npm run dev:https`, the admin writes directly into `public/` (guest links, event details, replacement invitations as `public/images/invite-<event>.<ext>`). The hosted site is static: make changes locally, then rebuild and redeploy. Replacing invitation artwork only works locally.
