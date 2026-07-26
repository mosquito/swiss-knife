import React, { useEffect, useMemo, useRef, useState } from 'react';
import { UndoableInput } from './UndoableFields';
import Base64QuerySync from './Base64QuerySync';
import {
  MAP_TIMEZONES,
  TIMEZONE_LOCATIONS,
  formatOffset,
  formatInTimezone,
  getBrowserTimezone,
  getSupportedTimezones,
  getTimezoneOffsetMinutes,
  getTimezoneTransitions,
  parseDateInTimezone,
  toDatetimeLocalInZone,
} from './timezones';
import worldMapSvg from './assets/world-map.svg';

const humanRelative = (targetMs, nowMs) => {
  let diff = targetMs - nowMs;
  const direction = diff === 0 ? 'now' : diff > 0 ? 'in' : 'ago';
  diff = Math.abs(diff);
  const sec = Math.floor(diff / 1000);
  const days = Math.floor(sec / 86400);
  const hours = Math.floor((sec % 86400) / 3600);
  const mins = Math.floor((sec % 3600) / 60);
  const seconds = sec % 60;
  const parts = [];
  if (days) parts.push(`${days} day${days !== 1 ? 's' : ''}`);
  if (hours) parts.push(`${hours} hour${hours !== 1 ? 's' : ''}`);
  if (mins) parts.push(`${mins} minute${mins !== 1 ? 's' : ''}`);
  if (seconds || parts.length === 0) parts.push(`${seconds} second${seconds !== 1 ? 's' : ''}`);
  if (direction === 'now') return 'now';
  return direction === 'in' ? `after ${parts.join(' ')}` : `${parts.join(' ')} ago`;
};

const isNumeric = (value) => /^-?\d+(\.\d+)?$/.test(value.trim());

const MAP_WIDTH = 2000;
const MAP_HEIGHT = 1001;
const ROBINSON_X = [1, .9986, .9954, .99, .9822, .973, .96, .9427, .9216, .8962, .8679, .835, .7986, .7597, .7186, .6732, .6213, .5722, .5322];
const ROBINSON_Y = [0, .062, .124, .186, .248, .31, .372, .434, .4958, .5571, .6176, .6769, .7346, .7903, .8435, .8936, .9394, .9761, 1];
const interpolateRobinson = (table, latitude) => {
  const absolute = Math.min(Math.abs(latitude), 90);
  const lower = Math.floor(absolute / 5);
  const upper = Math.min(lower + 1, table.length - 1);
  return table[lower] + (table[upper] - table[lower]) * ((absolute % 5) / 5);
};
const mapX = (longitude, latitude = 0) => (
  975.53 + longitude * interpolateRobinson(ROBINSON_X, latitude) * 5.62624
);
const mapY = (latitude) => (
  572.7 - Math.sign(latitude) * 513.15 * interpolateRobinson(ROBINSON_Y, latitude)
);
const WORLD_MAP_PATHS = (worldMapSvg.match(/<path\b[^>]*\/>/g) || [])
  .join('')
  .replace(/\sstyle="[^"]*"/g, '');
const WORLD_MAP_MARKUP = { __html: WORLD_MAP_PATHS };
const createRegionNames = (locale) => {
  try {
    return typeof Intl.DisplayNames === 'function' ? new Intl.DisplayNames(locale, { type: 'region' }) : null;
  } catch {
    return null;
  }
};
const REGION_NAMES = createRegionNames(undefined);
const REGION_NAMES_EN = createRegionNames('en');
const REGION_NAMES_RU = createRegionNames('ru');
const getRegionName = (code) => {
  try {
    return REGION_NAMES?.of(code) || code;
  } catch {
    return code;
  }
};
const getRegionAliases = (code) => [...new Set([
  code,
  getRegionName(code),
  REGION_NAMES_EN?.of(code),
  REGION_NAMES_RU?.of(code),
].filter(Boolean))];
const normalizeSearch = (value) => value
  .trim()
  .toLocaleLowerCase()
  .normalize('NFKD')
  .replace(/\p{Diacritic}/gu, '');
