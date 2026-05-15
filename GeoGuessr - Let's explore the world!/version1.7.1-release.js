// ==UserScript==
// @name         GeoGuessr - Let's explore the world!
// @namespace    https://github.com/JD-YH03D/release
// @version      1.7.1
// @description  Universal geography game assistant with Mini Map - GeoGuessr, WorldGuessr, OpenGuessr, FreeGuessr
// @author       Bintang Toba Pro
// @license      MIT
// @match        *://*.geoguessr.com/*
// @match        *://openguessr.com/*
// @match        *://*.worldguessr.com/*
// @match        *://*.worldguessr.net/*
// @match        *://freeguessr.com/*
// @match        *://geoduels.io/*
// @match        *://guesswhereyouare.com/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_xmlhttpRequest
// @connect      nominatim.openstreetmap.org
// @connect      discord.com
// @run-at       document-idle
// @icon         https://www.geoguessr.com/favicon.ico
// @downloadURL https://update.greasyfork.org/scripts/578278/GeoGuessr%20-%20Let%27s%20explore%20the%20world%21.user.js
// @updateURL https://update.greasyfork.org/scripts/578278/GeoGuessr%20-%20Let%27s%20explore%20the%20world%21.meta.js
// ==/UserScript==

/* global google, L,jshint esversion: 11, */
/* eslint-disable no-unused-vars */
/*
┌───────────────────────────────────────────────────────────┐
| Key   | Function       | Description                      |
| ----- | -------------- | -------------------------------- |
| `Tab` | Settings Panel | Open/close settings interface    |
| `V`   | Info Panel     | Toggle location info display     |
| `M`   | Manual Marker  | Place marker on game map         |
| `X`   | Refresh        | Reset for next round             |
| `1`   | Auto Place     | Place marker (exact position)    |
| `2`   | Safe Place     | Place marker (with offset)       |
| `S`   | Zoom In        | Increase mini-map zoom level     |
| `A`   | Zoom Out       | Decrease mini-map zoom level     |
| `C`   | Copy Coords    | Copy coordinates to clipboard    |
| `G`   | Google Maps    | Open location in Google Maps     |
| `D`   | Discord        | Send location to Discord webhook |
└───────────────────────────────────────────────────────────┘
*/

