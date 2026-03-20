import path from 'path';
import AdmZip from 'adm-zip';
import { config } from '../config/config.js';
import { staticDataService } from './StaticDataService.js';
import logger from '../lib/logger.js';

const log = logger.child({ service: 'gtfs-updater' });

class GtfsUpdater {
    constructor() {
        this.bartUrl = 'https://www.bart.gov/dev/schedules/google_transit.zip';
        this.isUpdating = false;
        this.lastUpdate = null;
        this._interval = null;
    }

    start() {
        // Check daily
        this._interval = setInterval(() => this.checkForUpdates(), 24 * 60 * 60 * 1000);
        log.info('GTFS Updater service started (daily checks)');
    }

    stop() {
        clearInterval(this._interval);
        log.info('GTFS Updater service stopped');
    }

    async checkForUpdates() {
        if (this.isUpdating) return;
        this.isUpdating = true;
        log.info('Checking for GTFS updates...');

        try {
            const downloadUrl = await this._resolveDownloadUrl(this.bartUrl);
            if (!downloadUrl) {
                throw new Error('Could not resolve GTFS download URL');
            }
            log.info({ url: downloadUrl }, 'Resolved GTFS URL');

            const zipBuffer = await this._downloadFile(downloadUrl);
            await this._processUpdate(zipBuffer);

            this.lastUpdate = new Date();
            log.info('GTFS update completed successfully');
        } catch (error) {
            log.error({ err: error.message }, 'GTFS update failed');
        } finally {
            this.isUpdating = false;
        }
    }

    async _resolveDownloadUrl(initialUrl) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60_000);
        try {
            const response = await fetch(initialUrl, { signal: controller.signal });
            const text = await response.text();

            const match = text.match(/<meta[^>]*http-equiv=["']refresh["'][^>]*content=["'][^"']*url=['"]?([^'"\s>]+)['"]?/i);

            if (match && match[1]) {
                let redirectUrl = match[1];
                if (redirectUrl.startsWith('/')) {
                    const u = new URL(initialUrl);
                    redirectUrl = `${u.protocol}//${u.host}${redirectUrl}`;
                }
                return redirectUrl;
            }

            const contentType = response.headers.get('content-type');
            if (contentType && (contentType.includes('zip') || contentType.includes('octet-stream'))) {
                return response.url;
            }

            return null;
        } finally {
            clearTimeout(timeoutId);
        }
    }

    async _downloadFile(url, retries = 3) {
        let lastError;
        for (let attempt = 1; attempt <= retries; attempt++) {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 120_000);
            try {
                const response = await fetch(url, { signal: controller.signal });
                clearTimeout(timeoutId);
                if (!response.ok) throw new Error(`Download failed: ${response.statusText}`);
                return await response.arrayBuffer();
            } catch (err) {
                clearTimeout(timeoutId);
                lastError = err;
                log.warn({ attempt, retries, err: err.message }, 'GTFS download attempt failed');
                if (attempt < retries) {
                    await new Promise(r => setTimeout(r, 5000 * Math.pow(2, attempt - 1)));
                }
            }
        }
        throw lastError;
    }

    async _processUpdate(arrayBuffer) {
        const buffer = Buffer.from(arrayBuffer);
        const zip = new AdmZip(buffer);

        if (!zip.getEntry('trips.txt') || !zip.getEntry('stops.txt')) {
            throw new Error('Invalid GTFS zip: missing required files');
        }

        const targetDir = path.resolve(config.paths.staticData);

        // Validate no path traversal
        for (const entry of zip.getEntries()) {
            const resolvedPath = path.resolve(targetDir, entry.entryName);
            if (!resolvedPath.startsWith(targetDir + path.sep) && resolvedPath !== targetDir) {
                throw new Error(`Zip entry escapes target directory: ${entry.entryName}`);
            }
        }

        log.info({ targetDir }, 'Extracting GTFS data');
        zip.extractAllTo(targetDir, true);

        await staticDataService.reload();
    }
}

export const gtfsUpdater = new GtfsUpdater();
