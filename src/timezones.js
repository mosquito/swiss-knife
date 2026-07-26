import { TIMEZONE_LOCATIONS } from './timezoneLocations';

export { TIMEZONE_LOCATIONS };

export const MAP_TIMEZONES = [
  { zone: 'Pacific/Honolulu', city: 'Honolulu', country: 'US', lat: 21.3, lon: -157.9 },
  { zone: 'America/Anchorage', city: 'Anchorage', country: 'US', lat: 61.2, lon: -149.9 },
  { zone: 'America/Vancouver', city: 'Vancouver', country: 'CA', lat: 49.3, lon: -123.1 },
  { zone: 'America/Los_Angeles', city: 'Los Angeles', country: 'US', lat: 34.1, lon: -118.2 },
  { zone: 'America/Denver', city: 'Denver', country: 'US', lat: 39.7, lon: -105 },
  { zone: 'America/Mexico_City', city: 'Mexico City', country: 'MX', lat: 19.4, lon: -99.1 },
  { zone: 'America/Chicago', city: 'Chicago', country: 'US', lat: 41.9, lon: -87.6 },
  { zone: 'America/New_York', city: 'New York', country: 'US', lat: 40.7, lon: -74 },
  { zone: 'America/Bogota', city: 'Bogotá', country: 'CO', lat: 4.7, lon: -74.1 },
  { zone: 'America/Lima', city: 'Lima', country: 'PE', lat: -12, lon: -77 },
  { zone: 'America/Caracas', city: 'Caracas', country: 'VE', lat: 10.5, lon: -66.9 },
  { zone: 'America/Santiago', city: 'Santiago', country: 'CL', lat: -33.4, lon: -70.7 },
  { zone: 'America/Argentina/Buenos_Aires', city: 'Buenos Aires', country: 'AR', lat: -34.6, lon: -58.4 },
  { zone: 'America/Sao_Paulo', city: 'São Paulo', country: 'BR', lat: -23.6, lon: -46.6 },
  { zone: 'Atlantic/Reykjavik', city: 'Reykjavík', country: 'IS', lat: 64.1, lon: -21.9 },
  { zone: 'Europe/London', city: 'London', country: 'GB', lat: 51.5, lon: -0.1 },
  { zone: 'Europe/Paris', city: 'Paris', country: 'FR', lat: 48.9, lon: 2.4 },
  { zone: 'Europe/Amsterdam', city: 'Amsterdam', country: 'NL', lat: 52.4, lon: 4.9 },
  { zone: 'Europe/Berlin', city: 'Berlin', country: 'DE', lat: 52.5, lon: 13.4 },
  { zone: 'Europe/Athens', city: 'Athens', country: 'GR', lat: 38, lon: 23.7 },
  { zone: 'Europe/Helsinki', city: 'Helsinki', country: 'FI', lat: 60.2, lon: 24.9 },
  { zone: 'Europe/Moscow', city: 'Moscow', country: 'RU', lat: 55.8, lon: 37.6 },
  { zone: 'Africa/Casablanca', city: 'Casablanca', country: 'MA', lat: 33.6, lon: -7.6 },
  { zone: 'Africa/Lagos', city: 'Lagos', country: 'NG', lat: 6.5, lon: 3.4 },
  { zone: 'Africa/Cairo', city: 'Cairo', country: 'EG', lat: 30, lon: 31.2 },
  { zone: 'Africa/Johannesburg', city: 'Johannesburg', country: 'ZA', lat: -26.2, lon: 28 },
  { zone: 'Asia/Jerusalem', city: 'Jerusalem', country: 'IL', lat: 31.8, lon: 35.2 },
  { zone: 'Asia/Dubai', city: 'Dubai', country: 'AE', lat: 25.2, lon: 55.3 },
  { zone: 'Asia/Karachi', city: 'Karachi', country: 'PK', lat: 24.9, lon: 67 },
  { zone: 'Asia/Kolkata', city: 'Kolkata', country: 'IN', lat: 22.6, lon: 88.4 },
  { zone: 'Asia/Kathmandu', city: 'Kathmandu', country: 'NP', lat: 27.7, lon: 85.3 },
  { zone: 'Asia/Dhaka', city: 'Dhaka', country: 'BD', lat: 23.8, lon: 90.4 },
  { zone: 'Asia/Bangkok', city: 'Bangkok', country: 'TH', lat: 13.8, lon: 100.5 },
  { zone: 'Asia/Jakarta', city: 'Jakarta', country: 'ID', lat: -6.2, lon: 106.8 },
  { zone: 'Asia/Singapore', city: 'Singapore', country: 'SG', lat: 1.3, lon: 103.8 },
  { zone: 'Asia/Shanghai', city: 'Shanghai', country: 'CN', lat: 31.2, lon: 121.5 },
  { zone: 'Asia/Hong_Kong', city: 'Hong Kong', country: 'HK', lat: 22.3, lon: 114.2 },
  { zone: 'Asia/Seoul', city: 'Seoul', country: 'KR', lat: 37.6, lon: 127 },
  { zone: 'Asia/Tokyo', city: 'Tokyo', country: 'JP', lat: 35.7, lon: 139.7 },
  { zone: 'Australia/Perth', city: 'Perth', country: 'AU', lat: -31.9, lon: 115.9 },
  { zone: 'Australia/Adelaide', city: 'Adelaide', country: 'AU', lat: -34.9, lon: 138.6 },
  { zone: 'Australia/Sydney', city: 'Sydney', country: 'AU', lat: -33.9, lon: 151.2 },
  { zone: 'Pacific/Port_Moresby', city: 'Port Moresby', country: 'PG', lat: -9.4, lon: 147.2 },
  { zone: 'Pacific/Auckland', city: 'Auckland', country: 'NZ', lat: -36.9, lon: 174.8 },
];