(function() {
    'use strict';

    // ==================== CONFIG ====================
    const CONFIG = {
        NAME: 'Bintang Toba Pro',
        VERSION: '1.7.1',
        NOMINATIM_URL: 'https://nominatim.openstreetmap.org/reverse',
        DISCORD_STORAGE_KEY: 'bintang_toba_discord_webhook',
        HOTKEYS_STORAGE_KEY: 'bintang_toba_hotkeys',
        DEFAULT_HOTKEYS: {
            panel: 'Tab',
            marker: 'M',
            info: 'V',
            refresh: 'X',
            zoomIn: 'S',
            zoomOut: 'A',
            copyCoords: 'C',
            googleMaps: 'G',
            discord: 'D',
            autoPlace: '1',
            safePlace: '2'
        },
        FEATURES_STORAGE_KEY: 'bintang_toba_features',
        DEFAULT_FEATURES: {
            autoMarker: false,
            safeMode: false
        }
    };

    // ==================== STATE ====================
    let state = {
        platform: null,
        coords: { lat: null, lng: null },
        address: null,
        gameMap: null,
        marker: null,
        panel: null,
        infoVisible: false,
        hotkeys: null,
        features: null,
        miniMap: null,
        miniMapMarker: null,
        miniMapVisible: false,
        markerPlacedThisRound: false
    };

    // Cleanup tracking for memory management
    let monitoringInterval = null;

    // XHR Interception for coordinate extraction (from Release.js)
    let interceptedCoords = { lat: null, lng: null };
    const originalOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(method, url) {
        if (method.toUpperCase() === 'POST' &&
            (url.startsWith('https://maps.googleapis.com/$rpc/google.internal.maps.mapsjs.v1.MapsJsInternalService/GetMetadata') ||
             url.startsWith('https://maps.googleapis.com/$rpc/google.internal.maps.mapsjs.v1.MapsJsInternalService/SingleImageSearch'))) {

            this.addEventListener('load', function () {
                try {
                    const interceptedResult = this.responseText;
                    const pattern = /-?\d+\.\d+,-?\d+\.\d+/g;
                    const matches = interceptedResult.match(pattern);
                    if (matches && matches.length > 0) {
                        const split = matches[0].split(",");
                        const lat = Number.parseFloat(split[0]);
                        const lng = Number.parseFloat(split[1]);
                        if (isValidCoord(lat, lng)) {
                            interceptedCoords = { lat, lng };
                            log('📡 XHR intercepted coordinates:', lat.toFixed(6), lng.toFixed(6));
                        }
                    }
                } catch (e) {
                    // Silent - parsing failed
                }
            });
        }
        return originalOpen.apply(this, arguments);
    };

    // ==================== HELPER FUNCTIONS ====================

    function log(...args) {
        console.log('[BintangTobaPro]', ...args);
    }

    // XSS safe text escaping
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = String(text);
        return div.innerHTML;
    }

    // showNotification removed - using status text instead

    function safeGM_getValue(key, defaultValue) {
        try {
            if (typeof GM_getValue !== 'undefined') {
                const val = GM_getValue(key);
                return val !== undefined ? val : defaultValue;
            }
            const stored = localStorage.getItem(key);
            return stored !== null ? JSON.parse(stored) : defaultValue;
        } catch (e) {
            return defaultValue;
        }
    }

    function safeGM_setValue(key, value) {
        try {
            if (typeof GM_setValue !== 'undefined') {
                GM_setValue(key, value);
            } else {
                localStorage.setItem(key, JSON.stringify(value));
            }
        } catch (e) {
            console.error('[BintangTobaPro] Storage error:', e);
        }
    }

    function detectPlatform() {
        const url = window.location.href.toLowerCase();
        if (url.includes('geoguessr')) return 'geoguessr';
        if (url.includes('worldguessr')) return 'worldguessr';
        if (url.includes('openguessr')) return 'openguessr';
        if (url.includes('freeguessr') || url.includes('guesswhereyouare')) return 'freeguessr';
        if (url.includes('geoduel')) return 'geoduels';
        return 'unknown';
    }

    function isValidCoord(lat, lng) {
        return typeof lat === 'number' && typeof lng === 'number' &&
               !isNaN(lat) && !isNaN(lng) &&
               lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
    }

    // ==================== COORDINATE EXTRACTION ====================

    // Get coordinates from XHR interception (Release.js method)
    function getInterceptedCoords() {
        if (isValidCoord(interceptedCoords.lat, interceptedCoords.lng)) {
            return { lat: interceptedCoords.lat, lng: interceptedCoords.lng };
        }
        return null;
    }

    // Deep walk React Fiber tree to find streetview/panorama object
    function walkFiber(fiber, depth = 0) {
        if (!fiber || depth > 15) return null;

        try {
            // Check memoizedProps for panorama/streetview objects
            const props = fiber.memoizedProps;
            if (props) {
                // Direct panorama object
                if (props.panorama?.location?.latLng) return props.panorama;
                // Map with streetview
                if (props.streetView?.location?.latLng) return props.streetView;
                // Nested in children
                if (props.children?.props?.panorama?.location?.latLng) return props.children.props.panorama;
            }

            // Check updateQueue for effects with deps
            const queue = fiber.updateQueue;
            if (queue?.lastEffect) {
                let effect = queue.lastEffect;
                const seen = new Set();
                do {
                    if (seen.has(effect)) break;
                    seen.add(effect);
                    if (effect.deps) {
                        for (const dep of effect.deps) {
                            if (dep?.location?.latLng) return dep;
                        }
                    }
                    effect = effect.next;
                } while (effect && effect !== queue.lastEffect);
            }

            // Walk sibling and return
            const fromSibling = walkFiber(fiber.sibling, depth + 1);
            if (fromSibling) return fromSibling;

            const fromReturn = walkFiber(fiber.return, depth + 1);
            if (fromReturn) return fromReturn;

        } catch (e) {
            // Silent - fiber walking can throw
        }
        return null;
    }

    // Extract from Google Maps StreetView on the page
    function extractFromGoogleSV() {
        try {
            // Try to find any StreetView instance via Google Maps API
            const canvases = document.querySelectorAll('.widget-scene-canvas, canvas[class*="scene"]');
            for (const canvas of canvases) {
                let el = canvas;
                // Walk up to find the panorama container
                for (let i = 0; i < 10 && el; i++) {
                    el = el.parentElement;
                    if (!el) break;
                    const fiberKey = Object.keys(el).find(k => k.startsWith('__reactFiber'));
                    if (fiberKey) {
                        const sv = walkFiber(el[fiberKey], 0);
                        if (sv?.location?.latLng) {
                            const lat = typeof sv.location.latLng.lat === 'function'
                                ? sv.location.latLng.lat() : sv.location.latLng.lat;
                            const lng = typeof sv.location.latLng.lng === 'function'
                                ? sv.location.latLng.lng() : sv.location.latLng.lng;
                            if (isValidCoord(lat, lng)) return { lat, lng };
                        }
                    }
                }
            }
        } catch (e) {
            // Silent
        }
        return null;
    }

    let lastExtractLog = 0;

    function extractCoordinates() {
        try {
            // ── Method 0: XHR Interception (Release.js method - fastest) ──
            const fromXHR = getInterceptedCoords();
            if (fromXHR) {
                return fromXHR;
            }

            // ── Method 1: GeoGuessr - React Fiber ──
            if (state.platform === 'geoguessr') {
                // 1a. Try data-qa="panorama" container
                const panorama = document.querySelector('div[data-qa="panorama"]');
                if (panorama) {
                    const fiberKey = Object.keys(panorama).find(k => k.startsWith('__reactFiber'));
                    if (fiberKey) {
                        const fiber = panorama[fiberKey];

                        // Try known paths first (fast)
                        const paths = [
                            fiber.return?.return?.return?.sibling?.memoizedProps?.panorama,
                            fiber.return?.return?.return?.return?.sibling?.memoizedProps?.panorama,
                            fiber.return?.updateQueue?.lastEffect?.deps?.[0],
                            fiber.return?.return?.updateQueue?.lastEffect?.deps?.[0],
                            fiber.child?.memoizedProps?.panorama,
                            fiber.return?.memoizedProps?.panorama,
                        ];

                        for (const sv of paths) {
                            if (sv?.location?.latLng) {
                                const lat = typeof sv.location.latLng.lat === 'function'
                                    ? sv.location.latLng.lat() : sv.location.latLng.lat;
                                const lng = typeof sv.location.latLng.lng === 'function'
                                    ? sv.location.latLng.lng() : sv.location.latLng.lng;
                                if (isValidCoord(lat, lng)) {
                                    return { lat, lng };
                                }
                            }
                        }

                        // Fallback: deep walk fiber tree
                        const sv = walkFiber(fiber, 0);
                        if (sv?.location?.latLng) {
                            const lat = typeof sv.location.latLng.lat === 'function'
                                ? sv.location.latLng.lat() : sv.location.latLng.lat;
                            const lng = typeof sv.location.latLng.lng === 'function'
                                ? sv.location.latLng.lng() : sv.location.latLng.lng;
                            if (isValidCoord(lat, lng)) {
                                return { lat, lng };
                            }
                        }
                    }
                }

                // 1b. Try Google Maps StreetView canvas approach
                const fromSV = extractFromGoogleSV();
                if (fromSV) return fromSV;
            }

            // ── Method 2: Iframe with location parameter ──
            const iframes = document.querySelectorAll('iframe');
            for (const iframe of iframes) {
                const src = iframe.src || iframe.getAttribute('data-src') || '';
                if (!src || src.length < 10) continue;

                try {
                    const baseUrl = src.startsWith('http') ? src : window.location.origin + src;
                    const url = new URL(baseUrl);

                    // location=lat,lng
                    const location = url.searchParams.get('location');
                    if (location) {
                        const parts = location.split(',');
                        if (parts.length >= 2) {
                            const lat = parseFloat(parts[0]);
                            const lng = parseFloat(parts[1]);
                            if (isValidCoord(lat, lng)) return { lat, lng };
                        }
                    }

                    // lat=...&lng=... or lat=...&lon=...
                    const iLat = url.searchParams.get('lat');
                    const iLng = url.searchParams.get('lng') || url.searchParams.get('lon');
                    if (iLat && iLng) {
                        const lat = parseFloat(iLat);
                        const lng = parseFloat(iLng);
                        if (isValidCoord(lat, lng)) return { lat, lng };
                    }

                    // cbll=lat,lng (Google StreetView embed)
                    const cbll = url.searchParams.get('cbll');
                    if (cbll) {
                        const parts = cbll.split(',');
                        if (parts.length >= 2) {
                            const lat = parseFloat(parts[0]);
                            const lng = parseFloat(parts[1]);
                            if (isValidCoord(lat, lng)) return { lat, lng };
                        }
                    }

                    // viewpoint=lat,lng
                    const viewpoint = url.searchParams.get('viewpoint');
                    if (viewpoint) {
                        const parts = viewpoint.split(',');
                        if (parts.length >= 2) {
                            const lat = parseFloat(parts[0]);
                            const lng = parseFloat(parts[1]);
                            if (isValidCoord(lat, lng)) return { lat, lng };
                        }
                    }
                } catch (e) {
                    continue;
                }
            }

            // ── Method 3: FreeGuessr / React Fiber latLong ──
            const freeGuessrSelectors = ['.iframeWithStreetView', '[class*="streetview"]', '[class*="panorama"]'];
            for (const selector of freeGuessrSelectors) {
                const el = document.querySelector(selector);
                if (!el) continue;
                const fiberKey = Object.keys(el).find(k => k.startsWith('__reactFiber'));
                if (!fiberKey) continue;

                const fiber = el[fiberKey];

                // Try latLong prop
                const latLong = fiber.return?.memoizedProps?.latLong
                    || fiber.return?.return?.memoizedProps?.latLong
                    || fiber.memoizedProps?.latLong;
                if (Array.isArray(latLong) && latLong.length === 2) {
                    const lat = latLong[0];
                    const lng = latLong[1];
                    if (isValidCoord(lat, lng)) return { lat, lng };
                }

                // Try coordinates prop
                const coordinates = fiber.return?.memoizedProps?.coordinates
                    || fiber.return?.return?.memoizedProps?.coordinates;
                if (coordinates) {
                    const lat = coordinates.lat || coordinates.latitude;
                    const lng = coordinates.lng || coordinates.lon || coordinates.longitude;
                    if (isValidCoord(lat, lng)) return { lat, lng };
                }
            }

            // ── Method 4: Google StreetView canvas (all platforms) ──
            if (state.platform !== 'geoguessr') {
                const fromSV = extractFromGoogleSV();
                if (fromSV) return fromSV;
            }

            // ── Method 5: URL parameters ──
            const urlParams = new URLSearchParams(window.location.search);
            const lat = urlParams.get('lat');
            const lng = urlParams.get('lng') || urlParams.get('lon');
            if (lat && lng) {
                const parsedLat = parseFloat(lat);
                const parsedLng = parseFloat(lng);
                if (isValidCoord(parsedLat, parsedLng)) {
                    return { lat: parsedLat, lng: parsedLng };
                }
            }

            // ── Method 6: Window/global game state ──
            try {
                const safeWin = (typeof unsafeWindow !== 'undefined') ? unsafeWindow : window;
                // Some games expose coords globally
                if (safeWin.__gameState?.coords) {
                    const c = safeWin.__gameState.coords;
                    if (isValidCoord(c.lat, c.lng)) return { lat: c.lat, lng: c.lng };
                }
                if (safeWin.gameCoordinates) {
                    const c = safeWin.gameCoordinates;
                    if (isValidCoord(c.lat, c.lng)) return { lat: c.lat, lng: c.lng };
                }
            } catch (e) {
                // Silent - not all platforms expose globals
            }

        } catch (e) {
            console.error('[BintangTobaPro] Extract error:', e);
        }

        // Log only once every 5 seconds to avoid console spam
        const now = Date.now();
        if (now - lastExtractLog > 5000) {
            lastExtractLog = now;
            log('No coordinates found (platform:', state.platform, ')');
        }
        return null;
    }

    // ==================== ADDRESS LOOKUP ====================

    let addressQueue = [];
    let addressProcessing = false;
    let lastAddressCall = 0;

    async function lookupAddress(lat, lng) {
        return new Promise((resolve, reject) => {
            if (!isValidCoord(lat, lng)) {
                reject(new Error('Invalid coordinates'));
                return;
            }

            addressQueue.push({ lat, lng, resolve, reject });
            processAddressQueue();
        });
    }

    function processAddressQueue() {
        if (addressProcessing || addressQueue.length === 0) return;

        const now = Date.now();
        const minInterval = state.platform === 'geoguessr' ? 1000 : 1500;
        const elapsed = now - lastAddressCall;

        if (elapsed >= minInterval) {
            addressProcessing = true;
            const { lat, lng, resolve, reject } = addressQueue.shift();

            const url = `${CONFIG.NOMINATIM_URL}?lat=${lat}&lon=${lng}&format=json&accept-language=en`;

            if (typeof GM_xmlhttpRequest !== 'undefined') {
                GM_xmlhttpRequest({
                    method: 'GET',
                    url: url,
                    headers: { 'Accept': 'application/json' },
                    onload: (res) => {
                        lastAddressCall = Date.now();
                        addressProcessing = false;
                        if (res.status === 200) {
                            try {
                                resolve(JSON.parse(res.responseText));
                            } catch (e) {
                                reject(e);
                            }
                        } else {
                            reject(new Error(`HTTP ${res.status}`));
                        }
                        setTimeout(processAddressQueue, minInterval);
                    },
                    onerror: (e) => {
                        lastAddressCall = Date.now();
                        addressProcessing = false;
                        reject(e);
                        setTimeout(processAddressQueue, minInterval);
                    }
                });
            } else {
                fetch(url, { headers: { 'Accept': 'application/json' } })
                    .then(res => {
                        lastAddressCall = Date.now();
                        addressProcessing = false;
                        if (res.ok) return res.json();
                        throw new Error(`HTTP ${res.status}`);
                    })
                    .then(data => resolve(data))
                    .catch(e => reject(e))
                    .finally(() => {
                        setTimeout(processAddressQueue, minInterval);
                    });
            }
        } else {
            setTimeout(processAddressQueue, minInterval - elapsed);
        }
    }

    function formatAddress(addr) {
        if (!addr?.address) return null;
        const a = addr.address;
        const parts = [
            a.road || a.street,
            a.city || a.town || a.village,
            a.state || a.province,
            a.country
        ].filter(Boolean);
        return parts.join(', ') || a.country || 'Unknown';
    }

    // ==================== MAP MARKER ====================

    // Apply safe mode offset to coordinates
    function applySafeMode(coords) {
        if (!state.features || !state.features.safeMode) {
            return coords;
        }

        // Add random offset 0-4 meters (makes score 4500-5000 instead of perfect 5000)
        const sway = [Math.random() > 0.5, Math.random() > 0.5];
        const multiplier = Math.random() * 4;
        const horizontalAmount = Math.random() * multiplier;
        const verticalAmount = Math.random() * multiplier;

        let lat = coords.lat;
        let lng = coords.lng;

        sway[0] ? lat += verticalAmount : lat -= verticalAmount;
        sway[1] ? lng += horizontalAmount : lng -= horizontalAmount;

        return { lat, lng };
    }

    function toggleMarker(forceCoords = null) {
        const coords = forceCoords || extractCoordinates();
        if (!coords || !isValidCoord(coords.lat, coords.lng)) {
            log('No valid coordinates');
            return false;
        }

        // Apply safe mode if enabled
        const finalCoords = applySafeMode(coords);

        // Remove existing marker
        if (state.marker) {
            try {
                if (typeof google !== 'undefined' && google.maps && state.marker.setMap) {
                    state.marker.setMap(null);
                } else if (typeof L !== 'undefined' && state.gameMap) {
                    state.gameMap.removeLayer(state.marker);
                }
            } catch (e) {
                log('Marker removal error:', e.message);
            }
            state.marker = null;
            log('Marker removed');
            return false;
        }

        // Add Google Maps marker
        if (typeof google !== 'undefined' && google.maps && state.gameMap) {
            state.marker = new google.maps.Marker({
                position: new google.maps.LatLng(finalCoords.lat, finalCoords.lng),
                map: state.gameMap,
                icon: {
                    path: google.maps.SymbolPath.CIRCLE,
                    scale: 8,
                    fillColor: '#ff4444',
                    fillOpacity: 1,
                    strokeColor: '#ffffff',
                    strokeWeight: 2
                }
            });
            log('Marker added (Google Maps)', state.features.safeMode ? '[Safe Mode]' : '[Exact]');
            return true;
        }

        // Add Leaflet marker
        if (typeof L !== 'undefined' && state.gameMap) {
            state.marker = L.marker([finalCoords.lat, finalCoords.lng]).addTo(state.gameMap);
            log('Marker added (Leaflet)', state.features.safeMode ? '[Safe Mode]' : '[Exact]');
            return true;
        }

        log('No map available');
        return false;
    }

    // Auto place marker (called when coordinates detected + auto marker enabled)
    function autoPlaceMarker() {
        if (!state.features || !state.features.autoMarker) return;
        if (state.markerPlacedThisRound) return; // Only once per round

        const coords = extractCoordinates();
        if (!coords || !isValidCoord(coords.lat, coords.lng)) return;

        // Check if map is ready
        if (!state.gameMap) {
            findMapInstance();
            if (!state.gameMap) return;
        }

        // Place marker
        const success = toggleMarker(coords);
        if (success) {
            state.markerPlacedThisRound = true;
            log('🎯 Auto marker placed', state.features.safeMode ? '(Safe Mode)' : '(Exact)');
        }
    }

    function findMapInstance() {
        try {
            // React Fiber approach
            const containers = document.querySelectorAll(
                "[class*='guess-map_canvas'], .leaflet-container, [class*='mapCanvas']"
            );

            for (const container of containers) {
                const fiberKey = Object.keys(container).find(k => k.startsWith('__reactFiber'));
                if (fiberKey) {
                    const fiber = container[fiberKey];
                    state.gameMap = fiber.return?.memoizedProps?.map ||
                                   fiber.return?.return?.memoizedProps?.map ||
                                   fiber.child?.memoizedProps?.value?.map ||
                                   null;
                    if (state.gameMap) {
                        log('Map found via React Fiber');
                        return true;
                    }
                }
            }
        } catch (e) {
            console.error('[BintangTobaPro] Map find error:', e);
        }
        return false;
    }

    // ==================== INFO DISPLAY WITH MINI MAP ====================

    function createInfoDisplay() {
        const display = document.createElement('div');
        display.id = 'geohelper-info';
        display.style.cssText = `
            position: fixed;
            top: 80px;
            left: 10px;
            width: 280px;
            background: rgba(15,15,20,0.95);
            color: #fff;
            border-radius: 10px;
            font-family: 'Segoe UI', Arial, sans-serif;
            font-size: 12px;
            z-index: 999998;
            display: none;
            box-shadow: 0 4px 20px rgba(0,0,0,0.5);
            border: 1px solid rgba(255,255,255,0.1);
            overflow: hidden;
        `;

        display.innerHTML = `
            <!-- Header: Bintang Toba Pro + Status -->
            <div style="display:flex;justify-content:space-between;align-items:center;padding:7px 12px;background:rgba(255,255,255,0.04);border-bottom:1px solid rgba(255,255,255,0.08);">
                <div style="display:flex;align-items:center;gap:6px;">
                    <span style="width:6px;height:6px;border-radius:50%;background:#4ade80;flex-shrink:0;"></span>
                    <span style="font-weight:700;font-size:11px;color:#ccc;">Bintang Toba Pro</span>
                </div>
                <div id="geohelper-status-text" style="font-size:10px;color:#4ade80;font-weight:600;cursor:pointer;" title="Click to refresh">Ready</div>
            </div>

            <!-- Info Content -->
            <div id="geohelper-info-content" style="padding:8px 12px;">
                <div style="color:#888;">Waiting for location data...</div>
            </div>

            <!-- Mini Map -->
            <div id="geohelper-minimap-container" style="width:280px;height:200px;border-top:1px solid rgba(255,255,255,0.08);position:relative;">
                <div id="geohelper-minimap" style="width:100%;height:100%;"></div>
                <!-- Zoom Controls (inside map, right side) -->
                <div style="position:absolute;top:6px;right:6px;display:flex;flex-direction:column;gap:2px;z-index:1000;">
                    <button id="geohelper-zoom-in" style="width:24px;height:24px;background:rgba(0,0,0,0.75);border:1px solid rgba(255,255,255,0.25);color:#fff;border-radius:3px 3px 0 0;cursor:pointer;font-size:14px;font-weight:bold;line-height:1;">+</button>
                    <button id="geohelper-zoom-out" style="width:24px;height:24px;background:rgba(0,0,0,0.75);border:1px solid rgba(255,255,255,0.25);border-top:none;color:#fff;border-radius:0 0 3px 3px;cursor:pointer;font-size:14px;font-weight:bold;line-height:1;">−</button>
                    <div id="geohelper-zoom-level" style="width:24px;text-align:center;background:rgba(0,0,0,0.65);color:#aaa;font-size:9px;font-family:monospace;padding:2px 0;border-radius:3px;margin-top:2px;">x2</div>
                </div>
                <!-- Coordinates Overlay -->
                <div id="geohelper-coords-overlay" style="position:absolute;bottom:6px;left:6px;background:rgba(0,0,0,0.7);padding:2px 6px;border-radius:3px;font-family:monospace;font-size:9px;color:#4ade80;z-index:1000;">
                    --, --
                </div>
            </div>
        `;

        document.body.appendChild(display);
        return display;
    }

    function initMiniMap() {
        if (typeof L === 'undefined') {
            log('Leaflet not available, loading from CDN...');

            // Load Leaflet CSS
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
            document.head.appendChild(link);

            // Load Leaflet JS
            const script = document.createElement('script');
            script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
            script.onload = () => {
                log('Leaflet loaded successfully');
                setTimeout(() => setupMiniMap(), 100);
            };
            document.head.appendChild(script);
            return;
        }

        setupMiniMap();
    }

    function setupMiniMap() {
        if (state.miniMap || typeof L === 'undefined') return;

        try {
            // Create mini map
            state.miniMap = L.map('geohelper-minimap', {
                zoomControl: false,
                attributionControl: false,
                zoomAnimation: true,
                fadeAnimation: true
            });

            // Add tile layer (OpenStreetMap)
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                maxZoom: 19
            }).addTo(state.miniMap);

            // Set initial view
            state.miniMap.setView([0, 0], 2);

            log('Mini map initialized');

            const zoomLevel = document.getElementById('geohelper-zoom-level');

            // Setup zoom controls with level display
            document.getElementById('geohelper-zoom-in').onclick = () => {
                if (state.miniMap) {
                    state.miniMap.zoomIn();
                    if (zoomLevel) zoomLevel.textContent = 'x' + state.miniMap.getZoom();
                }
            };

            document.getElementById('geohelper-zoom-out').onclick = () => {
                if (state.miniMap) {
                    state.miniMap.zoomOut();
                    if (zoomLevel) zoomLevel.textContent = 'x' + state.miniMap.getZoom();
                }
            };

            // Update zoom level on map zoom events
            state.miniMap.on('zoomend', () => {
                if (zoomLevel) zoomLevel.textContent = 'x' + state.miniMap.getZoom();
            });

            // Setup status text (click = refresh)
            const statusText = document.getElementById('geohelper-status-text');
            if (statusText) {
                statusText.onclick = () => {
                    refreshLocation();
                };
            }

        } catch (e) {
            console.error('[BintangTobaPro] Mini map setup error:', e);
        }
    }

    function updateMiniMap() {
        if (!state.miniMap) return;

        const coords = extractCoordinates();
        if (!coords || !isValidCoord(coords.lat, coords.lng)) return;

        // Update or create marker
        if (state.miniMapMarker) {
            state.miniMapMarker.setLatLng([coords.lat, coords.lng]);
        } else {
            state.miniMapMarker = L.marker([coords.lat, coords.lng]).addTo(state.miniMap);
        }

        // Update map view
        state.miniMap.setView([coords.lat, coords.lng], 12);

        // Update coordinates overlay
        const overlay = document.getElementById('geohelper-coords-overlay');
        if (overlay) {
            overlay.textContent = `${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}`;
        }

        // Invalidate size to fix rendering
        setTimeout(() => {
            if (state.miniMap) {
                state.miniMap.invalidateSize();
            }
        }, 100);
    }

    function updateStatusText(text, color) {
        const el = document.getElementById('geohelper-status-text');
        if (el) {
            el.textContent = text;
            el.style.color = color;
        }
    }

    function refreshLocation() {
        log('Refreshing location for next round...');

        // Update status
        updateStatusText('Refreshing...', '#fbbf24');

        // Reset state
        state.coords = { lat: null, lng: null };
        state.address = null;
        state.markerPlacedThisRound = false;
        interceptedCoords = { lat: null, lng: null };

        // Remove mini map marker safely
        if (state.miniMapMarker && state.miniMap) {
            try {
                state.miniMap.removeLayer(state.miniMapMarker);
            } catch (e) {
                log('Mini map marker removal warning:', e.message);
            }
            state.miniMapMarker = null;
        }

        // Reset mini map view safely
        if (state.miniMap) {
            try {
                state.miniMap.setView([0, 0], 2);
            } catch (e) {
                log('Mini map reset warning:', e.message);
            }
            const overlay = document.getElementById('geohelper-coords-overlay');
            if (overlay) overlay.textContent = '--, --';
            const zoomLevel = document.getElementById('geohelper-zoom-level');
            if (zoomLevel) zoomLevel.textContent = 'x2';
        }

        // Update info display
        updateInfoDisplay();

        // Re-extract coordinates after short delay
        setTimeout(async () => {
            const newCoords = extractCoordinates();
            if (newCoords && isValidCoord(newCoords.lat, newCoords.lng)) {
                state.coords = newCoords;
                try {
                    state.address = await lookupAddress(newCoords.lat, newCoords.lng);
                } catch (e) {
                    log('Address lookup failed after refresh');
                }
                updateInfoDisplay();
                updateMiniMap();
                updateStatusText('Ready', '#4ade80');
            } else {
                updateStatusText('Waiting...', '#888');
                // Keep trying
                setTimeout(() => {
                    const retry = extractCoordinates();
                    if (retry && isValidCoord(retry.lat, retry.lng)) {
                        updateStatusText('Ready', '#4ade80');
                    }
                }, 3000);
            }
        }, 2000);
    }

    async function updateInfoDisplay() {
        let display = document.getElementById('geohelper-info');
        if (!display) {
            display = createInfoDisplay();
        }

        const content = document.getElementById('geohelper-info-content');
        if (!content) return;

        if (state.infoVisible) {
            // Use fresh extraction first, fallback to cached state.coords
            const freshCoords = extractCoordinates();
            const coords = (freshCoords && isValidCoord(freshCoords.lat, freshCoords.lng))
                ? freshCoords
                : (isValidCoord(state.coords.lat, state.coords.lng) ? state.coords : null);

            let html = '';

            if (coords && isValidCoord(coords.lat, coords.lng)) {
                state.coords = coords;

                html += `<div style="margin-bottom:8px;">
                    <div style="color:#888;font-size:10px;margin-bottom:2px;">COORDINATES</div>
                    <div style="color:#4ade80;font-family:monospace;font-size:11px;background:rgba(74,222,128,0.1);padding:5px 8px;border-radius:4px;">
                        ${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}
                    </div>
                </div>`;

                if (!state.address) {
                    try {
                        state.address = await lookupAddress(coords.lat, coords.lng);
                    } catch (e) {
                        log('Address lookup pending...');
                    }
                }
            } else {
                html += `<div style="margin-bottom:8px;">
                    <div style="color:#ef4444;font-size:11px;background:rgba(239,68,68,0.1);padding:5px 8px;border-radius:4px;">
                        ⚠️ Waiting for location...
                    </div>
                </div>`;
            }

            if (state.address) {
                const formatted = formatAddress(state.address);
                const countryCode = state.address.address?.country_code;

                html += `<div style="margin-bottom:8px;">
                    <div style="color:#888;font-size:10px;margin-bottom:2px;">LOCATION</div>
                    <div style="color:#fbbf24;font-size:11px;line-height:1.4;">${escapeHtml(formatted)}</div>
                    ${countryCode ? `<div style="margin-top:4px;"><img src="https://flagcdn.com/20x15/${countryCode.toLowerCase()}.png" style="vertical-align:middle;border-radius:2px;" alt="${escapeHtml(countryCode)}"/> <span style="color:#888;font-size:10px;">${escapeHtml(countryCode.toUpperCase())}</span></div>` : ''}
                </div>`;
            }

            if (coords && isValidCoord(coords.lat, coords.lng)) {
                html += `<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">
                    <a href="https://www.google.com/maps?q=${coords.lat},${coords.lng}"
                       target="_blank"
                       style="background:rgba(96,165,250,0.2);color:#60a5fa;text-decoration:none;padding:5px;border-radius:4px;text-align:center;font-size:11px;border:1px solid rgba(96,165,250,0.3);"
                    >🗺️ Maps</a>
                    <button onclick="navigator.clipboard.writeText('${coords.lat}, ${coords.lng}').then(()=>alert('Copied!'))"
                       style="background:rgba(255,255,255,0.1);color:#fff;border:none;padding:5px;border-radius:4px;cursor:pointer;font-size:11px;"
                    >📋 Copy</button>
                </div>`;
            }

            content.innerHTML = html || '<div style="color:#888;">No data available</div>';
            display.style.display = 'block';
            state.miniMapVisible = true;

            // Initialize mini map after display is shown
            setTimeout(() => {
                initMiniMap();
                updateMiniMap();
            }, 200);
        } else {
            display.style.display = 'none';
            state.miniMapVisible = false;
        }
    }

    // ==================== SETTINGS PANEL WITH TABS ====================

    let activeTab = 'main';

    function createPanel() {
        const panel = document.createElement('div');
        panel.id = 'geohelper-panel';
        panel.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 320px;
            background: rgba(18,18,22,0.96);
            color: #fff;
            border-radius: 12px;
            z-index: 999999;
            font-family: 'Segoe UI', Arial, sans-serif;
            font-size: 12px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.6);
            border: 1px solid rgba(255,255,255,0.08);
            overflow: hidden;
        `;

        const savedHotkeys = safeGM_getValue(CONFIG.HOTKEYS_STORAGE_KEY, CONFIG.DEFAULT_HOTKEYS);
        const savedWebhook = safeGM_getValue(CONFIG.DISCORD_STORAGE_KEY, '');
        const savedFeatures = safeGM_getValue(CONFIG.FEATURES_STORAGE_KEY, CONFIG.DEFAULT_FEATURES);
        state.features = { ...CONFIG.DEFAULT_FEATURES, ...(savedFeatures || {}) };

        panel.innerHTML = `
            <!-- Header -->
            <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 16px;background:rgba(255,255,255,0.04);border-bottom:1px solid rgba(255,255,255,0.08);">
                <span style="font-size:14px;font-weight:700;">⚙️ Bintang Toba Pro</span>
                <button id="geohelper-close" style="background:none;border:none;color:#666;font-size:18px;cursor:pointer;padding:0;line-height:1;">×</button>
            </div>

            <!-- Tab Buttons -->
            <div id="geohelper-tabs" style="display:flex;border-bottom:1px solid rgba(255,255,255,0.08);">
                <button class="geohelper-tab" data-tab="main" style="flex:1;padding:10px 0;background:rgba(255,255,255,0.06);color:#fff;border:none;cursor:pointer;font-size:12px;font-weight:600;border-bottom:2px solid #4ade80;">🎮 Main</button>
                <button class="geohelper-tab" data-tab="hotkey" style="flex:1;padding:10px 0;background:transparent;color:#888;border:none;cursor:pointer;font-size:12px;font-weight:600;border-bottom:2px solid transparent;">⌨️ Hotkeys</button>
                <button class="geohelper-tab" data-tab="extra" style="flex:1;padding:10px 0;background:transparent;color:#888;border:none;cursor:pointer;font-size:12px;font-weight:600;border-bottom:2px solid transparent;">💬 Extra</button>
            </div>

            <!-- Tab Content Container (fixed height) -->
            <div id="geohelper-tab-container" style="height:300px;overflow-y:auto;">

            <!-- Tab: Main -->
            <div id="geohelper-tab-main" class="geohelper-tab-content" style="padding:14px 16px;height:100%;box-sizing:border-box;">
                <!-- Location -->
                <div style="margin-bottom:14px;">
                    <div style="color:#888;font-size:10px;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">📍 Current Location</div>
                    <div id="geohelper-coords-display" style="padding:8px 10px;background:rgba(0,0,0,0.3);border-radius:6px;font-family:monospace;font-size:11px;">
                        Detecting...
                    </div>
                    <button id="geohelper-maps-btn" style="width:100%;margin-top:6px;padding:8px;background:#60a5fa;color:#fff;border:none;border-radius:6px;cursor:pointer;font-weight:600;font-size:12px;">🗺️ Open Google Maps</button>
                </div>

                <!-- Auto Features -->
                <div style="margin-bottom:14px;">
                    <div style="color:#888;font-size:10px;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">🤖 Auto Features</div>
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                        <div>
                            <div style="font-weight:600;font-size:12px;">🎯 Auto Marker</div>
                            <div style="font-size:9px;color:#666;">Auto place when coords detected</div>
                        </div>
                        <label style="position:relative;display:inline-block;width:40px;height:20px;flex-shrink:0;">
                            <input type="checkbox" id="geohelper-auto-marker" ${state.features.autoMarker ? 'checked' : ''} style="opacity:0;width:0;height:0;">
                            <span id="geohelper-auto-marker-slider" style="position:absolute;cursor:pointer;top:0;left:0;right:0;bottom:0;background-color:${state.features.autoMarker ? '#4ade80' : 'rgba(255,255,255,0.2)'};transition:.3s;border-radius:20px;"></span>
                            <span id="geohelper-auto-marker-dot" style="position:absolute;height:14px;width:14px;left:${state.features.autoMarker ? '23px' : '3px'};bottom:3px;background-color:white;transition:.3s;border-radius:50%;"></span>
                        </label>
                    </div>
                    <div style="display:flex;justify-content:space-between;align-items:center;">
                        <div>
                            <div style="font-weight:600;font-size:12px;">🎲 Safe Mode</div>
                            <div style="font-size:9px;color:#666;">Random offset (4500-5000 pts)</div>
                        </div>
                        <label style="position:relative;display:inline-block;width:40px;height:20px;flex-shrink:0;">
                            <input type="checkbox" id="geohelper-safe-mode" ${state.features.safeMode ? 'checked' : ''} style="opacity:0;width:0;height:0;">
                            <span id="geohelper-safe-mode-slider" style="position:absolute;cursor:pointer;top:0;left:0;right:0;bottom:0;background-color:${state.features.safeMode ? '#4ade80' : 'rgba(255,255,255,0.2)'};transition:.3s;border-radius:20px;"></span>
                            <span id="geohelper-safe-mode-dot" style="position:absolute;height:14px;width:14px;left:${state.features.safeMode ? '23px' : '3px'};bottom:3px;background-color:white;transition:.3s;border-radius:50%;"></span>
                        </label>
                    </div>
                </div>

                <!-- Save / Reset -->
                <div style="display:flex;gap:8px;">
                    <button id="geohelper-save" style="flex:1;padding:8px;background:#4ade80;color:#000;border:none;border-radius:6px;cursor:pointer;font-weight:700;font-size:12px;">💾 Save</button>
                    <button id="geohelper-reset" style="flex:1;padding:8px;background:rgba(255,255,255,0.1);color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:12px;">🔄 Reset</button>
                </div>
            </div>

            <!-- Tab: Hotkeys -->
            <div id="geohelper-tab-hotkey" class="geohelper-tab-content" style="padding:14px 16px;display:none;height:100%;box-sizing:border-box;overflow-y:auto;">
                <div style="color:#888;font-size:10px;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">⌨️ Key Bindings</div>
                ${Object.entries(CONFIG.DEFAULT_HOTKEYS).map(([key, val]) => `
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
                        <label style="text-transform:capitalize;font-size:11px;">${key}</label>
                        <input type="text" data-hotkey="${key}" value="${savedHotkeys[key] || val}"
                               style="width:70px;text-align:center;padding:4px;border-radius:4px;border:1px solid rgba(255,255,255,0.15);background:rgba(255,255,255,0.06);color:#fff;font-size:11px;">
                    </div>
                `).join('')}
            </div>

            <!-- Tab: Extra -->
            <div id="geohelper-tab-extra" class="geohelper-tab-content" style="padding:14px 16px;display:none;height:100%;box-sizing:border-box;">
                <div style="color:#888;font-size:10px;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">💬 Discord Webhook</div>
                <input type="text" id="geohelper-webhook" value="${savedWebhook}"
                       placeholder="https://discord.com/api/webhooks/..."
                       style="width:100%;padding:8px;border-radius:4px;border:1px solid rgba(255,255,255,0.15);background:rgba(255,255,255,0.06);color:#fff;font-size:11px;box-sizing:border-box;">
            </div>

            </div><!-- Close tab container -->

            <!-- Footer -->
            <div style="padding:8px 16px;text-align:center;color:#555;font-size:10px;border-top:1px solid rgba(255,255,255,0.06);">
                ${state.platform} | v${CONFIG.VERSION}
            </div>
        `;

        document.body.appendChild(panel);
        state.panel = panel;

        // ── Tab Switching ──
        panel.querySelectorAll('.geohelper-tab').forEach(btn => {
            btn.onclick = () => {
                const tab = btn.dataset.tab;
                activeTab = tab;

                // Toggle content visibility
                panel.querySelectorAll('.geohelper-tab-content').forEach(c => c.style.display = 'none');
                const target = document.getElementById('geohelper-tab-' + tab);
                if (target) target.style.display = 'block';

                // Toggle tab button styles
                panel.querySelectorAll('.geohelper-tab').forEach(t => {
                    t.style.background = 'transparent';
                    t.style.color = '#888';
                    t.style.borderBottom = '2px solid transparent';
                });
                btn.style.background = 'rgba(255,255,255,0.06)';
                btn.style.color = '#fff';
                btn.style.borderBottom = '2px solid #4ade80';
            };
        });

        // ── Close Button ──
        document.getElementById('geohelper-close').onclick = () => togglePanel();

        // ── Save Button ──
        document.getElementById('geohelper-save').onclick = () => {
            const newHotkeys = {};
            panel.querySelectorAll('[data-hotkey]').forEach(input => {
                newHotkeys[input.dataset.hotkey] = input.value.trim() || CONFIG.DEFAULT_HOTKEYS[input.dataset.hotkey];
            });
            safeGM_setValue(CONFIG.HOTKEYS_STORAGE_KEY, newHotkeys);
            safeGM_setValue(CONFIG.DISCORD_STORAGE_KEY, (document.getElementById('geohelper-webhook')?.value || '').trim());
            safeGM_setValue(CONFIG.FEATURES_STORAGE_KEY, state.features);

            const saveBtn = document.getElementById('geohelper-save');
            saveBtn.textContent = '✅ Saved!';
            saveBtn.disabled = true;
            setTimeout(() => { saveBtn.textContent = '💾 Save'; saveBtn.disabled = false; }, 1500);
        };

        // ── Reset Button ──
        document.getElementById('geohelper-reset').onclick = () => {
            safeGM_setValue(CONFIG.HOTKEYS_STORAGE_KEY, CONFIG.DEFAULT_HOTKEYS);
            safeGM_setValue(CONFIG.DISCORD_STORAGE_KEY, '');
            safeGM_setValue(CONFIG.FEATURES_STORAGE_KEY, CONFIG.DEFAULT_FEATURES);

            panel.querySelectorAll('[data-hotkey]').forEach(input => {
                input.value = CONFIG.DEFAULT_HOTKEYS[input.dataset.hotkey];
            });
            const webhookEl = document.getElementById('geohelper-webhook');
            if (webhookEl) webhookEl.value = '';

            state.features = { ...CONFIG.DEFAULT_FEATURES };
            const am = document.getElementById('geohelper-auto-marker');
            const sm = document.getElementById('geohelper-safe-mode');
            if (am) { am.checked = false; document.getElementById('geohelper-auto-marker-slider').style.backgroundColor = 'rgba(255,255,255,0.2)'; document.getElementById('geohelper-auto-marker-dot').style.left = '3px'; }
            if (sm) { sm.checked = false; document.getElementById('geohelper-safe-mode-slider').style.backgroundColor = 'rgba(255,255,255,0.2)'; document.getElementById('geohelper-safe-mode-dot').style.left = '3px'; }

            const resetBtn = document.getElementById('geohelper-reset');
            resetBtn.textContent = '✅ Reset!';
            setTimeout(() => { resetBtn.textContent = '🔄 Reset'; }, 1500);
        };

        // ── Hotkey Input Handling ──
        panel.querySelectorAll('[data-hotkey]').forEach(input => {
            input.addEventListener('keydown', (e) => {
                e.preventDefault();
                if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) return;
                let key = e.key;
                if (key === ' ') key = 'Space';
                if (key.length === 1) key = key.toUpperCase();
                const mods = [];
                if (e.ctrlKey) mods.push('Ctrl');
                if (e.altKey) mods.push('Alt');
                if (e.shiftKey) mods.push('Shift');
                input.value = [...mods, key].join('+');
            });
        });

        // ── Toggle: Auto Marker ──
        const amCb = document.getElementById('geohelper-auto-marker');
        if (amCb) {
            amCb.addEventListener('change', () => {
                state.features.autoMarker = amCb.checked;
                document.getElementById('geohelper-auto-marker-slider').style.backgroundColor = amCb.checked ? '#4ade80' : 'rgba(255,255,255,0.2)';
                document.getElementById('geohelper-auto-marker-dot').style.left = amCb.checked ? '23px' : '3px';
            });
        }

        // ── Toggle: Safe Mode ──
        const smCb = document.getElementById('geohelper-safe-mode');
        if (smCb) {
            smCb.addEventListener('change', () => {
                state.features.safeMode = smCb.checked;
                document.getElementById('geohelper-safe-mode-slider').style.backgroundColor = smCb.checked ? '#4ade80' : 'rgba(255,255,255,0.2)';
                document.getElementById('geohelper-safe-mode-dot').style.left = smCb.checked ? '23px' : '3px';
            });
        }

        // ── Google Maps Button ──
        document.getElementById('geohelper-maps-btn').onclick = () => {
            const coords = extractCoordinates();
            if (coords && isValidCoord(coords.lat, coords.lng)) {
                window.open(`https://www.google.com/maps?q=${coords.lat.toFixed(6)},${coords.lng.toFixed(6)}&ll=${coords.lat.toFixed(6)},${coords.lng.toFixed(6)}&z=6`, '_blank');
            } else {
                updateStatusText('No coords', '#ef4444');
            }
        };

        // ── Coords Display Update ──
        const coordsDisplay = document.getElementById('geohelper-coords-display');
        if (coordsDisplay) {
            let coordsIntervalId = null;
            const updateCoords = () => {
                // Stop updating if panel is hidden
                if (state.panel && state.panel.style.display === 'none') return;
                const coords = extractCoordinates();
                if (coords && isValidCoord(coords.lat, coords.lng)) {
                    coordsDisplay.innerHTML = `
                        <div style="color:#4ade80;">Lat: ${coords.lat.toFixed(8)}</div>
                        <div style="color:#4ade80;">Lng: ${coords.lng.toFixed(8)}</div>
                        ${state.address ? `<div style="color:#fbbf24;margin-top:6px;font-size:10px;">${formatAddress(state.address)}</div>` : ''}
                    `;
                } else {
                    coordsDisplay.innerHTML = '<span style="color:#888;">Waiting for location data...</span>';
                }
            };
            updateCoords();
            coordsIntervalId = setInterval(updateCoords, 1000);
        }
    }

    function togglePanel() {
        if (!state.panel) {
            createPanel();
        } else {
            state.panel.style.display = state.panel.style.display === 'none' ? 'block' : 'none';
        }
    }

    // ==================== DISCORD ====================

    function isValidDiscordWebhook(url) {
        if (!url || typeof url !== 'string') return false;
        try {
            const parsed = new URL(url);
            return parsed.protocol === 'https:' &&
                   parsed.hostname === 'discord.com' &&
                   parsed.pathname.includes('/api/webhooks/');
        } catch (e) {
            return false;
        }
    }

    async function sendToDiscord() {
        const webhook = safeGM_getValue(CONFIG.DISCORD_STORAGE_KEY, '');
        if (!webhook) {
            alert('Please set Discord webhook URL in settings (Tab)');
            return;
        }

        // Validate webhook URL for security
        if (!isValidDiscordWebhook(webhook)) {
            alert('Invalid Discord webhook URL. Please check your settings.');
            log('Invalid webhook URL detected');
            return;
        }

        const coords = extractCoordinates();
        if (!coords || !isValidCoord(coords.lat, coords.lng)) {
            alert('No valid coordinates');
            return;
        }

        const embed = {
            title: '📍 Location Tracked',
            description: `**${formatAddress(state.address) || 'Unknown location'}**\n\n[🗺️ Google Maps](https://www.google.com/maps?q=${coords.lat},${coords.lng})`,
            color: 516235,
            fields: [
                { name: 'Coordinates', value: `\`${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}\``, inline: true },
                { name: 'Platform', value: state.platform, inline: true }
            ],
            footer: { text: CONFIG.NAME },
            timestamp: new Date().toISOString()
        };

        try {
            if (typeof GM_xmlhttpRequest !== 'undefined') {
                GM_xmlhttpRequest({
                    method: 'POST',
                    url: webhook,
                    headers: { 'Content-Type': 'application/json' },
                    data: JSON.stringify({ embeds: [embed] })
                });
            } else {
                await fetch(webhook, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ embeds: [embed] })
                });
            }
            log('Discord message sent');
        } catch (e) {
            console.error('[BintangTobaPro] Discord error:', e);
            alert('Failed to send to Discord');
        }
    }

    // ==================== KEYBOARD HANDLER ====================

    function handleKeydown(e) {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
            return;
        }

        const hotkeys = safeGM_getValue(CONFIG.HOTKEYS_STORAGE_KEY, CONFIG.DEFAULT_HOTKEYS);
        const key = e.key.toLowerCase();

        // Panel
        if (key === hotkeys.panel.toLowerCase()) {
            e.preventDefault();
            togglePanel();
            return;
        }

        // Marker (on game map)
        if (key === hotkeys.marker.toLowerCase()) {
            e.preventDefault();
            if (!state.gameMap) findMapInstance();
            toggleMarker();
            return;
        }

        // Refresh location (when info panel is open)
        if (key === hotkeys.refresh.toLowerCase() && state.infoVisible) {
            e.preventDefault();
            e.stopPropagation();
            refreshLocation();
            return;
        }

        // Info
        if (key === hotkeys.info.toLowerCase()) {
            e.preventDefault();
            state.infoVisible = !state.infoVisible;
            updateInfoDisplay();
            return;
        }

        // Copy coords
        if (key === hotkeys.copyCoords.toLowerCase()) {
            e.preventDefault();
            const coords = extractCoordinates();
            if (coords && isValidCoord(coords.lat, coords.lng)) {
                navigator.clipboard.writeText(`${coords.lat}, ${coords.lng}`)
                    .then(() => log('Coords copied'))
                    .catch(() => log('Clipboard failed'));
            }
            return;
        }

        // Google Maps
        if (key === hotkeys.googleMaps.toLowerCase()) {
            e.preventDefault();
            e.stopPropagation();

            const coords = extractCoordinates();
            log('G pressed - Coordinates:', coords);

            if (coords && isValidCoord(coords.lat, coords.lng)) {
                const mapsUrl = `https://www.google.com/maps?q=${coords.lat.toFixed(6)},${coords.lng.toFixed(6)}&ll=${coords.lat.toFixed(6)},${coords.lng.toFixed(6)}&z=6`;
                log('Opening Google Maps:', mapsUrl);

                try {
                    const newWindow = window.open(mapsUrl, '_blank');
                    if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
                        log('Popup may be blocked, trying fallback...');
                        window.location.href = mapsUrl;
                    }
                } catch (err) {
                    console.error('[BintangTobaPro] window.open error:', err);
                    window.location.href = mapsUrl;
                }
            } else {
                log('No valid coordinates available');
                updateStatusText('No coords', '#ef4444');
            }
            return;
        }

        // Auto Place Marker (key 1)
        if (key === hotkeys.autoPlace.toLowerCase()) {
            e.preventDefault();
            e.stopPropagation();
            if (!state.gameMap) findMapInstance();
            const success = toggleMarker();
            updateStatusText(success ? 'Marked' : 'No map', success ? '#4ade80' : '#ef4444');
            return;
        }

        // Safe Place Marker (key 2)
        if (key === hotkeys.safePlace.toLowerCase()) {
            e.preventDefault();
            e.stopPropagation();
            const wasSafeMode = state.features.safeMode;
            state.features.safeMode = true;
            if (!state.gameMap) findMapInstance();
            const success = toggleMarker();
            state.features.safeMode = wasSafeMode;
            updateStatusText(success ? 'Safe Marked' : 'No map', success ? '#4ade80' : '#ef4444');
            return;
        }

        // Zoom In (Mini Map)
        if (key === hotkeys.zoomIn.toLowerCase() && state.miniMapVisible) {
            e.preventDefault();
            e.stopPropagation();
            if (state.miniMap) {
                state.miniMap.zoomIn();
            }
            return;
        }

        // Zoom Out (Mini Map)
        if (key === hotkeys.zoomOut.toLowerCase() && state.miniMapVisible) {
            e.preventDefault();
            e.stopPropagation();
            if (state.miniMap) {
                state.miniMap.zoomOut();
            }
            return;
        }

        // Discord
        if (key === hotkeys.discord.toLowerCase()) {
            e.preventDefault();
            sendToDiscord();
            return;
        }
    }

    // ==================== COORD MONITORING ====================

    let lastCoords = { lat: null, lng: null };

    function startMonitoring() {
        // Clear existing interval to prevent memory leak
        if (monitoringInterval) {
            clearInterval(monitoringInterval);
        }

        let failCount = 0;
        let lastValidCoords = null;

        monitoringInterval = setInterval(async () => {
            const coords = extractCoordinates();

            if (coords && isValidCoord(coords.lat, coords.lng)) {
                failCount = 0;
                const changed = coords.lat !== lastCoords.lat || coords.lng !== lastCoords.lng;

                if (changed) {
                    lastCoords = { lat: coords.lat, lng: coords.lng };
                    state.coords = { lat: coords.lat, lng: coords.lng };

                    log('📍 New coordinates detected:', coords.lat.toFixed(6), coords.lng.toFixed(6));

                    // Detect new round (big coordinate change = new round)
                    if (lastValidCoords) {
                        const distance = Math.abs(coords.lat - lastValidCoords.lat) + Math.abs(coords.lng - lastValidCoords.lng);
                        if (distance > 0.1) { // Significant change = new round
                            log('🔄 New round detected!');
                            state.markerPlacedThisRound = false;
                            // Remove old marker if exists
                            if (state.marker) {
                                if (typeof google !== 'undefined' && google.maps) {
                                    state.marker.setMap(null);
                                } else if (typeof L !== 'undefined') {
                                    state.gameMap.removeLayer(state.marker);
                                }
                                state.marker = null;
                            }
                        }
                    }
                    lastValidCoords = { lat: coords.lat, lng: coords.lng };

                    try {
                        state.address = await lookupAddress(coords.lat, coords.lng);
                        log('📮 Address:', formatAddress(state.address));
                    } catch (e) {
                        log('Address lookup pending...');
                    }

                    if (state.infoVisible) {
                        updateInfoDisplay();
                    }

                    // Update mini map if visible
                    if (state.miniMapVisible && state.miniMap) {
                        updateMiniMap();
                    }

                    // Auto place marker if enabled
                    autoPlaceMarker();

                    // Update marker position on game map
                    if (state.marker) {
                        try {
                            if (typeof google !== 'undefined' && state.marker.setPosition) {
                                state.marker.setPosition(new google.maps.LatLng(coords.lat, coords.lng));
                            } else if (typeof L !== 'undefined' && state.marker.setLatLng) {
                                state.marker.setLatLng([coords.lat, coords.lng]);
                            }
                        } catch (e) {
                            log('Marker position update failed');
                        }
                    }
                }
            } else {
                failCount++;
                if (failCount === 10) {
                    log('⏳ Still waiting for coordinates... (platform:', state.platform, ')');
                    failCount = 0;
                }
            }
        }, 500);
    }

    // ==================== INITIALIZATION ====================

    function init() {
        state.platform = detectPlatform();
        log('========================================');
        log('Bintang Toba Pro v' + CONFIG.VERSION);
        log('Platform:', state.platform);
        log('========================================');

        // Load saved hotkeys
        state.hotkeys = safeGM_getValue(CONFIG.HOTKEYS_STORAGE_KEY, CONFIG.DEFAULT_HOTKEYS);
        log('Hotkeys loaded:', state.hotkeys);

        // Load saved features (with safe merge for new keys)
        const loadedFeatures = safeGM_getValue(CONFIG.FEATURES_STORAGE_KEY, null);
        state.features = { ...CONFIG.DEFAULT_FEATURES, ...(loadedFeatures || {}) };
        log('Features loaded:', state.features);

        // Event listeners
        document.addEventListener('keydown', handleKeydown, true);
        log('Keyboard listener attached');

        // Start monitoring
        startMonitoring();
        log('Coordinate monitoring started');

        // Find map instance
        setTimeout(() => {
            log('Attempting to find map instance...');
            findMapInstance();
        }, 2000);

        // Add pulse animation (used in info panel header)
        const style = document.createElement('style');
        style.textContent = '@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}';
        document.head.appendChild(style);

        log('✅ Initialization complete!');
        log('📌 HOTKEYS:');
        log('   ', state.hotkeys.panel, '- Settings Panel');
        log('   ', state.hotkeys.info, '- Location Info + Mini Map');
        log('   ', state.hotkeys.marker, '- Marker on Game Map (Manual)');
        log('   ', state.hotkeys.autoPlace, '- Auto Place Marker');
        log('   ', state.hotkeys.safePlace, '- Safe Place (4500-5000 pts)');
        log('   ', state.hotkeys.refresh, '- Refresh (when info open)');
        log('   ', state.hotkeys.zoomIn, '- Zoom In Mini Map');
        log('   ', state.hotkeys.zoomOut, '- Zoom Out Mini Map');
        log('   ', state.hotkeys.copyCoords, '- Copy Coordinates');
        log('   ', state.hotkeys.googleMaps, '- Open Google Maps');
        log('   ', state.hotkeys.discord, '- Send to Discord');
        log('');
        log('🤖 AUTO FEATURES:');
        log('   Auto Marker:', state.features.autoMarker ? '✅ ON' : '❌ OFF');
        log('   Safe Mode:', state.features.safeMode ? '✅ ON' : '❌ OFF');

        log('🚀 Press', state.hotkeys.info, 'to open info panel');
    }

    // Cleanup function for page unload
    function cleanup() {
        log('Cleaning up...');

        // Clear monitoring interval
        if (monitoringInterval) {
            clearInterval(monitoringInterval);
            monitoringInterval = null;
        }

        // Remove keyboard listener
        document.removeEventListener('keydown', handleKeydown, true);

        // Remove markers safely
        if (state.marker) {
            try {
                if (typeof google !== 'undefined' && google.maps && state.marker.setMap) {
                    state.marker.setMap(null);
                } else if (typeof L !== 'undefined' && state.gameMap && state.marker) {
                    state.gameMap.removeLayer(state.marker);
                }
            } catch (e) {
                // Silent cleanup
            }
            state.marker = null;
        }

        // Remove mini map marker
        if (state.miniMapMarker && state.miniMap) {
            try {
                state.miniMap.removeLayer(state.miniMapMarker);
            } catch (e) {
                // Silent cleanup
            }
            state.miniMapMarker = null;
        }

        // Destroy mini map
        if (state.miniMap) {
            try {
                state.miniMap.off(); // Remove all event listeners
                state.miniMap.remove();
            } catch (e) {
                // Silent cleanup
            }
            state.miniMap = null;
        }

        // Remove injected DOM elements
        const infoPanel = document.getElementById('geohelper-info');
        if (infoPanel) infoPanel.remove();
        if (state.panel) { state.panel.remove(); state.panel = null; }

        log('Cleanup complete');
    }

    // Start when DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Cleanup on page unload
    window.addEventListener('beforeunload', cleanup);
    window.addEventListener('pagehide', cleanup);

})();
