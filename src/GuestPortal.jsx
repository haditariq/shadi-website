import React, { useEffect, useRef, useState } from 'react';
import {
  Heart,
  Download,
  Copy,
  CheckCircle2,
  CalendarDays,
  Clock,
  MapPin,
  Navigation,
  Phone,
  MessageCircle,
  Camera,
  X,
  Maximize2,
  ChevronUp,
} from 'lucide-react';
import { codeHash, unseal, invitationPassword, norm } from './crypto';
import {
  EVENTS,
  defaultLocations,
  loadLocations,
  imageSrc,
  previewSrc,
  mapHref,
  locationString,
  withEvents,
  chatHref,
} from './locations';
import Brand from './Brand';
import { copyText } from './clipboard';
export default function GuestPortal() {
  const [locations, setLocations] = useState(defaultLocations);
  useEffect(() => {
    loadLocations()
      .then(setLocations)
      .catch(() => {});
  }, []);
  const params = new URLSearchParams(location.search);
  const [name, setName] = useState(params.get('name') || ''),
    [code, setCode] = useState((params.get('code') || '').toUpperCase()),
    // A personal link opens on its own, so start in the loading state.
    [status, setStatus] = useState(name && code ? 'loading' : 'idle'),
    [guest, setGuest] = useState(null),
    [active, setActive] = useState(''),
    [error, setError] = useState('');
  // A personal link carries both name and code, so it opens straight away.
  useEffect(() => {
    if (name && code) submit();
  }, []);
  async function submit(e) {
    e?.preventDefault();
    setStatus('loading');
    setError('');
    try {
      const response = await fetch(
        `${import.meta.env.BASE_URL}invitations.json?x=${Date.now()}`,
        { cache: 'no-store' },
      );
      if (!response.ok)
        throw Error('Published invitations could not be loaded.');
      const data = await response.json();
      const id = await codeHash(code);
      const row = data.guests?.find((r) => r.id === id);
      if (!row)
        throw Error(
          'We could not find that invitation. Check your link, or ask the hosts to send it again.',
        );
      const found = await unseal(row, invitationPassword(name, code));
      if (norm(found.name) !== norm(name))
        throw Error('Name or code is incorrect.');
      setGuest({ ...found, ...withEvents(found) });
      setStatus('found');
    } catch (err) {
      setStatus('idle');
      setError(
        err.name === 'OperationError'
          ? 'Name or code is incorrect.'
          : err.message,
      );
    }
  }
  const invited = guest ? EVENTS.filter((event) => guest[event.id]) : [];
  const shown = invited.find((event) => event.id === active) || invited[0];
  function show(event) {
    setActive(event.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  // Swipe left or right on the invitation to move between events.
  const touch = useRef(null);
  function onTouchEnd(e) {
    if (!touch.current) return;
    const dx = e.changedTouches[0].clientX - touch.current.x;
    const dy = e.changedTouches[0].clientY - touch.current.y;
    touch.current = null;
    if (Math.abs(dx) < 70 || Math.abs(dy) > 50) return;
    const next = invited[invited.indexOf(shown) + (dx < 0 ? 1 : -1)];
    if (next) show(next);
  }
  if (!guest && status === 'loading' && !error)
    return (
      <div className="site guest-bg opening">
        <Brand />
        <div className="spinner" aria-hidden="true" />
        <p role="status">Opening your invitation…</p>
      </div>
    );
  return (
    <div className={guest ? 'site guest-bg invited' : 'site guest-bg'}>
      {!guest && (
        <header>
          <Brand />
        </header>
      )}
      <main className="hero">
        {!guest ? (
          <section className="glass access">
            <span className="flourish">❀ ─ ✧ ─ ❀</span>
            <h2>Your personal invitation</h2>
            <p>
              Enter the name and invitation code shared with you to see the
              celebrations you're invited to.
            </p>
            <form onSubmit={submit}>
              <label>
                Guest full name
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter your name"
                  required
                  autoComplete="name"
                  autoCapitalize="words"
                  autoCorrect="off"
                  spellCheck={false}
                  enterKeyHint="go"
                />
              </label>
              <label>
                Invitation code
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="e.g. XK72..."
                  required
                  autoCapitalize="characters"
                  autoCorrect="off"
                  autoComplete="off"
                  spellCheck={false}
                  enterKeyHint="go"
                />
              </label>
              {error && (
                <div className="error" role="alert">
                  {error}
                </div>
              )}
              <button
                disabled={status === 'loading'}
                className="primary"
                type="submit"
              >
                {status === 'loading'
                  ? 'Opening invitation…'
                  : 'View my invitation'}{' '}
                <Heart size={16} />
              </button>
            </form>
          </section>
        ) : (
          <section className="revealed">
            {!shown ? (
              <div className="glass access">
                <p>Please contact the hosts for your invitation details.</p>
              </div>
            ) : (
              <>
                {invited.length > 1 && (
                  <div className="event-tabs" role="tablist">
                    {invited.map((event) => (
                      <button
                        key={event.id}
                        role="tab"
                        aria-selected={event.id === shown.id}
                        className={
                          event.id === shown.id
                            ? 'event-tab active'
                            : 'event-tab'
                        }
                        onClick={() => show(event)}
                      >
                        {event.title}
                        <small>{event.date}</small>
                      </button>
                    ))}
                  </div>
                )}
                <div
                  className="event-stage"
                  onTouchStart={(e) => {
                    touch.current = {
                      x: e.touches[0].clientX,
                      y: e.touches[0].clientY,
                    };
                  }}
                  onTouchEnd={onTouchEnd}
                >
                  <EventCard
                    key={shown.id}
                    event={shown}
                    guestName={guest.name}
                    location={locations[shown.id]}
                  />
                </div>
              </>
            )}
          </section>
        )}
        {!guest && (
          <p className="footer-note">Made with love · Private invitation</p>
        )}
      </main>
    </div>
  );
}
function EventCard({ event, location, guestName }) {
  const [copied, setCopied] = useState('');
  const [zoomed, setZoomed] = useState(false);
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const contacts = location.contacts.filter((c) => c.name || c.phone);
  const hasVenue = !!(location.venue || location.address);
  const overlay = zoomed || open;
  useEffect(() => {
    if (!overlay) return;
    const close = (e) => {
      if (e.key !== 'Escape') return;
      setZoomed(false);
      setOpen(false);
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', close);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', close);
    };
  }, [overlay]);
  // Pull the sheet down by its handle to close it.
  const drag = useRef(null);
  // Touches inside an overlay must not count as a swipe between events.
  const keepTouch = {
    onTouchStart: (e) => e.stopPropagation(),
    onTouchEnd: (e) => e.stopPropagation(),
  };
  return (
    <article className="event-card" role="tabpanel">
      <button
        className={loaded ? 'artwork-button loaded' : 'artwork-button'}
        aria-label={`View the ${event.title} invitation full screen`}
        onClick={() => setZoomed(true)}
      >
        <img
          src={previewSrc(event, location)}
          alt={`${event.title} invitation artwork`}
          onLoad={() => setLoaded(true)}
        />
        <span className="zoom-hint">
          <Maximize2 size={14} /> Tap to enlarge
        </span>
      </button>
      <button
        className="details-button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <span className="details-arrow">
          <ChevronUp size={20} />
        </span>
        <span>
          <strong>{event.title} details</strong>
          <small>Time, venue, directions and contacts</small>
        </span>
      </button>
      {open && (
        <div
          className="sheet-backdrop"
          onClick={() => setOpen(false)}
          {...keepTouch}
        >
          <section
            className="sheet"
            role="dialog"
            aria-modal="true"
            aria-label={`${event.title} details`}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="sheet-handle"
              onTouchStart={(e) => {
                drag.current = e.touches[0].clientY;
              }}
              onTouchEnd={(e) => {
                if (e.changedTouches[0].clientY - drag.current > 60)
                  setOpen(false);
              }}
            >
              <span />
              <button
                className="sheet-close"
                aria-label="Close details"
                onClick={() => setOpen(false)}
              >
                <X size={20} />
              </button>
            </div>
            <div className="event-info">
              <p className="sheet-guest">
                Dear <strong>{guestName}</strong>
              </p>
              <span className="pill">YOU ARE CORDIALLY INVITED TO THE</span>
              <h3>{event.title}</h3>
              <dl className="facts">
                <div>
                  <dt>
                    <CalendarDays size={18} /> Date
                  </dt>
                  <dd>{event.date}</dd>
                </div>
                <div>
                  <dt>
                    <Clock size={18} /> Time
                  </dt>
                  <dd>{location.time || 'To be announced'}</dd>
                </div>
              </dl>
              {hasVenue ? (
                <div className="location-info">
                  <p className="venue-title">
                    <MapPin size={18} />
                    <strong>{location.venue || 'Event location'}</strong>
                  </p>
                  {location.address && (
                    <p className="venue-address">{location.address}</p>
                  )}
                  <a
                    href={mapHref(location)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="primary directions"
                  >
                    <Navigation size={18} /> Get directions
                  </a>
                  <button
                    className="link-button"
                    onClick={async () => {
                      setCopied(
                        (await copyText(locationString(location)))
                          ? 'Address copied'
                          : 'Copy failed',
                      );
                      setTimeout(() => setCopied(''), 2000);
                    }}
                  >
                    <Copy size={15} />{' '}
                    <span aria-live="polite">{copied || 'Copy address'}</span>
                  </button>
                </div>
              ) : (
                <p className="venue-pending">
                  <MapPin size={18} /> Venue to be announced
                </p>
              )}
              {contacts.length > 0 && (
                <div className="contacts">
                  <p className="contacts-title">Need help? Contact</p>
                  {contacts.map((c, i) => (
                    <div className="contact" key={i}>
                      <span>
                        <strong>{c.name || 'Host'}</strong>
                        {c.phone && <small>{c.phone}</small>}
                      </span>
                      {c.phone && (
                        <div className="contact-buttons">
                          <a
                            className="action highlight"
                            href={chatHref(c, event)}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <MessageCircle size={16} /> Chat with{' '}
                            {c.name || 'host'}
                          </a>
                          <a
                            className="action"
                            href={`tel:${c.phone.replace(/[^\d+]/g, '')}`}
                            aria-label={`Call ${c.name || 'host'}`}
                          >
                            <Phone size={16} /> Call
                          </a>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
              <a
                download
                href={imageSrc(event, location)}
                className="action save-invite"
              >
                <Download size={16} /> Save invitation to phone
              </a>
              <a className="photo-cta" href="#photos">
                <Camera size={22} />
                <span>
                  <strong>Share your wedding photos</strong>
                  <small>Upload the moments you capture</small>
                </span>
              </a>
            </div>
          </section>
        </div>
      )}
      {zoomed && (
        <div
          className="lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={`${event.title} invitation`}
          onClick={() => setZoomed(false)}
          {...keepTouch}
        >
          <button className="lightbox-close" aria-label="Close">
            <X size={22} />
          </button>
          <img
            src={imageSrc(event, location)}
            alt={`${event.title} invitation artwork`}
          />
        </div>
      )}
    </article>
  );
}
