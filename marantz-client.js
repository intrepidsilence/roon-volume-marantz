"use strict";

const fetch = require('node-fetch');
const { XMLParser } = require('fast-xml-parser');
const EventEmitter = require('events');

class MarantzClient extends EventEmitter {
    constructor(ipAddress, port = '8080') {
        super();
        this.ipAddress = ipAddress;
        this.port = port || '8080';
        this.baseUrl = `http://${ipAddress}:${this.port}/goform`;
        this.parser = new XMLParser();
        this.currentVolume = null;
        this.currentMute = null;
        this.pollInterval = null;
        this.shouldSuppressUpdates = null; // Callback to check if updates should be suppressed
    }

    /**
     * Send a command to the receiver
     */
    async sendCommand(command) {
        try {
            const url = `${this.baseUrl}/formiPhoneAppDirect.xml?${command}`;
            const response = await fetch(url, { timeout: 5000 });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            return true;
        } catch (error) {
            console.error(`Error sending command ${command}:`, error.message);
            throw error;
        }
    }

    /**
     * Get current status from the receiver
     */
    async getStatus() {
        try {
            const url = `${this.baseUrl}/formMainZone_MainZoneXmlStatusLite.xml`;
            const response = await fetch(url, { timeout: 5000 });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const text = await response.text();
            const data = this.parser.parse(text);

            // Extract volume and mute status
            if (data.item) {
                const volumeRaw = data.item.MasterVolume?.value;
                const volume = this.parseVolume(volumeRaw);
                const mute = data.item.Mute?.value === 'on';

                console.log(`Receiver status: volume=${volume}, mute=${mute}`);

                // Emit events if values changed
                if (volume !== null && volume !== this.currentVolume) {
                    console.log(`Volume updated: ${this.currentVolume} -> ${volume}`);
                    this.currentVolume = volume;
                    this.emit('volumeChanged', volume);
                }

                if (mute !== this.currentMute) {
                    this.currentMute = mute;
                    this.emit('muteChanged', mute);
                }

                return {
                    volume: volume,
                    mute: mute,
                    power: data.item.Power?.value
                };
            }

            return null;
        } catch (error) {
            console.error('Error getting status:', error.message);
            this.emit('error', error);
            return null;
        }
    }

    /**
     * Parse volume value from receiver format
     * Denon/Marantz returns dB values like "-29.5" for volume 50.5
     * We need to convert: Display Value = dB + 80
     * Returns the value as displayed on the receiver (0-98)
     */
    parseVolume(volumeStr) {
        // Handle null, undefined, or objects
        if (!volumeStr) {
            return null;
        }

        // Convert to string if not already
        const str = String(volumeStr);

        if (str === '--' || str === '') {
            return 0; // Return minimum volume
        }

        // Parse as float (keeps negative sign)
        const dbValue = parseFloat(str);

        if (isNaN(dbValue)) {
            return null;
        }

        // Convert dB to display value: Display = dB + 80
        // Example: -29.5 dB + 80 = 50.5 on display
        const displayValue = dbValue + 80;

        return displayValue;
    }

    /**
     * Format volume for receiver
     * Takes a display value 0-98 and formats for the MV command
     * MV commands use the display value directly: MV50 = volume 50 on display
     * Format: whole numbers as "50", half values as "505" for 50.5
     */
    formatVolume(displayValue) {
        // Round to nearest 0.5
        const rounded = Math.round(displayValue * 2) / 2;

        // Format: whole numbers as "50", half values as "505" for 50.5
        if (rounded === Math.floor(rounded)) {
            return Math.floor(rounded).toString();
        } else {
            return (rounded * 10).toFixed(0);
        }
    }

    /**
     * Set volume to absolute value (0-98)
     */
    async setVolume(value) {
        const volumeStr = this.formatVolume(value);
        return await this.sendCommand(`MV${volumeStr}`);
    }

    /**
     * Adjust volume up
     */
    async volumeUp() {
        return await this.sendCommand('MVUP');
    }

    /**
     * Adjust volume down
     */
    async volumeDown() {
        return await this.sendCommand('MVDN');
    }

    /**
     * Set mute state
     */
    async setMute(mute) {
        const command = mute ? 'MUON' : 'MUOFF';
        return await this.sendCommand(command);
    }

    /**
     * Start polling for status updates
     */
    startPolling(intervalSeconds = 2) {
        if (this.pollInterval) {
            this.stopPolling();
        }

        // Initial status check
        this.getStatus();

        // Set up polling
        this.pollInterval = setInterval(() => {
            this.getStatus();
        }, intervalSeconds * 1000);
    }

    /**
     * Stop polling for status updates
     */
    stopPolling() {
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
            this.pollInterval = null;
        }
    }

    /**
     * Update IP address
     */
    updateIpAddress(ipAddress, port = this.port) {
        this.ipAddress = ipAddress;
        this.port = port || '8080';
        this.baseUrl = `http://${ipAddress}:${this.port}/goform`;

        // Restart polling if it was active
        if (this.pollInterval) {
            const wasPolling = true;
            this.stopPolling();
            if (wasPolling) {
                this.startPolling();
            }
        }
    }

    /**
     * Clean up resources
     */
    destroy() {
        this.stopPolling();
        this.removeAllListeners();
    }
}

module.exports = MarantzClient;
