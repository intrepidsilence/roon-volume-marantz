"use strict";

const MAX_RECEIVERS = 4;

class SettingsManager {
    constructor(roon) {
        this.roon = roon;
        this.settings = null;
        this.onChange = null;

        // Default settings
        this.defaults = {
            receiver_count: '1'
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
                    // Receiver count
                    if (settings.values.receiver_count !== undefined) {
                        const count = getValue(settings.values.receiver_count);
                        if (count) {
                            newSettings.receiver_count = count;
                        }
                    }

                    // Dynamic receiver settings
                    const count = parseInt(newSettings.receiver_count) || 1;
                    for (let i = 1; i <= count; i++) {
                        // IP Address
                        const ipKey = `ip_address_${i}`;
                        if (settings.values[ipKey] !== undefined) {
                            const ip = getValue(settings.values[ipKey]);
                            if (typeof ip === 'string') {
                                newSettings[ipKey] = ip.trim();
                            }
                        }

                        // Port
                        const portKey = `port_${i}`;
                        if (settings.values[portKey] !== undefined) {
                            const port = getValue(settings.values[portKey]);
                            if (typeof port === 'string') {
                                newSettings[portKey] = port.trim();
                            }
                        }

                        // Device Name
                        const nameKey = `device_name_${i}`;
                        if (settings.values[nameKey] !== undefined) {
                            const name = getValue(settings.values[nameKey]);
                            if (typeof name === 'string') {
                                newSettings[nameKey] = name.trim();
                            }
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

                    // Push updated layout to Roon UI (for dynamic field changes)
                    this.settings.update_settings(layout);

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
        const values = { ...settings };
        const l = {
            values: values,
            layout: [],
            has_error: false
        };

        // Receiver count dropdown
        const countValues = [];
        for (let i = 1; i <= MAX_RECEIVERS; i++) {
            countValues.push({ title: `${i}`, value: `${i}` });
        }

        l.layout.push({
            type: 'dropdown',
            title: 'Number of Receivers',
            values: countValues,
            setting: 'receiver_count'
        });

        // Dynamic receiver fields
        const count = parseInt(values.receiver_count) || 1;
        for (let i = 1; i <= count; i++) {
            const suffix = count > 1 ? ` ${i}` : '';

            // Set defaults for this receiver if not set
            if (values[`ip_address_${i}`] === undefined) {
                values[`ip_address_${i}`] = '';
            }
            if (!values[`port_${i}`]) {
                values[`port_${i}`] = '8080';
            }
            if (!values[`device_name_${i}`]) {
                values[`device_name_${i}`] = `Denon/Marantz Receiver${suffix}`;
            }

            // Add a label for multi-receiver setups
            if (count > 1) {
                l.layout.push({
                    type: 'label',
                    title: `Receiver${suffix}`
                });
            }

            // Receiver settings group
            l.layout.push({
                type: 'group',
                title: count > 1 ? '' : 'Receiver Settings',
                items: [
                    {
                        type: 'string',
                        title: 'IP Address',
                        maxlength: 256,
                        setting: `ip_address_${i}`
                    },
                    {
                        type: 'string',
                        title: 'Port',
                        subtitle: 'Newer receivers (2016+) use port 8080. Older models like SR6008 use port 80.',
                        maxlength: 5,
                        setting: `port_${i}`
                    },
                    {
                        type: 'string',
                        title: 'Device Name',
                        subtitle: 'Name shown in Roon volume control selection.',
                        maxlength: 256,
                        setting: `device_name_${i}`
                    }
                ]
            });
        }

        return l;
    }

    /**
     * Get current settings (with migration from old format)
     */
    get() {
        const persistedState = this.roon.load_config('settings') || {};
        const settings = { ...this.defaults, ...persistedState };

        // Migrate old single-receiver format to new indexed format
        if (settings.ip_address && !settings.ip_address_1) {
            settings.ip_address_1 = settings.ip_address;
            settings.port_1 = settings.port || '8080';
            settings.device_name_1 = settings.device_name || 'Denon/Marantz Receiver';
            // Clean up old keys
            delete settings.ip_address;
            delete settings.port;
            delete settings.device_name;
            // Save migrated settings
            this.save(settings);
        }

        return settings;
    }

    /**
     * Get configured receivers as an array
     */
    getReceivers() {
        const settings = this.get();
        const count = parseInt(settings.receiver_count) || 1;
        const receivers = [];

        for (let i = 1; i <= count; i++) {
            const ip = settings[`ip_address_${i}`];
            if (ip) {
                receivers.push({
                    index: i,
                    ip_address: ip,
                    port: settings[`port_${i}`] || '8080',
                    device_name: settings[`device_name_${i}`] || `Denon/Marantz Receiver ${i}`
                });
            }
        }

        return receivers;
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
