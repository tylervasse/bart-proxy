import express from 'express';
import { config } from './src/config/config.js';
import { staticDataService } from './src/services/StaticDataService.js';
import { gtfsMonitor } from './src/services/GtfsMonitor.js';
import { transitService } from './src/services/TransitService.js';
import { gtfsUpdater } from './src/services/GtfsUpdater.js';

// Initialize Express app
const app = express();
app.use(express.json());

// ---- EASY STATION SWITCHING ----
// Change ONLY these values when you want a different default station display.
const DEFAULT_STATION = {
  key: '16thstreetmission',
  direction: null // use null to show trains from both platforms
};

// Simple station presets.
// Add more here whenever you want.
const STATION_PRESETS = {
  '12thstreetoaklandcitycenter': {
    stationId: '12TH',
    stopIds: ['L10-1', 'L10-2'],
    displayName: '12th St. Oakland City Center'
  },
  '16thstreetmission': {
    stationId: '16TH',
    stopIds: ['M50-1', 'M50-2'],
    displayName: '16th St. Mission'
  },
  '19thstreetoakland': {
    stationId: '19TH',
    stopIds: ['L20-1', 'L20-2'],
    displayName: '19th St. Oakland'
  },
  '24thstreetmission': {
    stationId: '24TH',
    stopIds: ['M60-1', 'M60-2'],
    displayName: '24th St. Mission'
  },
  antioch: {
    stationId: 'ANTC',
    stopIds: ['E30-1', 'E30-2'],
    displayName: 'Antioch'
  },
  ashby: {
    stationId: 'ASHB',
    stopIds: ['R30-1', 'R30-2'],
    displayName: 'Ashby'
  },
  balboapark: {
    stationId: 'BALB',
    stopIds: ['M70-1', 'M70-2'],
    displayName: 'Balboa Park'
  },
  bayfair: {
    stationId: 'BAYF',
    stopIds: ['B20-1', 'B20-2'],
    displayName: 'Bay Fair'
  },
  berryessanorthsanjose: {
    stationId: 'BERY',
    stopIds: ['S50-1', 'S50-2'],
    displayName: 'Berryessa / North San Jose'
  },
  castlovalley: {
    stationId: 'CAST',
    stopIds: ['D20-1', 'D20-2'],
    displayName: 'Castro Valley'
  },
  civiccenteunplaza: {
    stationId: 'CIVC',
    stopIds: ['M40-1', 'M40-2'],
    displayName: 'Civic Center / UN Plaza'
  },
  civiccenter: {
    stationId: 'CIVC',
    stopIds: ['M40-1', 'M40-2'],
    displayName: 'Civic Center / UN Plaza'
  },
  coliseum: {
    stationId: 'COLS',
    stopIds: ['B10-1', 'B10-2'],
    displayName: 'Coliseum'
  },
  colma: {
    stationId: 'COLM',
    stopIds: ['Y30-1', 'Y30-2'],
    displayName: 'Colma'
  },
  concord: {
    stationId: 'CONC',
    stopIds: ['E10-1', 'E10-2'],
    displayName: 'Concord'
  },
  dalycity: {
    stationId: 'DALY',
    stopIds: ['M90-1', 'M90-2', 'M90-3'],
    displayName: 'Daly City'
  },
  downtownberkeley: {
    stationId: 'DBRK',
    stopIds: ['R20-1', 'R20-2'],
    displayName: 'Downtown Berkeley'
  },
  dublinpleasanton: {
    stationId: 'DUBL',
    stopIds: ['D10-1', 'D10-2'],
    displayName: 'Dublin / Pleasanton'
  },
  elcerritodelnorte: {
    stationId: 'DELN',
    stopIds: ['R50-1', 'R50-2'],
    displayName: 'El Cerrito del Norte'
  },
  elcerritoplaza: {
    stationId: 'PLZA',
    stopIds: ['R40-1', 'R40-2'],
    displayName: 'El Cerrito Plaza'
  },
  embarcadero: {
    stationId: 'EMBR',
    stopIds: ['M16-1', 'M16-2'],
    displayName: 'Embarcadero'
  },
  fremont: {
    stationId: 'FRMT',
    stopIds: ['A10-1', 'A10-2'],
    displayName: 'Fremont'
  },
  fruitvale: {
    stationId: 'FTVL',
    stopIds: ['B30-1', 'B30-2'],
    displayName: 'Fruitvale'
  },
  glenpark: {
    stationId: 'GLEN',
    stopIds: ['M80-1', 'M80-2'],
    displayName: 'Glen Park'
  },
  hayward: {
    stationId: 'HAYW',
    stopIds: ['A20-1', 'A20-2'],
    displayName: 'Hayward'
  },
  lafayette: {
    stationId: 'LAFY',
    stopIds: ['C20-1', 'C20-2'],
    displayName: 'Lafayette'
  },
  lakemerritt: {
    stationId: 'LAKE',
    stopIds: ['L30-1', 'L30-2'],
    displayName: 'Lake Merritt'
  },
  macarthur: {
    stationId: 'MCAR',
    stopIds: ['L40-1', 'L40-2'],
    displayName: 'MacArthur'
  },
  millbrae: {
    stationId: 'MLBR',
    stopIds: ['Y20-1', 'Y20-2'],
    displayName: 'Millbrae'
  },
  milpitas: {
    stationId: 'MLPT',
    stopIds: ['S20-1', 'S20-2'],
    displayName: 'Milpitas'
  },
  montgomerystreet: {
    stationId: 'MONT',
    stopIds: ['M20-1', 'M20-2'],
    displayName: 'Montgomery St.'
  },
  montgomery: {
    stationId: 'MONT',
    stopIds: ['M20-1', 'M20-2'],
    displayName: 'Montgomery St.'
  },
  northberkeley: {
    stationId: 'NBRK',
    stopIds: ['R10-1', 'R10-2'],
    displayName: 'North Berkeley'
  },
  northconcordmartinez: {
    stationId: 'NCON',
    stopIds: ['E20-1', 'E20-2'],
    displayName: 'North Concord / Martinez'
  },
  oaklandinternationalairport: {
    stationId: 'OAKL',
    stopIds: ['G10-1', 'G10-2'],
    displayName: 'Oakland International Airport'
  },
  orinda: {
    stationId: 'ORIN',
    stopIds: ['C10-1', 'C10-2'],
    displayName: 'Orinda'
  },
  pittsburgbaypoint: {
    stationId: 'PITT',
    stopIds: ['E40-1', 'E40-2'],
    displayName: 'Pittsburg / Bay Point'
  },
  pittsburgcenter: {
    stationId: 'PCTR',
    stopIds: ['E35-1', 'E35-2'],
    displayName: 'Pittsburg Center'
  },
  pleasanthillcontracosta: {
    stationId: 'PHIL',
    stopIds: ['C30-1', 'C30-2'],
    displayName: 'Pleasant Hill / Contra Costa Centre'
  },
  powellstreet: {
    stationId: 'POWL',
    stopIds: ['M30-1', 'M30-2'],
    displayName: 'Powell St.'
  },
  powell: {
    stationId: 'POWL',
    stopIds: ['M30-1', 'M30-2'],
    displayName: 'Powell St.'
  },
  richmond: {
    stationId: 'RICH',
    stopIds: ['R60-1', 'R60-2'],
    displayName: 'Richmond'
  },
  rockridge: {
    stationId: 'ROCK',
    stopIds: ['C40-1', 'C40-2'],
    displayName: 'Rockridge'
  },
  sanbruno: {
    stationId: 'SBRN',
    stopIds: ['Y40-1', 'Y40-2'],
    displayName: 'San Bruno'
  },
  sanfranciscointernationalairport: {
    stationId: 'SFIA',
    stopIds: ['Y10-1', 'Y10-2', 'Y10-3'],
    displayName: 'San Francisco International Airport'
  },
  sfo: {
    stationId: 'SFIA',
    stopIds: ['Y10-1', 'Y10-2', 'Y10-3'],
    displayName: 'SFO'
  },
  sanleandro: {
    stationId: 'SANL',
    stopIds: ['B40-1', 'B40-2'],
    displayName: 'San Leandro'
  },
  southhayward: {
    stationId: 'SHAY',
    stopIds: ['A30-1', 'A30-2'],
    displayName: 'South Hayward'
  },
  southsanfrancisco: {
    stationId: 'SSAN',
    stopIds: ['Y50-1', 'Y50-2'],
    displayName: 'South San Francisco'
  },
  unioncity: {
    stationId: 'UCTY',
    stopIds: ['A40-1', 'A40-2'],
    displayName: 'Union City'
  },
  walnutcreek: {
    stationId: 'WCRK',
    stopIds: ['C50-1', 'C50-2'],
    displayName: 'Walnut Creek'
  },
  warmspringssouthfremont: {
    stationId: 'WARM',
    stopIds: ['A50-1', 'A50-2'],
    displayName: 'Warm Springs / South Fremont'
  },
  westdublinpleasanton: {
    stationId: 'WDUB',
    stopIds: ['D30-1', 'D30-2'],
    displayName: 'West Dublin / Pleasanton'
  },
  westoakland: {
    stationId: 'WOAK',
    stopIds: ['L50-1', 'L50-2'],
    displayName: 'West Oakland'
  }
};

function normalizeStationKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/\bst[.]?\b/g, 'street')
    .replace(/[^a-z0-9]/g, '');
}

function resolveStationInput(input) {
  if (!input) {
    return STATION_PRESETS[DEFAULT_STATION.key] || {
      stationId: config.station.id,
      stopIds: [config.station.id],
      displayName: config.station.name || config.station.id
    };
  }

  const normalized = normalizeStationKey(input);

  if (STATION_PRESETS[normalized]) {
    return STATION_PRESETS[normalized];
  }

  // Match stationId directly
  const presetByStationId = Object.values(STATION_PRESETS).find(
    s => String(s.stationId).toUpperCase() === String(input).toUpperCase()
  );
  if (presetByStationId) {
    return presetByStationId;
  }

  // Match any platform stopId directly
  const presetByStopId = Object.values(STATION_PRESETS).find(
    s => Array.isArray(s.stopIds) && s.stopIds.some(id => id.toUpperCase() === String(input).toUpperCase())
  );
  if (presetByStopId) {
    return presetByStopId;
  }

  // Match legacy station name map
  const legacyCode = STATION_NAME_TO_LEGACY_CODE[String(input).trim().toLowerCase()];
  if (legacyCode) {
    const presetByLegacy = Object.values(STATION_PRESETS).find(
      s => s.stationId === legacyCode
    );
    if (presetByLegacy) return presetByLegacy;

    return {
      stationId: legacyCode,
      stopIds: [legacyCode],
      displayName: input
    };
  }

  // Fallback raw stop ID
  return {
    stationId: String(input).toUpperCase(),
    stopIds: [String(input).toUpperCase()],
    displayName: input
  };
}