const FALLBACK_TIMEZONES = [
  'UTC',
  ...MAP_TIMEZONES.map(({ zone }) => zone),
  'Atlantic/Azores',
  'Atlantic/Cape_Verde',
  'Pacific/Fiji',
  'Pacific/Guam',
  'Pacific/Pago_Pago',
  'Pacific/Tahiti',
];

export const getSupportedTimezones = () => {
  const discovered = typeof Intl.supportedValuesOf === 'function'
    ? Intl.supportedValuesOf('timeZone')
    : FALLBACK_TIMEZONES;
  return ['UTC', ...new Set(discovered)].sort((a, b) => a.localeCompare(b));
};

export const getBrowserTimezone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
};

const partsForZone = (ms, timeZone) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(ms));

  return Object.fromEntries(parts.filter(({ type }) => type !== 'literal').map(({ type, value }) => [type, value]));
};

export const getTimezoneOffsetMinutes = (ms, timeZone) => {
  const parts = partsForZone(ms, timeZone);
  const displayedAsUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return Math.round((displayedAsUtc - Math.floor(ms / 1000) * 1000) / 60000);
};

export const formatOffset = (minutes, prefix = 'UTC') => {
  if (!minutes) return `${prefix}±00:00`;
  const sign = minutes > 0 ? '+' : '−';
  const absolute = Math.abs(minutes);
  return `${prefix}${sign}${String(Math.floor(absolute / 60)).padStart(2, '0')}:${String(absolute % 60).padStart(2, '0')}`;
};

export const getTimezoneName = (ms, timeZone) => {
  try {
    const part = new Intl.DateTimeFormat('en-US', {
      timeZone,
      timeZoneName: 'short',
    }).formatToParts(new Date(ms)).find(({ type }) => type === 'timeZoneName');
    return part?.value || timeZone;
  } catch {
    return timeZone;
  }
};

export const formatInTimezone = (ms, timeZone) => {
  const date = new Date(ms);
  return {
    date: new Intl.DateTimeFormat(undefined, {
      timeZone,
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: '2-digit',
    }).format(date),
    time: new Intl.DateTimeFormat(undefined, {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    }).format(date),
    offset: formatOffset(getTimezoneOffsetMinutes(ms, timeZone)),
    abbreviation: getTimezoneName(ms, timeZone),
  };
};

export const toDatetimeLocalInZone = (ms, timeZone) => {
  if (ms === null || ms === undefined || !Number.isFinite(ms)) return '';
  const parts = partsForZone(ms, timeZone);
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
};

const parseLocalParts = (value) => {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return null;
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
    second: Number(match[6] || 0),
  };
};

