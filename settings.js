"use strict";

class SettingsManager {
    constructor(roon) {
        this.roon = roon;
        this.settings = null;
        this.onChange = null;

        // Default settings
        this.defaults = {
            ip_address: '',
            port: '8080',
            device_name: 'Denon/Marantz Receiver'
        };
    }

    /**
     * Initialize settings service
     */
    initialize(onChange) {
        this.onChange = onChange;

        const RoonApiSettings = require('node-roon-api-settings');

        this.settings = new RoonApiSettings(this.roon, {
            get_settings: (cb) => {
                cb(this.makeLayout(this.get()));
            },
            save_settings: (req, isDryRun, settings) => {
                const oldSettings = this.get();
                let newSettings = { ...oldSettings };
                let hasError = false;

                // Helper function to extract value (handles both string and object format)
                const getValue = (val) => {
                    if (typeof val === 'string') {
                        return val;
                    } else if (val && typeof val === 'object' && val.value !== undefined) {
                        return val.value;
                    }
                    return val;
                };

                // Parse and validate settings
                if (settings.values) {
                    // IP Address
                    if (settings.values.ip_address !== undefined) {
                        const ip = getValue(settings.values.ip_address);
                        if (typeof ip === 'string') {
                            newSettings.ip_address = ip.trim();
                        }
                    }

                    // Port
                    if (settings.values.port !== undefined) {
                        const port = getValue(settings.values.port);
                        if (typeof port === 'string') {
                            newSettings.port = port.trim();
                        }
                    }

                    // Device Name
                    if (settings.values.device_name !== undefined) {
                        const name = getValue(settings.values.device_name);
                        if (typeof name === 'string') {
                            newSettings.device_name = name.trim();
                        }
                    }
                }

                // Create the layout with new settings
                const layout = this.makeLayout(newSettings);

                // Send response with layout
                req.send_complete(hasError ? 'NotValid' : 'Success', {
                    settings: layout
                });

                // Save settings if not dry run and no errors
                if (!hasError && !isDryRun) {
                    this.save(newSettings);

                    // Notify of changes if settings actually changed
                    if (JSON.stringify(oldSettings) !== JSON.stringify(newSettings)) {
                        if (this.onChange) {
                            this.onChange(newSettings);
                        }
                    }
                }
            }
        });

        return this.settings;
    }

    /**
     * Validate IP address format
     */
    validateIpAddress(ip) {
        // Accept both IP addresses and hostnames
        if (!ip) return false;

        // Check if it's a valid hostname (contains letters)
        if (/[a-zA-Z]/.test(ip)) {
            // Simple hostname validation
            return /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/.test(ip);
        }

        // Otherwise validate as IP address
        const parts = ip.split('.');
        if (parts.length !== 4) return false;

        return parts.every(part => {
            const num = parseInt(part);
            return num >= 0 && num <= 255 && part === num.toString();
        });
    }

    /**
     * Create the settings layout for Roon UI
     */
    makeLayout(settings) {
        const l = {
            values: settings,
            layout: [],
            has_error: false
        };

        l.layout.push({
            type: 'group',
            title: 'Receiver Settings',
            items: [
                {
                    type: 'string',
                    title: 'IP Address',
                    maxlength: 256,
                    setting: 'ip_address'
                },
                {
                    type: 'string',
                    title: 'Port',
                    subtitle: 'Newer receivers (2016+) use port 8080. Older models like SR6008 use port 80.',
                    maxlength: 5,
                    setting: 'port'
                }
            ]
        });

        l.layout.push({
            type: 'group',
            title: 'Volume Control Settings',
            items: [
                {
                    type: 'string',
                    title: 'Device Name',
                    maxlength: 256,
                    setting: 'device_name'
                }
            ]
        });

        return l;
    }

    /**
     * Get current settings
     */
    get() {
        const persistedState = this.roon.load_config('settings') || {};
        return { ...this.defaults, ...persistedState };
    }

    /**
     * Save settings
     */
    save(settings) {
        this.roon.save_config('settings', settings);
    }

    /**
     * Get the settings service
     */
    getService() {
        return this.settings;
    }
}

module.exports = SettingsManager;
