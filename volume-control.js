"use strict";

const MarantzClient = require('./marantz-client');

class VolumeControl {
    constructor(roon, settings) {
        this.roon = roon;
        this.settings = settings;

        // Arrays for multiple receivers
        this.clients = [];
        this.volumeControls = [];

        // Volume mapping configuration
        this.volumeConfig = {
            min: 0,       // Minimum volume
            max: 98,      // Maximum volume
            step: 0.5     // Volume step size
        };

        // Debounce timers per receiver (Map: index -> timer)
        this.volumeDebounceTimers = new Map();
    }

    /**
     * Initialize volume controls for all configured receivers
     */
    initialize() {
        const receivers = this.settings.getReceivers();

        if (receivers.length === 0) {
            console.log('No receivers configured');
            return;
        }

        // Clean up existing clients
        this.destroy();

        // Create client and volume control for each receiver
        receivers.forEach((receiver, arrayIndex) => {
            this.initializeReceiver(receiver, arrayIndex);
        });

        console.log(`Initialized ${receivers.length} receiver(s)`);
    }

    /**
     * Initialize a single receiver
     */
    initializeReceiver(receiver, index) {
        console.log(`Initializing receiver ${index + 1}: ${receiver.device_name} at ${receiver.ip_address}:${receiver.port}`);

        // Create client with label for logging
        const client = new MarantzClient(
            receiver.ip_address,
            receiver.port,
            receiver.device_name
        );

        // Provide suppression callback to client
        client.shouldSuppressUpdates = () => false;

        // Set up event handlers (capture index via closure)
        client.on('volumeChanged', (volume) => {
            this.updateVolumeState(index, volume);
        });

        client.on('muteChanged', (mute) => {
            this.updateMuteState(index, mute);
        });

        client.on('error', (error) => {
            console.error(`Receiver ${index + 1} (${receiver.device_name}) error:`, error.message);
        });

        // Store client
        this.clients[index] = client;

        // Register volume control with Roon
        this.registerVolumeControl(receiver, index, client);

        // Initial status check
        client.getStatus();

        // Poll every 5 seconds to catch external volume changes
        client.startPolling(5);
    }

    /**
     * Register a volume control device with Roon
     */
    registerVolumeControl(receiver, index, client) {
        // Create volume control state
        const state = {
            display_name: receiver.device_name,
            volume_type: 'number',
            volume_min: this.volumeConfig.min,
            volume_max: this.volumeConfig.max,
            volume_step: this.volumeConfig.step,
            volume_value: client.currentVolume || 0,
            is_muted: client.currentMute || false,
            control_key: `receiver_${receiver.index}`
        };

        // Register with Roon
        const volumeControl = this.roon.services.RoonApiVolumeControl.new_device({
            state: state,
            set_volume: (req) => this.handleSetVolume(req, index),
            set_mute: (req) => this.handleSetMute(req, index)
        });

        this.volumeControls[index] = volumeControl;
        console.log(`Volume control registered: ${receiver.device_name}`);
    }

    /**
     * Handle volume change requests from Roon
     */
    async handleSetVolume(req, index) {
        const client = this.clients[index];
        if (!client) {
            console.error(`Client ${index} not initialized`);
            return;
        }

        const mode = req.body.mode;
        const value = req.body.value;

        console.log(`Volume change request for receiver ${index + 1}: mode=${mode}, value=${value}`);

        // Clear any pending debounce timer for this receiver
        if (this.volumeDebounceTimers.has(index)) {
            clearTimeout(this.volumeDebounceTimers.get(index));
        }

        // Debounce rapid volume changes - wait 200ms after last change
        const timer = setTimeout(async () => {
            this.volumeDebounceTimers.delete(index);

            try {
                let targetVolume = null;

                switch (mode) {
                    case 'absolute':
                        targetVolume = value;
                        console.log(`Setting volume to: ${targetVolume}`);
                        await client.setVolume(targetVolume);
                        break;

                    case 'relative':
                        const currentVolume = client.currentVolume || 0;
                        targetVolume = currentVolume + value;
                        console.log(`Adjusting volume: ${currentVolume} + ${value} = ${targetVolume}`);
                        await client.setVolume(targetVolume);
                        break;

                    case 'relative_step':
                        if (value > 0) {
                            await client.volumeUp();
                        } else if (value < 0) {
                            await client.volumeDown();
                        }
                        // Get the new volume after stepping
                        setTimeout(() => {
                            if (this.clients[index]) {
                                this.clients[index].getStatus();
                            }
                        }, 500);
                        return;

                    default:
                        console.error(`Unknown volume mode: ${mode}`);
                        return;
                }

                // Update Roon immediately with the value we just set
                // Don't wait for the receiver to confirm
                if (targetVolume !== null && this.volumeControls[index]) {
                    client.currentVolume = targetVolume;
                    this.volumeControls[index].update_state({
                        volume_value: targetVolume
                    });
                }

                // Verify the actual value from receiver after a delay
                setTimeout(() => {
                    if (this.clients[index]) {
                        this.clients[index].getStatus();
                    }
                }, 1000);

            } catch (error) {
                console.error('Error setting volume:', error);
            }
        }, 200);

        this.volumeDebounceTimers.set(index, timer);
    }

    /**
     * Handle mute change requests from Roon
     */
    async handleSetMute(req, index) {
        const client = this.clients[index];
        if (!client) {
            console.error(`Client ${index} not initialized`);
            return;
        }

        const action = req.body.action;
        console.log(`Mute change request for receiver ${index + 1}: action=${action}`);

        try {
            const shouldMute = action === 'mute';
            await client.setMute(shouldMute);
        } catch (error) {
            console.error('Error setting mute:', error);
        }
    }

    /**
     * Update volume state in Roon
     */
    updateVolumeState(index, volume) {
        if (this.volumeControls[index]) {
            this.volumeControls[index].update_state({
                volume_value: volume
            });
        }
    }

    /**
     * Update mute state in Roon
     */
    updateMuteState(index, mute) {
        if (this.volumeControls[index]) {
            this.volumeControls[index].update_state({
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
        // Clear all debounce timers
        for (const timer of this.volumeDebounceTimers.values()) {
            clearTimeout(timer);
        }
        this.volumeDebounceTimers.clear();

        // Destroy all clients
        this.clients.forEach((client) => {
            if (client) {
                client.destroy();
            }
        });
        this.clients = [];

        // Destroy all volume controls
        this.volumeControls.forEach((vc) => {
            if (vc) {
                vc.destroy();
            }
        });
        this.volumeControls = [];
    }
}

module.exports = VolumeControl;