async function getCombinedStopInfo(selectedStation, direction) {
  const stopIds = selectedStation.stopIds || [selectedStation.stationId];
  const results = await Promise.all(
    stopIds.map(stopId => transitService.getStopInfo(stopId, direction))
  );

  const baseStop = results[0]?.stop || {
    id: selectedStation.stationId,
    name: selectedStation.displayName,
    platform: ''
  };

  const allTrips = results
    .flatMap(r => Array.isArray(r.upcomingTrips) ? r.upcomingTrips : [])
    .sort((a, b) => a.minutesUntilArrival - b.minutesUntilArrival);

  const allAlerts = results.flatMap(r => Array.isArray(r.alerts) ? r.alerts : []);
  const allWarnings = results.flatMap(r => Array.isArray(r.warnings) ? r.warnings : []);

  const lastUpdated = results
    .map(r => r.lastUpdated)
    .filter(Boolean)
    .sort()
    .slice(-1)[0] || null;

  return {
    stop: {
      ...baseStop,
      id: selectedStation.stationId,
      name: selectedStation.displayName,
      platform: stopIds.join(', ')
    },
    upcomingTrips: allTrips,
    alerts: allAlerts,
    warnings: allWarnings,
    lastUpdated
  };
}

// ---- BART Legacy API Car Count Cache ----
// Set this in PowerShell before running:
//   $env:BART_API_KEY="your-key-here"
// Then start the server normally.
const BART_API_KEY = "ZLAD-56EA-9N6T-DWEI" || '';
const CAR_COUNT_POLL_MS = 30000;
const FETCH_TIMEOUT_MS = 10000;

let carCountCache = {}; // { [legacyStationCode]: { [normalizedDestination]: [{ minutes, cars, rawMinutes }] } }
let carCountLastUpdated = null;
let carCountLastError = null;
let carCountInterval = null;
let isFetchingCarCounts = false;

