import { defineConfig, loadEnv } from 'vite';
import { pbkdf2Sync } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import basicSsl from '@vitejs/plugin-basic-ssl';

// Dev server only: lets the admin page write straight into public/ instead
// of downloading files you then have to move by hand. Nothing else is
// writable: two JSON files and one replacement invitation image per event.
const JSON_FILES = ['invitations.json', 'event-locations.json'];
const IMAGE_FILE = /^images\/invite-(nikkah|barat|walima)\.(png|jpe?g|webp)$/;
const MAX_BYTES = 20_000_000;
// Writing is allowed only when the page was opened by its local address
// (localhost or a private network IP). Through the public tunnel the site is
// read-only, so nobody on the internet can change guests, venues or artwork.
const LOCAL_HOST =
  /^(localhost|127\.\d+\.\d+\.\d+|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|\[::1\])(:\d+)?$/;
const isLocalRequest = (req) =>
  // HTTPS dev serves HTTP/2, which sends `:authority` in place of `host`.
  LOCAL_HOST.test(req.headers.host || req.headers[':authority'] || '') &&
  !req.headers['x-forwarded-for'] &&
  !req.headers['cf-connecting-ip'];
const publishToPublic = () => ({
  name: 'publish-to-public',
  configureServer(server) {
    // Vite lists public/ once at startup, so a freshly uploaded invitation
    // would 404 until restart. Serve those straight from disk instead.
    server.middlewares.use(async (req, res, next) => {
      const file = (req.url || '').replace(/^\//, '').split('?')[0];
      if (req.method !== 'GET' || !IMAGE_FILE.test(file)) return next();
      try {
        const data = await readFile(
          new URL(`./public/${file}`, import.meta.url),
        );
        const ext = file.split('.').pop().replace('jpg', 'jpeg');
        res.setHeader('Content-Type', `image/${ext}`);
        res.setHeader('Cache-Control', 'no-cache');
        res.end(data);
      } catch {
        next();
      }
    });
    server.middlewares.use('/__publish', (req, res) => {
      const file = (req.url || '').replace(/^\//, '').split('?')[0];
      const isJson = JSON_FILES.includes(file);
      if (req.method !== 'POST' || !(isJson || IMAGE_FILE.test(file))) {
        res.statusCode = 404;
        return res.end();
      }
      if (!isLocalRequest(req)) {
        res.statusCode = 403;
        return res.end('Publishing is only available on the local address.');
      }
      const chunks = [];
      let size = 0;
      req.on('data', (chunk) => {
        chunks.push(chunk);
        size += chunk.length;
        if (size > MAX_BYTES) req.destroy();
      });
      req.on('end', async () => {
        try {
          let data = Buffer.concat(chunks);
          if (isJson)
            data = JSON.stringify(JSON.parse(data.toString()), null, 2) + '\n';
          await writeFile(new URL(`./public/${file}`, import.meta.url), data);
          res.end('ok');
        } catch (e) {
          res.statusCode = 400;
          res.end(String(e.message));
        }
      });
    });
  },
});

// `npm run dev:https` serves a self-signed certificate so the LAN address
// (phones on the same Wi-Fi) gets Web Crypto, which plain http:// does not.
// The admin password from .env.local is never put in the site. Only this
// slow hash is, so the admin page can check what is typed against it.
const adminPasswordHash = (mode) => {
  const env = loadEnv(mode, process.cwd(), '');
  const password = env.ADMIN_PASSWORD || env.VITE_ADMIN_PASSWORD || '';
  return password
    ? pbkdf2Sync(
        password,
        'hadi-mariam-admin-v1',
        180000,
        32,
        'sha256',
      ).toString('hex')
    : '';
};

export default defineConfig(({ mode }) => ({
  define: { __ADMIN_PASSWORD_HASH__: JSON.stringify(adminPasswordHash(mode)) },
  plugins: [publishToPublic(), ...(mode === 'https' ? [basicSsl()] : [])],
  // These are rewritten by the admin page; reloading on every write would
  // interrupt typing.
  server: {
    // `npm run tunnel` gives the dev site a temporary public https address.
    allowedHosts: ['.trycloudflare.com'],
    watch: {
      ignored: [
        ...JSON_FILES.map((file) => `**/public/${file}`),
        '**/public/images/invite-*',
      ],
    },
  },
}));