const getLocationCountryCodes = (point) => point.country.split(',');
const locationMatchesCountry = (point, countryCode) => getLocationCountryCodes(point).includes(countryCode);
const getLocationCountryName = (point) => getLocationCountryCodes(point).map(getRegionName).join(' / ');
const TIMEZONE_LOCATION_BY_ZONE = new Map(TIMEZONE_LOCATIONS.map((point) => [point.zone, point]));
const PIN_COLORS = ['#00b9f1', '#d83aff', '#f59e0b', '#22c55e', '#8b5cf6', '#f43f5e', '#14b8a6', '#f97316'];
const VISIBLE_PIN_COUNT = 5;
const MAX_PINNED_ZONES = 24;
const MAJOR_MAP_TIMEZONES = MAP_TIMEZONES.map((point) => {
  const databasePoint = TIMEZONE_LOCATION_BY_ZONE.get(point.zone);
  return databasePoint ? { ...point, lat: databasePoint.lat, lon: databasePoint.lon } : point;
});
const MAJOR_ZONE_RANK = new Map(MAJOR_MAP_TIMEZONES.map((point, index) => [point.zone, index]));
const getCivilTimeSignature = (timeZone, year) => Array.from({ length: 12 }, (_, month) => (
  getTimezoneOffsetMinutes(Date.UTC(year, month, 15, 12), timeZone)
)).join(',');
const getCivilTimeRepresentatives = (locations, year) => {
  const groups = new Map();
  locations.forEach((point) => {
    const signature = getCivilTimeSignature(point.zone, year);
    if (!groups.has(signature)) groups.set(signature, []);
    groups.get(signature).push(point);
  });
  return [...groups.values()].map((points) => points.sort((a, b) => (
    (MAJOR_ZONE_RANK.get(a.zone) ?? Number.MAX_SAFE_INTEGER)
    - (MAJOR_ZONE_RANK.get(b.zone) ?? Number.MAX_SAFE_INTEGER)
  ))[0]);
};
const getCountryRepresentatives = (locations) => {
  const representatives = new Map();
  [...MAJOR_MAP_TIMEZONES, ...locations].forEach((point) => {
    getLocationCountryCodes(point).forEach((countryCode) => {
      if (!representatives.has(countryCode)) representatives.set(countryCode, point);
    });
  });
  return [...representatives.values()];
};
const thinTimezonePoints = (
  locations,
  zoom,
  selectedPoint,
  pinnedPoints,
  civilTimeRepresentatives,
  countryRepresentatives,
) => {
  if (zoom >= 3.5) return locations;

  const preferred = [
    selectedPoint,
    ...pinnedPoints,
    ...MAJOR_MAP_TIMEZONES,
    ...civilTimeRepresentatives,
    ...countryRepresentatives,
    ...locations,
  ].filter(Boolean);
  const minimumDistance = 48 / zoom;
  const alwaysVisibleZones = new Set([
    selectedPoint?.zone,
    ...pinnedPoints.map((point) => point.zone),
    ...MAJOR_MAP_TIMEZONES.map((point) => point.zone),
    ...civilTimeRepresentatives.map((point) => point.zone),
  ].filter(Boolean));
  const seenZones = new Set();
  const visible = [];

  preferred.forEach((point) => {
    if (seenZones.has(point.zone)) return;
    seenZones.add(point.zone);
    const x = mapX(point.lon, point.lat);
    const y = mapY(point.lat);
    if (
      alwaysVisibleZones.has(point.zone)
      || visible.every((other) => Math.hypot(x - other.x, y - other.y) >= minimumDistance)
    ) {
      visible.push({ ...point, x, y });
    }
  });

  return visible;
};

const describeTransitionPattern = (ms, timeZone) => {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone,
      calendar: 'gregory',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long',
    })
      .formatToParts(new Date(ms))
      .filter(({ type }) => type !== 'literal')
      .map(({ type, value }) => [type, value]),
  );
  const numericMonth = Number(new Intl.DateTimeFormat('en-US', {
    timeZone,
    calendar: 'gregory',
    month: 'numeric',
  }).format(new Date(ms)));
  const day = Number(parts.day);
  const daysInMonth = new Date(Date.UTC(Number(parts.year), numericMonth, 0)).getUTCDate();
  const ordinal = day + 7 > daysInMonth
    ? 'Last'
    : ['First', 'Second', 'Third', 'Fourth'][Math.floor((day - 1) / 7)];
  return `${ordinal} ${parts.weekday} in ${parts.month}`;
};

