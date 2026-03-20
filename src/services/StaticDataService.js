import { parse } from 'csv-parse';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { config } from '../config/config.js';
import logger from '../lib/logger.js';

const log = logger.child({ service: 'static-data' });

class StaticDataService {
    constructor() {
        this.stops = new Map();
        this.routes = new Map();
        this.trips = new Map();
        this.stopTimes = new Map();
        this.initialized = false;
    }

    async _parseFile(filename) {
        const content = await readFile(join(config.paths.staticData, filename), 'utf-8');
        return new Promise((resolve, reject) => {
            parse(content, { columns: true, skip_empty_lines: true }, (err, records) => {
                if (err) reject(err);
                else resolve(records);
            });
        });
    }

    async load() {
        if (this.initialized) return;

        try {
            log.info('Loading static GTFS data...');

            const newStops = new Map();
            const newRoutes = new Map();
            const newTrips = new Map();
            const newStopTimes = new Map();

            // Load stops
            const stops = await this._parseFile('stops.txt');
            stops.forEach(stop => newStops.set(stop.stop_id, stop));
            log.info({ count: newStops.size }, 'Loaded stops');

            // Load routes
            const routes = await this._parseFile('routes.txt');
            routes.forEach(route => newRoutes.set(route.route_id, route));
            log.info({ count: newRoutes.size }, 'Loaded routes');

            // Load trips
            const trips = await this._parseFile('trips.txt');
            trips.forEach(trip => newTrips.set(trip.trip_id, trip));
            log.info({ count: newTrips.size }, 'Loaded trips');

            // Load stop_times and index by trip_id
            const stopTimes = await this._parseFile('stop_times.txt');
            stopTimes.forEach(stopTime => {
                if (!newStopTimes.has(stopTime.trip_id)) {
                    newStopTimes.set(stopTime.trip_id, []);
                }
                newStopTimes.get(stopTime.trip_id).push(stopTime);
            });
            log.info({ count: newStopTimes.size }, 'Loaded stop times');

            // Atomic swap
            this.stops = newStops;
            this.routes = newRoutes;
            this.trips = newTrips;
            this.stopTimes = newStopTimes;
            this.initialized = true;
        } catch (error) {
            log.error({ err: error }, 'Error loading static GTFS data');
            throw error;
        }
    }

    async reload() {
        log.info('Reloading static data...');
        this.initialized = false;
        await this.load();
    }

    getStop(stopId) {
        return this.stops.get(stopId);
    }

    getRoute(routeId) {
        return this.routes.get(routeId);
    }

    getTrip(tripId) {
        return this.trips.get(tripId);
    }

    getAllStops() {
        return Array.from(this.stops.values());
    }

    getStats() {
        return {
            stops: this.stops.size,
            routes: this.routes.size,
            trips: this.trips.size
        }
    }
}

export const staticDataService = new StaticDataService();