const sameWallClock = (actual, wanted) => (
  Number(actual.year) === wanted.year
  && Number(actual.month) === wanted.month
  && Number(actual.day) === wanted.day
  && Number(actual.hour) === wanted.hour
  && Number(actual.minute) === wanted.minute
  && Number(actual.second) === wanted.second
);

export const zonedLocalToUtc = (value, timeZone, disambiguation = 'earlier') => {
  const wanted = parseLocalParts(value);
  if (!wanted) return { ms: null, error: 'Use YYYY-MM-DD HH:mm[:ss]' };

  const wallClockAsUtc = Date.UTC(
    wanted.year,
    wanted.month - 1,
    wanted.day,
    wanted.hour,
    wanted.minute,
    wanted.second,
  );

  // Nearby samples reveal all offsets that can apply around a transition.
  const offsets = new Set();
  for (let hours = -36; hours <= 36; hours += 6) {
    offsets.add(getTimezoneOffsetMinutes(wallClockAsUtc + hours * 3600000, timeZone));
  }
  const alternatives = [...offsets]
    .map((offset) => wallClockAsUtc - offset * 60000)
    .filter((candidate) => sameWallClock(partsForZone(candidate, timeZone), wanted))
    .filter((candidate, index, all) => all.indexOf(candidate) === index)
    .sort((a, b) => a - b);

  if (alternatives.length === 0) {
    return {
      ms: null,
      error: `That wall-clock time does not exist in ${timeZone} because the clock moves forward.`,
      dstStatus: 'gap',
      alternatives: [],
    };
  }

  const index = disambiguation === 'later' ? alternatives.length - 1 : 0;
  return {
    ms: alternatives[index],
    error: '',
    dstStatus: alternatives.length > 1 ? 'overlap' : 'exact',
    alternatives,
  };
};

export const parseDateInTimezone = (value, timeZone, disambiguation = 'earlier') => {
  const trimmed = value.trim();
  if (!trimmed) return { ms: null, error: '' };
  const localParts = parseLocalParts(trimmed);
  const hasExplicitOffset = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(trimmed);
  if (localParts && !hasExplicitOffset) return zonedLocalToUtc(trimmed, timeZone, disambiguation);
  const ms = Date.parse(trimmed);
  return Number.isNaN(ms)
    ? { ms: null, error: 'Unparseable date' }
    : { ms, error: '', dstStatus: 'explicit', alternatives: [ms] };
};

const transitionCache = new Map();

const findOffsetTransition = (timeZone, fromMs, toMs, previousOffset) => {
  let low = fromMs;
  let high = toMs;
  while (high - low > 1000) {
    const middle = low + Math.floor((high - low) / 2);
    if (getTimezoneOffsetMinutes(middle, timeZone) === previousOffset) low = middle;
    else high = middle;
  }
  return Math.ceil(high / 1000) * 1000;
};

export const getTimezoneTransitions = (timeZone, year) => {
  const cacheKey = `${timeZone}:${year}`;
  if (transitionCache.has(cacheKey)) return transitionCache.get(cacheKey);

  const start = Date.UTC(year, 0, 1);
  const end = Date.UTC(year + 1, 0, 1);
  const step = 6 * 3600000;
  const transitions = [];
  let previousMs = start;
  let previousOffset = getTimezoneOffsetMinutes(start, timeZone);

  for (let sample = start + step; sample <= end; sample += step) {
    const offset = getTimezoneOffsetMinutes(sample, timeZone);
    if (offset !== previousOffset) {
      const at = findOffsetTransition(timeZone, previousMs, sample, previousOffset);
      const nextOffset = getTimezoneOffsetMinutes(at, timeZone);
      transitions.push({
        at,
        beforeOffset: previousOffset,
        afterOffset: nextOffset,
        deltaMinutes: nextOffset - previousOffset,
      });
      previousOffset = nextOffset;
    }
    previousMs = sample;
  }

  const result = {
    year,
    startOffset: getTimezoneOffsetMinutes(start, timeZone),
    endOffset: getTimezoneOffsetMinutes(end - 1, timeZone),
    transitions,
  };
  transitionCache.set(cacheKey, result);
  return result;
};