const STATION_NAME_TO_LEGACY_CODE = {
  '12th st. oakland city center': '12TH',
  '12th street oakland city center': '12TH',
  '16th st. mission': '16TH',
  '16th street mission': '16TH',
  '19th st. oakland': '19TH',
  '19th street oakland': '19TH',
  '24th st. mission': '24TH',
  '24th street mission': '24TH',
  'antioch': 'ANTC',
  'ashby': 'ASHB',
  'balboa park': 'BALB',
  'bay fair': 'BAYF',
  'berryessa/north san jose': 'BERY',
  'castro valley': 'CAST',
  'civic center/un plaza': 'CIVC',
  'civic center / un plaza': 'CIVC',
  'coliseum': 'COLS',
  'colma': 'COLM',
  'concord': 'CONC',
  'daly city': 'DALY',
  'downtown berkeley': 'DBRK',
  'dublin/pleasanton': 'DUBL',
  'el cerrito del norte': 'DELN',
  'el cerrito plaza': 'PLZA',
  'embarcadero': 'EMBR',
  'fremont': 'FRMT',
  'fruitvale': 'FTVL',
  'glen park': 'GLEN',
  'hayward': 'HAYW',
  'lafayette': 'LAFY',
  'lake merritt': 'LAKE',
  'macarthur': 'MCAR',
  'millbrae': 'MLBR',
  'milpitas': 'MLPT',
  'montgomery st.': 'MONT',
  'montgomery street': 'MONT',
  'north berkeley': 'NBRK',
  'north concord/martinez': 'NCON',
  'oakland international airport': 'OAKL',
  'orinda': 'ORIN',
  'pittsburg/bay point': 'PITT',
  'pittsburg center': 'PCTR',
  'pleasant hill/contra costa centre': 'PHIL',
  'powell st.': 'POWL',
  'powell street': 'POWL',
  'richmond': 'RICH',
  'rockridge': 'ROCK',
  'san bruno': 'SBRN',
  'san francisco international airport': 'SFO',
  'sf international airport': 'SFO',
  'sfo': 'SFO',
  'san leandro': 'SANL',
  'south hayward': 'SHAY',
  'south san francisco': 'SSAN',
  'union city': 'UCTY',
  'walnut creek': 'WCRK',
  'warm springs/south fremont': 'WARM',
  'west dublin/pleasanton': 'WDUB',
  'west oakland': 'WOAK'
};



const DESTINATION_ALIASES = {
  antioch: 'antioch',
  richmond: 'richmond',
  berryessanorthsanjose: 'berryessanorthsanjose',
  northsanjoseberryessa: 'berryessanorthsanjose',
  dublinpleasanton: 'dublinpleasanton',
  millbrae: 'millbrae',
  dalycity: 'dalycity',
  warmspringssouthfremont: 'warmspringssouthfremont',
  southfremontwarmsprings: 'warmspringssouthfremont',
  fremont: 'fremont',
  pittsburghbaypoint: 'pittsburgbaypoint',
  pittsburgbaypoint: 'pittsburgbaypoint',
  sfiaairport: 'sanfranciscointlairport',
  sfoairport: 'sanfranciscointlairport',
  sanfranciscointlairport: 'sanfranciscointlairport',
  specialevent: 'specialevent',
  oaklandairport: 'oaklandairport',
  oaklinternationalairport: 'oaklandairport'
};

function normalizeText(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/\bst[.]?\b/g, 'street')
    .replace(/\bintl[.]?\b/g, 'international')
    .replace(/\bsf international airport\b/g, 'san francisco international airport')
    .replace(/\bsfo\b/g, 'san francisco international airport')
    .replace(/[^a-z0-9]/g, '');
}

function normalizeDestination(value) {
  const normalized = normalizeText(value);
  return DESTINATION_ALIASES[normalized] || normalized;
}

function extractDestinationFromHeadsign(headsign) {
  if (!headsign) return 'Unknown';
  const parts = String(headsign).split(' / ');
  return parts.length > 1 ? parts[parts.length - 1] : headsign;
}

function parseMinutesValue(value) {
  if (value === null || value === undefined) return null;

  const text = String(value).trim().toLowerCase();
  if (!text) return null;

  if (text === 'leaving' || text === 'arriving') {
    return 0;
  }

  const num = parseInt(text, 10);
  return Number.isFinite(num) ? num : null;
}

