const fs = require('fs');
const path = require('path');

const candidates = [
  process.argv[2],
  '/usr/share/zoneinfo/zone1970.tab',
  '/usr/share/zoneinfo/zone.tab',
].filter(Boolean);
const source = candidates.find((candidate) => fs.existsSync(candidate));

if (!source) {
  throw new Error('Could not find zone1970.tab or zone.tab. Pass its path as the first argument.');
}

const parseCoordinate = (part, degreeDigits) => {
  const sign = part[0] === '-' ? -1 : 1;
  const digits = part.slice(1);
  const degrees = Number(digits.slice(0, degreeDigits));
  const minutes = Number(digits.slice(degreeDigits, degreeDigits + 2));
  const seconds = digits.length > degreeDigits + 2 ? Number(digits.slice(degreeDigits + 2)) : 0;
  return sign * (degrees + minutes / 60 + seconds / 3600);
};

const parseCoordinates = (value) => {
  const splitAt = Math.max(value.indexOf('+', 1), value.indexOf('-', 1));
  return {
    lat: parseCoordinate(value.slice(0, splitAt), 2),
    lon: parseCoordinate(value.slice(splitAt), 3),
  };
};

const locations = fs.readFileSync(source, 'utf8')
  .split(/\r?\n/)
  .filter((line) => line && !line.startsWith('#'))
  .map((line) => {
    const [country, coordinates, zone, comment = ''] = line.split('\t');
    const point = parseCoordinates(coordinates);
    return {
      zone,
      city: zone.split('/').at(-1).replaceAll('_', ' '),
      country,
      lat: Number(point.lat.toFixed(5)),
      lon: Number(point.lon.toFixed(5)),
      ...(comment ? { comment } : {}),
    };
  })
  .sort((a, b) => a.zone.localeCompare(b.zone));

const output = `// Generated from the public-domain IANA tzdb zone table.\n`
  + `// Run: bun scripts/generateTimezoneLocations.js [path/to/zone1970.tab]\n`
  + `export const TIMEZONE_LOCATIONS = ${JSON.stringify(locations, null, 2)};\n`;

const destination = path.resolve(__dirname, '../src/timezoneLocations.js');
fs.writeFileSync(destination, output);
console.log(`Generated ${path.relative(process.cwd(), destination)} with ${locations.length} locations from ${source}`);

