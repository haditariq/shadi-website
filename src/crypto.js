const enc = new TextEncoder();
const dec = new TextDecoder();
const to64 = (u) => {
  // Chunked: spreading a whole large buffer into one call overflows the stack.
  let s = '';
  for (let i = 0; i < u.length; i += 0x8000)
    s += String.fromCharCode(...u.subarray(i, i + 0x8000));
  return btoa(s);
};
const from64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
// Web Crypto only exists on https:// or localhost.
const subtle = () => {
  if (!globalThis.crypto?.subtle)
    throw Error(
      'This page must be opened over https:// (or http://localhost) for invitations to work.',
    );
  return crypto.subtle;
};
const hex = (b) =>
  [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
export const norm = (s) =>
  s.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();
export const makeCode = () => {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return [...bytes].map((b) => alphabet[b % alphabet.length]).join('');
};
export async function codeHash(code) {
  return hex(
    await subtle().digest(
      'SHA-256',
      enc.encode(code.replace(/[\s-]/g, '').toUpperCase()),
    ),
  );
}
async function derive(pass, salt) {
  const base = await subtle().importKey(
    'raw',
    enc.encode(pass),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return subtle().deriveKey(
    { name: 'PBKDF2', salt, iterations: 180000, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}
// Must match the same derivation in vite.config.js.
export const ADMIN_HASH_SALT = 'hadi-mariam-admin-v1';
export async function passwordHash(pass) {
  const base = await subtle().importKey(
    'raw',
    enc.encode(pass),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  return hex(
    await subtle().deriveBits(
      {
        name: 'PBKDF2',
        salt: enc.encode(ADMIN_HASH_SALT),
        iterations: 180000,
        hash: 'SHA-256',
      },
      base,
      256,
    ),
  );
}
export async function seal(data, pass) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await derive(pass, salt);
  const cipher = await subtle().encrypt(
    { name: 'AES-GCM', iv },
    key,
    enc.encode(JSON.stringify(data)),
  );
  return {
    salt: to64(salt),
    iv: to64(iv),
    cipher: to64(new Uint8Array(cipher)),
  };
}
export async function unseal(blob, pass) {
  const key = await derive(pass, from64(blob.salt));
  const bytes = await subtle().decrypt(
    { name: 'AES-GCM', iv: from64(blob.iv) },
    key,
    from64(blob.cipher),
  );
  return JSON.parse(dec.decode(bytes));
}
export const invitationPassword = (name, code) =>
  `${norm(name)}:${code.replace(/[\s-]/g, '').toUpperCase()}`;
export async function publishRows(guests) {
  const records = [];
  for (const g of guests) {
    if (!g.name || !g.code) continue;
    records.push({
      id: await codeHash(g.code),
      ...(await seal(
        {
          name: g.name,
          nikkah: !!g.nikkah,
          barat: !!g.barat,
          walima: !!g.walima,
        },
        invitationPassword(g.name, g.code),
      )),
    });
  }
  return { version: 1, generatedAt: new Date().toISOString(), guests: records };
}
export function downloadJson(data, name) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
