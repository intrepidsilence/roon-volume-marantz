# Roon Extension for Denon/Marantz HTTP Volume Control

A Roon Extension that provides volume control for Denon and Marantz AV receivers using their HTTP API. This extension allows you to control receiver volume directly from Roon.

## Features

- Control Denon/Marantz receiver volume from within Roon
- Support for absolute and incremental volume control
- Mute/unmute functionality
- Real-time status synchronization
- Configurable volume scale mapping (dB, Number, or Incremental)
- Settings UI within Roon for easy configuration
- Automatic polling for receiver status updates

## Requirements

- Node.js v8.0.0 or later
- Roon Core (version 1.8 or later)
- Denon or Marantz AV receiver with network connectivity
- Receiver and Roon Extension must be on the same network

## Installation

1. Download or clone this repository:
```bash
git clone https://github.com/yourusername/roon-extension-marantz-denon-http.git
cd roon-extension-marantz-denon-http
```

2. Install dependencies:
```bash
npm install
```

3. Start the extension:
```bash
node app.js
```

4. The extension should now appear in Roon:
   - Open Roon
   - Go to **Settings** → **Extensions**
   - Find "Denon/Marantz HTTP Volume Control" and click **Enable**

## Configuration

After enabling the extension, configure it in Roon:

1. Go to **Settings** → **Extensions** → **Denon/Marantz HTTP Volume Control**
2. Click **Settings**
3. Configure the following options:

### Receiver Settings

- **IP Address**: The IP address or hostname of your Denon/Marantz receiver
  - Example: `192.168.1.100` or `receiver.local`

- **Refresh Interval**: How often (in seconds) to poll the receiver for status updates
  - Range: 1-60 seconds
  - Default: 2 seconds
  - Lower values provide more responsive updates but increase network traffic

### Volume Control Settings

- **Volume Type**: How volume is displayed and controlled in Roon
  - **dB (-79.5 to 0)**: Standard decibel scale, typical for audio equipment
  - **Number (0 to 99)**: Numeric scale from 0-99 (maps to -79.5 to +19.5 dB)
  - **Incremental (up/down only)**: Only allows volume up/down, no absolute control

- **Device Name**: The name that appears in Roon when assigning this volume control
  - Example: "Living Room Receiver" or "Marantz SR7013"
  - This helps identify the device when you have multiple zones

## Usage

### Assigning to a Zone

1. In Roon, go to **Settings** → **Audio**
2. Find the audio device/zone you want to control
3. Click on the device
4. Under **Volume Control**, select **Use Device Volume Control**
5. Choose your configured Denon/Marantz device from the dropdown

### Controlling Volume

Once configured, you can control the receiver volume:
- Use the volume slider in Roon
- Use volume up/down buttons
- Mute/unmute from Roon interface
- Changes made directly on the receiver will be reflected in Roon

## Denon/Marantz HTTP API

This extension uses the Denon/Marantz HTTP API on port 8080. The following commands are supported:

### Volume Commands

- **Volume Up**: `http://{IP}:8080/goform/formiPhoneAppDirect.xml?MVUP`
- **Volume Down**: `http://{IP}:8080/goform/formiPhoneAppDirect.xml?MVDN`
- **Set Volume to 50**: `http://{IP}:8080/goform/formiPhoneAppDirect.xml?MV50`
- **Mute On**: `http://{IP}:8080/goform/formiPhoneAppDirect.xml?MUON`
- **Mute Off**: `http://{IP}:8080/goform/formiPhoneAppDirect.xml?MUOFF`

### Status Queries

- **Main Zone Status**: `http://{IP}:8080/goform/formMainZone_MainZoneXmlStatusLite.xml`
- **Device Info**: `http://{IP}:8080/goform/Deviceinfo.xml`

## Project Structure

