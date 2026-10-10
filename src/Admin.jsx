import React, { useEffect, useRef, useState } from 'react';
import {
  LockKeyhole,
  LogOut,
  Plus,
  Trash2,
  Download,
  Upload,
  Copy,
  ExternalLink,
  KeyRound,
  ShieldCheck,
  ChevronLeft,
  Search,
  Eye,
  EyeOff,
  Save,
  ImageUp,
  RotateCcw,
} from 'lucide-react';
import {
  makeCode,
  seal,
  unseal,
  publishRows,
  downloadJson,
  passwordHash,
} from './crypto';
import {
  EVENTS,
  defaultLocations,
  loadLocations,
  mergeLocations,
  imageSrc,
  withEvents,
} from './locations';
import Brand from './Brand';
import PhotoShare from './PhotoShare';
import { copyText } from './clipboard';
const TITLE = 'Hadi Tariq & Mariam Ahmed';
const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
const IMAGE_EXT = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};
const PAGES = [
  ['guests', 'All guests'],
  ['add', 'Add guest'],
  ['events', 'Events & venues'],
  ['photos', 'Photo QR'],
];
// Hash of the admin password set in .env.local (see vite.config.js). When it
// is set, every device is asked for that one password and never to create one.
const PASSWORD_HASH = __ADMIN_PASSWORD_HASH__;
// On the dev server, publishing writes the file into public/ directly.
// On the hosted site there is no server, so it downloads the file instead.
async function saveToPublic(body, file) {
  if (!import.meta.env.DEV) return false;
  try {
    const r = await fetch(`/__publish/${file}`, { method: 'POST', body });
    return r.ok;
  } catch {
    return false;
  }
}
async function publishFile(data, file) {
  if (await saveToPublic(JSON.stringify(data), file)) return true;
  downloadJson(data, file);
  return false;
}
const baseUrl = () => location.origin + location.pathname;
const makeLink = (g) =>
  `${baseUrl()}?name=${encodeURIComponent(g.name.trim())}&code=${encodeURIComponent(g.code)}`;
