"use strict";

const MarantzClient = require('./marantz-client');

class VolumeControl {
    constructor(roon, settings) {
        this.roon = roon;
        this.settings = settings;
        this.client = null;
        this.volumeControl = null;

        // Volume mapping configuration
        this.volumeConfig = {
            min: 0,  // Minimum volume
            max: 98,      // Maximum volume
            step: 0.5    // Volume step size
        };

        // Debouncing and feedback prevention
        this.volumeDebounceTimer = null;
        this.lastCommandTime = 0;
        this.suppressUpdatesUntil = 0;
    }

    /**
     * Initialize the volume control with current settings
     */
    initialize() {
        const config = this.settings.get();

        if (!config.ip_address) {
            console.log('No IP address configured');
            return;
        }

        // Clean up existing client
        if (this.client) {
            this.client.destroy();
        }

        // Create new client
        this.client = new MarantzClient(config.ip_address);

        // Provide suppression callback to client
        this.client.shouldSuppressUpdates = () => {
            return Date.now() < this.suppressUpdatesUntil;
        };

        // Set up event handlers
        this.client.on('volumeChanged', (volume) => {
            this.updateVolumeState(volume);
        });

        this.client.on('muteChanged', (mute) => {
            this.updateMuteState(mute);
        });

        this.client.on('error', (error) => {
            console.error('Marantz client error:', error);
        });

        // Configure volume range
        this.configureVolumeRange();

        // Register volume control with Roon
        this.registerVolumeControl(config);

        // Do an initial status check
        this.client.getStatus();

        // Poll every 5 seconds to catch external volume changes
        this.client.startPolling(5);
    }

    /**
     * Configure volume range - always use Marantz native range (0-98)
     */
    configureVolumeRange() {
        // Marantz displays 0-98
        this.volumeConfig.min = 0;
        this.volumeConfig.max = 98;
        this.volumeConfig.step = 0.5;
    }

    /**
     * Register the volume control device with Roon
     */
    registerVolumeControl(config) {
        const deviceName = config.device_name || 'Denon/Marantz Receiver';

        // Destroy existing control if present
        if (this.volumeControl) {
            this.volumeControl.destroy();
        }

        // Create volume control state
        const state = {
            display_name: deviceName,
            volume_type: 'number',
            volume_min: this.volumeConfig.min,
            volume_max: this.volumeConfig.max,
            volume_step: this.volumeConfig.step,
            volume_value: this.client.currentVolume || 0,
            is_muted: this.client.currentMute || false
        };

        // Register with Roon
        this.volumeControl = this.roon.services.RoonApiVolumeControl.new_device({
            state: state,
            set_volume: (req) => this.handleSetVolume(req),
            set_mute: (req) => this.handleSetMute(req)
        });

        console.log(`Volume control registered: ${deviceName}`);
    }

    /**
     * Handle volume change requests from Roon
     */
    async handleSetVolume(req) {
        if (!this.client) {
            console.error('Client not initialized');
            return;
        }

        const mode = req.body.mode;
        const value = req.body.value;

        console.log(`Volume change request: mode=${mode}, value=${value}`);

        // Clear any pending debounce timer
        if (this.volumeDebounceTimer) {
            clearTimeout(this.volumeDebounceTimer);
        }

        // Debounce rapid volume changes - wait 200ms after last change
        this.volumeDebounceTimer = setTimeout(async () => {
            try {
                let targetVolume = null;

                switch (mode) {
                    case 'absolute':
                        targetVolume = value;
                        console.log(`Setting volume to: ${targetVolume}`);
                        await this.client.setVolume(targetVolume);
                        break;

                    case 'relative':
                        const currentVolume = this.client.currentVolume || 0;
                        targetVolume = currentVolume + value;
                        console.log(`Adjusting volume: ${currentVolume} + ${value} = ${targetVolume}`);
                        await this.client.setVolume(targetVolume);
                        break;

                    case 'relative_step':
                        if (value > 0) {
                            await this.client.volumeUp();
                        } else if (value < 0) {
                            await this.client.volumeDown();
                        }
                        // Get the new volume after stepping
                        setTimeout(() => {
                            if (this.client) {
                                this.client.getStatus();
                            }
                        }, 500);
                        return;

                    default:
                        console.error(`Unknown volume mode: ${mode}`);
                        return;
                }

                // Update Roon immediately with the value we just set
                // Don't wait for the receiver to confirm
                if (targetVolume !== null && this.volumeControl) {
                    this.client.currentVolume = targetVolume;
                    this.volumeControl.update_state({
                        volume_value: targetVolume
                    });
                }

                // Verify the actual value from receiver after a delay
                setTimeout(() => {
                    if (this.client) {
                        this.client.getStatus();
                    }
                }, 1000);

            } catch (error) {
                console.error('Error setting volume:', error);
            }
        }, 200);
    }

    /**
     * Handle mute change requests from Roon
     */
    async handleSetMute(req) {
        if (!this.client) {
            console.error('Client not initialized');
            return;
        }

        const action = req.body.action;
        console.log(`Mute change request: action=${action}`);

        try {
            const shouldMute = action === 'mute';
            await this.client.setMute(shouldMute);
        } catch (error) {
            console.error('Error setting mute:', error);
        }
    }

    /**
     * Update volume state in Roon
     */
    updateVolumeState(volume) {
        if (this.volumeControl) {
            this.volumeControl.update_state({
                volume_value: volume
            });
        }
    }

    /**
     * Update mute state in Roon
     */
    updateMuteState(mute) {
        if (this.volumeControl) {
            this.volumeControl.update_state({
                is_muted: mute
            });
        }
    }

    /**
     * Update settings and reinitialize
     */
    updateSettings(newSettings) {
        console.log('Updating volume control settings');
        this.initialize();
    }

    /**
     * Clean up resources
     */
    destroy() {
        if (this.client) {
            this.client.destroy();
            this.client = null;
        }

        if (this.volumeControl) {
            this.volumeControl.destroy();
            this.volumeControl = null;
        }
    }
}

module.exports = VolumeControl;