const TimezoneMap = ({
  selectedZone,
  referenceMs,
  onSelect,
  currentLocation,
  locationStatus,
  onLocate,
  locations,
  pinnedZones,
  allPinnedZones,
  onPin,
  onUnpin,
}) => {
  const selectedPoint = locations.find(({ zone }) => zone === selectedZone)
    || MAJOR_MAP_TIMEZONES.find(({ zone }) => zone === selectedZone);
  const [zoom, setZoom] = useState(1);
  const [center, setCenter] = useState({ x: MAP_WIDTH / 2, y: MAP_HEIGHT / 2 });
  const [hoveredPoint, setHoveredPoint] = useState(null);
  const dragRef = useRef(null);
  const landRef = useRef(null);
  const hoveredCountryRef = useRef(null);
  const tooltipHideRef = useRef(null);

  const focus = (point, nextZoom = zoom) => {
    if (!point || nextZoom === 1) {
      setCenter({ x: MAP_WIDTH / 2, y: MAP_HEIGHT / 2 });
      return;
    }
    setCenter({ x: mapX(point.lon, point.lat), y: mapY(point.lat) });
  };

  const changeZoom = (nextZoom) => {
    const clamped = Math.min(Math.max(nextZoom, 1), 4);
    setZoom(clamped);
    focus(currentLocation || selectedPoint, clamped);
  };
  useEffect(() => {
    if (currentLocation) {
      setZoom(2.5);
      focus(currentLocation, 2.5);
    }
  }, [currentLocation]);

  useEffect(() => {
    if (zoom > 1 && selectedPoint) focus(selectedPoint, zoom);
  }, [selectedZone]);

  useEffect(() => () => clearTimeout(tooltipHideRef.current), []);

  const showPointTooltip = (point) => {
    clearTimeout(tooltipHideRef.current);
    setHoveredPoint(point);
  };
  const hidePointTooltip = () => {
    clearTimeout(tooltipHideRef.current);
    tooltipHideRef.current = setTimeout(() => setHoveredPoint(null), 180);
  };

  const viewWidth = MAP_WIDTH / zoom;
  const viewHeight = MAP_HEIGHT / zoom;
  const viewX = Math.min(Math.max(center.x - viewWidth / 2, 0), MAP_WIDTH - viewWidth);
  const viewY = Math.min(Math.max(center.y - viewHeight / 2, 0), MAP_HEIGHT - viewHeight);
  const referenceYear = new Date(referenceMs).getUTCFullYear();
  const pinnedPoints = useMemo(
    () => pinnedZones.map((zone) => locations.find((point) => point.zone === zone)).filter(Boolean),
    [locations, pinnedZones],
  );
  const civilTimeRepresentatives = useMemo(
    () => getCivilTimeRepresentatives(locations, referenceYear),
    [locations, referenceYear],
  );
  const countryRepresentatives = useMemo(
    () => getCountryRepresentatives(locations),
    [locations],
  );
  const visiblePoints = useMemo(
    () => thinTimezonePoints(
      locations,
      zoom,
      selectedPoint,
      pinnedPoints,
      civilTimeRepresentatives,
      countryRepresentatives,
    ),
    [
      locations,
      zoom,
      selectedPoint,
      pinnedPoints,
      civilTimeRepresentatives,
      countryRepresentatives,
    ],
  );
  const hoveredTime = hoveredPoint ? formatInTimezone(referenceMs, hoveredPoint.zone) : null;
  const tooltipTitle = hoveredPoint ? `${hoveredPoint.city}, ${getLocationCountryName(hoveredPoint)}` : '';
  const tooltipMeta = hoveredTime ? `${hoveredTime.time.slice(0, 5)} · ${hoveredTime.offset}` : '';
  const tooltipWidth = Math.min(460, Math.max(
    280,
    tooltipTitle.length * 10 + 36,
    hoveredPoint ? hoveredPoint.zone.length * 9 + 36 : 0,
    tooltipMeta.length * 8 + 36,
  ));
  const tooltipHalfWidth = tooltipWidth / 2;
  const hoveredPinIndex = hoveredPoint ? allPinnedZones.indexOf(hoveredPoint.zone) : -1;
  const hoveredPinLabel = hoveredPinIndex < 0 ? 'Pin zone' : 'Unpin';

  const startDragging = (event) => {
    if (zoom <= 1) return;
    dragRef.current = {
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
      center,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.currentTarget.classList.add('is-dragging');
  };

  const dragMap = (event) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const nextX = drag.center.x - (event.clientX - drag.clientX) * (viewWidth / bounds.width);
    const nextY = drag.center.y - (event.clientY - drag.clientY) * (viewHeight / bounds.height);
    setCenter({
      x: Math.min(Math.max(nextX, viewWidth / 2), MAP_WIDTH - viewWidth / 2),
      y: Math.min(Math.max(nextY, viewHeight / 2), MAP_HEIGHT - viewHeight / 2),
    });
  };

  const trackCountry = (event) => {
    const land = landRef.current;
    if (!land) return;
    const country = document.elementsFromPoint(event.clientX, event.clientY)
      .find((element) => element.tagName?.toLowerCase() === 'path' && element.parentElement === land);
    if (country === hoveredCountryRef.current) return;
    hoveredCountryRef.current?.classList.remove('is-hovered');
    country?.classList.add('is-hovered');
    hoveredCountryRef.current = country || null;
  };

  const clearHoveredCountry = () => {
    hoveredCountryRef.current?.classList.remove('is-hovered');
    hoveredCountryRef.current = null;
  };

  const stopDragging = (event) => {
    if (!dragRef.current || dragRef.current.pointerId !== event.pointerId) return;
    dragRef.current = null;
    event.currentTarget.classList.remove('is-dragging');
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  return (
    <div className="timezone-map-shell">
      <div className="timezone-map-controls" aria-label="Map controls">
        <button type="button" onClick={() => changeZoom(zoom * 1.5)} disabled={zoom >= 4} aria-label="Zoom in" title="Zoom in">+</button>
        <button type="button" onClick={() => changeZoom(zoom / 1.5)} disabled={zoom <= 1} aria-label="Zoom out" title="Zoom out">−</button>
        <button type="button" className="timezone-map-reset" onClick={() => changeZoom(1)} disabled={zoom === 1}>Reset</button>
        <button
          type="button"
          className="timezone-locate"
          onClick={onLocate}
          disabled={locationStatus === 'locating'}
          title="Uses the browser Geolocation API only after you click"
        >
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <circle cx="10" cy="10" r="3" />
            <path d="M10 1v3M10 16v3M1 10h3M16 10h3" />
          </svg>
          {locationStatus === 'locating' ? 'Locating…' : 'Current location'}
        </button>
      </div>
      <svg
        className="timezone-map"
        viewBox={`${viewX} ${viewY} ${viewWidth} ${viewHeight}`}
        role="img"
        aria-label="Interactive world map with representative IANA timezones"
        onPointerDown={startDragging}
        onPointerMoveCapture={trackCountry}
        onPointerMove={dragMap}
        onPointerUp={stopDragging}
        onPointerCancel={stopDragging}
        onPointerLeave={clearHoveredCountry}
      >
        <defs>
          <linearGradient id="timezone-ocean" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#eaf7ff" />
            <stop offset="100%" stopColor="#dbeafe" />
          </linearGradient>
          <filter id="timezone-shadow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity=".28" />
          </filter>
        </defs>
        <rect width={MAP_WIDTH} height={MAP_HEIGHT} rx="12" fill="url(#timezone-ocean)" />
        {[-60, -30, 0, 30, 60].map((latitude) => (
          <path
            key={latitude}
            d={Array.from({ length: 37 }, (_, index) => -180 + index * 10)
              .map((longitude, index) => `${index ? 'L' : 'M'}${mapX(longitude, latitude)} ${mapY(latitude)}`)
              .join(' ')}
            className="timezone-gridline"
          />
        ))}
        {Array.from({ length: 13 }, (_, index) => -180 + index * 30).map((longitude) => (
          <path
            key={longitude}
            d={Array.from({ length: 35 }, (_, index) => 85 - index * 5)
              .map((latitude, index) => `${index ? 'L' : 'M'}${mapX(longitude, latitude)} ${mapY(latitude)}`)
              .join(' ')}
            className="timezone-gridline"
          />
        ))}
        <g
          ref={landRef}
          className="timezone-land"
          dangerouslySetInnerHTML={WORLD_MAP_MARKUP}
        />
        {visiblePoints.map((point) => {
          const active = point.zone === selectedZone;
          const pinIndex = pinnedZones.indexOf(point.zone);
          const pinColor = pinIndex >= 0 ? PIN_COLORS[pinIndex % PIN_COLORS.length] : null;
          return (
            <g
              key={point.zone}
              className={`timezone-marker ${active ? 'is-active' : ''} ${pinColor ? 'is-pinned' : ''}`}
              transform={`translate(${point.x ?? mapX(point.lon, point.lat)} ${point.y ?? mapY(point.lat)}) scale(${1 / zoom})`}
              style={pinColor ? { '--timezone-pin-color': pinColor } : undefined}
              role="button"
              tabIndex="0"
              aria-label={`${point.city}, ${point.zone}`}
              onClick={() => onSelect(point.zone)}
              onMouseEnter={() => showPointTooltip(point)}
              onMouseLeave={hidePointTooltip}
              onFocus={() => showPointTooltip(point)}
              onBlur={hidePointTooltip}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onSelect(point.zone);
                }
              }}
            >
              {active && <circle className="timezone-marker-pulse" r={pinColor ? 30 : 24} />}
              <circle
                className="timezone-marker-dot"
                r={active ? (pinColor ? 15 : 12) : (pinColor ? 11 : 7)}
              />
            </g>
          );
        })}
        {currentLocation && (
          <g
            className="timezone-current-location"
            transform={`translate(${mapX(currentLocation.lon, currentLocation.lat)} ${mapY(currentLocation.lat)}) scale(${1 / zoom})`}
            pointerEvents="none"
          >
            <circle className="timezone-current-location-ring" r="22" />
            <circle className="timezone-current-location-dot" r="9" />
          </g>
        )}
        {hoveredPoint && hoveredTime && (
          <g
            className="timezone-city-tooltip"
            transform={`translate(${Math.min(Math.max(mapX(hoveredPoint.lon, hoveredPoint.lat), viewX + tooltipHalfWidth / zoom), viewX + viewWidth - tooltipHalfWidth / zoom)} ${Math.max(mapY(hoveredPoint.lat) - 20 / zoom, viewY + 134 / zoom)}) scale(${1 / zoom})`}
            onMouseEnter={() => showPointTooltip(hoveredPoint)}
            onMouseLeave={hidePointTooltip}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <rect x={-tooltipHalfWidth} y="-130" width={tooltipWidth} height="116" rx="9" />
            <text className="timezone-city-tooltip-title" textAnchor="middle" y="-103">
              {tooltipTitle}
            </text>
            <text className="timezone-city-tooltip-zone" textAnchor="middle" y="-81">
              {hoveredPoint.zone}
            </text>
            <text className="timezone-city-tooltip-meta" textAnchor="middle" y="-60">
              {tooltipMeta}
            </text>
            <g
              className={`timezone-tooltip-pin ${hoveredPinIndex >= 0 ? 'is-pinned' : ''}`}
              role="button"
              tabIndex="0"
              aria-label={`${hoveredPinIndex >= 0 ? 'Unpin' : 'Pin'} ${hoveredPoint.zone}`}
              onClick={(event) => {
                event.stopPropagation();
                if (hoveredPinIndex < 0) onPin(hoveredPoint.zone);
                else onUnpin(hoveredPoint.zone);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  event.stopPropagation();
                  if (hoveredPinIndex < 0) onPin(hoveredPoint.zone);
                  else onUnpin(hoveredPoint.zone);
                }
              }}
            >
              <rect x="-48" y="-49" width="96" height="26" rx="6" />
              <text textAnchor="middle" x="0" y="-36" dominantBaseline="central">{hoveredPinLabel}</text>
            </g>
          </g>
        )}
        {[-12, -9, -6, -3, 0, 3, 6, 9, 12].map((offset) => (
          <text
            key={offset}
            x={mapX(offset * 15)}
            y={MAP_HEIGHT - 20}
            textAnchor="middle"
            className="timezone-offset-label"
          >
            {offset === 0 ? 'UTC' : `UTC${offset > 0 ? '+' : ''}${offset}`}
          </text>
        ))}
      </svg>
      <div className="timezone-map-note">
        {visiblePoints.length} visible · {locations.length - visiblePoints.length} more appear as you zoom. Overview prioritizes distinct offset/DST rule groups; selected, pinned, and major cities are always visible.
      </div>
    </div>
  );
};