const whatsappUrl = (g) =>
  `https://wa.me/?text=${encodeURIComponent(
    `Dear ${g.name || 'Guest'}, you're invited to celebrate the wedding of ${TITLE}. Open your personal invitation: ${makeLink(g)}`,
  )}`;
// Whose guest this is. Private to the admin: never part of the published file.
const SIDES = [
  ['groom', 'Groom’s side'],
  ['bride', 'Bride’s side'],
];
const sideLabel = (side) => SIDES.find(([id]) => id === side)?.[1] || 'No side';
// Staying signed in: the password is kept in this browser until "Lock" is
// pressed or the session runs out, so a reload does not ask for it again.
const SESSION_KEY = 'wedding_admin_session_v1';
const SESSION_DAYS = 7;
const readSession = () => {
  try {
    const session = JSON.parse(localStorage.getItem(SESSION_KEY));
    if (session?.pass && session.until > Date.now()) return session.pass;
  } catch {}
  localStorage.removeItem(SESSION_KEY);
  return '';
};
const writeSession = (pass) =>
  localStorage.setItem(
    SESSION_KEY,
    JSON.stringify({ pass, until: Date.now() + SESSION_DAYS * 86400000 }),
  );
const toGuest = (g) => ({
  id: g.id || crypto.randomUUID(),
  name: String(g.name || ''),
  side: SIDES.some(([id]) => id === g.side) ? g.side : '',
  code: g.code || makeCode(),
  ...withEvents(g),
});
const blankDraft = (side = '') => ({
  name: '',
  side,
  nikkah: true,
  barat: true,
  walima: true,
});
export default function Admin() {
  const [vault, setVault] = useState(() =>
    localStorage.getItem('wedding_admin_v1'),
  );
  const [pass, setPass] = useState(''),
    [confirm, setConfirm] = useState(''),
    [guests, setGuests] = useState(null),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false),
    [resuming, setResuming] = useState(() => !!readSession()),
    [search, setSearch] = useState(''),
    [visible, setVisible] = useState(false);
  const [hasEdits, setHasEdits] = useState(false);
  const [page, setPage] = useState('guests');
  const [filter, setFilter] = useState('all');
  const [sideFilter, setSideFilter] = useState('all');
  const [draft, setDraft] = useState(blankDraft);
  const [justAdded, setJustAdded] = useState([]);
  const saveSeq = useRef(0);
  const [savedPass, setSavedPass] = useState('');
  const [locations, setLocations] = useState(() => {
    try {
      return mergeLocations(
        JSON.parse(localStorage.getItem('wedding_locations_v1') || '{}'),
      );
    } catch {
      return defaultLocations;
    }
  });
  const [locationsSaved, setLocationsSaved] = useState(true);
  useEffect(() => {
    loadLocations()
      .then((data) => {
        if (!localStorage.getItem('wedding_locations_v1')) setLocations(data);
      })
      .catch(() => {});
  }, []);
  function setEvent(id, change) {
    setLocations((previous) => {
      const next = { ...previous, [id]: change(previous[id]) };
      localStorage.setItem('wedding_locations_v1', JSON.stringify(next));
      return next;
    });
    setLocationsSaved(false);
  }
  const editLocation = (id, field, value) =>
    setEvent(id, (event) => ({ ...event, [field]: value }));
  const editContact = (id, index, field, value) =>
    setEvent(id, (event) => ({
      ...event,
      contacts: event.contacts.map((c, i) =>
        i === index ? { ...c, [field]: value } : c,
      ),
    }));
  async function saveLocations(next = locations) {
    for (const event of EVENTS) {
      const url = next[event.id].mapsUrl.trim();
      if (!url) continue;
      try {
        if (!['https:', 'http:'].includes(new URL(url).protocol))
          throw Error('Invalid URL');
      } catch {
        setMessage(
          `${event.title}: use a valid https:// Maps link or leave it blank.`,
        );
        return;
      }
    }
    const saved = await publishFile(next, 'event-locations.json');
    setLocationsSaved(true);
    setMessage(
      saved
        ? 'Saved all event details. Guests on this dev site see them now; redeploy to update the hosted site.'
        : 'Downloaded event-locations.json. Replace public/event-locations.json and redeploy to update guests’ invitations.',
    );
  }
  async function replaceImage(event, file) {
    if (!file) return;
    const ext = IMAGE_EXT[file.type];
    if (!ext) return setMessage('Use a PNG, JPEG or WebP image.');
    if (file.size > MAX_IMAGE_BYTES)
      return setMessage('That image is over 12 MB. Use a smaller file.');
    const path = `images/invite-${event.id}.${ext}`;
    if (!(await saveToPublic(file, path)))
      return setMessage(
        'Replacing an invitation only works while the admin runs on your computer (npm run dev). Do it there, then redeploy.',
      );
    const next = {
      ...locations,
      // The query string makes browsers fetch the new picture, not a cached one.
      [event.id]: { ...locations[event.id], image: `${path}?v=${Date.now()}` },
    };
    setLocations(next);
    localStorage.setItem('wedding_locations_v1', JSON.stringify(next));
    await saveLocations(next);
    setMessage(
      `${event.title} invitation replaced and saved to public/${path}.`,
    );
  }
  useEffect(() => {
    const pass = readSession();
    if (pass) unlock(pass, pass).finally(() => setResuming(false));
  }, []);
  // Dev server: keep public/invitations.json in step with the guest list, so
  // a copied link works without pressing Publish. Unnamed rows are skipped.
  const [autoPublished, setAutoPublished] = useState('');
  useEffect(() => {
    if (!import.meta.env.DEV || !guests) return;
    let stale = false;
    const timer = setTimeout(async () => {
      const rows = JSON.stringify(await publishRows(guests));
      if (stale || !(await saveToPublic(rows, 'invitations.json'))) return;
      setAutoPublished(new Date().toLocaleTimeString());
    }, 800);
    return () => {
      stale = true;
      clearTimeout(timer);
    };
  }, [guests]);
  async function login(e) {
    e.preventDefault();
    if (!PASSWORD_HASH) return unlock(pass, confirm);
    setBusy(true);
    try {
      if ((await passwordHash(pass)) !== PASSWORD_HASH) {
        setMessage('Incorrect password.');
        return setBusy(false);
      }
    } catch (e) {
      setMessage(e.message);
      return setBusy(false);
    }
    unlock(pass, pass);
  }
  async function unlock(pass, confirm) {
    setMessage('');
    setBusy(true);
    try {
      if (!vault) {
        if (pass.length < 10)
          throw Error('Choose a password of at least 10 characters.');
        if (pass !== confirm) throw Error('Passwords do not match.');
        const initial = [];
        const sealed = await seal(initial, pass);
        localStorage.setItem('wedding_admin_v1', JSON.stringify(sealed));
        setVault(JSON.stringify(sealed));
        setGuests(initial);
      } else setGuests((await unseal(JSON.parse(vault), pass)).map(toGuest));
      setSavedPass(pass);
      writeSession(pass);
      setPass('');
      setConfirm('');
    } catch (e) {
      localStorage.removeItem(SESSION_KEY);
      setMessage(
        e.name !== 'OperationError'
          ? e.message
          : PASSWORD_HASH
            ? 'This browser has a guest list saved under an older password. Enter that older password once, or clear this site’s data to start fresh.'
            : 'Incorrect password.',
      );
    } finally {
      setBusy(false);
    }
  }
  async function update(list) {
    const seq = ++saveSeq.current;
    setGuests(list);
    setHasEdits(true);
    try {
      const sealed = await seal(list, savedPass);
      // Encryption finishes out of order; a slower, older save must not win.
      if (seq !== saveSeq.current) return;
      localStorage.setItem('wedding_admin_v1', JSON.stringify(sealed));
      setHasEdits(false);
    } catch (e) {
      if (seq === saveSeq.current)
        setMessage('Could not save locally: ' + e.message);
    }
  }
  function patch(id, field, value) {
    update(guests.map((g) => (g.id === id ? { ...g, [field]: value } : g)));
  }
  function addGuest(e) {
    e.preventDefault();
    const name = draft.name.trim().replace(/\s+/g, ' ');
    if (!name) return;
    const guest = toGuest({ ...draft, name });
    update([...guests, guest]);
    setJustAdded((list) => [guest, ...list]);
    setDraft(blankDraft(draft.side));
    setMessage(`Added ${name}.`);
  }
  async function copyLink(g) {
    setMessage(
      !g.name.trim()
        ? 'Add the guest’s name before copying their link.'
        : (await copyText(makeLink(g)))
          ? `Link for ${g.name} copied. It opens their invitation directly.`
          : 'Could not copy the link on this browser.',
    );
  }
  async function importList(e) {
    const f = e.target.files[0];
    if (!f) return;
    try {
      const json = JSON.parse(await f.text());
      if (!Array.isArray(json.guests))
        throw Error('Expected a JSON object with a guests array.');
      const rows = json.guests.map(toGuest);
      if (!confirmReplace(rows.length)) return;
      await update(rows);
      setMessage(`Imported ${rows.length} guests.`);
    } catch (err) {
      setMessage(err.message);
    }
    e.target.value = '';
  }
  function confirmReplace(n) {
    return window.confirm(
      `Replace your current guest list with ${n} imported guests?`,
    );
  }
  async function publish() {
    setBusy(true);
    setMessage('');
    try {
      const names = guests.map((g) => g.name.trim());
      if (names.some((n) => !n))
        throw Error('Each guest needs a name before publishing.');
      const codes = guests.map((g) => g.code);
      if (new Set(codes).size !== codes.length)
        throw Error('Duplicate codes detected.');
      const saved = await publishFile(
        await publishRows(guests),
        'invitations.json',
      );
      setMessage(
        saved
          ? `Published ${guests.length} guests to public/invitations.json. Links work on this dev site now; redeploy to update the hosted site.`
          : 'Downloaded invitations.json. Replace public/invitations.json with this file, then redeploy your website.',
      );
    } catch (e) {
      setMessage(e.message);
    } finally {
      setBusy(false);
    }
  }
  function goTo(id) {
    setPage(id);
    setMessage('');
    window.scrollTo(0, 0);
  }
  const displayed =
    guests?.filter(
      (g) =>
        (filter === 'all' || g[filter]) &&
        (sideFilter === 'all' || g.side === sideFilter) &&
        (g.name + ' ' + g.code).toLowerCase().includes(search.toLowerCase()),
    ) || [];
  return (
    <div className="admin-layout">
      <header className="admin-header">
        <Brand />
        <div className="head-actions">
          <a href={import.meta.env.BASE_URL} className="small-nav">
            <ChevronLeft size={15} /> Invitation
          </a>
          {guests && (
            <button
              className="textbtn"
              onClick={() => {
                localStorage.removeItem(SESSION_KEY);
                setGuests(null);
                setSavedPass('');
                setMessage('');
              }}
            >
              <LogOut size={16} /> Lock
            </button>
          )}
        </div>
      </header>
      {resuming && !guests ? (
        <main className="login-card resuming">
          <div className="spinner" aria-hidden="true" />
          <p role="status">Opening your dashboard…</p>
        </main>
      ) : !guests ? (
        <main className="login-card glass">
          <LockKeyhole className="login-icon" />
          <p className="overline">PRIVATE ADMIN SPACE</p>
          <h1>
            {vault || PASSWORD_HASH ? 'Admin login' : 'Create admin password'}
          </h1>
          <p>
            {PASSWORD_HASH
              ? 'Enter the admin password to continue.'
              : vault
                ? 'Unlock the guest list saved in this browser.'
                : 'Set up a password for the local encrypted guest list. Do not lose it; it cannot be recovered.'}
          </p>
          <form onSubmit={login}>
            <label>
              Admin password
              <div className="password">
                <input
                  type={visible ? 'text' : 'password'}
                  minLength={vault || PASSWORD_HASH ? 1 : 10}
                  required
                  value={pass}
                  onChange={(e) => setPass(e.target.value)}
                  placeholder="Your admin password"
                />
                <button
                  type="button"
                  aria-label="Show password"
                  onClick={() => setVisible(!visible)}
                >
                  {visible ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </label>
            {!vault && !PASSWORD_HASH && (
              <label>
                Confirm password
                <input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  placeholder="Confirm your password"
                />
              </label>
            )}
            {message && <p className="error">{message}</p>}
            <button className="primary" disabled={busy}>
              {vault || PASSWORD_HASH
                ? 'Unlock dashboard'
                : 'Create admin space'}{' '}
              <KeyRound size={16} />
            </button>
          </form>
        </main>
      ) : (
        <main className="dashboard">
          <nav className="tabs">
            {PAGES.map(([id, label]) => (
              <button
                key={id}
                className={page === id ? 'tab active' : 'tab'}
                aria-current={page === id ? 'page' : undefined}
                onClick={() => goTo(id)}
              >
                {label}
              </button>
            ))}
          </nav>

          {page === 'guests' && (
            <>
              <div className="dash-title">
                <div>
                  <p className="overline">GUEST LIST</p>
                  <h1>All guests</h1>
                  <p>
                    Everyone you have invited, and which celebrations each guest
                    can see.
                  </p>
                </div>
                <button className="primary add" onClick={() => goTo('add')}>
                  <Plus size={18} /> Add guest
                </button>
              </div>
              <div className="stats">
                <div>
                  <strong>{guests.length}</strong>
                  <span>Total guests</span>
                </div>
                {EVENTS.map((event) => (
                  <div key={event.id}>
                    <strong>{guests.filter((g) => g[event.id]).length}</strong>
                    <span>{event.title}</span>
                  </div>
                ))}
              </div>
              <section className="tools">
                <div className="search">
                  <Search size={17} />
                  <input
                    placeholder="Search name or code"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <div className="tool-actions">
                  <label className="action">
                    <Upload size={16} /> Import guest JSON
                    <input
                      type="file"
                      accept="application/json,.json"
                      onChange={importList}
                      hidden
                    />
                  </label>
                  <button
                    className="action"
                    onClick={() =>
                      downloadJson({ version: 1, guests }, 'guest-list.json')
                    }
                  >
                    <Download size={16} /> Export guest list
                  </button>
                  <button
                    className="action highlight"
                    disabled={busy || hasEdits}
                    onClick={publish}
                  >
                    <ShieldCheck size={16} /> Publish invitation JSON
                  </button>
                </div>
              </section>
              <div className="filters">
                {[['all', 'Everyone', guests.length]]
                  .concat(
                    EVENTS.map((event) => [
                      event.id,
                      event.title,
                      guests.filter((g) => g[event.id]).length,
                    ]),
                  )
                  .map(([id, label, count]) => (
                    <button
                      key={id}
                      className={filter === id ? 'chip active' : 'chip'}
                      aria-pressed={filter === id}
                      onClick={() => setFilter(id)}
                    >
                      {label} ({count})
                    </button>
                  ))}
                <span className="chip-gap" />
                {[['all', 'Both sides', guests.length]]
                  .concat(
                    SIDES.map(([id, label]) => [
                      id,
                      label,
                      guests.filter((g) => g.side === id).length,
                    ]),
                  )
                  .map(([id, label, count]) => (
                    <button
                      key={id}
                      className={sideFilter === id ? 'chip active' : 'chip'}
                      aria-pressed={sideFilter === id}
                      onClick={() => setSideFilter(id)}
                    >
                      {label} ({count})
                    </button>
                  ))}
                <span className="shown">
                  Showing {displayed.length} of {guests.length}
                </span>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Guest name</th>
                      <th>Side</th>
                      <th>Invitation code</th>
                      {EVENTS.map((event) => (
                        <th key={event.id}>
                          {event.title}
                          <br />
                          <small>{event.date}</small>
                        </th>
                      ))}
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayed.map((g) => (
                      <tr key={g.id}>
                        <td data-label="Guest name">
                          <input
                            aria-label="Guest name"
                            autoCapitalize="words"
                            autoCorrect="off"
                            spellCheck={false}
                            value={g.name}
                            onChange={(e) =>
                              patch(g.id, 'name', e.target.value)
                            }
                            placeholder="Full name"
                          />
                        </td>
                        <td data-label="Guest of">
                          <select
                            aria-label="Guest side"
                            value={g.side}
                            onChange={(e) =>
                              patch(g.id, 'side', e.target.value)
                            }
                          >
                            <option value="">Not set</option>
                            {SIDES.map(([id, label]) => (
                              <option key={id} value={id}>
                                {label}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td data-label="Invitation code">
                          <div className="codecell">
                            <code>{g.code}</code>
                            <button
                              title="Regenerate code"
                              aria-label="Regenerate code"
                              onClick={() => {
                                if (
                                  window.confirm(
                                    'Regenerate? Old link will stop working after republishing.',
                                  )
                                )
                                  patch(g.id, 'code', makeCode());
                              }}
                            >
                              <KeyRound size={15} />
                            </button>
                          </div>
                        </td>
                        {EVENTS.map((event) => (
                          <td className="center" key={event.id}>
                            <label className="check">
                              <input
                                aria-label={`${event.title} invited`}
                                type="checkbox"
                                checked={g[event.id]}
                                onChange={(e) =>
                                  patch(g.id, event.id, e.target.checked)
                                }
                              />
                              <span>{event.title}</span>
                            </label>
                          </td>
                        ))}
                        <td>
                          <div className="actions">
                            <button
                              title="Copy invitation link"
                              aria-label="Copy invitation link"
                              onClick={() => copyLink(g)}
                            >
                              <Copy size={17} />
                              <span className="btn-text">Copy link</span>
                            </button>
                            <button
                              title="Share via WhatsApp"
                              aria-label="Share via WhatsApp"
                              onClick={() =>
                                window.open(whatsappUrl(g), '_blank')
                              }
                            >
                              <ExternalLink size={17} />
                              <span className="btn-text">WhatsApp</span>
                            </button>
                            <button
                              title="Delete guest"
                              aria-label="Delete guest"
                              className="danger"
                              onClick={() => {
                                if (
                                  window.confirm(
                                    `Remove ${g.name || 'this guest'}?`,
                                  )
                                )
                                  update(guests.filter((x) => x.id !== g.id));
                              }}
                            >
                              <Trash2 size={17} />
                              <span className="btn-text">Delete</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {displayed.length === 0 && (
                      <tr>
                        <td className="empty" colSpan={EVENTS.length + 4}>
                          {guests.length
                            ? 'No guests match this search or filter.'
                            : 'No guests yet. Use “Add guest” or import a JSON guest list.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {page === 'add' && (
            <>
              <div className="dash-title">
                <div>
                  <p className="overline">GUEST LIST</p>
                  <h1>Add guest</h1>
                  <p>
                    Each guest gets their own code and link. Tick the
                    celebrations they are invited to.
                  </p>
                </div>
              </div>
              <form className="add-form" onSubmit={addGuest}>
                <label>
                  Guest name
                  <input
                    aria-label="New guest name"
                    autoFocus
                    autoCapitalize="words"
                    autoCorrect="off"
                    spellCheck={false}
                    enterKeyHint="done"
                    value={draft.name}
                    onChange={(e) =>
                      setDraft({ ...draft, name: e.target.value })
                    }
                    placeholder="Full name, as you will address them"
                    required
                  />
                </label>
                <fieldset>
                  <legend>Guest of</legend>
                  <div className="side-choice">
                    {SIDES.map(([id, label]) => (
                      <label
                        className={
                          draft.side === id
                            ? 'side-option active'
                            : 'side-option'
                        }
                        key={id}
                      >
                        <input
                          type="radio"
                          name="side"
                          value={id}
                          required
                          checked={draft.side === id}
                          onChange={() => setDraft({ ...draft, side: id })}
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                </fieldset>
                <fieldset>
                  <legend>Invited to</legend>
                  {EVENTS.map((event) => (
                    <label className="check wide" key={event.id}>
                      <input
                        type="checkbox"
                        aria-label={`Invite to ${event.title}`}
                        checked={draft[event.id]}
                        onChange={(e) =>
                          setDraft({ ...draft, [event.id]: e.target.checked })
                        }
                      />
                      <span>
                        {event.title} <small>{event.date}</small>
                      </span>
                    </label>
                  ))}
                </fieldset>
                <button className="primary">
                  <Plus size={18} /> Add guest
                </button>
              </form>
              {justAdded.length > 0 && (
                <section className="just-added">
                  <h2>Added just now</h2>
                  {justAdded.map((g) => (
                    <div className="added-row" key={g.id}>
                      <span>
                        <strong>{g.name}</strong>
                        <small>
                          {sideLabel(g.side)} ·{' '}
                          {EVENTS.filter((event) => g[event.id])
                            .map((event) => event.title)
                            .join(', ') || 'No events'}
                        </small>
                      </span>
                      <button className="action" onClick={() => copyLink(g)}>
                        <Copy size={16} /> Copy link
                      </button>
                      <button
                        className="action"
                        onClick={() => window.open(whatsappUrl(g), '_blank')}
                      >
                        <ExternalLink size={16} /> WhatsApp
                      </button>
                    </div>
                  ))}
                  <button className="action" onClick={() => goTo('guests')}>
                    View all guests
                  </button>
                </section>
              )}
            </>
          )}

          {page === 'events' && (
            <>
              <div className="dash-title">
                <div>
                  <p className="overline">EVENT DETAILS</p>
                  <h1>Events & venues</h1>
                  <p>
                    Time, venue, map link, contacts and invitation artwork for
                    each celebration. One save button stores everything.
                  </p>
                </div>
                <button className="primary add" onClick={() => saveLocations()}>
                  <Save size={18} /> Save all event details
                </button>
              </div>
              {!locationsSaved && (
                <p className="config-warning unsaved">
                  You have unsaved changes. Guests see them only after you save.
                </p>
              )}
              <div className="location-editor-grid">
                {EVENTS.map((event) => {
                  const loc = locations[event.id];
                  return (
                    <div className="venue-edit-card" key={event.id}>
                      <h3>
                        {event.title} · {event.date}
                      </h3>
                      <label>
                        Time
                        <input
                          aria-label={`${event.title} time`}
                          placeholder="e.g. 6:00 PM"
                          value={loc.time}
                          onChange={(e) =>
                            editLocation(event.id, 'time', e.target.value)
                          }
                        />
                      </label>
                      <label>
                        Venue name
                        <input
                          aria-label={`${event.title} venue`}
                          placeholder="e.g. Rose Garden Marquee"
                          value={loc.venue}
                          onChange={(e) =>
                            editLocation(event.id, 'venue', e.target.value)
                          }
                        />
                      </label>
                      <label>
                        Full address
                        <input
                          aria-label={`${event.title} address`}
                          placeholder="Street, city, country"
                          value={loc.address}
                          onChange={(e) =>
                            editLocation(event.id, 'address', e.target.value)
                          }
                        />
                      </label>
                      <label>
                        Google Maps link (optional)
                        <input
                          aria-label={`${event.title} maps link`}
                          type="url"
                          inputMode="url"
                          placeholder="https://maps.app.goo.gl/..."
                          value={loc.mapsUrl}
                          onChange={(e) =>
                            editLocation(event.id, 'mapsUrl', e.target.value)
                          }
                        />
                      </label>
                      <p className="venue-hint">
                        Without a map link, Google Maps searches the venue and
                        address.
                      </p>
                      {loc.contacts.map((contact, i) => (
                        <div className="contact-edit" key={i}>
                          <label>
                            Contact {i + 1} name
                            <input
                              aria-label={`${event.title} contact ${i + 1} name`}
                              autoCapitalize="words"
                              placeholder="e.g. Ahmed (bride’s brother)"
                              value={contact.name}
                              onChange={(e) =>
                                editContact(event.id, i, 'name', e.target.value)
                              }
                            />
                          </label>
                          <label>
                            Contact {i + 1} number
                            <input
                              aria-label={`${event.title} contact ${i + 1} number`}
                              type="tel"
                              inputMode="tel"
                              autoComplete="off"
                              placeholder="+92 300 1234567"
                              value={contact.phone}
                              onChange={(e) =>
                                editContact(
                                  event.id,
                                  i,
                                  'phone',
                                  e.target.value,
                                )
                              }
                            />
                          </label>
                        </div>
                      ))}
                      <div className="artwork">
                        <img
                          src={imageSrc(event, loc)}
                          alt={`${event.title} invitation`}
                        />
                        <div>
                          <strong>Invitation artwork</strong>
                          <small>
                            {loc.image
                              ? 'Using your uploaded invitation.'
                              : 'Using the original artwork.'}
                          </small>
                          <label className="action">
                            <ImageUp size={16} /> Upload & replace
                            <input
                              type="file"
                              aria-label={`Replace ${event.title} invitation`}
                              accept="image/png,image/jpeg,image/webp"
                              hidden
                              onChange={(e) => {
                                replaceImage(event, e.target.files[0]);
                                e.target.value = '';
                              }}
                            />
                          </label>
                          {loc.image && (
                            <button
                              className="action"
                              onClick={() =>
                                editLocation(event.id, 'image', '')
                              }
                            >
                              <RotateCcw size={16} /> Use original
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <button
                className="primary save-all"
                onClick={() => saveLocations()}
              >
                <Save size={18} /> Save all event details
              </button>
              <p className="config-warning">
                This file is public and holds only event details, never guest
                names. On the hosted site, saving downloads{' '}
                <code>event-locations.json</code> for you to place in{' '}
                <code>public/</code> and redeploy.
              </p>
            </>
          )}

          {page === 'photos' && (
            <>
              <PhotoShare />
              <div className="help">
                <ShieldCheck size={20} />
                <div>
                  <strong>Private by design (for a static site)</strong>
                  <p>
                    The public file contains encrypted event assignments, not
                    guest names. Your editable guest list lives encrypted in
                    this browser; <b>export a backup</b> and never upload
                    guest-list.json to your public site. Publishing requires
                    replacing <code>public/invitations.json</code> and
                    redeploying.
                  </p>
                </div>
              </div>
            </>
          )}

          {message && (
            <div className="notice" role="status">
              {message}
            </div>
          )}
          {autoPublished && (
            <p className="admin-foot">
              Dev server: guest links were published automatically at{' '}
              {autoPublished}.
            </p>
          )}
          <p className="admin-foot">
            Changes are auto-saved to this browser. After each update, export
            guest-list.json for backup and publish invitations.json for guests.
          </p>
        </main>
      )}
    </div>
  );
}
