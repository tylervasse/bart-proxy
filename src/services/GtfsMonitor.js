import GtfsRealtimeBindings from 'gtfs-realtime-bindings';
import { config } from '../config/config.js';
import logger from '../lib/logger.js';

const log = logger.child({ service: 'gtfs-monitor' });

class GtfsMonitor {
    constructor() {
        this.tripsFeed = null;
        this.alertsFeed = null;
        this.lastTripsUpdate = null;
        this.lastAlertsUpdate = null;
        this.tripsError = null;
        this.alertsError = null;

        this._tripsTimeout = null;
        this._alertsTimeout = null;
        this._tripsInFlight = false;
        this._alertsInFlight = false;

        // Status tracking
        this.isPolling = false;
        this.stats = {
            tripUpdates: 0,
            tripErrors: 0,
            alertUpdates: 0,
            alertErrors: 0
        };
    }

    start() {
        if (this.isPolling) return;
        this.isPolling = true;

        // Initial fetch with error handling
        this._pollTrips();
        this._pollAlerts();

        log.info('GTFS Real-time monitor started');
    }

    stop() {
        this.isPolling = false;
        clearTimeout(this._tripsTimeout);
        clearTimeout(this._alertsTimeout);
        log.info('GTFS Real-time monitor stopped');
    }

    async _pollTrips() {
        if (!this.isPolling || this._tripsInFlight) return;
        this._tripsInFlight = true;
        try {
            await this.updateTrips();
        } catch (err) {
            log.error({ err }, 'Unhandled error in trips poll');
        } finally {
            this._tripsInFlight = false;
            if (this.isPolling) {
                this._tripsTimeout = setTimeout(() => this._pollTrips(), config.refreshInterval);
            }
        }
    }

    async _pollAlerts() {
        if (!this.isPolling || this._alertsInFlight) return;
        this._alertsInFlight = true;
        try {
            await this.updateAlerts();
        } catch (err) {
            log.error({ err }, 'Unhandled error in alerts poll');
        } finally {
            this._alertsInFlight = false;
            if (this.isPolling) {
                this._alertsTimeout = setTimeout(() => this._pollAlerts(), config.refreshInterval * 2);
            }
        }
    }

    async fetchFeed(url, type) {
        const retries = 3;
        let lastError = null;

        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

                const response = await fetch(url, {
                    headers: {
                        'User-Agent': 'bart-proxy/1.0.0 (https://github.com/filbot/bart-proxy)',
                        'Accept': 'application/x-protobuf, application/octet-stream',
                        'Connection': 'keep-alive'
                    },
                    signal: controller.signal
                });

                clearTimeout(timeoutId);

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                const buffer = await response.arrayBuffer();
                const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(
                    new Uint8Array(buffer)
                );

                return feed;

            } catch (error) {
                lastError = error;
                const isLastAttempt = attempt === retries;

                log.warn({ attempt, retries, type, err: error.message }, 'Feed fetch attempt failed');

                if (!isLastAttempt) {
                    const delay = 1000 * Math.pow(2, attempt - 1);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }

        throw lastError;
    }

    async updateTrips() {
        try {
            const feed = await this.fetchFeed(config.feeds.trips, 'trips');
            this.tripsFeed = feed;
            this.lastTripsUpdate = new Date();
            this.tripsError = null;
            this.stats.tripUpdates++;
        } catch (error) {
            this.tripsError = error;
            this.stats.tripErrors++;
            log.error({ err: error.message }, 'Failed to update trips feed');
        }
    }

    async updateAlerts() {
        try {
            const feed = await this.fetchFeed(config.feeds.alerts, 'alerts');
            this.alertsFeed = feed;
            this.lastAlertsUpdate = new Date();
            this.alertsError = null;
            this.stats.alertUpdates++;
        } catch (error) {
            this.alertsError = error;
            this.stats.alertErrors++;
            log.error({ err: error.message }, 'Failed to update alerts feed');
        }
    }

    getTrips() {
        if (!this.tripsFeed) return null;
        return this.tripsFeed;
    }

    getAlerts() {
        return this.alertsFeed;
    }

    getStatus() {
        return {
            trips: {
                lastUpdate: this.lastTripsUpdate,
                hasData: !!this.tripsFeed,
                error: this.tripsError ? this.tripsError.message : null
            },
            alerts: {
                lastUpdate: this.lastAlertsUpdate,
                hasData: !!this.alertsFeed,
                error: this.alertsError ? this.alertsError.message : null
            },
            stats: this.stats
        };
    }
}

export const gtfsMonitor = new GtfsMonitor();
