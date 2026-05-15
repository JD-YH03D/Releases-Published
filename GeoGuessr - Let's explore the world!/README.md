<div align="center">

![bintang toba](public/image/hero.png)

<h1> Bintang Toba Pro</h1>
</div>

# Bintang Toba Pro

**Version:** 1.8.0
**Version:** 1.7.1  
**License:** MIT  
**Platform:** Tampermonkey / Greasemonkey Userscript

A professional geography game assistant designed for GeoGuessr, WorldGuessr, OpenGuessr, FreeGuessr, and GeoDuels. Provides real-time location detection, interactive mini-map, and advanced automation features.

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Installation](#installation)
- [Usage](#usage)
- [Hotkeys](#hotkeys)
- [Settings Panel](#settings-panel)
- [Supported Platforms](#supported-platforms)
- [Technical Details](#technical-details)
- [Troubleshooting](#troubleshooting)
- [Disclaimer](#disclaimer)

---

## Overview

Bintang Toba Pro is an advanced browser extension that enhances geography-based gaming experience through intelligent coordinate detection, reverse geocoding, and interactive mapping capabilities. The extension operates entirely client-side and integrates seamlessly with supported gaming platforms.

### Key Capabilities

- Real-time coordinate extraction from multiple data sources
- Interactive mini-map with zoom controls
- Automated marker placement
- Address lookup via Nominatim API
- Discord webhook integration
- Customizable hotkey system

---

## Features

### Coordinate Detection

The extension employs multiple extraction methods to ensure reliable coordinate detection:

1. **XHR Interception** - Captures coordinates directly from Google Maps API responses
2. **React Fiber Analysis** - Extracts data from React component tree
3. **Iframe Parsing** - Reads location parameters from embedded maps
4. **Canvas Detection** - Identifies StreetView instances
5. **URL Parameter Analysis** - Parses location data from URL queries
6. **Global State Access** - Reads exposed game state variables

### Mini Map

- **Interactive Display** - Full-featured Leaflet-based map
- **Zoom Controls** - Manual zoom in/out with level indicator
- **Auto-Update** - Marker position updates in real-time
- **Coordinate Overlay** - Current position displayed on map

### Automation

- **Auto Marker** - Automatically places marker when coordinates are detected
- **Safe Mode** - Applies random offset (0-4 meters) for natural-looking scores
- **Round Detection** - Automatically resets on new round detection

### Integration

- **Discord Webhooks** - Send location data to Discord channels
- **Google Maps** - Quick open current location in Google Maps
- **Clipboard** - One-click coordinate copying

### User Interface

- **Tabbed Settings Panel** - Organized configuration interface
- **Status Indicator** - Real-time status display (Ready, Refreshing, Waiting)
- **Compact Design** - Non-intrusive overlay panels
- **Fixed Dimensions** - Consistent panel sizing across all tabs

---

## Installation

### Prerequisites

- Modern web browser (Chrome, Firefox, Edge, Safari)
- Tampermonkey or Greasemonkey extension installed

### Step-by-Step Installation

1. **Install Userscript Manager**
   - Chrome/Edge: Install [Tampermonkey](https://www.tampermonkey.net/)
   - Firefox: Install [Greasemonkey](https://www.greasespot.net/) or Tampermonkey
   - Safari: Install [Tampermonkey](https://www.tampermonkey.net/)

2. **Install the Script**
   - Open Tampermonkey dashboard
   - Click "Create a new script"
   - Copy the entire content of `GeoHelper_Pro.user.js`
   - Paste into the editor
   - Press Ctrl+S to save
   - Enable the script (toggle should be green)

3. **Verify Installation**
   - Navigate to a supported platform (e.g., geoguessr.com)
   - Press `V` to open the info panel
   - If the panel appears, installation was successful

### Update Instructions

To update to a newer version:

1. Open Tampermonkey dashboard
2. Find "Bintang Toba Pro" in the script list
3. Click the script name to open editor
4. Replace all content with the new version
5. Save (Ctrl+S)
6. Refresh the game page

---

## Usage

### Basic Operations

1. **Open Info Panel** - Press `V` to view location data and mini-map
2. **Open Settings** - Press `Tab` to configure hotkeys and features
3. **Place Marker** - Press `M` for manual placement or enable auto-marker
4. **Refresh Location** - Press `X` or click "Ready" status text

### Info Panel

The info panel (press `V`) displays:

- **Header** - Extension name and status indicator
- **Coordinates Section** - Current latitude and longitude
- **Location Section** - Reverse-geocoded address with country flag
- **Mini Map** - Interactive map with current position marker
- **Zoom Controls** - Plus/minus buttons with zoom level display
- **Action Buttons** - Quick access to Google Maps and clipboard

### Settings Panel

The settings panel (press `Tab`) contains three tabs:

#### Main Tab
- Current location display
- Auto Marker toggle
- Safe Mode toggle
- Save/Reset buttons

#### Hotkeys Tab
- All 11 configurable hotkeys
- Click input field and press desired key
- Supports modifier keys (Ctrl, Alt, Shift)

#### Extra Tab
- Discord webhook URL configuration

---

## Hotkeys

### Default Key Bindings

| Key | Function | Description |
|-----|----------|-------------|
| `Tab` | Settings Panel | Open/close settings interface |
| `V` | Info Panel | Toggle location info display |
| `M` | Manual Marker | Place marker on game map |
| `X` | Refresh | Reset for next round |
| `1` | Auto Place | Place marker (exact position) |
| `2` | Safe Place | Place marker (with offset) |
| `S` | Zoom In | Increase mini-map zoom level |
| `A` | Zoom Out | Decrease mini-map zoom level |
| `C` | Copy Coords | Copy coordinates to clipboard |
| `G` | Google Maps | Open location in Google Maps |
| `D` | Discord | Send location to Discord webhook |

### Customizing Hotkeys

1. Open settings panel (`Tab`)
2. Navigate to "Hotkeys" tab
3. Click on any hotkey input field
4. Press the desired key or key combination
5. Click "Save" to apply changes

**Supported Modifiers:**
- `Ctrl` - Control key
- `Alt` - Alt key
- `Shift` - Shift key
- `Meta` - Command (Mac) or Windows key

**Examples:**
- `Ctrl+M` - Manual marker with Control modifier
- `Shift+V` - Info panel with Shift modifier
- `Space` - Spacebar as hotkey

---

## Settings Panel

### Auto Features

#### Auto Marker
When enabled, automatically places a marker on the game map as soon as coordinates are detected. Only triggers once per round to prevent multiple placements.

**Recommended Use:** Enable for speed runs or when quick placement is needed.

#### Safe Mode
Applies a random offset (0-4 meters) to coordinates before placing marker. This results in scores between 4500-5000 instead of perfect 5000, making gameplay appear more natural.

**Recommended Use:** Enable when playing in competitive environments where perfect scores may raise suspicion.

### Discord Integration

Configure a Discord webhook URL to send location data to a Discord channel.

**Webhook Format:**
```
https://discord.com/api/webhooks/[ID]/[TOKEN]
```

**Message Content:**
- Location title
- Formatted address with Google Maps link
- Coordinates field
- Platform identifier
- Timestamp

---

## Supported Platforms

| Platform | URL Pattern | Support Level |
|----------|-------------|---------------|
| GeoGuessr | `*.geoguessr.com` | Full |
| OpenGuessr | `openguessr.com` | Full |
| WorldGuessr | `*.worldguessr.com`, `*.worldguessr.net` | Full |
| FreeGuessr | `freeguessr.com`, `*.freeguessr.com` | Full |
| GeoDuels | `geoduels.io`, `*.geoduels.io` | Full |
| GuessWhere | `guesswhereyouare.com` | Full |

### Platform-Specific Notes

**GeoGuessr:**
- Uses React Fiber extraction as primary method
- XHR interception as backup
- Most reliable coordinate detection

**OpenGuessr / WorldGuessr:**
- Iframe-based extraction
- Leaflet map integration
- May require additional load time

**FreeGuessr:**
- React Fiber latLong extraction
- Similar structure to GeoGuessr
- Fast coordinate detection

---

## Technical Details

### Architecture

```
Bintang Toba Pro
├── Configuration Module
│   ├── Hotkey management
│   └── Feature toggles
├── Detection Module
│   ├── XHR interception
│   ├── React Fiber walker
│   ├── Iframe parser
│   └── Canvas detector
├── Mapping Module
│   ├── Leaflet integration
│   ├── Google Maps integration
│   └── Marker management
├── UI Module
│   ├── Info panel
│   ├── Settings panel
│   └── Status indicators
└── Integration Module
    ├── Discord webhooks
    ├── Nominatim API
    └── Clipboard API
```

### Data Flow

1. **Detection Phase**
   - XHR interceptor monitors API calls
   - React Fiber walker scans component tree
   - Iframe parser extracts location parameters
   - Coordinates stored in global state

2. **Processing Phase**
   - Coordinates validated (lat/lng range check)
   - Address lookup queued (rate-limited)
   - Mini-map marker updated
   - UI components refreshed

3. **Output Phase**
   - Display updated with coordinates
   - Status text reflects current state
   - Optional: Discord webhook triggered
   - Optional: Auto-marker placed

### API Rate Limiting

**Nominatim (OpenStreetMap):**
- Maximum 1 request per second
- Queue-based request management
- Automatic retry on failure
- Platform-aware timing (1000ms for GeoGuessr, 1500ms for others)

### Memory Management

The extension implements proper cleanup to prevent memory leaks:

- **Interval Management** - All `setInterval` calls tracked and cleared
- **Event Listener Cleanup** - All listeners removed on page unload
- **DOM Element Removal** - Injected elements properly removed
- **Map Instance Cleanup** - Leaflet instances properly destroyed

### Security Features

- **XSS Protection** - All user input escaped before DOM insertion
- **URL Validation** - Discord webhook URLs validated before use
- **HTTPS Enforcement** - All external requests use HTTPS
- **No External Dependencies** - All code runs locally

---

## Troubleshooting

### Common Issues

#### "No coordinates found" message

**Possible Causes:**
- Game has not fully loaded
- Coordinate extraction methods failed
- Platform not supported

**Solutions:**
1. Wait 5-10 seconds for game to load completely
2. Refresh the page and try again
3. Check browser console for error messages
4. Verify you are on a supported platform

#### Mini-map not displaying

**Possible Causes:**
- Leaflet library failed to load
- Network connectivity issue
- Browser extension conflict

**Solutions:**
1. Check internet connection
2. Disable other browser extensions temporarily
3. Clear browser cache
4. Reinstall the userscript

#### Hotkeys not responding

**Possible Causes:**
- Hotkey conflict with browser
- Input field is focused
- Script disabled

**Solutions:**
1. Ensure script is enabled in Tampermonkey
2. Change conflicting hotkey in settings
3. Make sure no input field is focused
4. Check browser extension shortcuts

#### Discord webhook not sending

**Possible Causes:**
- Invalid webhook URL
- Network error
- Discord API rate limit

**Solutions:**
1. Verify webhook URL format
2. Test webhook in Discord server settings
3. Check browser console for error messages
4. Wait a few seconds before retrying

### Console Commands

Open browser console (F12) to view debug information:

```javascript
// Check current coordinates
console.log(state.coords);

// Check loaded features
console.log(state.features);

// Force coordinate extraction
extractCoordinates();

// Force address lookup
lookupAddress(lat, lng);
```

### Getting Help

If issues persist:

1. Open browser console (F12)
2. Navigate to the game page
3. Copy all console output
4. Document the issue and steps to reproduce
5. Submit with console logs for assistance

---

## Disclaimer

This extension is provided for educational purposes only. The developers are not responsible for any misuse of this software or any consequences resulting from its use.

### Terms of Service

Users are responsible for:
- Compliance with platform terms of service
- Appropriate use of automation features
- Consequences of account actions

### Privacy

This extension:
- Does not collect personal data
- Does not transmit usage statistics
- Stores configuration locally only
- Does not require external accounts (except optional Discord)

### License

MIT License - See LICENSE file for full terms.

---

## Version History

### v1.7.1 (Current)
- Removed unused notification function
- Added null guards for marker operations
- Fixed memory leak in settings panel
- Improved cleanup on page unload
- Added keyboard listener cleanup

### v1.7.0
- Removed popup notifications
- Added status text indicator
- Professional zoom level display
- Fixed panel dimensions

### v1.6.0
- Tabbed settings panel
- Fixed panel height
- Compact design improvements

### v1.5.0
- Auto marker feature
- Safe mode implementation
- XHR interception method
- Round detection

### v1.4.0
- Mini map integration
- Zoom controls
- Refresh functionality
- Status indicators

### v1.3.0
- Enhanced coordinate extraction
- Multiple extraction methods
- Improved reliability

### v1.0.0 - v1.2.0
- Initial release
- Basic coordinate detection
- Settings panel
- Hotkey system

---

## Credits

**Development:** Bintang Toba Pro Team  
**Inspiration:** Various open-source geography game tools  
**Libraries:** Leaflet.js, Nominatim API  

---

**Last Updated:** 2024  
**Current Version:** 1.7.1
