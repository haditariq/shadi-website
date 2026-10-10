// The three celebrations. Guests are invited to each one independently.
export const EVENTS = [
  {
    id: 'nikkah',
    title: 'Nikkah',
    date: '23 March',
    time: '4:30 PM',
    image: 'images/nikkah-barat.png',
    preview: 'images/nikkah-barat.jpg',
  },
  {
    id: 'barat',
    title: 'Barat',
    date: '23 March',
    time: '6:00 PM',
    image: 'images/nikkah-barat.png',
    preview: 'images/nikkah-barat.jpg',
  },
  {
    id: 'walima',
    title: 'Walima',
    date: '25 March',
    time: '',
    image: 'images/walima.png',
    preview: 'images/walima.jpg',
  },
];
const blankContact = () => ({ name: '', phone: '' });
const blankEvent = (event) => ({
  time: event.time,
  venue: '',
  address: '',
  mapsUrl: '',
  // Path of an uploaded replacement invitation; empty means the default art.
  image: '',
  contacts: [blankContact(), blankContact()],
});
// Fills in anything missing, so older saved files keep working.
export const mergeLocations = (saved = {}) => {
  // Files saved while Nikkah and Barat were one event: same venue for both.
  if (saved?.barat && !saved.nikkah) {
    const { venue = '', address = '', mapsUrl = '' } = saved.barat;
    saved = { ...saved, nikkah: { venue, address, mapsUrl } };
  }
  return Object.fromEntries(
    EVENTS.map((event) => {
      const merged = { ...blankEvent(event), ...saved?.[event.id] };
      merged.contacts = [0, 1].map((i) => ({
        ...blankContact(),
        ...merged.contacts?.[i],
      }));
      return [event.id, merged];
    }),
  );
};
export const defaultLocations = mergeLocations();
export const loadLocations = async () => {
  const response = await fetch(
    `${import.meta.env.BASE_URL}event-locations.json`,
    { cache: 'no-store' },
  );
  if (!response.ok) throw Error('Event locations could not be loaded');
  return mergeLocations(await response.json());
};
export const imageSrc = (event, loc) =>
  import.meta.env.BASE_URL + (loc?.image || event.image);
// Lighter copy of the original artwork for showing on screen; the full
// quality file is what "Save invitation" downloads.
export const previewSrc = (event, loc) =>
  import.meta.env.BASE_URL + (loc?.image || event.preview);
export const mapHref = (loc) =>
  loc.mapsUrl?.trim() ||
  'https://www.google.com/maps/search/?api=1&query=' +
    encodeURIComponent([loc.venue, loc.address].filter(Boolean).join(', '));
export const locationString = (loc) =>
  [loc.venue, loc.address].filter(Boolean).join(' — ');
// Guest records made before Nikkah and Barat were split only have `barat`.
export const withEvents = (g) => ({
  nikkah: !!(g.nikkah ?? g.barat),
  barat: !!g.barat,
  walima: !!g.walima,
});
// WhatsApp needs the full international number. Numbers written the local
// way (0321...) are taken to be Pakistani.
const DEFAULT_COUNTRY_CODE = '92';
export const whatsappNumber = (phone) => {
  const raw = String(phone || '').trim();
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  if (raw.startsWith('+')) return digits;
  if (digits.startsWith('00')) return digits.slice(2);
  if (digits.startsWith('0')) return DEFAULT_COUNTRY_CODE + digits.slice(1);
  return digits;
};
export const chatHref = (contact, event) =>
  `https://wa.me/${whatsappNumber(contact.phone)}?text=${encodeURIComponent(
    `Assalamu alaikum${contact.name ? ' ' + contact.name : ''}, I have a question about the ${event.title}.`,
  )}`;
