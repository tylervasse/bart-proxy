import { existsSync } from 'fs';
import { join } from 'path';
import express from 'express';
import { config } from './src/config/config.js';
import { staticDataService } from './src/services/StaticDataService.js';
import { gtfsMonitor } from './src/services/GtfsMonitor.js';
import { transitService } from './src/services/TransitService.js';
import { gtfsUpdater } from './src/services/GtfsUpdater.js';
import logger from './src/lib/logger.js';

const VALID_DIRECTIONS = new Set(['eastbound', 'westbound']);

// Initialize Express app
const app = express();
app.use(express.json());

let isShuttingDown = false;

// Connection draining middleware
app.use((req, res, next) => {
  if (isShuttingDown) {
    res.set('Connection', 'close');
  }
  next();
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    service: 'BART GTFS Real-time API',
    endpoints: {
      '/station': 'Get real-time information for the configured station',
      '/station/:stopId': 'Get real-time information for any station by stop ID',
      '/next': 'Get next 4 arrivals in simplified format (destination & minutes)',
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
      }
    }
  });
});

// Health check
app.get('/health', (req, res) => {
  const status = gtfsMonitor.getStatus();
  const tripsAge = status.trips.lastUpdate
    ? Date.now() - status.trips.lastUpdate.getTime()
    : Infinity;

  const isHealthy = status.trips.hasData && tripsAge < 300_000; // 5 min

  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    monitor: status,
    staticDataLoaded: staticDataService.getStats()
  });
});

// Internal Status
app.get('/status', (req, res) => {
  res.json(gtfsMonitor.getStatus());
});

// Get configured station info
app.get('/station', async (req, res) => {
  try {
    const direction = req.query.direction?.toLowerCase() || config.station.direction;
    if (req.query.direction && !VALID_DIRECTIONS.has(direction)) {
      return res.status(400).json({ error: 'Invalid direction. Use "eastbound" or "westbound".' });
    }
    const stopInfo = await transitService.getStopInfo(config.station.id, direction);
    res.json(stopInfo);
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
    const direction = req.query.direction?.toLowerCase() || null;
    if (direction && !VALID_DIRECTIONS.has(direction)) {
      return res.status(400).json({ error: 'Invalid direction. Use "eastbound" or "westbound".' });
    }
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
    const stopId = req.query.stop || config.station.id;
    const direction = req.query.direction?.toLowerCase() || config.station.direction;
    if (req.query.direction && !VALID_DIRECTIONS.has(direction)) {
      return res.status(400).json({ error: 'Invalid direction. Use "eastbound" or "westbound".' });
    }
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 4, 1), 20);

    const stopInfo = await transitService.getStopInfo(stopId, direction);

    const nextArrivals = stopInfo.upcomingTrips.slice(0, limit).map(trip => {
      let destination = trip.headsign;
      if (destination) {
        const parts = destination.split(' / ');
        if (parts.length > 1) {
          destination = parts[parts.length - 1];
        }
      } else {
        destination = "Unknown";
      }

      const status = trip.minutesUntilArrival <= 1 ? 'arriving' : 'scheduled';

      const arrival = {
        destination: destination,
        minutesUntilArrival: trip.minutesUntilArrival,
        status: status
      };

      if (trip.vehicleLabel) {
        arrival.vehicle = trip.vehicleLabel;
      }
      if (trip.occupancyStatus !== undefined) {
        arrival.occupancy = trip.occupancyStatus;
      }

      return arrival;
    });

    res.json({
      station: stopInfo.stop.name,
      platform: stopInfo.stop.platform,
      direction: direction || 'all',
      nextArrivals: nextArrivals,
      lastUpdated: stopInfo.lastUpdated,
      ...(stopInfo.warnings.length > 0 && { warnings: stopInfo.warnings })
    });

  } catch (error) {
    res.status(500).json({
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
    res.json({ status: 'Update executed', timestamp: new Date().toISOString() });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Start server
async function startServer() {
  try {
    // Download GTFS data if not present
    const stopsFile = join(config.paths.staticData, 'stops.txt');
    if (!existsSync(stopsFile)) {
      logger.info('No GTFS static data found. Downloading...');
      await gtfsUpdater.checkForUpdates();
    }

    // Load Static Data
    await staticDataService.load();

    // Start GTFS Monitor (Background polling)
    gtfsMonitor.start();

    // Start GTFS Updater (Daily check)
    gtfsUpdater.start();

    const server = app.listen(config.port, config.host, () => {
      logger.info({
        station: config.station.id,
        stationName: staticDataService.getStop(config.station.id)?.stop_name,
        direction: config.station.direction,
        url: `http://${config.host}:${config.port}`
      }, 'BART GTFS Real-time API server started');
    });

    function shutdown(signal) {
      if (isShuttingDown) return;
      isShuttingDown = true;
      logger.info({ signal }, 'Shutting down gracefully');
      gtfsMonitor.stop();
      gtfsUpdater.stop();
      server.close(() => {
        logger.info('Server closed');
        process.exit(0);
      });
      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 10_000);
    }

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('unhandledRejection', (reason) => {
      logger.error({ err: reason }, 'Unhandled rejection');
    });
    process.on('uncaughtException', (err) => {
      logger.fatal({ err }, 'Uncaught exception, shutting down');
      shutdown('uncaughtException');
    });
  } catch (e) {
    logger.fatal({ err: e }, 'Failed to start server');
    process.exit(1);
  }
}

startServer();