function resolveLegacyStationCode(stopId) {
  const stop = staticDataService.getStop(stopId);
  const candidates = [
    stop?.stop_name,
    stop?.name,
    stop?.station_name,
    config.station?.name
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;
    const normalizedName = String(candidate).trim().toLowerCase();

    if (STATION_NAME_TO_LEGACY_CODE[normalizedName]) {
      return STATION_NAME_TO_LEGACY_CODE[normalizedName];
    }
  }

  if (stop?.stop_code && /^[A-Z0-9]{3,4}$/.test(stop.stop_code)) {
    return stop.stop_code.toUpperCase();
  }

  // Hard fallback for your current Montgomery setup
  console.warn('[CAR DEBUG] Falling back to MONT for stopId:', stopId);
  return 'MONT';
}

async function fetchJsonWithTimeout(url, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'bart-proxy/1.0.0' },
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchCarCountsForStation(legacyStationCode) {
  const url =
    `https://api.bart.gov/api/etd.aspx?cmd=etd&orig=${encodeURIComponent(legacyStationCode)}&key=${encodeURIComponent(BART_API_KEY)}&json=y`;

  const data = await fetchJsonWithTimeout(url, FETCH_TIMEOUT_MS);
  const etdList = data?.root?.station?.[0]?.etd;

  if (!Array.isArray(etdList)) {
    throw new Error('Unexpected legacy API response shape');
  }

  const stationCache = {};

  for (const etd of etdList) {
    const destination = etd?.destination;
    const estimates = Array.isArray(etd?.estimate) ? etd.estimate : [];

    if (!destination || estimates.length === 0) continue;

    const destinationKey = normalizeDestination(destination);
    const parsedEstimates = [];

    for (const estimate of estimates) {
      const cars = parseInt(estimate?.length, 10);
      const minutes = parseMinutesValue(estimate?.minutes);

      if (!Number.isFinite(cars) || cars <= 0) continue;

      parsedEstimates.push({
        minutes,
        cars,
        rawMinutes: estimate?.minutes ?? null
      });
    }

    if (parsedEstimates.length === 0) continue;

    parsedEstimates.sort((a, b) => {
      const aMinutes = a.minutes ?? Number.MAX_SAFE_INTEGER;
      const bMinutes = b.minutes ?? Number.MAX_SAFE_INTEGER;
      return aMinutes - bMinutes;
    });

    stationCache[destinationKey] = parsedEstimates;

    console.log(
      '[CAR DEBUG] fetched destination',
      destination,
      'normalized as',
      destinationKey,
      'estimates =',
      parsedEstimates
    );
  }

  return stationCache;
}

async function refreshAllConfiguredCarCounts() {
  if (!BART_API_KEY) {
    return;
  }

  if (isFetchingCarCounts) {
    return;
  }

  isFetchingCarCounts = true;

  try {
    const stationCodes = new Set();

    const defaultStation = resolveStationInput(DEFAULT_STATION.key);
    const configuredCode = resolveLegacyStationCode(defaultStation.stationId);
    console.log('[CAR DEBUG] DEFAULT_STATION.key =', DEFAULT_STATION.key);
    console.log('[CAR DEBUG] resolved default stationId =', defaultStation.stationId);
    console.log('[CAR DEBUG] resolved legacy station code =', configuredCode);

    if (configuredCode) {
      stationCodes.add(configuredCode);
    } else {
      console.warn('[CAR DEBUG] Could not resolve a BART legacy station code');
    }

    const newCache = { ...carCountCache };

    for (const legacyStationCode of stationCodes) {
      newCache[legacyStationCode] = await fetchCarCountsForStation(legacyStationCode);
    }

    carCountCache = newCache;
    console.log('[CAR DEBUG] carCountCache =', JSON.stringify(carCountCache, null, 2));
    carCountLastUpdated = new Date();
    carCountLastError = null;

    const totalDestinations = Object.values(carCountCache)
      .reduce((sum, stationMap) => sum + Object.keys(stationMap || {}).length, 0);

    console.log(`Car counts updated: ${totalDestinations} destination groups`);
  } catch (error) {
    carCountLastError = error.message;
    console.warn(`Failed to fetch BART car counts: ${error.message}`);
  } finally {
    isFetchingCarCounts = false;
  }
}

