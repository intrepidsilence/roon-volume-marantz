# Quick Start Guide

Get your Roon extension up and running in 5 minutes!

## Step 1: Install Dependencies

```bash
npm install
```

## Step 2: Update Configuration (Optional)

Edit `config.json` to customize the extension metadata:

```json
{
  "extension_id": "com.example.roon.marantz-denon-http",
  "display_name": "Denon/Marantz HTTP Volume Control",
  "display_version": "1.0.0",
  "publisher": "Your Name",
  "email": "your@email.com",
  "description": "Volume control for Denon and Marantz receivers using HTTP API"
}
```

## Step 3: Start the Extension

```bash
node app.js
```

You should see:
```
Roon Extension for Denon/Marantz HTTP Volume Control
Extension ID: com.example.roon.marantz-denon-http
Version: 1.0.0
Waiting for Roon Core...
```

## Step 4: Enable in Roon

1. Open Roon on your device
2. Go to **Settings** (gear icon)
3. Click **Extensions**
4. Find **Denon/Marantz HTTP Volume Control**
5. Click **Enable**

## Step 5: Configure the Extension

1. In the Extensions list, click on **Denon/Marantz HTTP Volume Control**
2. Click **Settings**
3. Enter your receiver's settings:
   - **IP Address**: e.g., `192.168.1.100`
   - **Refresh Interval**: `2` (seconds)
   - **Volume Type**: `dB (-79.5 to 0)` (recommended)
   - **Device Name**: e.g., `Living Room Receiver`
4. Click **Save**

## Step 6: Assign to a Zone

1. Go to **Settings** → **Audio** in Roon
2. Find your audio output device
3. Click on it to open settings
4. Under **Volume Control**, select:
   - **Use Device Volume Control**
   - Choose your receiver from the dropdown
5. Done!

## Testing

To verify it's working:

1. Play some music in Roon to the configured zone
2. Use the volume slider in Roon - you should see the receiver respond
3. Change volume on the receiver - Roon should update within a few seconds
4. Try the mute button in Roon

## Troubleshooting

### Can't find the extension in Roon?
- Make sure `node app.js` is still running
- Check that your computer and Roon Core are on the same network

### Receiver not responding?
- Verify the IP address is correct
- Test the HTTP API in a browser:
  ```
  http://YOUR_RECEIVER_IP:8080/goform/formMainZone_MainZoneXmlStatusLite.xml
  ```

### Need help?
- Check the full [README.md](README.md) for detailed documentation
- Look at the console output for error messages

## Next Steps

Once everything is working:
- Consider running the extension as a service (see README.md)
- Adjust the refresh interval based on your preference
- Experiment with different volume types to find what works best for you

Enjoy controlling your Denon/Marantz receiver from Roon!