```
roon-extension-marantz-denon-http/
├── app.js                  # Main application entry point
├── config.json            # Extension configuration
├── package.json           # Node.js dependencies
├── marantz-client.js      # HTTP API client for Denon/Marantz
├── volume-control.js      # Roon volume control implementation
├── settings.js            # Settings manager for Roon UI
└── README.md              # This file
```

## Troubleshooting

### Extension not appearing in Roon

- Ensure the extension is running (`node app.js`)
- Check that your computer and Roon Core are on the same network
- Look for the extension in **Settings** → **Extensions**
- Check the console output for any error messages

### Cannot control volume

- Verify the IP address is correct in settings
- Ensure the receiver is powered on and connected to the network
- Test the HTTP API directly in a web browser:
  ```
  http://YOUR_RECEIVER_IP:8080/goform/formMainZone_MainZoneXmlStatusLite.xml
  ```
- Check that port 8080 is not blocked by a firewall
- Verify the receiver's network settings allow HTTP control

### Volume changes not reflected in Roon

- Increase the refresh interval in settings (try 1 second)
- Check the console output for polling errors
- Ensure no other applications are controlling the receiver simultaneously

### Receiver becomes unresponsive

- Reduce the refresh interval (try 5 seconds)
- Check your network connection quality
- Some receivers may have rate limiting on the HTTP API

## Running as a Service

### Linux (systemd)

Create a service file at `/etc/systemd/system/roon-marantz.service`:

```ini
[Unit]
Description=Roon Denon/Marantz Volume Control
After=network.target

[Service]
Type=simple
User=your-username
WorkingDirectory=/path/to/roon-extension-marantz-denon-http
ExecStart=/usr/bin/node app.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl enable roon-marantz
sudo systemctl start roon-marantz
```

### macOS (launchd)

Create a plist file at `~/Library/LaunchAgents/com.roon.marantz.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.roon.marantz</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/node</string>
        <string>/path/to/roon-extension-marantz-denon-http/app.js</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
</dict>
</plist>
```

Load the service:
```bash
launchctl load ~/Library/LaunchAgents/com.roon.marantz.plist
```

### Docker

Build and run with Docker:

```bash
docker build -t roon-marantz .
docker run -d --name roon-marantz --network host roon-marantz
```

## Development

### Testing the HTTP Client

You can test the Marantz client independently:

```javascript
const MarantzClient = require('./marantz-client');

const client = new MarantzClient('192.168.1.100');

client.on('volumeChanged', (volume) => {
    console.log('Volume changed:', volume);
});

client.on('muteChanged', (mute) => {
    console.log('Mute changed:', mute);
});

client.startPolling(2);

// Test commands
setTimeout(() => client.volumeUp(), 2000);
setTimeout(() => client.setMute(true), 4000);
setTimeout(() => client.setMute(false), 6000);
```

## Known Limitations

- Only supports Main Zone control (Zone 2 support may be added in future)
- The receiver can only accept one HTTP control connection at a time
- Very rapid volume changes may be rate-limited by the receiver
- Maximum volume is capped at 0 dB by default for safety

## License

This project is licensed under the **Apache License 2.0** - see below for details.

Copyright 2025 Michael Spurlock

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.

## Credits and Attributions

This extension is built using the following open source projects:

### Roon API
- **Project**: [node-roon-api](https://github.com/RoonLabs/node-roon-api)
- **License**: Apache License 2.0
- **Copyright**: RoonLabs LLC
- **Usage**: Core API for Roon extension development, including volume control, settings, and status services

### Other Acknowledgments
- Inspired by [roon-extension-denon](https://github.com/docbobo/roon-extension-denon) by Doc Bobo
- Denon/Marantz HTTP API documentation from [cheat.readthedocs.io](https://cheat.readthedocs.io/en/latest/denon.html)

## Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

## Support

For issues and questions:
- Check the troubleshooting section above
- Review the [Roon Community Forums](https://community.roonlabs.com/)
- Submit an issue on GitHub
