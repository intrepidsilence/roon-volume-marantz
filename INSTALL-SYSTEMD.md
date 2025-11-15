# Installing as a systemd Service

Follow these steps to run the Roon extension automatically on system startup.

## 1. Edit the Service File

Edit `roon-marantz.service` and replace the placeholders:

```bash
# Replace YOUR_USERNAME with your actual username
User=YOUR_USERNAME

# Replace with the full path to this extension directory
WorkingDirectory=/path/to/roon-volume-marantz
```

For example:
```ini
User=pi
WorkingDirectory=/home/pi/roon-volume-marantz
```

## 2. Verify Node.js Path

Check where Node.js is installed:

```bash
which node
```

If it's not `/usr/bin/node`, update the `ExecStart` line in the service file:

```ini
ExecStart=/usr/local/bin/node app.js
```

## 3. Copy Service File

Copy the service file to the systemd directory:

```bash
sudo cp roon-marantz.service /etc/systemd/system/
```

## 4. Reload systemd

Tell systemd to reload its configuration:

```bash
sudo systemctl daemon-reload
```

## 5. Enable and Start the Service

Enable the service to start on boot:

```bash
sudo systemctl enable roon-marantz
```

Start the service now:

```bash
sudo systemctl start roon-marantz
```

## 6. Check Status

Verify the service is running:

```bash
sudo systemctl status roon-marantz
```

You should see `Active: active (running)` in green.

## 7. View Logs

View the service logs:

```bash
# View recent logs
sudo journalctl -u roon-marantz

# Follow logs in real-time
sudo journalctl -u roon-marantz -f

# View logs from the last boot
sudo journalctl -u roon-marantz -b
```

## Managing the Service

**Stop the service:**
```bash
sudo systemctl stop roon-marantz
```

**Restart the service:**
```bash
sudo systemctl restart roon-marantz
```

**Disable auto-start on boot:**
```bash
sudo systemctl disable roon-marantz
```

**Re-enable after disabling:**
```bash
sudo systemctl enable roon-marantz
```

## Troubleshooting

### Service fails to start

1. Check the logs:
   ```bash
   sudo journalctl -u roon-marantz -n 50
   ```

2. Verify the paths in the service file are correct
3. Make sure Node.js is installed and the path is correct
4. Ensure the extension directory has the correct permissions

### Extension not appearing in Roon

1. Wait 30 seconds for the service to fully start
2. Check if the service is actually running:
   ```bash
   sudo systemctl status roon-marantz
   ```
3. Check the logs for errors
4. Verify your Roon Core and the Linux system are on the same network

### After updating the extension

After making changes to the extension code, restart the service:

```bash
sudo systemctl restart roon-marantz
```

After modifying the service file itself:

```bash
sudo cp roon-marantz.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl restart roon-marantz
```