function getCarCount(stopId, destination, minutesUntilArrival) {
  const legacyStationCode = resolveLegacyStationCode(stopId);
  console.log('[CAR DEBUG] getCarCount stopId =', stopId, 'resolved legacyStationCode =', legacyStationCode);

  if (!legacyStationCode) return null;

  const stationCache = carCountCache[legacyStationCode];
  console.log('[CAR DEBUG] stationCache keys =', stationCache ? Object.keys(stationCache) : null);

  if (!stationCache) return null;

  const destinationKey = normalizeDestination(destination);
  const estimates = stationCache[destinationKey];

  console.log(
    '[CAR DEBUG] destination =', destination,
    'normalized =', destinationKey,
    'minutesUntilArrival =', minutesUntilArrival,
    'matched estimates =', estimates
  );

  if (!Array.isArray(estimates) || estimates.length === 0) {
    return null;
  }

  const targetMinutes = Number.isFinite(minutesUntilArrival)
    ? minutesUntilArrival
    : parseMinutesValue(minutesUntilArrival);

  if (targetMinutes === null) {
    return estimates[0]?.cars ?? null;
  }

  const exact = estimates.find(entry => entry.minutes === targetMinutes);
  if (exact) {
    console.log('[CAR DEBUG] exact match found =', exact);
    return exact.cars;
  }

  let best = estimates[0];
  let bestDelta = Math.abs((best.minutes ?? Number.MAX_SAFE_INTEGER) - targetMinutes);

  for (const entry of estimates.slice(1)) {
    const delta = Math.abs((entry.minutes ?? Number.MAX_SAFE_INTEGER) - targetMinutes);
    if (delta < bestDelta) {
      best = entry;
      bestDelta = delta;
    }
  }

  console.log('[CAR DEBUG] closest match =', best);
  return best?.cars ?? null;
}

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    service: 'BART GTFS Real-time API',
    endpoints: {
      '/station': 'Get real-time information for the configured station',
      '/station/:stopId': 'Get real-time information for any station by stop ID',
      '/next': 'Get next arrivals in simplified format (destination, minutes, vehicle, cars)',
      '/stops': 'List all available stops',
      '/health': 'Health check endpoint',
      '/status': 'Internal status of the monitor',
      '/update': 'Trigger manual GTFS update (admin)'
    },
    configuration: {
      station: config.station,
      feeds: {
        trips: config.feeds.trips,
        alerts: config.feeds.alerts
      },
      carCounts: {
        enabled: !!BART_API_KEY,
        pollMs: CAR_COUNT_POLL_MS
      }
    }
  });
});

// Health check
app.get('/health', (req, res) => {
  const status = gtfsMonitor.getStatus();
  const isHealthy = !status.trips.error || !!status.trips.hasData;
  const responseCode = isHealthy ? 200 : 503;

  res.status(responseCode).json({
    status: isHealthy ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    monitor: status,
    staticDataLoaded: staticDataService.getStats(),
    carCountCache: {
      enabled: !!BART_API_KEY,
      stations: Object.keys(carCountCache).length,
      destinations: Object.values(carCountCache).reduce(
        (sum, stationMap) => sum + Object.keys(stationMap || {}).length,
        0
      ),
      lastUpdated: carCountLastUpdated?.toISOString() || null,
      lastError: carCountLastError
    }
  });
});

// Internal Status
app.get('/status', (req, res) => {
  res.json(gtfsMonitor.getStatus());
});