const TimezoneRules = ({ timeZone, referenceMs }) => {
  const year = Number(new Intl.DateTimeFormat('en', {
    timeZone,
    year: 'numeric',
  }).format(new Date(referenceMs)));
  const rules = useMemo(() => getTimezoneTransitions(timeZone, year), [timeZone, year]);
  const hasTransitions = rules.transitions.length > 0;

  return (
    <section className="timezone-rules" aria-labelledby="timezone-rules-title">
      <div className="timezone-rules-heading">
        <div>
          <strong id="timezone-rules-title">DST / Offset Rules · {year}</strong>
          <span>{timeZone}</span>
        </div>
        <span className={hasTransitions ? 'observes-dst' : 'fixed-offset'}>
          {hasTransitions ? `${rules.transitions.length} transitions` : 'No offset changes'}
        </span>
      </div>
      {hasTransitions ? (
        <div className="timezone-transition-list">
          {rules.transitions.map((transition) => {
            const before = formatInTimezone(transition.at - 60000, timeZone);
            const after = formatInTimezone(transition.at, timeZone);
            const forward = transition.deltaMinutes > 0;
            const pattern = describeTransitionPattern(transition.at - 60000, timeZone);
            return (
              <div key={transition.at} className="timezone-transition">
                <span className={`timezone-transition-direction ${forward ? 'forward' : 'back'}`}>
                  {forward ? '↗ Forward' : '↙ Back'}
                </span>
                <div>
                  <strong>{pattern}</strong>
                  <span>{before.date}</span>
                  <span>{before.time.slice(0, 5)} → {after.time.slice(0, 5)}</span>
                </div>
                <div>
                  <strong>{formatOffset(transition.beforeOffset)} → {formatOffset(transition.afterOffset)}</strong>
                  <span>{transition.deltaMinutes > 0 ? '+' : '−'}{Math.abs(transition.deltaMinutes)} minutes</span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="timezone-no-transitions">
          The UTC offset stays at {formatOffset(rules.startOffset)} throughout {year}.
        </div>
      )}
      <div className="timezone-rules-note">
        Calculated from the browser&apos;s IANA timezone data for this year; historical and future rules may differ.
      </div>
    </section>
  );
};

const DetailRows = ({ info }) => (
  <div className="mt-3 font-mono text-[11px] break-all space-y-1">
    <div><span className="font-bold">ISO UTC:</span> {info.isoUTC}</div>
    <div><span className="font-bold">Selected zone:</span> {info.zoned} <span className="text-gray-500">({info.offset}, {info.abbreviation})</span></div>
    <div><span className="font-bold">Browser local:</span> {info.locale}</div>
    <div><span className="font-bold">Weekday:</span> {info.weekday}</div>
    <div><span className="font-bold">Epoch Seconds:</span> {info.epochSeconds}</div>
    <div><span className="font-bold">Epoch Milliseconds:</span> {info.epochMilliseconds}</div>
    {info.relative && <div><span className="font-bold">Relative:</span> {info.relative}</div>}
  </div>
);

const DateTimeTool = () => {
  const browserZone = useMemo(getBrowserTimezone, []);
  const supportedZones = useMemo(getSupportedTimezones, []);
  const timezoneLocations = useMemo(
    () => TIMEZONE_LOCATIONS.filter(({ zone }) => supportedZones.includes(zone)),
    [supportedZones],
  );
  const countryOptions = useMemo(() => {
    const byCode = new Map();
    timezoneLocations.forEach((point) => {
      getLocationCountryCodes(point).forEach((countryCode) => {
        if (!byCode.has(countryCode)) byCode.set(countryCode, []);
        byCode.get(countryCode).push(point);
      });
    });
    return [...byCode.entries()]
      .map(([code, points]) => ({ code, points, aliases: getRegionAliases(code) }))
      .sort((a, b) => getRegionName(a.code).localeCompare(getRegionName(b.code)));
  }, [timezoneLocations]);
  const initialPins = useMemo(
    () => [...new Set(['UTC', browserZone, 'America/New_York', 'Europe/London', 'Asia/Tokyo'])],
    [browserZone],
  );
  const [tsInput, setTsInput] = useState(() => Math.floor(Date.now() / 1000).toString());
  const [dtInput, setDtInput] = useState(() => new Date().toISOString());
  const [selectedZone, setSelectedZone] = useState(browserZone);
  const [zoneInput, setZoneInput] = useState(browserZone);
  const [pinnedZones, setPinnedZones] = useState(initialPins);
  const activePinnedZones = useMemo(() => pinnedZones.slice(0, VISIBLE_PIN_COUNT), [pinnedZones]);
  const [referenceSource, setReferenceSource] = useState('now');
  const [dstDisambiguation, setDstDisambiguation] = useState('earlier');
  const [dstInfo, setDstInfo] = useState({ status: 'exact', alternatives: [] });
  const [currentLocation, setCurrentLocation] = useState(null);
  const [locationStatus, setLocationStatus] = useState('idle');
  const [locationError, setLocationError] = useState('');
  const [resolvedTsMs, setResolvedTsMs] = useState(null);
  const [resolvedDtMs, setResolvedDtMs] = useState(null);
  const [errorTs, setErrorTs] = useState('');
  const [errorDt, setErrorDt] = useState('');
  const [nowMs, setNowMs] = useState(Date.now());
  const tickRef = useRef(null);

  useEffect(() => {
    tickRef.current = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(tickRef.current);
  }, []);

  useEffect(() => {
    if (!tsInput.trim()) {
      setResolvedTsMs(null);
      setErrorTs('');
      return;
    }
    if (!isNumeric(tsInput)) {
      setErrorTs('Not a number');
      setResolvedTsMs(null);
      return;
    }
    const num = Number(tsInput.trim());
    const ms = Math.abs(num) < 1e12 ? num * 1000 : num;
    if (!Number.isFinite(ms) || Number.isNaN(new Date(ms).getTime())) {
      setErrorTs('Timestamp is outside the supported range');
      setResolvedTsMs(null);
      return;
    }
    setErrorTs('');
    setResolvedTsMs(ms);
  }, [tsInput]);

  useEffect(() => {
    const result = parseDateInTimezone(dtInput, selectedZone, dstDisambiguation);
    setErrorDt(result.error);
    setResolvedDtMs(result.ms);
    setDstInfo({ status: result.dstStatus || 'exact', alternatives: result.alternatives || [] });
  }, [dtInput, selectedZone, dstDisambiguation]);

  const formatDetails = (ms, includeRelative = true) => {
    if (ms === null) return null;
    const date = new Date(ms);
    const zoned = formatInTimezone(ms, selectedZone);
    return {
      isoUTC: date.toISOString(),
      locale: date.toLocaleString(),
      zoned: `${zoned.date}, ${zoned.time}`,
      offset: zoned.offset,
      abbreviation: zoned.abbreviation,
      weekday: new Intl.DateTimeFormat(undefined, { weekday: 'long', timeZone: selectedZone }).format(date),
      epochSeconds: Math.floor(ms / 1000),
      epochMilliseconds: ms,
      relative: includeRelative ? humanRelative(ms, nowMs) : '',
    };
  };

  const tsInfo = formatDetails(resolvedTsMs);
  const dtInfo = formatDetails(resolvedDtMs);
  const nowInfo = formatDetails(nowMs, false);
  const referenceMs = (
    referenceSource === 'timestamp' ? resolvedTsMs
      : referenceSource === 'datetime' ? resolvedDtMs
        : nowMs
  ) ?? nowMs;

  const selectZone = (zone) => {
    if (!supportedZones.includes(zone) && zone !== 'UTC') return;
    setSelectedZone(zone);
    setZoneInput(zone);
  };

  const resolveZoneInput = (input) => {
    if (supportedZones.includes(input) || input === 'UTC') return input;
    const normalized = normalizeSearch(input);
    const match = timezoneLocations.find(({ city, country, comment = '' }) => (
      normalizeSearch(city) === normalized
      || normalizeSearch(`${city}, ${country}`) === normalized
      || getLocationCountryCodes({ country }).some((code) => (
        getRegionAliases(code).some((name) => normalizeSearch(`${city}, ${name}`) === normalized)
      ))
      || normalizeSearch(comment) === normalized
    ));
    if (match) return match.zone;

    const country = countryOptions.find(({ aliases }) => (
      aliases.some((name) => normalizeSearch(name) === normalized)
    ));
    if (!country) return null;
    const preferred = MAJOR_MAP_TIMEZONES.find((point) => (
      locationMatchesCountry(point, country.code) && supportedZones.includes(point.zone)
    ));
    return preferred?.zone || country.points[0]?.zone || null;
  };

  const pinZone = (zone) => {
    setPinnedZones((current) => current.includes(zone) ? current : [...current, zone].slice(0, MAX_PINNED_ZONES));
  };
  const unpinZone = (zone) => {
    setPinnedZones((current) => current.filter((item) => item !== zone));
  };
  const addPinnedZone = () => {
    const zone = resolveZoneInput(zoneInput);
    if (!zone) return;
    selectZone(zone);
    pinZone(zone);
  };

  const locateCurrentPosition = () => {
    if (!navigator.geolocation) {
      setLocationStatus('error');
      setLocationError('Geolocation is not available in this browser.');
      return;
    }
    setLocationStatus('locating');
    setLocationError('');
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setCurrentLocation({ lat: coords.latitude, lon: coords.longitude });
        selectZone(browserZone);
        setLocationStatus('located');
      },
      (error) => {
        setLocationStatus('error');
        setLocationError(error.message || 'Location permission was denied.');
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    );
  };

  const encodeState = useMemo(
    () => (value) => JSON.stringify({
      t: value.tsInput,
      d: value.dtInput,
      z: value.selectedZone,
      p: value.pinnedZones,
      r: value.referenceSource,
      a: value.dstDisambiguation,
    }),
    [],
  );
  const decodeState = useMemo(() => (str) => {
    try {
      const obj = JSON.parse(str);
      if (obj && (obj.t !== undefined || obj.d !== undefined || obj.z !== undefined)) {
        return {
          tsInput: obj.t,
          dtInput: obj.d,
          selectedZone: obj.z,
          pinnedZones: obj.p,
          referenceSource: obj.r,
          dstDisambiguation: obj.a,
        };
      }
    } catch {}
    return undefined;
  }, []);
  const handleDecoded = (value) => {
    if (value.tsInput !== undefined) setTsInput(value.tsInput);
    if (value.dtInput !== undefined) setDtInput(value.dtInput);
    if (supportedZones.includes(value.selectedZone) || value.selectedZone === 'UTC') selectZone(value.selectedZone);
    if (Array.isArray(value.pinnedZones)) {
      setPinnedZones(value.pinnedZones
        .filter((zone) => supportedZones.includes(zone) || zone === 'UTC')
        .slice(0, MAX_PINNED_ZONES));
    }
    if (['now', 'timestamp', 'datetime'].includes(value.referenceSource)) setReferenceSource(value.referenceSource);
    if (['earlier', 'later'].includes(value.dstDisambiguation)) setDstDisambiguation(value.dstDisambiguation);
  };
  const syncValue = useMemo(
    () => ({ tsInput, dtInput, selectedZone, pinnedZones, referenceSource, dstDisambiguation }),
    [tsInput, dtInput, selectedZone, pinnedZones, referenceSource, dstDisambiguation],
  );

  return (
    <div className="tool-container">
      <Base64QuerySync
        value={syncValue}
        encode={encodeState}
        decode={decodeState}
        onDecoded={handleDecoded}
        queryParam="time"
        toolHash="#datetime"
      />
      <div className="tool-content">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="tool-title">Date / Time</h2>
            <p className="text-xs text-gray-600 dark:text-gray-400">Convert instants, explore IANA timezones, and compare local wall-clock time.</p>
          </div>
          <div className="timezone-selected-pill" title="The timezone used for wall-clock parsing and formatted output">
            <span className="timezone-selected-dot" />
            {selectedZone}
          </div>
        </div>

        <div className="grid-2col">
          <div className="card">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-gray-500 dark:text-gray-400">Timestamp → Date</span>
            </div>
            <UndoableInput
              value={tsInput}
              onChange={(event) => setTsInput(event.target.value)}
              placeholder="Enter Unix timestamp (seconds or ms)"
              className="w-full text-sm font-mono px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 focus:outline-hidden focus:ring-2 focus:ring-jwtBlue"
              spellCheck="false"
            />
            {errorTs && <div className="mt-2 text-xs text-red-600 font-mono">{errorTs}</div>}
            {tsInfo && !errorTs && <DetailRows info={tsInfo} />}
          </div>

          <div className="card">
            <div className="flex flex-wrap items-center justify-between gap-1 mb-2">
              <span className="text-xs font-bold text-gray-500 dark:text-gray-400">Date → Unix Timestamp</span>
              <span className="text-[10px] text-gray-500 font-mono">No offset → {selectedZone}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <UndoableInput
                value={dtInput}
                onChange={(event) => setDtInput(event.target.value)}
                placeholder="ISO, RFC 2822, or YYYY-MM-DD HH:mm"
                className="min-w-0 flex-1 text-sm font-mono px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 focus:outline-hidden focus:ring-2 focus:ring-jwtPurple"
                spellCheck="false"
              />
              <UndoableInput
                type="datetime-local"
                value={toDatetimeLocalInZone(resolvedDtMs, selectedZone)}
                onChange={(event) => setDtInput(event.target.value)}
                className="text-sm px-2 py-2 rounded border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 focus:outline-hidden focus:ring-2 focus:ring-jwtPurple"
                aria-label={`Date and time in ${selectedZone}`}
              />
            </div>
            {errorDt && <div className="mt-2 text-xs text-red-600 font-mono">{errorDt}</div>}
            {dstInfo.status === 'overlap' && (
              <div className="dst-overlap" role="status">
                <div>
                  <strong>Ambiguous wall-clock time</strong>
                  <span>The clock repeats this time. Choose which occurrence you mean.</span>
                </div>
                <div className="dst-overlap-options">
                  {dstInfo.alternatives.map((instant, index) => {
                    const occurrence = index === 0 ? 'earlier' : 'later';
                    const value = formatInTimezone(instant, selectedZone);
                    return (
                      <button
                        key={instant}
                        type="button"
                        className={dstDisambiguation === occurrence ? 'is-active' : ''}
                        onClick={() => setDstDisambiguation(occurrence)}
                      >
                        {index === 0 ? 'Earlier' : 'Later'} · {value.offset}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            {dtInfo && !errorDt && <DetailRows info={dtInfo} />}
          </div>
        </div>

        <section className="card timezone-explorer" aria-labelledby="timezone-explorer-title">
          <div className="timezone-explorer-header">
            <div>
              <div id="timezone-explorer-title" className="text-sm font-bold">Timezone Explorer</div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Compare the same instant across the world. Offsets automatically include DST.
              </div>
            </div>
            <div className="timezone-reference" aria-label="Map reference instant">
              {[
                ['now', 'Now'],
                ['timestamp', 'Timestamp'],
                ['datetime', 'Date input'],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className={referenceSource === value ? 'is-active' : ''}
                  disabled={(value === 'timestamp' && resolvedTsMs === null) || (value === 'datetime' && resolvedDtMs === null)}
                  onClick={() => setReferenceSource(value)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="timezone-picker-row">
            <label className="timezone-zone-picker">
              <span>Find a city, country or IANA timezone</span>
              <div className="flex gap-2">
                <UndoableInput
                  type="text"
                  list="timezone-options"
                  value={zoneInput}
                  onChange={(event) => {
                    const value = event.target.value;
                    setZoneInput(value);
                    const zone = resolveZoneInput(value);
                    if (zone) setSelectedZone(zone);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      addPinnedZone();
                    }
                  }}
                  placeholder="Berlin, Germany or Europe/Berlin"
                  className="min-w-0 flex-1 text-sm font-mono px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 focus:outline-hidden focus:ring-2 focus:ring-jwtBlue"
                />
                <button type="button" className="btn-secondary whitespace-nowrap" onClick={addPinnedZone}>Pin zone</button>
              </div>
            </label>
            <datalist id="timezone-options">
              {supportedZones.map((zone) => {
                const location = timezoneLocations.find((point) => point.zone === zone);
                return <option key={zone} value={zone} label={location ? `${location.city}, ${location.country}` : zone} />;
              })}
              {timezoneLocations.map((point) => (
                <option key={`${point.zone}:city`} value={`${point.city}, ${getLocationCountryName(point)}`} label={point.zone} />
              ))}
              {countryOptions.flatMap(({ code, points, aliases }) => aliases
                .filter((name) => name !== code)
                .map((name) => (
                  <option key={`${code}:country:${name}`} value={name} label={`${points.length} IANA location${points.length === 1 ? '' : 's'}`} />
                )))}
            </datalist>
            <div className="timezone-primary-clock" aria-live="polite">
              <div>
                <strong>{formatInTimezone(referenceMs, selectedZone).time}</strong>
                <span>{formatInTimezone(referenceMs, selectedZone).date}</span>
              </div>
              <div>
                <strong>{formatInTimezone(referenceMs, selectedZone).offset}</strong>
                <span>{formatInTimezone(referenceMs, selectedZone).abbreviation}</span>
              </div>
            </div>
          </div>

          <TimezoneMap
            selectedZone={selectedZone}
            referenceMs={referenceMs}
            onSelect={selectZone}
            currentLocation={currentLocation}
            locationStatus={locationStatus}
            onLocate={locateCurrentPosition}
            locations={timezoneLocations}
            pinnedZones={activePinnedZones}
            allPinnedZones={pinnedZones}
            onPin={pinZone}
            onUnpin={unpinZone}
          />
          {locationError && <div className="timezone-location-error" role="alert">{locationError}</div>}
          {locationStatus === 'located' && (
            <div className="timezone-location-note">
              Position comes from your device; timezone comes from the browser setting ({browserZone}).
            </div>
          )}
          <TimezoneRules timeZone={selectedZone} referenceMs={referenceMs} />

          <div className="timezone-clocks" aria-label="Pinned timezone comparison">
            {activePinnedZones.map((zone, pinIndex) => {
              const value = formatInTimezone(referenceMs, zone);
              const active = zone === selectedZone;
              const pinColor = PIN_COLORS[pinIndex % PIN_COLORS.length];
              return (
                <button
                  key={zone}
                  type="button"
                  className={`timezone-clock ${active ? 'is-active' : ''}`}
                  style={{ '--timezone-pin-color': pinColor }}
                  onClick={() => selectZone(zone)}
                >
                  <span className="timezone-clock-color" aria-hidden="true" />
                  <span className="timezone-clock-main">
                    <strong>{value.time.slice(0, 5)}</strong>
                    <span>{zone.replaceAll('_', ' ')}</span>
                  </span>
                  <span className="timezone-clock-meta">
                    <span>{value.offset}</span>
                    <span
                      role="button"
                      tabIndex="0"
                      aria-label={`Remove ${zone}`}
                      title={`Remove ${zone}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        unpinZone(zone);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          event.stopPropagation();
                          unpinZone(zone);
                        }
                      }}
                    >
                      ×
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
          {pinnedZones.length > VISIBLE_PIN_COUNT && (
            <div className="timezone-pin-queue">
              {pinnedZones.length - VISIBLE_PIN_COUNT} more pinned zone{pinnedZones.length - VISIBLE_PIN_COUNT === 1 ? '' : 's'} queued · remove a clock to promote the next one
            </div>
          )}
        </section>

        <div className="card">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <div className="text-xs font-bold text-gray-500 dark:text-gray-400">Current Time</div>
            <div className="text-[10px] text-gray-500 font-mono">{selectedZone}</div>
          </div>
          <DetailRows info={nowInfo} />
        </div>

        <div className="text-[10px] text-gray-500 dark:text-gray-400 font-mono">
          IANA timezone conversion is provided by Intl in your browser. Explicit ISO offsets always identify an instant; offset-free wall-clock input uses the selected zone.
        </div>
      </div>
    </div>
  );
};

export default DateTimeTool;
