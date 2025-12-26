"use strict";

const RoonApi = require('node-roon-api');
const RoonApiStatus = require('node-roon-api-status');
const RoonApiVolumeControl = require('node-roon-api-volume-control');
const SettingsManager = require('./settings');
const VolumeControl = require('./volume-control');
const fs = require('fs');
const path = require('path');

// Load extension configuration
const configPath = path.join(__dirname, 'config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

// Initialize Roon API
const roon = new RoonApi({
    extension_id: config.extension_id,
    display_name: config.display_name,
    display_version: config.display_version,
    publisher: config.publisher,
    email: config.email,
    website: 'https://github.com/yourusername/roon-extension-marantz-denon-http',

    core_paired: (core) => {
        console.log('Paired with Roon Core:', core.display_name);
        updateStatus('Connected to Roon Core');

        // Initialize volume control when paired
        if (volumeControl) {
            volumeControl.initialize();
        }
    },

    core_unpaired: (core) => {
        console.log('Unpaired from Roon Core:', core.display_name);
        updateStatus('Not connected to Roon Core');

        // Clean up volume control
        if (volumeControl) {
            volumeControl.destroy();
        }
    }
});

// Initialize status service
const svc_status = new RoonApiStatus(roon);

function updateStatus(message, isError = false) {
    svc_status.set_status(message, isError);
}

function updateStatusFromSettings(settingsManager) {
    const receivers = settingsManager.getReceivers();
    if (receivers.length === 0) {
        updateStatus('Not configured - please set IP address', true);
        return;
    }

    if (receivers.length === 1) {
        updateStatus(`Configured for ${receivers[0].ip_address}`);
        return;
    }

    updateStatus(`Configured for ${receivers.length} receivers`);
}

// Initialize settings manager
const settingsManager = new SettingsManager(roon);
const svc_settings = settingsManager.initialize((newSettings) => {
    console.log('Settings changed:', newSettings);

    // Update volume control with new settings
    if (volumeControl) {
        volumeControl.updateSettings(newSettings);
    }

    // Update status
    updateStatusFromSettings(settingsManager);
});

// Initialize RoonApiVolumeControl service
const svc_volume_control = new RoonApiVolumeControl(roon);

// Make the service available to VolumeControl
roon.services = {
    RoonApiVolumeControl: svc_volume_control
};

// Initialize volume control
const volumeControl = new VolumeControl(roon, settingsManager);

// Initialize Roon services
roon.init_services({
    required_services: [],
    optional_services: [],
    provided_services: [
        svc_status,
        svc_settings,
        svc_volume_control
    ]
});

// Check initial configuration
const initialReceivers = settingsManager.getReceivers();
if (initialReceivers.length === 0) {
    updateStatus('Not configured - please set IP address in settings', true);
} else {
    updateStatus('Starting up...');
}

// Start Roon discovery
roon.start_discovery();

console.log('Roon Extension for Denon/Marantz HTTP Volume Control');
console.log('Extension ID:', config.extension_id);
console.log('Version:', config.display_version);
console.log('Waiting for Roon Core...');

// Handle shutdown gracefully
let shuttingDown = false;

process.on('SIGINT', () => {
    if (shuttingDown) {
        console.log('\nForce quit...');
        process.exit(1);
    }

    shuttingDown = true;
    console.log('\nShutting down gracefully... (press Ctrl+C again to force quit)');

    try {
        if (volumeControl) {
            volumeControl.destroy();
        }

        roon.stop_discovery();
    } catch (error) {
        console.error('Error during shutdown:', error);
    }

    // Force exit immediately - the websocket keeps the process alive
    setImmediate(() => {
        process.exit(0);
    });
});

process.on('SIGTERM', () => {
    console.log('\nShutting down...');

    try {
        if (volumeControl) {
            volumeControl.destroy();
        }

        roon.stop_discovery();
    } catch (error) {
        console.error('Error during shutdown:', error);
    }

    setImmediate(() => {
        process.exit(0);
    });
});

// Handle uncaught errors
process.on('uncaughtException', (error) => {
    console.error('Uncaught exception:', error);
    updateStatus('Error: ' + error.message, true);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled rejection at:', promise, 'reason:', reason);
    updateStatus('Error: ' + reason, true);
});