// Get configured station info
app.get('/station', async (req, res) => {
  try {
    const selectedStation = resolveStationInput(
      req.query.station || req.query.stop || DEFAULT_STATION.key
    );
    const stopId = selectedStation.stationId;
    const direction = req.query.direction || DEFAULT_STATION.direction || config.station.direction;

    const stopInfo = await getCombinedStopInfo(selectedStation, direction);

    console.log('[STATION DEBUG]', {
      requestedStation: selectedStation,
      stopId,
      direction,
      stopName: stopInfo?.stop?.name,
      platform: stopInfo?.stop?.platform,
      upcomingTripsCount: stopInfo?.upcomingTrips?.length,
      warnings: stopInfo?.warnings
    });

    res.json({
      selectedStation,
      ...stopInfo
    });
  } catch (error) {
    res.status(500).json({
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Get any station info by ID
app.get('/station/:stopId', async (req, res) => {
  try {
    const stopId = req.params.stopId;
    const direction = req.query.direction || null;
    const stopInfo = await transitService.getStopInfo(stopId, direction);
    res.json(stopInfo);
  } catch (error) {
    const status = error.message.includes('not found') ? 404 : 500;
    res.status(status).json({
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Get next arrivals in simplified format
app.get('/next', async (req, res) => {
  try {
    const selectedStation = resolveStationInput(req.query.station || req.query.stop || DEFAULT_STATION.key);
    const stopId = selectedStation.stationId;
    const direction = req.query.direction || DEFAULT_STATION.direction || config.station.direction;
    const limit = parseInt(req.query.limit, 10) || 4;

    const stopInfo = await getCombinedStopInfo(selectedStation, direction);

    const nextArrivals = stopInfo.upcomingTrips.slice(0, limit).map(trip => {
      const destination = extractDestinationFromHeadsign(trip.headsign);
      const status = trip.minutesUntilArrival <= 1 ? 'arriving' : 'scheduled';

      const arrival = {
        destination,
        minutesUntilArrival: trip.minutesUntilArrival,
        status
      };

      if (trip.vehicleLabel) {
        arrival.vehicle = trip.vehicleLabel;
      }

      const cars = getCarCount(stopId, destination, trip.minutesUntilArrival);
      console.log(
        '[CAR DEBUG] /next trip',
        JSON.stringify({
          stopId,
          destination,
          minutesUntilArrival: trip.minutesUntilArrival,
          vehicleLabel: trip.vehicleLabel,
          cars
        })
      );

      if (cars !== null) {
        arrival.cars = cars;
      }

      if (trip.occupancyStatus !== undefined) {
        arrival.occupancy = trip.occupancyStatus;
      }

      return arrival;
    });

    res.json({
      station: stopInfo.stop.name,
      selectedStation,
      platform: stopInfo.stop.platform,
      direction: direction || 'all',
      nextArrivals,
      lastUpdated: stopInfo.lastUpdated,
      carCountUpdated: carCountLastUpdated?.toISOString() || null,
      ...(stopInfo.warnings.length > 0 && { warnings: stopInfo.warnings })
    });
  } catch (error) {
    const status = error.message.includes('not found') ? 404 : 500;
    res.status(status).json({
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// List all stops
app.get('/stops', (req, res) => {
  const stops = staticDataService.getAllStops().map(stop => ({
    id: stop.stop_id,
    name: stop.stop_name,
    code: stop.stop_code,
    platform: stop.platform_code
  }));
  res.json({ stops, count: stops.length });
});

// Update endpoint
app.post('/update', async (req, res) => {
  try {
    await gtfsUpdater.checkForUpdates();

    if (BART_API_KEY) {
      await refreshAllConfiguredCarCounts();
    }

    res.json({ status: 'Update executed', timestamp: new Date().toISOString() });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Start server
async function startServer() {
  try {
    staticDataService.load();
    gtfsMonitor.start();
    gtfsUpdater.start();

    if (BART_API_KEY) {
      await refreshAllConfiguredCarCounts();
      carCountInterval = setInterval(refreshAllConfiguredCarCounts, CAR_COUNT_POLL_MS);
    } else {
      console.warn('BART_API_KEY not set; car count enrichment is disabled.');
    }

    app.listen(config.port, config.host, () => {
      console.log(`\n🚇 BART GTFS Real-time API Server`);
      const startupStation = resolveStationInput(DEFAULT_STATION.key);
      console.log(`📍 Default Station: ${startupStation.stationId} (${startupStation.displayName})`);
      console.log(`🧭 Direction: ${DEFAULT_STATION.direction || config.station.direction}`);
      console.log(`🌐 Server running on http://${config.host}:${config.port}`);
      console.log(`🚃 Car counts: ${BART_API_KEY ? 'enabled' : 'disabled'}`);
      console.log(`\nAvailable endpoints:`);
      console.log(`  GET /                - API information`);
      console.log(`  GET /station         - Configured station info`);
      console.log(`  GET /station/:stopId - Any station info`);
      console.log(`  GET /next            - Next arrivals (simplified)`);
      console.log(`  GET /stops           - List all stops`);
      console.log(`  GET /health          - Health check`);
      console.log(`  GET /status          - Monitor status\n`);
    });
  } catch (e) {
    console.error('Failed to start server:', e);
    process.exit(1);
  }
}

function shutdown() {
  if (carCountInterval) {
    clearInterval(carCountInterval);
    carCountInterval = null;
  }
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

startServer();