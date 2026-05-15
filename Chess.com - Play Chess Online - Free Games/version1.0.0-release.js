// ==UserScript==
// @name         Bintang Toba Pro
// @namespace    Bintang-Toba-Pro
// @version      1.0.0
// @description  sistem string concatenation style - type scrip ES6
// @author       Delta-Polder-Indonesia
// @license      GPL-3.0-only
// @match        https://www.chess.com/*
// @icon         https://cdn.corenexis.com/files/c/3853186720.png
// @run-at       document-idle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_getResourceText
// @grant        GM_registerMenuCommand
// @grant        GM_info
// @grant        GM_xmlhttpRequest
// @grant        unsafeWindow
// @resource     stockfishjs  https://cdnjs.cloudflare.com/ajax/libs/stockfish.js/10.0.2/stockfish.js
// @resource     openingbook  https://raw.githubusercontent.com/Delta-Polder-Indonesia/Egine-chess-tempermonkey-pro/refs/heads/main/opening-book.JSON
// @connect      localhost
// @connect      cdnjs.cloudflare.com
// @connect      unpkg.com
// @connect      jsdelivr.net
// @connect      raw.githubusercontent.com
// @connect      drive.google.com
// @antifeature  none
// ==/UserScript==

(function () {
    "use strict";

    // =====================================================
    // Section 01: Enhanced Tampermonkey Polyfills
    // =====================================================
    let isTampermonkey = typeof GM_getValue === "function" && typeof GM_xmlhttpRequest === "function";

    if (!isTampermonkey) {
        window.GM_getValue = (key, defaultValue) => {
            try {
                const item = localStorage.getItem("tm_" + btoa(key));
                if (item === null) return defaultValue;
                let decoded;
                try {
                    decoded = atob(item);
                    return JSON.parse(decoded);
                } catch (e2) {
                    return decoded !== undefined ? decoded : defaultValue;
                }
            } catch (e) {
                return defaultValue;
            }
        };

        window.GM_setValue = (key, value) => {
            try {
                const str = typeof value === "string" ? value : JSON.stringify(value);
                localStorage.setItem("tm_" + btoa(key), btoa(str));
            } catch (e) { }
        };

        window.GM_getResourceText = (name) => {
            return "";
        };

        window.GM_registerMenuCommand = (name, fn) => {
            log("Registering menu command:", name);
            window["tmCommand_" + name.replace(/\s+/g, "_")] = fn;
        };

        window.GM_info = {
            script: {
                name: "Bintang Toba Pro",
                version: "1.0.0",
                namespace: "Bintang-Toba-Pro"
            }
        };

        window.GM_xmlhttpRequest = (details) => {
            const xhr = new XMLHttpRequest();
            const timeout = details.timeout || 10000;
            const retries = details.retries || 0;
            let attempt = 0;

            function doRequest() {
                xhr.open(details.method || "GET", details.url, true);
                xhr.timeout = timeout;
                if (details.headers) {
                    Object.keys(details.headers).forEach((k) => {
                        xhr.setRequestHeader(k, details.headers[k]);
                    });
                }
                xhr.onload = () => {
                    if (details.onload) {
                        details.onload({
                            status: xhr.status,
                            responseText: xhr.responseText,
                            finalUrl: xhr.responseURL || details.url
                        });
                    }
                };
                xhr.onerror = (e) => {
                    if (attempt < retries) {
                        attempt++;
                        scheduleManagedTimeout(doRequest, 1000 * attempt);
                    } else if (details.onerror) {
                        details.onerror(e);
                    }
                };
                xhr.ontimeout = (e) => {
                    if (details.ontimeout) details.ontimeout(e);
                    else if (details.onerror) details.onerror(e);
                };
                xhr.send(details.data || null);
            }
            doRequest();
        };

        window.GM_addStyle = (css) => {
            const style = document.createElement('style');
            style.textContent = css;
            (document.head || document.documentElement).appendChild(style);
            return style;
        };

        if (typeof unsafeWindow === "undefined") {
            try {
                if (typeof window.unsafeWindow === "undefined") {
                    Object.defineProperty(window, 'unsafeWindow', {
                        value: window.wrappedJSObject || window,
                        writable: true,
                        enumerable: false,
                        configurable: true
                    });
                }
            } catch (e) {
                if (typeof window.unsafeWindow === "undefined") {
                    try { window.unsafeWindow = window; } catch (err) { }
                }
            }
        }
    }

    // =====================================================
    // Section 02: Multi-Source Stockfish Loader
    // =====================================================
    let EngineLoader = {
        sources: [
            { url: "https://cdnjs.cloudflare.com/ajax/libs/stockfish.js/10.0.2/stockfish.js", weight: 1 },
            { url: "https://unpkg.com/stockfish.js@10.0.2/stockfish.js", weight: 1 },
            { url: "https://cdn.jsdelivr.net/npm/stockfish.js@10.0.2/stockfish.js", weight: 1 }
        ],
        stockfishSourceCode: "",
        currentSourceIndex: 0,
        loadWithFallback: function () {
            let self = this;
            return new Promise(function (resolve, reject) {
                function tryNextSource() {
                    if (self.currentSourceIndex >= self.sources.length) {
                        reject(new Error("All Stockfish sources failed"));
                        return;
                    }
                    let source = self.sources[self.currentSourceIndex++];
                    self.loadFromURL(source.url)
                        .then(function (code) {
                        self.stockfishSourceCode = code;
                        log("Stockfish loaded from:", source.url, "Size:", code.length);
                        resolve(true);
                    })
                        .catch(function (e) {
                        warn("Source failed:", source.url, e);
                        tryNextSource();
                    });
                }
                tryNextSource();
            });
        },
        loadFromURL: function (url) {
            return new Promise(function (resolve, reject) {
                let xhr = new XMLHttpRequest();
                xhr.open("GET", url, true);
                xhr.timeout = 15000;
                xhr.onload = function () {
                    if (xhr.status === 200 && xhr.responseText.length > 50000) {
                        resolve(xhr.responseText);
                    } else {
                        reject(new Error("Invalid response"));
                    }
                };
                xhr.onerror = function () { reject(new Error("Network error")); };
                xhr.ontimeout = function () { reject(new Error("Timeout")); };
                xhr.send();
            });
        },
        loadAsync: function (onProgress) {
            let self = this;
            return new Promise(function (resolve, reject) {
                if (self.stockfishSourceCode && self.stockfishSourceCode.length > 50000) {
                    resolve(true);
                    return;
                }
                try {
                    let resource = GM_getResourceText("stockfishjs");
                    if (resource && resource.length > 50000) {
                        self.stockfishSourceCode = resource;
                        resolve(true);
                        return;
                    }
                } catch (e) { }
                self.loadWithFallback().then(resolve).catch(reject);
            });
        }
    };

    // =====================================================
    // Section 03: DOM Utility Functions
    // =====================================================
    function $(sel, root) {
        return (root || document).querySelector(sel);
    }

    function $$(sel, root) {
        return Array.from((root || document).querySelectorAll(sel));
    }

    function sleep(ms) {
        return new Promise(function (resolve) {
            scheduleManagedTimeout(resolve, ms);
        });
    }

    function randomInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    function clamp(val, min, max) {
        return Math.max(min, Math.min(max, val));
    }

    function escapeHtml(text) {
        if (typeof text !== 'string') return '';
        return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    }

    // =====================================================
    // Section 04: Debug and Error Logging
    // =====================================================
    const DEBUG = true;
    function isSilentLoggingEnabled() {
        try {
            if (typeof State !== "undefined" && State && typeof State.silentLogging === "boolean") {
                return !!State.silentLogging;
            }
            return !!GM_getValue("silentLogging", false);
        } catch (e) {
            return false;
        }
    }

    const ErrorTelemetry = {
        moduleCounts: {
            engine: 0,
            ui: 0,
            premove: 0,
            syzygy: 0,
            runtime: 0,
            other: 0
        },
        recent: [],
        maxRecent: 20
    };

    function _inferErrorModule(args) {
        let text = args.map(function (x) {
            if (x === null || x === undefined) return "";
            if (typeof x === "string") return x;
            try {
                return JSON.stringify(x);
            } catch (e) {
                return String(x);
            }
        }).join(" ").toLowerCase();

        if (text.includes("syzygy")) return "syzygy";
        if (text.includes("premove")) return "premove";
        if (text.includes("engine") || text.includes("stockfish") || text.includes("worker")) return "engine";
        if (text.includes("ui") || text.includes("panel") || text.includes("render")) return "ui";
        if (text.includes("watchdog") || text.includes("loop") || text.includes("runtime")) return "runtime";
        return "other";
    }

    function reportErrorTelemetry(args) {
        try {
            let module = _inferErrorModule(args);
            if (!Object.prototype.hasOwnProperty.call(ErrorTelemetry.moduleCounts, module)) module = "other";
            ErrorTelemetry.moduleCounts[module]++;

            let msg = args.map(function (x) {
                if (x === null || x === undefined) return "";
                if (typeof x === "string") return x;
                if (x instanceof Error) return x.message || String(x);
                try {
                    return JSON.stringify(x);
                } catch (e) {
                    return String(x);
                }
            }).join(" ").trim();

            ErrorTelemetry.recent.push({
                ts: Date.now(),
                module: module,
                message: msg || "Unknown error"
            });

            if (ErrorTelemetry.recent.length > ErrorTelemetry.maxRecent) {
                ErrorTelemetry.recent = ErrorTelemetry.recent.slice(-ErrorTelemetry.maxRecent);
            }
        } catch (e) {
        }
    }

    function log() {
        if (!DEBUG || isSilentLoggingEnabled()) return;
        console.log.apply(console, ["[ChessAssistant]"].concat([...arguments]));
    }

    function warn() {
        if (!DEBUG || isSilentLoggingEnabled()) return;
        console.warn.apply(console, ["[ChessAssistant]"].concat([...arguments]));
    }

    function err() {
        reportErrorTelemetry(Array.from(arguments));
        if (isSilentLoggingEnabled()) return;
        console.error.apply(console, ["[ChessAssistant]"].concat([...arguments]));
    }

    window.addEventListener("unhandledrejection", function (e) {
        let reason = e && e.reason ? e.reason : "Unhandled promise rejection";
        let reasonText = "";
        try {
            reasonText = typeof reason === "string" ? reason : (reason && reason.message ? reason.message : String(reason));
        } catch (e2) {
            reasonText = "";
        }
        if (reason instanceof Event || reasonText === "[object Event]" || reasonText === "Event") {
            if (e && typeof e.preventDefault === "function") e.preventDefault();
            return;
        }
        if (reasonText && /UID2 shared library|UID2 API error/i.test(reasonText)) {
            if (e && typeof e.preventDefault === "function") e.preventDefault();
            return;
        }
        if (reasonText && !/ChessAssistant|userscript|tamper/i.test(reasonText)) {
            return;
        }
        err("UnhandledRejection", reason);
    });

    // =====================================================
    // Section 05: Local Error Handler
    // =====================================================
    (function attachLocalErrorHandler() {
        window.addEventListener("error", function (e) {
            if (!e || !e.filename) return;
            if (!e.filename.includes("user") && !e.filename.includes("tamper")) return;
            err(e.error || e.message);
        });
    })();

    // =====================================================
    // Section 06: Stealth Configuration
    // =====================================================
    let CONFIG = {
        MAX_HISTORY_SIZE: 50,
        MAX_ACPL_DISPLAY: 50,
        MATE_VALUE: 50000,
        MAX_BAR_CAP: 2000,
        DEFAULT_DEPTH: 15,
        MAX_DEPTH: 30,
        PANEL_WIDTH: 340,
        UPDATE_INTERVAL: 150,
        FEN_POLL_INTERVAL: 300,
        MAX_CACHE_SIZE: 500,
        STEALTH: {
            RANDOMIZE_DELAYS: true,
            JITTER_RANGE: 0.15,
            MOVE_TIME_VARIANCE: 0.25,
            HUMAN_PAUSE_PROBABILITY: 0.1,
            MAX_CONSISTENT_MOVES: 8,
            BLUNDER_INJECTION_RATE: 0.05,
            THINK_TIME_MIN: 800,
            THINK_TIME_MAX: 3500,
        },
        EVASION: {
            CLEAR_CONSOLE_LOGS: true,
            MASK_GLOBAL_VARIABLES: true,
            RANDOMIZE_CLASS_NAMES: false,
            DISABLE_RIGHT_CLICK: false,
            PREVENT_DEVTOOLS_DETECTION: true,
        },
        PREMOVE: {
            MAX_EXECUTED_FENS: 100,
            ENGINE_TIMEOUT: 8000,
            EXECUTION_TIMEOUT: 5000,
            RETRY_DELAY: 100,
            MAX_RETRIES: 2
        },
        HUMAN: {
            CRITICAL_CP_THRESHOLD: -120,
            CRITICAL_MATE_PLY: 8,
            CRITICAL_KING_ATTACKERS: 1,
            DEBUG_DECISION: false,
            LEVEL_TUNING: {
                beginner: { errorMult: 1.20, blunderMult: 1.35, criticalErrorMult: 0.75, criticalBlunderMult: 0.45, safetyRiskCap: 70 },
                casual: { errorMult: 1.10, blunderMult: 1.20, criticalErrorMult: 0.70, criticalBlunderMult: 0.35, safetyRiskCap: 65 },
                intermediate: { errorMult: 1.00, blunderMult: 1.00, criticalErrorMult: 0.55, criticalBlunderMult: 0.20, safetyRiskCap: 60 },
                advanced: { errorMult: 0.80, blunderMult: 0.70, criticalErrorMult: 0.45, criticalBlunderMult: 0.12, safetyRiskCap: 55 },
                expert: { errorMult: 0.65, blunderMult: 0.55, criticalErrorMult: 0.35, criticalBlunderMult: 0.08, safetyRiskCap: 50 }
            }
        }
    };

    let ELO_LEVELS = {
        beginner: { elo: 800, moveTime: { min: 1, max: 5 }, errorRate: 0.30, blunderRate: 0.15 },
        casual: { elo: 1200, moveTime: { min: 2, max: 8 }, errorRate: 0.20, blunderRate: 0.10 },
        intermediate: { elo: 1600, moveTime: { min: 3, max: 12 }, errorRate: 0.15, blunderRate: 0.05 },
        advanced: { elo: 2000, moveTime: { min: 5, max: 15 }, errorRate: 0.10, blunderRate: 0.03 },
        expert: { elo: 2400, moveTime: { min: 8, max: 20 }, errorRate: 0.05, blunderRate: 0.01 }
    };

    let PIECE_CHAR = {
        "br": "r",
        "bn": "n",
        "bb": "b",
        "bq": "q",
        "bk": "k",
        "bp": "p",
        "wr": "R",
        "wn": "N",
        "wb": "B",
        "wq": "Q",
        "wk": "K",
        "wp": "P"
    };

    let PIECE_VALUES = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 };

    let _OPENING_BOOK_CACHE = null;
    let _OPENING_NAMES_CACHE = null;
    let _openingBookVersion = 0;
    let _openingBookLoadState = { inFlight: false, lastAttemptTs: 0 };

    function _loadOpeningBookExternal() {
        if (_OPENING_BOOK_CACHE) return;
        if (_openingBookLoadState.inFlight) return;
        if (Date.now() - _openingBookLoadState.lastAttemptTs < 60000) return;
        _openingBookLoadState.inFlight = true;
        _openingBookLoadState.lastAttemptTs = Date.now();

        function _extractLegacyObject(text, varName) {
            let marker = "window." + varName + " =";
            let idx = text.indexOf(marker);
            if (idx === -1) return null;
            let start = text.indexOf("{", idx);
            if (start === -1) return null;
            let depth = 0, inString = false, escaped = false;
            for (let i = start; i < text.length; i++) {
                let ch = text[i];
                if (inString) {
                    if (escaped) escaped = false;
                    else if (ch === "\\") escaped = true;
                    else if (ch === '"') inString = false;
                    continue;
                }
                if (ch === '"') { inString = true; continue; }
                if (ch === "{") depth++;
                else if (ch === "}") {
                    depth--;
                    if (depth === 0) return text.slice(start, i + 1);
                }
            }
            return null;
        }

        function _parseBookPayload(text) {
            try {
                let data = JSON.parse(text);
                if (data && data.book && typeof data.book === "object") {
                    _OPENING_BOOK_CACHE = data.book;
                    _OPENING_NAMES_CACHE = data.names || null;
                    _openingBookVersion++;
                    if (typeof OpeningBook !== "undefined" && OpeningBook) OpeningBook._noEpIndex = null;
                    log("[OpeningBook] Loaded JSON " + Object.keys(_OPENING_BOOK_CACHE).length + " positions");
                    return true;
                }
            } catch (e) { }

            try {
                let bookText = _extractLegacyObject(text, "CHESS_OPENING_BOOK");
                let namesText = _extractLegacyObject(text, "CHESS_OPENING_NAMES");
                if (bookText) {
                    _OPENING_BOOK_CACHE = JSON.parse(bookText);
                    _OPENING_NAMES_CACHE = namesText ? JSON.parse(namesText) : null;
                    _openingBookVersion++;
                    if (typeof OpeningBook !== "undefined" && OpeningBook) OpeningBook._noEpIndex = null;
                    log("[OpeningBook] Loaded legacy JS " + Object.keys(_OPENING_BOOK_CACHE).length + " positions");
                    return true;
                }
            } catch (e2) {
                warn("[OpeningBook] Parse failed:", e2);
            }
            return false;
        }

        try {
            let raw = GM_getResourceText("openingbook");
            if (raw && raw.length > 200 && _parseBookPayload(raw)) {
                _openingBookLoadState.inFlight = false;
                return;
            }
        } catch (e) { }

        try {
            GM_xmlhttpRequest({
                method: "GET",
                url: "https://raw.githubusercontent.com/Delta-Polder-Indonesia/Egine-chess-tempermonkey-pro/refs/heads/main/opening-book.JSON",
                timeout: 8000,
                onload: function (r) {
                    _openingBookLoadState.inFlight = false;
                    if (r && r.status === 200 && r.responseText && r.responseText.length > 200) {
                        _parseBookPayload(r.responseText);
                    }
                },
                onerror: function () {
                    _openingBookLoadState.inFlight = false;
                    warn("[OpeningBook] Fetch failed");
                }
            });
        } catch (e2) {
            _openingBookLoadState.inFlight = false;
            warn("[OpeningBook] Request failed");
        }
    }

    let OPENING_BOOK = new Proxy({}, {
        get: function (target, prop) {
            _loadOpeningBookExternal();
            if (_OPENING_BOOK_CACHE && _OPENING_BOOK_CACHE[prop] !== undefined) return _OPENING_BOOK_CACHE[prop];
            return _OPENING_BOOK_FALLBACK[prop];
        },
        ownKeys: function () {
            _loadOpeningBookExternal();
            let keys = _OPENING_BOOK_CACHE ? Object.keys(_OPENING_BOOK_CACHE) : [];
            if (keys.length === 0) keys = Object.keys(_OPENING_BOOK_FALLBACK);
            return keys;
        },
        getOwnPropertyDescriptor: function (target, prop) { return { configurable: true, enumerable: true, value: OPENING_BOOK[prop] }; }
    });

    let OPENING_NAMES = new Proxy({}, {
        get: function (target, prop) {
            _loadOpeningBookExternal();
            if (_OPENING_NAMES_CACHE && _OPENING_NAMES_CACHE[prop] !== undefined) return _OPENING_NAMES_CACHE[prop];
            return _OPENING_NAMES_FALLBACK[prop];
        }
    });

    // Embedded fallback — 5 core positions for instant first-move response
    let _OPENING_BOOK_FALLBACK = {
        "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -": {
            "e2e4": 4, "d2d4": 3, "c2c4": 2, "g1f3": 2, "b1c3": 1
        },
        "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3": {
            "c7c5": 3, "e7e5": 3, "e7e6": 2, "c7c6": 2, "d7d5": 1
        },
        "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6": {
            "g1f3": 3, "f1c4": 2, "b1c3": 2, "d2d4": 1
        },
        "rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq d3": {
            "d7d5": 3, "g8f6": 3, "c7c5": 2, "e7e6": 2
        },
        "rnbqkbnr/pppppppp/8/8/2P5/8/PP1PPPPP/RNBQKBNR b KQkq c3": {
            "e7e5": 3, "c7c5": 2, "g8f6": 2, "e7e6": 2
        }
    };

    let _OPENING_NAMES_FALLBACK = {
        "e2e4": "King's Pawn Opening", "d2d4": "Queen's Pawn Game",
        "c2c4": "English Opening", "g1f3": "Réti Opening",
        "e7e5": "Open Game", "c7c5": "Sicilian Defense",
        "e7e6": "French Defense", "c7c6": "Caro-Kann Defense",
        "d7d5": "Scandinavian Defense", "g8f6": "Alekhine's Defense",
        "f1c4": "Italian Game", "b1c3": "Vienna Game"
    };

    // =====================================================
    // Section 07: Application State Variables
    // =====================================================
    let State = {
        autoMovePiece: GM_getValue("autoMovePiece", false),
        moveExecutionMode: GM_getValue("moveExecutionMode", "click"),
        autoRun: GM_getValue("autoRun", false),
        autoMatch: GM_getValue("autoMatch", false),
        minDelay: GM_getValue("minDelay", 0.5),
        maxDelay: GM_getValue("maxDelay", 3.0),
        eloRating: GM_getValue("eloRating", 1600),
        customDepth: GM_getValue("customDepth", CONFIG.DEFAULT_DEPTH),
        skillLevel: GM_getValue("skillLevel", 20),
        evaluationMode: GM_getValue("evaluationMode", "engine"),
        panelTop: GM_getValue("panelTop", null),
        panelLeft: GM_getValue("panelLeft", null),
        panelState: GM_getValue("panelState", "maximized"),
        onboardingAccepted: GM_getValue("onboardingAccepted", false),
        highlightColor1: GM_getValue("highlightColor1", "#eb6150"),
        highlightColor2: GM_getValue("highlightColor2", "#4287f5"),
        analysisMode: GM_getValue("analysisMode", false),
        highlightEnabled: GM_getValue("highlightEnabled", false),
        autoAnalysisColor: GM_getValue("autoAnalysisColor", "none"),
        useMainConsensus: GM_getValue("useMainConsensus", true),
        analysisBlunderGuard: GM_getValue("analysisBlunderGuard", true),
        analysisMinStableUpdates: GM_getValue("analysisMinStableUpdates", 2),
        numberOfMovesToShow: GM_getValue("numberOfMovesToShow", 5),
        clockSyncQuickDelayMs: GM_getValue("clockSyncQuickDelayMs", 300),

        premoveEnabled: GM_getValue("premoveEnabled", false),
        premoveMode: GM_getValue("premoveMode", "capture"),
        premovePieces: GM_getValue("premovePieces", { q: 1, r: 1, b: 1, n: 1, p: 1 }),
        premoveDepth: GM_getValue("premoveDepth", 5),
        premoveRiskPenaltyFactor: GM_getValue("premoveRiskPenaltyFactor", 0.5),
        premoveMinConfidence: GM_getValue("premoveMinConfidence", 5),
        premoveDelayMs: GM_getValue("premoveDelayMs", 300),

        premoveExecutedForFen: null,
        premoveAnalysisInProgress: false,
        premoveLastAnalysisTime: 0,
        premoveThrottleMs: 500,
        premoveRetryCount: 0,

        lastNewGameLogTs: 0,
        moveNumber: 1,
        incrementSeconds: 0,
        humanLevel: GM_getValue("humanLevel", "intermediate"),
        useOpeningBook: GM_getValue("useOpeningBook", true),
        showPVArrows: GM_getValue("showPVArrows", false),
        pvArrowColors: GM_getValue("pvArrowColors", {
            1: "#4287f5",
            2: "#eb6150",
            3: "#4caf50",
            4: "#9c27b0",
            5: "#f38ba8",
            6: "#fab387",
            7: "#74c7ec",
            8: "#f5c2e7",
            9: "#b4befe"
        }),
        showBestmoveArrows: GM_getValue("showBestmoveArrows", false),
        bestmoveArrowColor: GM_getValue("bestmoveArrowColor", "#f9e2af"),
        bestmoveArrowColors: GM_getValue("bestmoveArrowColors", {
            1: "#eb6150",
            2: "#89b4fa",
            3: "#a6e3a1",
            4: "#f38ba8",
            5: "#cba6f7",
            6: "#fab387",
            7: "#74c7ec",
            8: "#f5c2e7",
            9: "#b4befe"
        }),
        maxPVDepth: GM_getValue("maxPVDepth", 2),
        autoDepthAdapt: GM_getValue("autoDepthAdapt", false),

        mainPVLine: [],
        mainPVTurn: "w",
        lastRenderedMainPV: "",
        lastMainPVDrawTime: 0,
        _mainDepthByPv: {},

        analysisPVLine: [],
        analysisPVTurn: "w",
        lastRenderedAnalysisPV: "",
        lastAnalysisPVDrawTime: 0,
        _analysisDepthByPv: {},

        _lastAnalysisFen: null,
        _lastAnalysisDepth: 0,
        _lastAnalysisBestPV: [],
        _lastAnalysisBestMove: null,

        _prePremoveState: null,
        _preAnalysisState: null,
        _preSmartControlsState: null,
        _smartControlsForcedByAutoPlay: false,

        _lastScoreInfo: null,
        _lastPremoveScoreInfo: null,

        isThinking: false,
        loopStarted: false,
        gameEnded: false,
        lastAutoRunFen: null,
        currentEvaluation: 0,
        evalBarSmoothedCp: 0,
        evalBarInitialized: false,
        lastEvalDeltaCp: 0,
        _lastEvalRawCp: null,
        previousEvaluation: 0,
        currentPVTurn: "w",
        analysisStableCount: 0,
        analysisLastBestMove: "",
        analysisLastEvalCp: null,
        analysisPrevEvalCp: null,
        analysisGuardStateText: "Ready",
        mainBestHistory: [],

        totalCplWhite: 0,
        cplMoveCountWhite: 0,
        acplWhite: "0.00",
        totalCplBlack: 0,
        cplMoveCountBlack: 0,
        acplBlack: "0.00",
        acplInitialized: false,

        _analysisAutoPlayApproved: false,
        _analysisAutoPlayMove: null,

        topMoves: [],
        topMoveInfos: {},
        topMovesFen: "",
        lastTopMove1: "...",
        lastEvalText1: "0.00",
        lastMoveGrade: "Book",
        lastEvalClass1: "eval-equal",
        principalVariation: "",
        statusInfo: "",
        evalBarStatus: "Loading...",
        isAnalysisThinking: false,
        currentDelayMs: 0,
        moveExecutionInProgress: false,
        lastError: "",

        autoResignEnabled: GM_getValue("autoResignEnabled", false),
        resignMode: GM_getValue("resignMode", "mate"),
        autoResignThresholdMate: GM_getValue("autoResignThresholdMate", 3),
        autoResignThresholdCp: GM_getValue("autoResignThresholdCp", 1000),

        clockSync: GM_getValue("clockSync", false),
        clockSyncMinDelay: GM_getValue("clockSyncMinDelay", 1.5),
        clockSyncMaxDelay: GM_getValue("clockSyncMaxDelay", 5.0),
        clockSyncLowTimeQuickSec: GM_getValue("clockSyncLowTimeQuickSec", 20),

        cctAnalysisEnabled: GM_getValue("cctAnalysisEnabled", true),
        cctComponents: GM_getValue("cctComponents", { checks: true, captures: true, threats: true }),
        cctDebugEnabled: GM_getValue("cctDebugEnabled", false),
        silentLogging: GM_getValue("silentLogging", false),

        moveStartTime: 0,
        notationSequence: GM_getValue("notationSequence", ""),
        premoveStats: {
            attempted: 0,
            allowed: 0,
            executed: 0,
            blocked: 0,
            failed: 0
        },
        premoveLiveChance: 0,
        premoveTargetChance: 0,
        premoveLastEvalDisplay: "-",
        premoveLastMoveDisplay: "-",
        premoveChanceReason: "Waiting for position...",
        premoveChanceUpdatedTs: 0,
        cctLastDebugText: "CCT debug idle",
        syzygyStatus: "Idle",
        syzygyLastFen: "",
        syzygySource: "",
        syzygyMoves: [],
        syzygyMeta: null,
        syzygyError: "",
        analysisHistoryCursor: 0,
        analysisAcplFen: "",
        analysisEvalText: "0.00",
        analysisLastRecordedKey: ""
    };

    const PERSISTED_SETTING_DEFAULTS = {
        autoMovePiece: false,
        moveExecutionMode: "click",
        autoRun: false,
        autoMatch: false,
        minDelay: 0.5,
        maxDelay: 3.0,
        eloRating: 1600,
        customDepth: CONFIG.DEFAULT_DEPTH,
        skillLevel: 20,
        evaluationMode: "engine",
        panelTop: null,
        panelLeft: null,
        panelState: "maximized",
        onboardingAccepted: false,
        highlightColor1: "#eb6150",
        highlightColor2: "#4287f5",
        analysisMode: false,
        highlightEnabled: false,
        autoAnalysisColor: "none",
        useMainConsensus: true,
        analysisBlunderGuard: true,
        analysisMinStableUpdates: 2,
        analysisGuardStateText: "Ready",
        numberOfMovesToShow: 5,
        clockSyncQuickDelayMs: 300,
        premoveEnabled: false,
        premoveMode: "capture",
        premovePieces: { q: 1, r: 1, b: 1, n: 1, p: 1 },
        premoveDepth: 5,
        premoveRiskPenaltyFactor: 0.5,
        premoveMinConfidence: 5,
        premoveDelayMs: 300,
        humanLevel: "intermediate",
        useOpeningBook: true,
        showPVArrows: false,
        pvArrowColors: {
            1: "#4287f5",
            2: "#eb6150",
            3: "#4caf50",
            4: "#9c27b0",
            5: "#f38ba8",
            6: "#fab387",
            7: "#74c7ec",
            8: "#f5c2e7",
            9: "#b4befe"
        },
        showBestmoveArrows: false,
        bestmoveArrowColor: "#f9e2af",
        bestmoveArrowColors: {
            1: "#eb6150",
            2: "#89b4fa",
            3: "#a6e3a1",
            4: "#f38ba8",
            5: "#cba6f7",
            6: "#fab387",
            7: "#74c7ec",
            8: "#f5c2e7",
            9: "#b4befe"
        },
        maxPVDepth: 2,
        autoDepthAdapt: false,
        autoResignEnabled: false,
        resignMode: "mate",
        autoResignThresholdMate: 3,
        autoResignThresholdCp: 1000,
        clockSync: false,
        clockSyncMinDelay: 1.5,
        clockSyncMaxDelay: 5.0,
        clockSyncLowTimeQuickSec: 20,
        cctAnalysisEnabled: true,
        cctComponents: { checks: true, captures: true, threats: true },
        cctDebugEnabled: false,
        silentLogging: false,
        notationSequence: ""
    };

    const SETTING_NUMBER_LIMITS = {
        minDelay: [0.05, 60],
        maxDelay: [0.05, 60],
        eloRating: [300, 3200],
        customDepth: [1, CONFIG.MAX_DEPTH],
        skillLevel: [0, 20],
        analysisMinStableUpdates: [1, 5],
        numberOfMovesToShow: [2, 10],
        clockSyncQuickDelayMs: [100, 5000],
        premoveDepth: [1, CONFIG.MAX_DEPTH],
        premoveRiskPenaltyFactor: [0, 2],
        premoveMinConfidence: [1, 95],
        premoveDelayMs: [50, 2000],
        maxPVDepth: [2, 10],
        autoResignThresholdMate: [1, 10],
        autoResignThresholdCp: [100, 5000],
        clockSyncMinDelay: [0.1, 30],
        clockSyncMaxDelay: [0.1, 60],
        clockSyncLowTimeQuickSec: [1, 300],
        panelTop: [0, 10000],
        panelLeft: [0, 10000]
    };

    function sanitizeSettingValue(key, rawValue) {
        const defaultValue = PERSISTED_SETTING_DEFAULTS[key];
        if (defaultValue === undefined) return rawValue;

        if (key === "panelTop" || key === "panelLeft") {
            if (rawValue === null || rawValue === undefined || rawValue === "") return null;
        }

        if (key === "premovePieces") {
            const base = { q: 1, r: 1, b: 1, n: 1, p: 1 };
            const src = (rawValue && typeof rawValue === "object") ? rawValue : base;
            return {
                q: src.q ? 1 : 0,
                r: src.r ? 1 : 0,
                b: src.b ? 1 : 0,
                n: src.n ? 1 : 0,
                p: src.p ? 1 : 0
            };
        }

        if (key === "cctComponents") {
            const base = { checks: true, captures: true, threats: true };
            const src = (rawValue && typeof rawValue === "object") ? rawValue : base;
            return {
                checks: !!src.checks,
                captures: !!src.captures,
                threats: !!src.threats
            };
        }

        if (key === "pvArrowColors") {
            const base = {
                1: "#4287f5",
                2: "#eb6150",
                3: "#4caf50",
                4: "#9c27b0",
                5: "#f38ba8",
                6: "#fab387",
                7: "#74c7ec",
                8: "#f5c2e7",
                9: "#b4befe"
            };
            const src = (rawValue && typeof rawValue === "object") ? rawValue : base;
            const out = {};
            for (let i = 1; i <= 9; i++) {
                const raw = src[i] || src[String(i)] || base[i];
                out[i] = /^#[0-9a-fA-F]{6}$/.test(String(raw)) ? String(raw) : base[i];
            }
            return out;
        }

        if (key === "bestmoveArrowColors") {
            const base = {
                1: "#eb6150",
                2: "#89b4fa",
                3: "#a6e3a1",
                4: "#f38ba8",
                5: "#cba6f7",
                6: "#fab387",
                7: "#74c7ec",
                8: "#f5c2e7",
                9: "#b4befe"
            };
            const src = (rawValue && typeof rawValue === "object") ? rawValue : base;
            const out = {};
            for (let i = 1; i <= 9; i++) {
                const raw = src[i] || src[String(i)] || base[i];
                out[i] = /^#[0-9a-fA-F]{6}$/.test(String(raw)) ? String(raw) : base[i];
            }
            return out;
        }

        if (key === "moveExecutionMode") {
            return rawValue === "drag" ? "drag" : "click";
        }

        if (key === "evaluationMode") {
            return rawValue === "human" ? "human" : "engine";
        }

        if (key === "panelState") {
            return ["maximized", "minimized", "closed"].includes(rawValue) ? rawValue : "maximized";
        }

        if (key === "autoAnalysisColor") {
            return ["white", "black", "none"].includes(rawValue) ? rawValue : "none";
        }

        if (key === "premoveMode") {
            return ["every", "capture", "filter"].includes(rawValue) ? rawValue : "capture";
        }

        if (key === "humanLevel") {
            return ELO_LEVELS[rawValue] ? rawValue : "intermediate";
        }

        if (key === "resignMode") {
            return rawValue === "cp" ? "cp" : "mate";
        }

        if (key === "highlightColor1" || key === "highlightColor2" || key === "bestmoveArrowColor") {
            return /^#[0-9a-fA-F]{6}$/.test(String(rawValue)) ? String(rawValue) : defaultValue;
        }

        if (typeof defaultValue === "boolean") {
            return !!rawValue;
        }

        if (typeof defaultValue === "number") {
            const n = Number(rawValue);
            if (!Number.isFinite(n)) return defaultValue;
            const limits = SETTING_NUMBER_LIMITS[key];
            if (!limits) return n;
            return clamp(n, limits[0], limits[1]);
        }

        if (typeof defaultValue === "string") {
            return String(rawValue || "");
        }

        return rawValue;
    }

    function normalizeLoadedSettings() {
        Object.keys(PERSISTED_SETTING_DEFAULTS).forEach(function (key) {
            const sanitized = sanitizeSettingValue(key, State[key]);
            if (JSON.stringify(sanitized) !== JSON.stringify(State[key])) {
                State[key] = sanitized;
                GM_setValue(key, sanitized);
            }
        });

        if (State.clockSyncMinDelay > State.clockSyncMaxDelay) {
            const temp = State.clockSyncMinDelay;
            State.clockSyncMinDelay = State.clockSyncMaxDelay;
            State.clockSyncMaxDelay = temp;
            GM_setValue("clockSyncMinDelay", State.clockSyncMinDelay);
            GM_setValue("clockSyncMaxDelay", State.clockSyncMaxDelay);
        }

        if (State.minDelay > State.maxDelay) {
            const temp = State.minDelay;
            State.minDelay = State.maxDelay;
            State.maxDelay = temp;
            GM_setValue("minDelay", State.minDelay);
            GM_setValue("maxDelay", State.maxDelay);
        }

    }

    normalizeLoadedSettings();

    // =====================================================
    // Section 08: Cache Variables
    // =====================================================
    let cachedGame = null;
    let cachedGameTimestamp = 0;
    let GAME_CACHE_TTL = 100;
    let pendingMoveTimeoutId = null;
    let _resignObserver = null;
    let _resignTimeout = null;
    let _resignTriggerCount = 0;
    let _resignTriggerNeeded = 3;
    let _suppressNewGameActionUntil = 0;
    // stockfishSourceCode now accessed via EngineLoader.stockfishSourceCode
    let _allLoopsActive = true;
    let _premoveCacheClearInterval = null;
    let _panelHotkeysBound = false;
    let _gearMenuDocBound = false;

    let _eventListeners = [];
    let _loopTimeoutIds = new Set();

    function scheduleManagedTimeout(fn, delay) {
        let id = null;
        id = setTimeout(function () {
            _loopTimeoutIds.delete(id);
            fn();
        }, delay);
        _loopTimeoutIds.add(id);
        return id;
    }

    function clearManagedTimeouts() {
        _loopTimeoutIds.forEach(function (id) {
            clearTimeout(id);
        });
        _loopTimeoutIds.clear();
    }

    function trimTimeoutIds() {
        if (_loopTimeoutIds.size > 100) {
            log("[Runtime] Trimming timeout IDs: " + _loopTimeoutIds.size + " → 0");
            clearManagedTimeouts();
        }
    }

    function cleanupEventListeners() {
        if (_eventListeners && _eventListeners.length > 0) {
            _eventListeners.forEach(function (listener) {
                try {
                    listener.element.removeEventListener(listener.type, listener.handler, listener.options || false);
                } catch (e) {
                }
            });
            _eventListeners = [];
        }
    }

    let RuntimeGuard = {
        loopPerf: Object.create(null),
        lastPerfLogTs: 0,
        lastCacheAlertTs: 0,
        lastSoakLogTs: 0,
        lastUIHealTs: 0,
        uiHealCount: 0,
        listenerHealCount: 0,
        selfTestRuns: 0,
        selfTestFailures: 0,
        premoveStuckSince: 0,
        mainStuckSince: 0,
        analysisStuckSince: 0,
        premoveHealCount: 0,
        mainHealCount: 0,
        analysisHealCount: 0,

        _nowMs: function () {
            if (typeof performance !== "undefined" && typeof performance.now === "function") {
                return performance.now();
            }
            return Date.now();
        },

        trackLoop: function (name, startTs) {
            const elapsed = this._nowMs() - startTs;
            let stat = this.loopPerf[name];
            if (!stat) {
                stat = { count: 0, total: 0, max: 0 };
                this.loopPerf[name] = stat;
            }

            stat.count++;
            stat.total += elapsed;
            if (elapsed > stat.max) stat.max = elapsed;

            if (elapsed > 120) {
                warn("[Perf] Slow loop:", name, Math.round(elapsed) + "ms");
            }

            const now = Date.now();
            if (stat.count % 120 === 0 && now - this.lastPerfLogTs > 30000) {
                const avg = stat.total / Math.max(1, stat.count);
                log("[Perf]", name, "avg=" + avg.toFixed(1) + "ms", "max=" + stat.max.toFixed(1) + "ms", "runs=" + stat.count);
                this.lastPerfLogTs = now;
            }
        },

        checkCachePressure: function () {
            const issues = [];

            if (Engine && Engine._premoveProcessedFens && Engine._premoveProcessedFens.size > 25) {
                issues.push("premoveProcessed=" + Engine._premoveProcessedFens.size);
                const keep = 12;
                const arr = Array.from(Engine._premoveProcessedFens);
                Engine._premoveProcessedFens = new Set(arr.slice(-keep));
            }
            if (CCTAnalyzer && CCTAnalyzer.cache && CCTAnalyzer.cache.size > 260) {
                issues.push("cctCache=" + CCTAnalyzer.cache.size);
                CCTAnalyzer.clearCache();
            }
            if (ThreatDetectionSystem && ThreatDetectionSystem.cache && ThreatDetectionSystem.cache.size > 260) {
                issues.push("threatCache=" + ThreatDetectionSystem.cache.size);
                ThreatDetectionSystem.clearCache();
            }
            if (Syzygy && Syzygy.cache && Syzygy.cache.size > 80) {
                issues.push("syzygyCache=" + Syzygy.cache.size);
                Syzygy.clear();
            }

            if (issues.length > 0) {
                const now = Date.now();
                if (now - this.lastCacheAlertTs > 10000) {
                    warn("[Watchdog] Cache pressure:", issues.join(", "));
                    this.lastCacheAlertTs = now;
                }
            }
        },

        checkPremoveWatchdog: function () {
            if (!State.premoveEnabled || State.analysisMode) {
                this.premoveStuckSince = 0;
                return;
            }

            const active = !!(Engine._premoveEngineBusy || Engine._premoveProcessing || State.premoveAnalysisInProgress);
            if (!active) {
                this.premoveStuckSince = 0;
                return;
            }

            const now = Date.now();
            const lastActivity = Engine._premoveLastActivityTs || 0;
            if (!lastActivity) {
                Engine._premoveLastActivityTs = now;
                return;
            }

            const timeoutMs = (CONFIG.PREMOVE.ENGINE_TIMEOUT || 8000) + 3000;
            if (now - lastActivity < timeoutMs) {
                this.premoveStuckSince = 0;
                return;
            }

            if (!this.premoveStuckSince) {
                this.premoveStuckSince = now;
                return;
            }

            if (now - this.premoveStuckSince < 1500) {
                return;
            }

            this.premoveHealCount++;
            warn("[Watchdog] Premove stuck detected. Healing worker...");
            if (Engine && typeof Engine.selfHealPremove === "function") {
                Engine.selfHealPremove("watchdog-timeout");
            }
            this.premoveStuckSince = 0;
        },

        checkEngineWatchdog: function () {
            const now = Date.now();

            const mainActive = !!(Engine && Engine.main && Engine._ready && State.isThinking && !State.analysisMode);
            if (!mainActive) {
                this.mainStuckSince = 0;
            } else {
                const mainLast = Engine._mainLastActivityTs || 0;
                if (mainLast && now - mainLast > 12000) {
                    if (!this.mainStuckSince) {
                        this.mainStuckSince = now;
                    } else if (now - this.mainStuckSince > 1500) {
                        this.mainHealCount++;
                        warn("[Watchdog] Main engine stuck detected. Healing worker...");
                        if (typeof Engine.selfHealMain === "function") {
                            Engine.selfHealMain("watchdog-timeout");
                        }
                        this.mainStuckSince = 0;
                    }
                } else {
                    this.mainStuckSince = 0;
                }
            }

            const analysisActive = !!(Engine && Engine.analysis && State.analysisMode && State.isAnalysisThinking);
            if (!analysisActive) {
                this.analysisStuckSince = 0;
            } else {
                const analysisLast = Engine._analysisLastActivityTs || 0;
                if (analysisLast && now - analysisLast > 12000) {
                    if (!this.analysisStuckSince) {
                        this.analysisStuckSince = now;
                    } else if (now - this.analysisStuckSince > 1500) {
                        this.analysisHealCount++;
                        warn("[Watchdog] Analysis engine stuck detected. Healing worker...");
                        if (typeof Engine.selfHealAnalysis === "function") {
                            Engine.selfHealAnalysis("watchdog-timeout");
                        }
                        this.analysisStuckSince = 0;
                    }
                } else {
                    this.analysisStuckSince = 0;
                }
            }
        },

        checkUIWatchdog: function () {
            const now = Date.now();
            const panel = $("#chess-assist-panel");
            if (!panel) return;

            let lastUiTs = UI && typeof UI._lastHeartbeatTs === "number" ? UI._lastHeartbeatTs : 0;
            if (!lastUiTs || now - lastUiTs < 15000) return;
            if (now - this.lastUIHealTs < 10000) return;

            this.lastUIHealTs = now;
            this.uiHealCount++;
            warn("[Watchdog] UI heartbeat stale, healing UI render");

            try {
                renderAll();
            } catch (e) {
                err("[Watchdog] renderAll heal failed:", e);
            }

            try {
                setupAllListeners();
                this.listenerHealCount++;
            } catch (e) {
                err("[Watchdog] setupAllListeners heal failed:", e);
            }
        },

        logSoakSummary: function () {
            const now = Date.now();
            if (now - this.lastSoakLogTs < 60000) return;

            this.lastSoakLogTs = now;
            const loops = Object.keys(this.loopPerf).map((k) => {
                const p = this.loopPerf[k];
                const avg = p && p.count ? (p.total / p.count).toFixed(1) : "0.0";
                return k + ":" + avg + "ms";
            }).join(" | ");

            log(
                "[Soak]",
                "caches CCT=" + (CCTAnalyzer && CCTAnalyzer.cache ? CCTAnalyzer.cache.size : 0) +
                " TH=" + (ThreatDetectionSystem && ThreatDetectionSystem.cache ? ThreatDetectionSystem.cache.size : 0),
                "heals P=" + this.premoveHealCount +
                " M=" + this.mainHealCount +
                " A=" + this.analysisHealCount,
                loops
            );
        },

        getSnapshot: function () {
            return {
                loops: this.loopPerf,
                premoveHealCount: this.premoveHealCount,
                mainHealCount: this.mainHealCount,
                analysisHealCount: this.analysisHealCount,
                uiHealCount: this.uiHealCount,
                listenerHealCount: this.listenerHealCount,
                selfTestRuns: this.selfTestRuns,
                selfTestFailures: this.selfTestFailures
            };
        }
    };

    // =====================================================
    // Section 09: Ultra-Smart Premove Engine
    // =====================================================
    const SmartPremove = {

        lastSafeMoves: [],
        moveHistory: [],
        executedFens: new Set(),

        executionLock: false,
        processingLock: false,

        lastExecutionTime: 0,
        consecutiveErrors: 0,
        patternBreakCounter: 0,
        lastBlunderFen: null,
        blunderCount: 0,

        MAX_EXECUTED_FENS: 15,
        MAX_HISTORY: 20,
        MAX_CONSECUTIVE_ERRORS: 3,
        MIN_EXECUTION_INTERVAL: 200,
        ERROR_COOLDOWN: 5000,
        BLUNDER_COOLDOWN: 8000,

        PIECE_ORDER: ['p', 'n', 'b', 'r', 'q'],

        RISK_MULTIPLIERS: {
            SAFE_THRESHOLD: 10,
            BLOCK_THRESHOLD: 15,
            PIECE_HANGING: 12,
            BAD_TRADE: 7,
            RISK_LEVEL_DIVISOR: 5,
            KING_SAFETY_WEIGHT: 25,
            PIN_PENALTY: 15,
            DISCOVERED_CHECK_PENALTY: 30
        },

        PATTERN_DETECTION: {
            MIN_MOVES: 5,
            VARIANCE_THRESHOLD: 0.1,
            ACCURACY_THRESHOLD: 0.95,
            VARIANCE_WEIGHT: 40,
            ACCURACY_WEIGHT: 60
        },

        AGGRESSION_CONFIG: {

            every: {
                minConfidence: 20,
                riskTolerance: 35,
                tacticalBonus: 15,
                allowSpeculative: true,
                maxRiskScore: 220,
                requireSafetyCheck: true,
                minEvalForSpeculative: -200,
                rollBuffer: 12,
                maxConfidenceBoost: 8,
            },

            capture: {
                minConfidence: 40,
                riskTolerance: 15,
                tacticalBonus: 8,
                allowSpeculative: false,
                maxRiskScore: 100,
                requireSafetyCheck: true,
                requirePositiveExchange: true,
                minSEEValue: 0,
                minCaptureValue: 0,
                avoidLossyCapture: true,
                maxNetLoss: 0,
                rollBuffer: -5,
            },

            filter: {
                minConfidence: 32,
                riskTolerance: 22,
                tacticalBonus: 10,
                allowSpeculative: false,
                maxRiskScore: 180,
                requireSafetyCheck: true,
                requireMoveQuality: true,
                minTacticalScore: -3,
                rollBuffer: 0,
            }
        },

        resetExecutionTracking() {
            this.executedFens.clear();
            this.executionLock = false;
            this.processingLock = false;
            this.consecutiveErrors = 0;
            this.patternBreakCounter = 0;
            this.moveHistory = [];
            this.lastSafeMoves = [];
            this.lastExecutionTime = 0;
            this.lastBlunderFen = null;
            this.blunderCount = 0;
            this._invalidateAllTokens();
        },

        isInErrorCooldown() {
            if (this.consecutiveErrors >= this.MAX_CONSECUTIVE_ERRORS) {
                const timeSinceLastError = Date.now() - this.lastExecutionTime;
                if (timeSinceLastError < this.ERROR_COOLDOWN) {
                    return true;
                }
                this.consecutiveErrors = 0;
            }
            return false;
        },

        recordBlunder(fen) {
            this.blunderCount++;
            this.lastBlunderFen = fen;
            if (this.blunderCount >= 2) {
                log("[SmartPremove] Multiple blunders - entering cautious mode");
            }
        },

        isInCautiousMode() {
            if (this.blunderCount >= 3) return true;
            if (this.blunderCount >= 2 &&
                Date.now() - this.lastExecutionTime < this.BLUNDER_COOLDOWN) {
                return true;
            }
            return false;
        },

        detectPattern() {
            if (this.moveHistory.length < this.PATTERN_DETECTION.MIN_MOVES) {
                return null;
            }

            const last = this.moveHistory.slice(-this.PATTERN_DETECTION.MIN_MOVES);
            const variance = this._timeVariance(last);
            const accuracy = this._engineAccuracy(last);

            const isTooConsistent =
                  variance < this.PATTERN_DETECTION.VARIANCE_THRESHOLD &&
                  accuracy > this.PATTERN_DETECTION.ACCURACY_THRESHOLD;

            const varianceRisk = Math.max(0, 1 - variance / this.PATTERN_DETECTION.VARIANCE_THRESHOLD);
            const accuracyRisk = accuracy;

            const riskLevel = Math.min(
                100,
                varianceRisk * this.PATTERN_DETECTION.VARIANCE_WEIGHT +
                accuracyRisk * this.PATTERN_DETECTION.ACCURACY_WEIGHT
            );

            return {
                isTooConsistent,
                riskLevel,
                variance,
                accuracy,
                moveCount: last.length
            };
        },

        _timeVariance(moves) {
            if (!moves || moves.length < 2) return 0;
            const times = moves.map(m => m.timeSpent || 0);
            const mean = times.reduce((a, b) => a + b, 0) / times.length;
            if (mean === 0) return 0;
            const variance = times.reduce((s, t) => s + (t - mean) ** 2, 0) / times.length;
            return Math.sqrt(variance) / mean;
        },

        _engineAccuracy(moves) {
            if (!moves || moves.length === 0) return 0;
            return moves.filter(m => m.wasEngineMove).length / moves.length;
        },

        analyzeTacticalMotifs(fen, uci, ourColor) {
            const empty = { score: 0, isBlunder: false, isBrilliant: false, details: [] };

            if (!fen || !uci || uci.length < 4) return empty;
            if (!ourColor || (ourColor !== "w" && ourColor !== "b")) return empty;

            const from = uci.slice(0, 2);
            const to = uci.slice(2, 4);
            const promo = uci.length > 4 ? uci[4] : null;

            const movingPiece = pieceFromFenChar(fenCharAtSquare(fen, from));
            if (!movingPiece || movingPiece.color !== ourColor) return empty;

            const newFen = makeSimpleMove(fen, from, to, promo);
            if (!newFen) return empty;

            const motifs = { score: 0, isBlunder: false, isBrilliant: false, details: [] };
            const oppColor = ourColor === "w" ? "b" : "w";

            const oppKing = findKing(newFen, oppColor);
            if (oppKing && isSquareAttackedBy(newFen, oppKing, ourColor)) {
                if (isCheckmate(newFen, oppColor)) {
                    motifs.score += 1000;
                    motifs.isBrilliant = true;
                    motifs.details.push("Checkmate!");
                    return motifs;
                }

                motifs.score += 8;
                motifs.details.push("Check");

                const checkAttackers = getAttackersOfSquare(newFen, to, oppColor);
                const checkDefenders = getAttackersOfSquare(newFen, to, ourColor);
                if (checkAttackers.length > 0 && checkDefenders.length === 0) {
                    const pieceVal = PIECE_VALUES[movingPiece.type] || 0;
                    if (pieceVal > 3) {
                        motifs.score -= pieceVal * 2;
                        motifs.details.push(`Check BUT ${movingPiece.type.toUpperCase()} hangs (-${pieceVal * 2})`);
                    }
                }
            }

            const capturedCh = fenCharAtSquare(fen, to);
            const capturedPiece = pieceFromFenChar(capturedCh);

            if (capturedPiece && capturedPiece.color === oppColor) {
                const seeResult = this._staticExchangeEval(fen, from, to, ourColor);

                if (seeResult >= 0) {
                    const capturedVal = PIECE_VALUES[capturedPiece.type] || 0;
                    motifs.score += capturedVal + seeResult;
                    motifs.details.push(`Good capture: ${capturedPiece.type.toUpperCase()} (SEE: +${seeResult})`);
                } else {
                    motifs.score += seeResult;
                    motifs.details.push(`Bad capture: lose ${Math.abs(seeResult)} in exchange`);
                    if (seeResult < -2) {
                        motifs.isBlunder = true;
                        motifs.details.push("BLUNDER: losing exchange");
                    }
                }
            }

            if (isEnPassantCapture(fen, from, to, ourColor)) {
                motifs.score += 1;
                motifs.details.push("En passant capture");
            }

            const ourHanging = this._findOurHangingPieces(newFen, ourColor);
            if (ourHanging.length > 0) {
                const hangValue = ourHanging.reduce((s, p) => s + (PIECE_VALUES[p.type] || 0), 0);
                motifs.score -= hangValue * 2;
                motifs.details.push(`Our pieces hanging: ${ourHanging.map(p => p.type.toUpperCase()).join(",")} (-${hangValue * 2})`);
                if (hangValue >= 5) {
                    motifs.isBlunder = true;
                }
            }

            const oppHanging = this._findHangingPieces(newFen, oppColor);
            if (oppHanging.length > 0) {
                const value = oppHanging.reduce((s, p) => s + (PIECE_VALUES[p.type] || 0), 0);
                motifs.score += Math.min(value, 8);
                motifs.details.push(`Opponent hanging pieces (${value})`);
            }

            const forkResult = this._detectForkAfterMove(newFen, to, movingPiece.type, ourColor);
            if (forkResult) {
                motifs.score += forkResult.value;
                motifs.isBrilliant = motifs.isBrilliant || forkResult.value >= 8;
                motifs.details.push(forkResult.description);
            }

            const pinResult = this._detectPinAfterMove(newFen, to, movingPiece.type, ourColor);
            if (pinResult) {
                motifs.score += 3;
                motifs.details.push(pinResult.description);
            }

            const ourKing = findKing(newFen, ourColor);
            if (ourKing && isSquareAttackedBy(newFen, ourKing, oppColor)) {
                motifs.score -= 100;
                motifs.isBlunder = true;
                motifs.details.push("BLUNDER: Our king in check after move!");
            }

            const toAttackers = getAttackersOfSquare(newFen, to, oppColor);
            const toDefenders = getAttackersOfSquare(newFen, to, ourColor);

            if (toAttackers.length > 0 && toDefenders.length === 0 && !capturedPiece) {
                const pieceVal = PIECE_VALUES[movingPiece.type] || 0;
                if (pieceVal >= 3) {
                    motifs.score -= pieceVal * 2;
                    motifs.details.push(`Moving ${movingPiece.type.toUpperCase()} to undefended square (-${pieceVal * 2})`);
                    if (pieceVal >= 5) motifs.isBlunder = true;
                }
            }

            if (promo) {
                motifs.score += PIECE_VALUES[promo] || 9;
                motifs.details.push(`Promotion to ${promo.toUpperCase()}`);
            }

            if (movingPiece.type === 'p') {
                const promoRank = ourColor === 'w' ? 8 : 1;
                const toRank = parseInt(to[1], 10);
                const distance = Math.abs(toRank - promoRank);
                if (distance === 1) {
                    motifs.score += 4;
                    motifs.details.push("Pawn 1 square from promotion");
                } else if (distance === 2) {
                    motifs.score += 2;
                    motifs.details.push("Pawn 2 squares from promotion");
                }
            }

            return motifs;
        },

        _staticExchangeEval(fen, from, to, ourColor) {
            const oppColor = ourColor === "w" ? "b" : "w";
            const movingPiece = pieceFromFenChar(fenCharAtSquare(fen, from));
            const capturedPiece = pieceFromFenChar(fenCharAtSquare(fen, to));
            if (!movingPiece || !capturedPiece) return 0;
            const afterMoveFen = makeSimpleMove(fen, from, to);
            if (!afterMoveFen) return 0;
            const oppAttackers = getAttackersOfSquare(afterMoveFen, to, oppColor).map(a => PIECE_VALUES[a.piece] || 0).sort((a, b) => a - b);
            const ourDefenders = getAttackersOfSquare(afterMoveFen, to, ourColor).map(a => PIECE_VALUES[a.piece] || 0).sort((a, b) => a - b);
            const capturedVal = PIECE_VALUES[capturedPiece.type] || 0;
            const ourPieceVal = PIECE_VALUES[movingPiece.type] || 0;
            const gains = [capturedVal];
            let currentPieceVal = ourPieceVal;
            let oppIdx = 0, ourIdx = 0, isOppTurn = true;
            for (let depth = 0; depth < 16; depth++) {
                if (isOppTurn) { if (oppIdx >= oppAttackers.length) break; gains.push(currentPieceVal); currentPieceVal = oppAttackers[oppIdx++]; }
                else { if (ourIdx >= ourDefenders.length) break; gains.push(currentPieceVal); currentPieceVal = ourDefenders[ourIdx++]; }
                isOppTurn = !isOppTurn;
            }
            let value = 0;
            for (let i = gains.length - 1; i > 0; i--) { value = Math.max(0, gains[i] - value); }
            return gains[0] - value;
        },

        _findOurHangingPieces(fen, ourColor) {
            if (!fen || !ourColor) return [];
            const pieces = getAllPieces(fen, ourColor);
            const oppColor = ourColor === "w" ? "b" : "w";
            const result = [];
            for (const p of pieces) {
                if (p.type === "k") continue;
                const attackers = getAttackersOfSquare(fen, p.square, oppColor);
                if (!attackers.length) continue;
                const defenders = getAttackersOfSquare(fen, p.square, ourColor);
                const val = PIECE_VALUES[p.type] || 0;
                if (!defenders.length) { result.push(p); continue; }
                const minAtk = Math.min(...attackers.map(a => PIECE_VALUES[a.piece] || 99));
                if (minAtk < val) result.push(p);
            }
            return result;
        },

        _findHangingPieces(fen, color) {
            if (!fen || !color) return [];
            const pieces = getAllPieces(fen, color);
            const opp = color === "w" ? "b" : "w";
            const result = [];
            for (const p of pieces) {
                if (p.type === "k") continue;
                const attackers = getAttackersOfSquare(fen, p.square, opp);
                if (!attackers.length) continue;
                const defenders = getAttackersOfSquare(fen, p.square, color);
                const val = PIECE_VALUES[p.type] || 0;
                const minAtk = Math.min(...attackers.map(a => PIECE_VALUES[a.piece] || 99));
                if (!defenders.length || minAtk < val) result.push(p);
            }
            return result;
        },

        _detectForkAfterMove(fen, square, pieceType, ourColor) {
            const oppColor = ourColor === "w" ? "b" : "w";
            const attacked = getSquaresAttackedByPiece(fen, square, pieceType, ourColor);
            const valuableTargets = [];
            for (const sq of attacked) {
                const piece = pieceFromFenChar(fenCharAtSquare(fen, sq));
                if (piece && piece.color === oppColor) {
                    const val = PIECE_VALUES[piece.type] || 0;
                    if (val >= 3 || piece.type === 'k') { valuableTargets.push({ square: sq, type: piece.type, value: val }); }
                }
            }
            if (valuableTargets.length >= 2) {
                const totalValue = valuableTargets.reduce((s, t) => s + t.value, 0);
                const hasKing = valuableTargets.some(t => t.type === 'k');
                return { value: hasKing ? Math.min(totalValue, 15) : Math.min(totalValue, 10), targets: valuableTargets, description: `Fork: ${pieceType.toUpperCase()} attacks ${valuableTargets.map(t => t.type.toUpperCase()).join(" & ")}` };
            }
            return null;
        },

        _detectPinAfterMove(fen, square, pieceType, ourColor) {
            if (!['q', 'r', 'b'].includes(pieceType)) return null;
            const oppColor = ourColor === "w" ? "b" : "w";
            const oppKing = findKing(fen, oppColor);
            if (!oppKing) return null;
            const directions = [];
            if (pieceType === 'q' || pieceType === 'r') directions.push([1, 0], [-1, 0], [0, 1], [0, -1]);
            if (pieceType === 'q' || pieceType === 'b') directions.push([1, 1], [1, -1], [-1, 1], [-1, -1]);
            const sf = "abcdefgh".indexOf(square[0]);
            const sr = parseInt(square[1], 10);
            for (const [dx, dy] of directions) {
                let f = sf + dx, r = sr + dy, firstPiece = null;
                while (f >= 0 && f <= 7 && r >= 1 && r <= 8) {
                    const sq = "abcdefgh"[f] + r;
                    const ch = fenCharAtSquare(fen, sq);
                    if (ch) {
                        const p = pieceFromFenChar(ch);
                        if (!p) break;
                        if (!firstPiece) { if (p.color === oppColor) { firstPiece = { square: sq, piece: p }; } else { break; } }
                        else { if (p.color === oppColor && p.type === 'k') { return { pinnedPiece: firstPiece.piece.type, pinnedSquare: firstPiece.square, description: `Pin: ${pieceType.toUpperCase()} pins ${firstPiece.piece.type.toUpperCase()} to king` }; } break; }
                    }
                    f += dx; r += dy;
                }
            }
            return null;
        },

        analyzeSafety(fen, uci, ourColor, config) {
            const failResult = (msg) => ({ safe: false, riskScore: 999, warnings: [msg], riskLevel: 100 });
            if (!fen || !uci || uci.length < 4) return failResult("Invalid input");
            if (!ourColor || (ourColor !== "w" && ourColor !== "b")) return failResult("Invalid color");
            const from = uci.slice(0, 2), to = uci.slice(2, 4), promo = uci.length > 4 ? uci[4] : null;
            const piece = pieceFromFenChar(fenCharAtSquare(fen, from));
            if (!piece) return failResult("No piece found");
            if (piece.color !== ourColor) return failResult("Not our piece");
            const newFen = makeSimpleMove(fen, from, to, promo);
            if (!newFen) return failResult("Invalid move");
            const oppColor = ourColor === "w" ? "b" : "w";
            let riskScore = 0; const warnings = [];
            const ourKing = findKing(newFen, ourColor);
            if (ourKing && isSquareAttackedBy(newFen, ourKing, oppColor)) { return { safe: false, riskScore: 1000, warnings: ["King exposed - ILLEGAL"], riskLevel: 100 }; }
            const ourKingBefore = findKing(fen, ourColor);
            if (ourKingBefore && piece.type !== 'k') {
                if (isPiecePinned(fen, from, ourKingBefore, ourColor, oppColor)) {
                    const kingAfter = findKing(newFen, ourColor);
                    if (kingAfter && isSquareAttackedBy(newFen, kingAfter, oppColor)) { return { safe: false, riskScore: 1000, warnings: ["Moving pinned piece - ILLEGAL"], riskLevel: 100 }; }
                    riskScore += this.RISK_MULTIPLIERS.PIN_PENALTY; warnings.push("Moving previously pinned piece");
                }
            }
            const attackers = getAttackersOfSquare(newFen, to, oppColor);
            const defenders = getAttackersOfSquare(newFen, to, ourColor);
            const capturedCh = fenCharAtSquare(fen, to);
            const capturedPiece = pieceFromFenChar(capturedCh);
            const capturedVal = (capturedPiece && capturedPiece.color === oppColor) ? (PIECE_VALUES[capturedPiece.type] || 0) : 0;
            if (attackers.length > 0) {
                const pieceVal = PIECE_VALUES[piece.type] || 0;
                const minAtkVal = Math.min(...attackers.map(a => PIECE_VALUES[a.piece] || 99));
                if (defenders.length === 0) { const netLoss = pieceVal - capturedVal; if (netLoss > 0) { riskScore += netLoss * this.RISK_MULTIPLIERS.PIECE_HANGING; warnings.push(`${piece.type.toUpperCase()} hangs (net loss: ${netLoss})`); } }
                else if (minAtkVal < pieceVal && capturedVal < pieceVal) { const netLoss = pieceVal - Math.max(capturedVal, minAtkVal); if (netLoss > 0) { riskScore += netLoss * this.RISK_MULTIPLIERS.BAD_TRADE; warnings.push(`Bad trade: ${piece.type.toUpperCase()} (net: -${netLoss})`); } }
            }
            const oppLongRange = getAllPieces(newFen, oppColor).filter(p => ['q', 'r', 'b'].includes(p.type));
            for (const oppPiece of oppLongRange) {
                const ourValuable = getAllPieces(newFen, ourColor).filter(p => (PIECE_VALUES[p.type] || 0) >= 5 || p.type === 'k');
                for (const target of ourValuable) {
                    const attackedNow = canPieceAttackSquare(newFen, oppPiece, target.square);
                    const attackedBefore = canPieceAttackSquare(fen, oppPiece, target.square);
                    if (attackedNow && !attackedBefore) {
                        riskScore += this.RISK_MULTIPLIERS.DISCOVERED_CHECK_PENALTY; warnings.push(`Discovered attack on our ${target.type.toUpperCase()} by ${oppPiece.type.toUpperCase()}`);
                        if (target.type === 'k') { riskScore += 100; warnings.push("DISCOVERED CHECK against our king!"); }
                    }
                }
            }
            const leftBehind = this._checkLeftBehindPieces(fen, newFen, from, to, ourColor, oppColor);
            if (leftBehind.totalRisk > 0) { riskScore += leftBehind.totalRisk; warnings.push(...leftBehind.warnings); }
            if (piece.type === 'k') { const kingSafety = this._evaluateKingSafety(newFen, to, ourColor, oppColor); riskScore += kingSafety.risk; warnings.push(...kingSafety.warnings); }
            if (piece.type === 'q') { const queenTrapped = this._isQueenTrapped(newFen, to, ourColor, oppColor); if (queenTrapped) { riskScore += 80; warnings.push("QUEEN may be trapped!"); } }
            const maxRisk = config.maxRiskScore || 500;
            const safeThreshold = config.riskTolerance * this.RISK_MULTIPLIERS.SAFE_THRESHOLD;
            const safe = riskScore <= safeThreshold;
            return { safe, riskScore: Math.min(riskScore, maxRisk), warnings, riskLevel: Math.min(100, riskScore / this.RISK_MULTIPLIERS.RISK_LEVEL_DIVISOR) };
        },

        _checkLeftBehindPieces(oldFen, newFen, from, to, ourColor, oppColor) {
            let totalRisk = 0; const warnings = [];
            const ourPieces = getAllPieces(oldFen, ourColor);
            for (const p of ourPieces) {
                if (p.square === from || p.type === 'k') continue;
                const wasDefendedByUs = isSquareDefendedBy(oldFen, p.square, from);
                if (!wasDefendedByUs) continue;
                const stillDefendedByMoved = isSquareDefendedBy(newFen, p.square, to);
                const otherDefenders = getAttackersOfSquare(newFen, p.square, ourColor);
                if (stillDefendedByMoved || otherDefenders.length > 0) continue;
                const atk = getAttackersOfSquare(newFen, p.square, oppColor);
                if (atk.length > 0) { const val = PIECE_VALUES[p.type] || 0; totalRisk += val * 8; warnings.push(`${p.type.toUpperCase()} at ${p.square} left undefended and attacked`); }
            }
            return { totalRisk, warnings };
        },

        _evaluateKingSafety(fen, kingSquare, ourColor, oppColor) {
            let risk = 0; const warnings = [];
            const kf = "abcdefgh".indexOf(kingSquare[0]), kr = parseInt(kingSquare[1], 10);
            let unsafeNeighbors = 0;
            for (let df = -1; df <= 1; df++) { for (let dr = -1; dr <= 1; dr++) { if (df === 0 && dr === 0) continue; const nf = kf + df, nr = kr + dr; if (nf < 0 || nf > 7 || nr < 1 || nr > 8) continue; if (isSquareAttackedBy(fen, "abcdefgh"[nf] + nr, oppColor)) unsafeNeighbors++; } }
            if (unsafeNeighbors >= 5) { risk += this.RISK_MULTIPLIERS.KING_SAFETY_WEIGHT * 2; warnings.push("King destination very exposed"); }
            else if (unsafeNeighbors >= 3) { risk += this.RISK_MULTIPLIERS.KING_SAFETY_WEIGHT; warnings.push("King destination somewhat exposed"); }
            return { risk, warnings };
        },

        _isQueenTrapped(fen, queenSquare, ourColor, oppColor) {
            const escapes = getQueenEscapeSquares(fen, queenSquare, ourColor);
            const safeEscapes = escapes.filter(sq => { const ch = fenCharAtSquare(fen, sq); if (ch) { const p = pieceFromFenChar(ch); if (p && p.color === ourColor) return false; } return !isSquareAttackedBy(fen, sq, oppColor); });
            return safeEscapes.length <= 1;
        },

        _validateCaptureQuality(fen, uci, ourColor, config) {
            const from = uci.substring(0, 2), to = uci.substring(2, 4);
            if (isEnPassantCapture(fen, from, to, ourColor)) return { ok: true };
            const movingPiece = pieceFromFenChar(fenCharAtSquare(fen, from));
            const capturedPiece = pieceFromFenChar(fenCharAtSquare(fen, to));
            if (!capturedPiece) return { ok: false, reason: "Tidak ada piece yang diambil" };
            const capturedVal = PIECE_VALUES[capturedPiece.type] || 0;
            const ourVal = PIECE_VALUES[movingPiece ? movingPiece.type : 'p'] || 0;
            if (config.minCaptureValue && capturedVal < config.minCaptureValue) return { ok: false, reason: `Capture terlalu murah: ${capturedVal} < min ${config.minCaptureValue}` };
            if (config.requirePositiveExchange) { const see = this._staticExchangeEval(fen, from, to, ourColor); if (see < (config.minSEEValue || 0)) return { ok: false, reason: `Exchange tidak menguntungkan (SEE: ${see})` }; }
            if (config.avoidLossyCapture && movingPiece) { const oppColor = ourColor === "w" ? "b" : "w"; const newFen = makeSimpleMove(fen, from, to); if (newFen) { const atk = getAttackersOfSquare(newFen, to, oppColor); const def = getAttackersOfSquare(newFen, to, ourColor); if (atk.length > 0 && def.length === 0) { const netLoss = ourVal - capturedVal; if (netLoss > (config.maxNetLoss !== undefined ? config.maxNetLoss : 0)) return { ok: false, reason: `Capture berisiko: net loss ${netLoss}` }; } } }
            return { ok: true };
        },

        _validateMoveQuality(fen, uci, ourColor, tactical, config) {
            const from = uci.substring(0, 2), to = uci.substring(2, 4);
            const movingPiece = pieceFromFenChar(fenCharAtSquare(fen, from));
            if (!movingPiece) return { ok: false, reason: "Piece tidak ditemukan" };
            const oppColor = ourColor === "w" ? "b" : "w";
            if (tactical.isBrilliant) return { ok: true };
            if (tactical.score >= 5) return { ok: true };
            const minScore = config.minTacticalScore !== undefined ? config.minTacticalScore : -3;
            if (tactical.score < minScore) return { ok: false, reason: `Taktik lemah: score ${tactical.score} < minimum ${minScore}` };
            const newFen = makeSimpleMove(fen, from, to);
            if (!newFen) return { ok: true };
            const atk = getAttackersOfSquare(newFen, to, oppColor);
            const def = getAttackersOfSquare(newFen, to, ourColor);
            const val = PIECE_VALUES[movingPiece.type] || 0;
            if (val >= 5 && atk.length > 0 && def.length === 0) return { ok: false, reason: `${movingPiece.type.toUpperCase()} digantung di ${to}` };
            if (val >= 3 && atk.length > 0 && def.length === 0) { const minAtk = Math.min(...atk.map(a => PIECE_VALUES[a.piece] || 99)); if (minAtk < val) return { ok: false, reason: `${movingPiece.type.toUpperCase()} diserang piece lebih murah di ${to}` }; }
            const ourKing = findKing(fen, ourColor);
            if (ourKing && movingPiece.type !== 'k' && isPiecePinned(fen, from, ourKing, ourColor, oppColor)) return { ok: false, reason: "Move melepas pin - berbahaya" };
            return { ok: true };
        },

        calculateConfidence(scoreInfo, tactical, safety, config) {
            let score = 50;
            if (scoreInfo) {
                if (scoreInfo.type === "mate") { const mate = scoreInfo.value, dist = Math.abs(mate); if (mate < 0) { if (dist <= 1) score += 35; else if (dist <= 2) score += 28; else if (dist <= 4) score += 18; else if (dist <= 6) score += 10; else score += 5; } else { if (dist <= 1) score -= 50; else if (dist <= 2) score -= 35; else if (dist <= 4) score -= 20; else score -= 10; } }
                else { const ourAdv = -(scoreInfo.value || 0) / 100; if (ourAdv >= 8) score += 28; else if (ourAdv >= 5) score += 22; else if (ourAdv >= 3) score += 16; else if (ourAdv >= 1.5) score += 10; else if (ourAdv >= 0.5) score += 5; else if (ourAdv >= 0) score += 0; else if (ourAdv >= -1) score -= 8; else if (ourAdv >= -2) score -= 16; else if (ourAdv >= -4) score -= 24; else score -= 32; }
            }
            if (tactical.isBlunder) score -= 60; else if (tactical.isBrilliant) score += 18;
            if (tactical.score > 0) score += Math.min(config.tacticalBonus || 10, tactical.score * 2); else if (tactical.score < 0) score += Math.max(-30, tactical.score * 3);
            if (safety.riskScore > 0) { const risk = safety.riskScore; let penalty; if (risk <= 20) penalty = risk * 0.3; else if (risk <= 50) penalty = 6 + (risk - 20) * 0.6; else if (risk <= 100) penalty = 24 + (risk - 50) * 0.8; else penalty = 64 + (risk - 100) * 1.0; score -= Math.min(45, penalty); }
            const warnCount = safety.warnings ? safety.warnings.length : 0;
            if (warnCount >= 4) score -= 10; else if (warnCount >= 2) score -= 4;
            if (this.isInCautiousMode()) score -= 18;
            return Math.max(3, Math.min(95, Math.round(score)));
        },

        _isCaptureMove(fen, uci, ourColor) { if (!fen || !uci || uci.length < 4 || !ourColor) return false; const from = uci.substring(0, 2), to = uci.substring(2, 4); const target = pieceFromFenChar(fenCharAtSquare(fen, to)); if (target && target.color !== ourColor) return true; return isEnPassantCapture(fen, from, to, ourColor); },
        _isGoodCapture(fen, uci, ourColor) { if (!this._isCaptureMove(fen, uci, ourColor)) return false; const from = uci.substring(0, 2), to = uci.substring(2, 4); return this._staticExchangeEval(fen, from, to, ourColor) >= 0; },

        _multiPvConvergenceCheck(fen, uci, pvMoves, ourColor) { const result = { converged: false, validIn: 0, totalChecked: 0, bonus: 0 }; const oppColor = ourColor === "w" ? "b" : "w"; const oppCandidates = new Set(); if (pvMoves && pvMoves[0]) oppCandidates.add(pvMoves[0]); const fenHash = hashFen(fen); const bucket = (Engine && Engine._premoveCandidates) ? Engine._premoveCandidates[fenHash] : null; if (Array.isArray(bucket)) { bucket.forEach(c => { if (c.pvMoves && c.pvMoves[0]) oppCandidates.add(c.pvMoves[0]); }); } const from = uci.substring(0, 2), to = uci.substring(2, 4), promo = uci[4]; for (const oppMove of oppCandidates) { if (!oppMove || oppMove.length < 4) continue; result.totalChecked++; const predFen = makeSimpleMove(fen, oppMove.slice(0, 2), oppMove.slice(2, 4), oppMove[4]); if (!predFen) continue; const piece = pieceFromFenChar(fenCharAtSquare(predFen, from)); if (!piece || piece.color !== ourColor) continue; const afterFen = makeSimpleMove(predFen, from, to, promo); if (!afterFen) continue; const king = findKing(afterFen, ourColor); if (king && isSquareAttackedBy(afterFen, king, oppColor)) continue; const atk = getAttackersOfSquare(afterFen, to, oppColor); const def = getAttackersOfSquare(afterFen, to, ourColor); const pVal = PIECE_VALUES[piece.type] || 0; if (atk.length > 0 && def.length === 0 && pVal >= 5) continue; result.validIn++; } const ratio = result.totalChecked > 0 ? result.validIn / result.totalChecked : 0; if (ratio >= 1.0) result.bonus = this.HEURISTICS.MULTIPV_FULL_CONSENSUS; else if (ratio >= 0.6) result.bonus = this.HEURISTICS.MULTIPV_PARTIAL_CONSENSUS; else if (ratio < 0.4) result.bonus = this.HEURISTICS.MULTIPV_DIVERGENT_PENALTY; result.converged = ratio >= 0.6; return result; },

        _analyzeRecapture(predictedFen, uci, ourColor, pvMoves) { const result = { isRecapture: false, bonus: 0, speedMultiplier: 1.0 }; let oppMoveTo = null; if (pvMoves && pvMoves[0] && pvMoves[0].length >= 4) oppMoveTo = pvMoves[0].substring(2, 4); if (!oppMoveTo) { const history = getGameHistory(); if (history.length > 0 && history[history.length - 1].length >= 4) oppMoveTo = history[history.length - 1].substring(2, 4); } if (!oppMoveTo) return result; const myTo = uci.substring(2, 4); if (oppMoveTo !== myTo) return result; const target = pieceFromFenChar(fenCharAtSquare(predictedFen, myTo)); if (!target || target.color === ourColor) return result; const see = this._staticExchangeEval(predictedFen, uci.substring(0, 2), myTo, ourColor); result.isRecapture = true; if (see >= 0) { result.bonus = 35; result.speedMultiplier = 0.5; } else if (see >= -2) { result.bonus = 10; result.speedMultiplier = 0.7; } else { result.bonus = -10; } return result; },

        _detectForcedResponse(fen, ourColor) { const result = { isForced: false, bonus: 0 }; const oppColor = ourColor === "w" ? "b" : "w"; const pieces = getAllPieces(fen, oppColor); let reasonableMoves = 0; const oppKing = findKing(fen, oppColor); const weGiveCheck = oppKing && isSquareAttackedBy(fen, oppKing, ourColor); const checkEscapeMoves = []; for (const p of pieces) { const squares = getSquaresAttackedByPiece(fen, p.square, p.type, oppColor); for (const sq of squares) { const testFen = makeSimpleMove(fen, p.square, sq); if (!testFen) continue; const kingAfter = findKing(testFen, oppColor); if (kingAfter && !isSquareAttackedBy(testFen, kingAfter, ourColor)) { reasonableMoves++; if (weGiveCheck) checkEscapeMoves.push(p.square + sq); } if (reasonableMoves > 5) break; } if (reasonableMoves > 5) break; } if (weGiveCheck) { if (checkEscapeMoves.length === 1) { result.bonus = 50; result.isForced = true; } else if (checkEscapeMoves.length <= 3) { result.bonus = 30; result.isForced = true; } else { result.bonus = 12; } } else { if (reasonableMoves <= 1) result.bonus = 30; else if (reasonableMoves <= 3) result.bonus = 15; result.isForced = reasonableMoves <= 3; } return result; },

        _getTimePressureBonus() { try { const clock = getClockTimes(); if (!clock || !clock.found) return { bonus: 0, speedMultiplier: 1.0 }; const myTime = clock.playerTime, oppTime = clock.opponentTime; let bonus = 0, speedMult = 1.0; if (myTime !== null && myTime < 10) { bonus += 20; speedMult = 0.3; } else if (myTime !== null && myTime < 30) { bonus += 8; speedMult = 0.6; } if (oppTime !== null && oppTime < 10) { bonus += 10; speedMult = Math.min(speedMult, 0.5); } return { bonus, speedMultiplier: speedMult }; } catch (e) { return { bonus: 0, speedMultiplier: 1.0 }; } },

        _checkBookPremove(fen, ourColor) { if (!State.useOpeningBook || State.moveNumber > 12) return null; const history = getGameHistory(); const bookMove = OpeningBook.getMove(fen, history); if (bookMove && bookMove.length >= 4) return bookMove; return null; },

        _checkEndgamePremove(fen) { const fenHash = hashFen(fen); if (Syzygy && Syzygy.cache && Syzygy.cache.has(fenHash)) { const data = Syzygy.cache.get(fenHash).payload; if (data && data.moves && data.moves.length > 0) { const best = data.moves[0]; if (best && best.category !== "loss") return best.uci; } } return null; },

        _detectSacrifice(fen, predictedFen, uci, ourColor, pvMoves) { const result = { isSacrifice: false, penalty: 0, details: "" }; const oppMove = (pvMoves && pvMoves[0] && pvMoves[0].length >= 4) ? pvMoves[0] : null; if (!oppMove) return result; const oppFrom = oppMove.substring(0, 2), oppTo = oppMove.substring(2, 4); const capturedByOpp = pieceFromFenChar(fenCharAtSquare(fen, oppTo)); if (!capturedByOpp || capturedByOpp.color !== ourColor) return result; const oppColor = ourColor === "w" ? "b" : "w"; const oppSee = this._staticExchangeEval(fen, oppFrom, oppTo, oppColor); if (oppSee < 0) { result.isSacrifice = true; const sacrificeDepth = Math.abs(oppSee); result.details = `Opp may sacrifice ${capturedByOpp.type} (SEE: ${oppSee})`; if (sacrificeDepth >= 5) { result.penalty = 25; } else if (sacrificeDepth >= 3) { result.penalty = 15; } else { result.penalty = 5; } } return result; },

        _premoveToken: 0,
        _newToken: function () { this._premoveToken = (this._premoveToken || 0) + 1; return this._premoveToken; },
        _isCurrentToken: function (token) { return token === this._premoveToken; },
        _invalidateAllTokens: function () { this._premoveToken = (this._premoveToken || 0) + 1; },

        HEURISTICS: { CHECK_MATE_BONUS: 60, SINGLE_ESCAPE_BONUS: 50, FORCED_MOVE_BONUS_HIGH: 30, FORCED_MOVE_BONUS_LOW: 15, RECAPTURE_SAFE_BONUS: 35, RECAPTURE_MARGINAL_BONUS: 10, RECAPTURE_BAD_PENALTY: -10, MULTIPV_FULL_CONSENSUS: 25, MULTIPV_PARTIAL_CONSENSUS: 12, MULTIPV_DIVERGENT_PENALTY: -15, PV_CONSENSUS_MAX: 30, TIME_PRESSURE_CRITICAL: 25, TIME_PRESSURE_NORMAL: 12, OPPONENT_LOW_TIME_BONUS: 10, SACRIFICE_QUEEN_PENALTY: 25, SACRIFICE_PIECE_PENALTY: 15, SACRIFICE_MINOR_PENALTY: 5, VOLATILITY_HIGH_PENALTY: 5, TACTICAL_EXPLOSION_MAX: 10, REPLY_TREE_BAD: 3, VOLATILITY_BLOCK: 95, EXPLOSION_BLOCK: 80, RISK_CRITICAL: 1000, DELAY_RECAPTURE: 0.35, DELAY_FORCED: 0.5, DELAY_CONVERGED: 0.7, DELAY_SACRIFICE: 2.2, DELAY_VOLATILE: 1.6, DELAY_BOOK_TB: 0.35, DELAY_MIN_MS: 150, DELAY_MAX_MS: 2000, TC_BULLET_BOOST: 30, TC_BLITZ_BOOST: 15, TC_CLASSICAL_PENALTY: -10 },

        _calculatePositionVolatility(fen) { let score = 0; const parts = fen.split(" "); const placement = parts[0]; const turn = parts[1] || "w"; const oppColor = turn === "w" ? "b" : "w"; const pieceMatch = placement.match(/[pnbrqkPNBRQK]/g); score += (pieceMatch ? pieceMatch.length : 0) * 3; const ourKing = findKing(fen, turn); if (ourKing && isSquareAttackedBy(fen, ourKing, oppColor)) score += 40; const oppKing = findKing(fen, oppColor); if (oppKing && isSquareAttackedBy(fen, oppKing, turn)) score += 25; const ourPieces = getAllPieces(fen, turn); let hangingCount = 0; for (const p of ourPieces) { if (p.type === "k") continue; const atk = getAttackersOfSquare(fen, p.square, oppColor).length; const def = getAttackersOfSquare(fen, p.square, turn).length; if (atk > 0 && def === 0) hangingCount += PIECE_VALUES[p.type] || 0; } score += hangingCount * 10; let captureOpportunities = 0; for (const p of ourPieces) { const sqs = getSquaresAttackedByPiece(fen, p.square, p.type, turn); for (const s of sqs) { const target = pieceFromFenChar(fenCharAtSquare(fen, s)); if (target && target.color === oppColor) captureOpportunities++; } } score += Math.min(captureOpportunities, 10) * 2; let totalMoves = 0; for (const p of ourPieces) { totalMoves += getSquaresAttackedByPiece(fen, p.square, p.type, turn).length; } score += Math.min(totalMoves / 5, 20); return Math.min(100, Math.round(score)); },

        _calculatePvConsensus(fen, ourUci, ourColor) { const result = { consensus: 0, bonus: 0, totalLines: 0, agreedLines: 0 }; const fenHash = hashFen(fen); const bucket = (Engine && Engine._premoveCandidates) ? Engine._premoveCandidates[fenHash] : null; if (!Array.isArray(bucket) || bucket.length < 2) return result; result.totalLines = bucket.length; for (const c of bucket) { if (!c.pvMoves || c.pvMoves.length < 2) continue; if (c.pvMoves[1] === ourUci) result.agreedLines++; } result.consensus = result.totalLines > 0 ? result.agreedLines / result.totalLines : 0; if (result.consensus >= 1.0) result.bonus = this.HEURISTICS.PV_CONSENSUS_MAX; else if (result.consensus >= 0.8) result.bonus = Math.round(this.HEURISTICS.PV_CONSENSUS_MAX * 0.6); else if (result.consensus >= 0.5) result.bonus = Math.round(this.HEURISTICS.PV_CONSENSUS_MAX * 0.27); return result; },

        _opponentReplyExpectedScore(fen, ourUci, ourColor, pvMoves) { const result = { expectedScore: 0, worstScore: 999, bestScore: -999, replies: 0 }; const oppColor = ourColor === "w" ? "b" : "w"; const oppCandidates = []; const fenHash = hashFen(fen); const bucket = (Engine && Engine._premoveCandidates) ? Engine._premoveCandidates[fenHash] : null; if (Array.isArray(bucket)) { for (const c of bucket) { if (c.pvMoves && c.pvMoves[0] && c.pvMoves[0].length >= 4) oppCandidates.push({ move: c.pvMoves[0], weight: 1 }); } } if (pvMoves && pvMoves[0] && pvMoves[0].length >= 4 && !oppCandidates.some(c => c.move === pvMoves[0])) oppCandidates.push({ move: pvMoves[0], weight: 2 }); if (oppCandidates.length === 0) return result; const totalWeight = oppCandidates.reduce((s, c) => s + c.weight, 0); const ourFrom = ourUci.substring(0, 2), ourTo = ourUci.substring(2, 4), ourPromo = ourUci.length > 4 ? ourUci[4] : null; for (const cand of oppCandidates) { const predFen = makeSimpleMove(fen, cand.move.substring(0, 2), cand.move.substring(2, 4)); if (!predFen) continue; const piece = pieceFromFenChar(fenCharAtSquare(predFen, ourFrom)); if (!piece || piece.color !== ourColor) { result.worstScore = -999; continue; } const afterFen = makeSimpleMove(predFen, ourFrom, ourTo, ourPromo); if (!afterFen) { result.worstScore = -999; continue; } const king = findKing(afterFen, ourColor); if (king && isSquareAttackedBy(afterFen, king, oppColor)) { result.worstScore = -999; continue; } const atk = getAttackersOfSquare(afterFen, ourTo, oppColor); const def = getAttackersOfSquare(afterFen, ourTo, ourColor); const pVal = PIECE_VALUES[piece.type] || 0; let replyScore = 0; if (atk.length > 0 && def.length === 0) replyScore = -pVal * 3; else if (atk.length > def.length) replyScore = -pVal; else replyScore = 1; const prob = cand.weight / totalWeight; result.expectedScore += prob * replyScore; if (replyScore < result.worstScore) result.worstScore = replyScore; if (replyScore > result.bestScore) result.bestScore = replyScore; result.replies++; } return result; },

        _detectTacticalExplosion(fen, ourColor) { const result = { explosion: false, severity: 0, reasons: [] }; const oppColor = ourColor === "w" ? "b" : "w"; let severity = 0; const ourKing = findKing(fen, ourColor); if (ourKing && isSquareAttackedBy(fen, ourKing, oppColor)) { severity += 60; result.reasons.push("Our king in check"); } const oppKing = findKing(fen, oppColor); if (oppKing && isSquareAttackedBy(fen, oppKing, ourColor)) { severity += 30; result.reasons.push("We give check"); } const ourPieces = getAllPieces(fen, ourColor); let hangingVal = 0; for (const p of ourPieces) { if (p.type === "k") continue; const atk = getAttackersOfSquare(fen, p.square, oppColor).length; const def = getAttackersOfSquare(fen, p.square, ourColor).length; if (atk > 0 && def === 0) hangingVal += PIECE_VALUES[p.type] || 0; } if (hangingVal >= 9) { severity += 40; result.reasons.push("Queen/rook hanging"); } else if (hangingVal >= 5) { severity += 20; result.reasons.push("Major piece hanging"); } if (ThreatDetectionSystem && ThreatDetectionSystem.detectOpponentForks) { const forks = ThreatDetectionSystem.detectOpponentForks(fen, ourColor); if (Array.isArray(forks) && forks.length > 0) { severity += 25; result.reasons.push("Fork threat detected"); } } result.severity = Math.min(100, severity); result.explosion = severity >= 40; return result; },

        _getContextualPremoveDelay(decision) { let base = State.premoveDelayMs || 250; if (decision.recapture && decision.recapture.isRecapture) base = Math.round(base * this.HEURISTICS.DELAY_RECAPTURE); else if (decision.forced && decision.forced.isForced) base = Math.round(base * this.HEURISTICS.DELAY_FORCED); else if (decision.convergence && decision.convergence.converged) base = Math.round(base * this.HEURISTICS.DELAY_CONVERGED); if (decision.sacrifice && decision.sacrifice.isSacrifice) base = Math.round(base * this.HEURISTICS.DELAY_SACRIFICE); if (decision.volatility && decision.volatility > 60) base = Math.round(base * this.HEURISTICS.DELAY_VOLATILE); if (decision.timePressure && decision.timePressure.speedMultiplier < 1) base = Math.round(base * decision.timePressure.speedMultiplier); if (decision.isBook || decision.isTB) base = Math.round(base * this.HEURISTICS.DELAY_BOOK_TB); return this._humanDelay(Math.max(60, Math.min(2000, base))); },

        _getTimeControlProfile() { const clock = getClockTimes(); if (!clock.found || clock.playerTime === null) return { profile: "rapid", aggressionMultiplier: 1.0, confidenceBoost: 0 }; const initialEstimate = clock.playerTime + (State.moveNumber || 1) * 5; if (initialEstimate <= 180) return { profile: "bullet", aggressionMultiplier: 2.2, confidenceBoost: this.HEURISTICS.TC_BULLET_BOOST }; else if (initialEstimate <= 600) return { profile: "blitz", aggressionMultiplier: 1.5, confidenceBoost: this.HEURISTICS.TC_BLITZ_BOOST }; else if (initialEstimate <= 1800) return { profile: "rapid", aggressionMultiplier: 1.0, confidenceBoost: 0 }; else return { profile: "classical", aggressionMultiplier: 0.6, confidenceBoost: this.HEURISTICS.TC_CLASSICAL_PENALTY }; },

        _validatePreExecution(fenHash, uci, ourColor, isPremove) { const currentFen = getAccurateFen(); if (!currentFen) return { ok: false, reason: "Cannot read board" }; const from = uci.substring(0, 2); const piece = pieceFromFenChar(fenCharAtSquare(currentFen, from)); if (!piece || piece.color !== ourColor) return { ok: false, reason: "Piece missing from origin" }; const turn = getCurrentTurn(currentFen); if (!isPremove && turn !== ourColor) return { ok: false, reason: "Not our turn" }; if (!isPremove) { const to = uci.substring(2, 4), promo = uci.length > 4 ? uci[4] : null; const afterFen = makeSimpleMove(currentFen, from, to, promo); if (!afterFen || afterFen === currentFen) return { ok: false, reason: "Move illegal" }; const oppColor = ourColor === "w" ? "b" : "w"; const king = findKing(afterFen, ourColor); if (king && isSquareAttackedBy(afterFen, king, oppColor)) return { ok: false, reason: "Move exposes king" }; } const board = getBoardElement(); if (board && (board.classList.contains("animating") || board.classList.contains("dragging"))) return { ok: false, reason: "Board is animating/dragging" }; return { ok: true }; },

        shouldPremove(fen, uci, pvMoves, scoreInfo) {
            if (this.executionLock || this.processingLock) return { allowed: false, reason: "System locked" };
            if (this.isInErrorCooldown()) return { allowed: false, reason: "Error cooldown active" };
            const ourColor = getPlayingAs();
            if (!ourColor) return { allowed: false, reason: "Unknown color" };
            const predictedFen = getPredictedFen(fen, pvMoves);
            if (predictedFen) { const bookMove = this._checkBookPremove(predictedFen, ourColor); if (bookMove === uci) return { allowed: true, confidence: 95, reason: "Theory/Book", isBook: true }; const tbMove = this._checkEndgamePremove(predictedFen); if (tbMove === uci) return { allowed: true, confidence: 100, reason: "Tablebase (Win/Draw)", isTB: true }; }
            if (!predictedFen || predictedFen === fen) return { allowed: false, reason: "Cannot predict position after opponent move" };
            const fenHash = hashFen(predictedFen);
            if (this.executedFens.has(fenHash)) return { allowed: false, reason: "Position already executed" };
            const from = uci.substring(0, 2), to = uci.substring(2, 4);
            const movingPiece = pieceFromFenChar(fenCharAtSquare(predictedFen, from));
            if (!movingPiece || movingPiece.color !== ourColor) return { allowed: false, reason: "Move invalid in predicted position" };
            const config = this.AGGRESSION_CONFIG[State.premoveMode] || this.AGGRESSION_CONFIG.filter;
            const mode = State.premoveMode || "filter";
            const isEveryMode = mode === "every", isCaptureMode = mode === "capture", isFilteredMode = mode === "filter";
            const recapture = this._analyzeRecapture(predictedFen, uci, ourColor, pvMoves);
            const forced = this._detectForcedResponse(fen, ourColor);
            const convergence = this._multiPvConvergenceCheck(fen, uci, pvMoves, ourColor);
            const timePressure = this._getTimePressureBonus();
            const sacrifice = this._detectSacrifice(fen, predictedFen, uci, ourColor, pvMoves);
            const volatility = this._calculatePositionVolatility(fen);
            const pvConsensus = this._calculatePvConsensus(fen, uci, ourColor);
            const replyTree = this._opponentReplyExpectedScore(fen, uci, ourColor, pvMoves);
            const tacticalExplosion = this._detectTacticalExplosion(fen, ourColor);
            const tcProfile = this._getTimeControlProfile();
            if (isCaptureMode) { if (!this._isCaptureMove(predictedFen, uci, ourColor)) return { allowed: false, reason: "Capture mode: bukan capture" }; const captureCheck = this._validateCaptureQuality(predictedFen, uci, ourColor, config); if (!captureCheck.ok) return { allowed: false, reason: "Capture mode: " + captureCheck.reason }; }
            if (isEveryMode && config.allowSpeculative && scoreInfo && scoreInfo.type === "cp") { const evalForUs = -(scoreInfo.value || 0); if (evalForUs < (config.minEvalForSpeculative || -200)) return { allowed: false, reason: `Every mode: eval terlalu negatif (${evalForUs}cp)` }; }
            const tactical = this.analyzeTacticalMotifs(predictedFen, uci, ourColor);
            if (tactical.isBlunder) { this.recordBlunder(predictedFen); return { allowed: false, reason: "Blunder terdeteksi: " + tactical.details.join("; "), tactical }; }
            if (isFilteredMode && config.requireMoveQuality) { const moveCheck = this._validateMoveQuality(predictedFen, uci, ourColor, tactical, config); if (!moveCheck.ok) return { allowed: false, reason: "Filter mode: " + moveCheck.reason }; }
            const safety = this.analyzeSafety(predictedFen, uci, ourColor, config);
            if (safety.riskScore >= 1000) return { allowed: false, reason: "Safety critical: " + (safety.warnings[0] || "King exposed"), safety };
            if (safety.riskScore >= (config.maxRiskScore || 200)) return { allowed: false, reason: `Risk ${Math.round(safety.riskScore)} >= cap ${config.maxRiskScore}`, safety };
            const riskBoost = isEveryMode ? 1.4 : (isCaptureMode ? 0.7 : 1.0);
            const riskThreshold = config.riskTolerance * this.RISK_MULTIPLIERS.BLOCK_THRESHOLD * riskBoost;
            if (!safety.safe && safety.riskScore > riskThreshold) return { allowed: false, reason: `Terlalu berisiko: ${Math.round(safety.riskScore)} > ${Math.round(riskThreshold)}`, safety };
            if (isCaptureMode && (!safety.safe || safety.riskScore > (config.maxRiskScore || 100))) return { allowed: false, reason: "Capture mode: capture tidak aman", riskScore: safety.riskScore };
            let confidence = this.calculateConfidence(scoreInfo, tactical, safety, config);
            if (recapture.isRecapture) confidence += recapture.bonus;
            if (forced.isForced) confidence += forced.bonus;
            confidence += convergence.bonus; confidence += timePressure.bonus;
            if (sacrifice.isSacrifice) confidence -= sacrifice.penalty;
            confidence += pvConsensus.bonus; confidence += tcProfile.confidenceBoost;
            if (tacticalExplosion.explosion) confidence -= Math.min(tacticalExplosion.severity / 5, 10);
            if (volatility > 80) confidence -= 5;
            if (replyTree.replies > 0 && replyTree.worstScore < -5) confidence -= 3;
            if (isEveryMode) { const safetyRatio = Math.max(0, 1 - (safety.riskScore / (config.maxRiskScore || 220))); confidence = Math.min(95, confidence + Math.round((config.maxConfidenceBoost || 8) * safetyRatio)); }
            if (isCaptureMode) { confidence = Math.max(5, confidence - 3); if (tactical.score >= 3) confidence = Math.min(95, confidence + 5); }
            if (isFilteredMode && tactical.isBrilliant) confidence = Math.min(90, confidence + 8);
            if (this.isInCautiousMode()) confidence = Math.max(config.minConfidence, confidence - 20);
            const effectiveMin = this.isInCautiousMode() ? Math.min(60, config.minConfidence + 20) : config.minConfidence;
            if (confidence < effectiveMin) return { allowed: false, reason: `Confidence kurang: ${confidence} < ${effectiveMin}`, confidence, required: effectiveMin };
            const pattern = this.detectPattern();
            if (pattern && pattern.isTooConsistent && !isEveryMode) { const threshold = 68 + Math.random() * 22; if (confidence < threshold && !tactical.isBrilliant) { this.patternBreakCounter++; return { allowed: false, reason: "Pattern break (humanisasi)", pattern }; } }
            if (!tactical.isBrilliant) { const roll = Math.random() * 100; const rollBuffer = config.rollBuffer || 0; if (roll > confidence + rollBuffer) return { allowed: false, reason: `Roll gagal (roll: ${Math.round(roll)}, need: ${Math.round(confidence + rollBuffer)})`, confidence, roll: Math.round(roll) }; }
            const promo = uci.length > 4 ? uci[4] : null;
            const verifyFen = makeSimpleMove(predictedFen, from, to, promo);
            if (verifyFen) { const oppColor = ourColor === "w" ? "b" : "w"; const verifyKing = findKing(verifyFen, ourColor); if (verifyKing && isSquareAttackedBy(verifyFen, verifyKing, oppColor)) return { allowed: false, reason: "Final gate: move meninggalkan raja dalam check" }; }
            return { allowed: true, confidence, tactical, safety, pattern, mode, recapture, forced, convergence, timePressure, sacrifice, volatility, pvConsensus, replyTree, tacticalExplosion, tcProfile };
        },

        async execute(fen, uci, decision) {
            if (!decision || !decision.allowed) return false;
            const now = Date.now();
            if (now - this.lastExecutionTime < this.MIN_EXECUTION_INTERVAL) return false;
            if (this.executionLock) return false;
            const execToken = this._newToken();
            this.executionLock = true; this.processingLock = true;
            try {
                const fenHash = hashFen(fen);
                if (this.executedFens.has(fenHash)) return false;
                this.executedFens.add(fenHash);
                if (this.executedFens.size > this.MAX_EXECUTED_FENS) { const arr = [...this.executedFens]; this.executedFens = new Set(arr.slice(-Math.floor(this.MAX_EXECUTED_FENS * 0.7))); }
                const delay = this._getContextualPremoveDelay(decision);
                await sleep(delay);
                if (!this._isCurrentToken(execToken)) { this.executedFens.delete(fenHash); return false; }
                const currentFen = getAccurateFen();
                if (currentFen) { const currentHash = hashFen(currentFen); if (currentHash !== fenHash && normalizeFen(currentFen) !== normalizeFen(fen)) { this.executedFens.delete(fenHash); return false; } }
                const from = uci.slice(0, 2), to = uci.slice(2, 4), promotion = uci.length > 4 ? uci.slice(4) : null;
                const ourColor = getPlayingAs();
                if (!ourColor) { this.executedFens.delete(fenHash); return false; }
                const preExecCheck = this._validatePreExecution(fenHash, uci, ourColor, true);
                if (!preExecCheck.ok) { this.executedFens.delete(fenHash); return false; }
                const ok = await MoveExecutor._clickMove(from, to, promotion, true);
                if (ok === true) {
                    this.consecutiveErrors = 0;
                    this.moveHistory.push({ move: uci, timeSpent: delay, wasEngineMove: true, timestamp: Date.now(), confidence: decision.confidence, mode: decision.mode || State.premoveMode });
                    if (this.moveHistory.length > this.MAX_HISTORY) this.moveHistory = this.moveHistory.slice(-this.MAX_HISTORY);
                    this.lastSafeMoves.push({ fen, uci, timestamp: Date.now() });
                    if (this.lastSafeMoves.length > 10) this.lastSafeMoves.shift();
                } else { this.consecutiveErrors++; }
                return ok;
            } catch (e) { console.error("SmartPremove execution error:", e); this.consecutiveErrors++; return false; }
            finally { this.executionLock = false; this.processingLock = false; this.lastExecutionTime = Date.now(); }
        },

        _humanDelay(base) { const u1 = Math.random(), u2 = Math.random(); const normal = Math.sqrt(-2 * Math.log(Math.max(u1, 0.001))) * Math.cos(2 * Math.PI * u2); const delay = base + normal * (base * 0.25); const thinkPause = Math.random() < 0.1 ? (base * 0.5 + Math.random() * base) : 0; return Math.min(this.HEURISTICS.DELAY_MAX_MS, Math.max(this.HEURISTICS.DELAY_MIN_MS, delay + thinkPause)); },

        getStats() { const pattern = this.detectPattern(); return { executedPositions: this.executedFens.size, moveHistory: this.moveHistory.length, consecutiveErrors: this.consecutiveErrors, patternBreaks: this.patternBreakCounter, blunderCount: this.blunderCount, isLocked: this.executionLock || this.processingLock, inCooldown: this.isInErrorCooldown(), inCautiousMode: this.isInCautiousMode(), pattern, lastExecutionTime: this.lastExecutionTime, recentMoves: this.moveHistory.slice(-5) }; }
    };

    // =====================================================
    // Section 10: Engine Execution Functions
    // =====================================================
    let _pendingEngineRunId = null;
    function runEngineNow() {
        let fen = getAccurateFen();
        if (!fen) { warn("Cannot get FEN"); return; }
        if (_pendingEngineRunId) { clearTimeout(_pendingEngineRunId); _pendingEngineRunId = null; }
        if (State.isThinking) { Engine.stop(); _pendingEngineRunId = scheduleManagedTimeout(function () { _doRun(fen); }, 100); }
        else { _doRun(fen); }
    }

    let _goLock = false;
    function _doRun(fen) {
        if (_goLock) return;
        _goLock = true;
        try {
            if (State.useOpeningBook && State.evaluationMode === "engine") {
                let history = getGameHistory();
                let bookMove = OpeningBook.getMove(fen, history);
                if (bookMove) { State.isThinking = false; State.statusInfo = "Book Move: " + bookMove; UI.updateStatusInfo(); MoveExecutor.recordMove(bookMove); if (State.autoMovePiece) executeAction(bookMove, fen); return; }
            }
            Engine.go(fen, State.customDepth);
        } finally {
            _goLock = false;
        }
    }

    function autoRunCheck() {
        if (!State.autoRun || State.isThinking || !isPlayersTurn()) return;
        let fen = getAccurateFen();
        if (!fen || fen === State.lastAutoRunFen) return;
        State.lastAutoRunFen = fen;
        runEngineNow();
    }

    function syncAnalysisMoveHistory() {
        if (!State.analysisMode) return;
        let history = getGameHistory();
        if (!Array.isArray(history)) return;
        State.analysisHistoryCursor = history.length;
    }

    function recordAnalysisBestmove(move, evalText, depth, fen, sourceTag) {
        if (!State.analysisMode || !move || move.length < 4) return;
        let fenKey = hashFen(fen || getAccurateFen() || "");
        let recordKey = fenKey + "|" + move;
        if (State.analysisLastRecordedKey === recordKey) return;
        MoveHistory.add(move, evalText || State.analysisEvalText || State.lastEvalText1 || "0.00", depth || State._lastAnalysisDepth || State.customDepth, "Analysis", null, sourceTag || "Analysis");
        State.analysisLastRecordedKey = recordKey;
    }

    function analysisCheck() {
        if (!State.analysisMode || !Engine.analysis) return;
        let fen = getAccurateFen();
        if (!fen) return;
        if (fen === State._lastAnalysisFen) return;
        syncAnalysisMoveHistory();
        UI.clearAll();
        State.topMoves = []; State.topMoveInfos = {};
        let maxRows = clamp(State.numberOfMovesToShow || 5, 2, 10);
        for (let i = 1; i <= maxRows; i++) { UI.updateMove(i, "...", "0.00", "eval-equal"); }
        State._lastAnalysisFen = fen; State.analysisPVTurn = getCurrentTurn(fen); State.isAnalysisThinking = true;
        State._lastAnalysisDepth = 0; State._analysisDepthByPv = {}; State._lastAnalysisBestPV = []; State._lastAnalysisBestMove = null;
        State.analysisPVLine = []; State.analysisStableCount = 0; State.analysisLastBestMove = "";
        State.analysisPrevEvalCp = null; State.analysisLastEvalCp = null;
        State._analysisAutoPlayApproved = false; State._analysisAutoPlayMove = null;
        Syzygy.maybeProbe(fen);
        if (Syzygy.tryUseForAnalysis(fen)) return;
        Engine.analysis.postMessage("stop");
        Engine.analysis.postMessage("position fen " + fen);
        Engine.analysis.postMessage("go depth " + State.customDepth);
        State.statusInfo = "Analyzing..."; UI.updateStatusInfo();
    }

    // =====================================================
    // Section 11: Premove Check
    // =====================================================
    function premoveCheck() {
        if (!State.premoveEnabled) return;
        let now = Date.now();
        if (now - State.premoveLastAnalysisTime < State.premoveThrottleMs) return;
        if (Engine._premoveEngineBusy) return;
        const fen = getAccurateFen();
        if (!fen) return;
        const fenHash = hashFen(fen);
        if (State.premoveExecutedForFen === fenHash) return;
        if (Engine._premoveProcessedFens.has(fenHash)) return;
        const game = getGame();
        if (!game || isPlayersTurn(game)) { State.premoveExecutedForFen = null; return; }
        if (State.premoveAnalysisInProgress) return;
        if (Engine._premoveLastFen === fenHash) return;
        State.premoveAnalysisInProgress = true;
        State.premoveLastAnalysisTime = now;
        if (!Engine.premove) {
            let loaded = Engine.loadPremoveEngine();
            if (!loaded) { State.premoveAnalysisInProgress = false; return; }
            scheduleManagedTimeout(function () { _startPremoveAnalysis(fen, fenHash); }, 200);
        } else {
            _startPremoveAnalysis(fen, fenHash);
        }
        UI.updateStatusInfo();
    }

    function _startPremoveAnalysis(fen, fenHash) {
        Engine._premoveEngineBusy = true; Engine._premoveLastFen = fenHash; Engine._premoveLastActivityTs = Date.now();
        Engine.premove.postMessage("stop"); Engine.premove.postMessage("ucinewgame");
        scheduleManagedTimeout(function () {
            const freshFen = getAccurateFen();
            if (hashFen(freshFen) !== fenHash) { Engine._premoveEngineBusy = false; State.premoveAnalysisInProgress = false; return; }
            Engine.premove.postMessage("position fen " + fen);
            Engine.premove.postMessage("go depth " + (State.premoveDepth || 15));
            Engine._premoveLastActivityTs = Date.now();
            if (Engine._premoveTimeoutId) { clearTimeout(Engine._premoveTimeoutId); Engine._premoveTimeoutId = null; }
            Engine._premoveTimeoutId = setTimeout(function () { Engine._premoveEngineBusy = false; State.premoveAnalysisInProgress = false; Engine._premoveLastActivityTs = Date.now(); if (Engine.premove) Engine.premove.postMessage("stop"); }, CONFIG.PREMOVE.ENGINE_TIMEOUT);
        }, 50);
        State.statusInfo = "Smart premove analyzing..."; UI.updateStatusInfo();
    }

    function autoMatchCheck() {
        if (!State.autoMatch) return;
        if (State.analysisMode) return;
        let modal = $(".game-result-component, .game-over-modal-shell-content, .daily-game-footer-game-over");
        if (!modal) return;
        AutoMatch.try();
    }

    // =====================================================
    // Section 12: User Interface Panel Construction
    // =====================================================
    function getPanelHTML() {
        let mode = State.evaluationMode;
        let modeText = mode === "engine" ? "ENGINE" : "HUMAN";
        let modeClass = mode === "engine" ? "on" : "off";
        let multiPvCount = 2;
        let safeNotationSequence = escapeHtml(String(State.notationSequence || ""));
        let safePrincipalVariation = escapeHtml(String(State.principalVariation || "Waiting for analysis..."));
        let safeStatusInfo = escapeHtml(String(State.statusInfo || "Ready"));

        let topMovesRows = "";
        for (let i = 1; i <= multiPvCount; i++) {
            topMovesRows += '<div class="cap-move-row"><span class="cap-rank">' + i + '.</span><span id="topMove' + i + '" class="cap-move-text">...</span><span id="topMoveEval' + i + '" class="eval eval-equal">0.00</span></div>';
        }

        let eloOptions = "";
        let keys = Object.keys(ELO_LEVELS);
        for (let i = 0; i < keys.length; i++) {
            let k = keys[i];
            let v = ELO_LEVELS[k];
            let sel = State.humanLevel === k ? " selected" : "";
            eloOptions += "<option value=\"" + k + "\"" + sel + ">" + k.charAt(0).toUpperCase() + k.slice(1) + " (" + v.elo + ")</option>";
        }

        let resignMateOptions = "";
        for (let m = 1; m <= 5; m++) {
            let s = State.autoResignThresholdMate === m ? " selected" : "";
            resignMateOptions += "<option value=\"" + m + "\"" + s + ">M" + m + "</option>";
        }

        return '<div class="cap-panel">' +
            '<div class="cap-header cap-drag-handle">' +
            '<div class="cap-header-left">' +
            '<span class="cap-title">BINTANG TOBA</span>' +
            '<div class="cap-leds">' +
            '<div id="engine-status-led" class="cap-led green" title="Engine"></div>' +
            '<div id="GILIRAN-SAYA" class="cap-led blue" title="My Turn"></div>' +
            '<div id="GILIRAN-LAWAN" class="cap-led red" title="Opponent Turn"></div>' +
            '</div>' +
            '<span id="digital-clock" class="cap-clock">--:--:--</span>' +
            '</div>' +
            '<div class="cap-header-btns">' +
            '<div class="cap-gear-wrap">' +
            '<button id="cap-gear" title="Quick Menu">⚙</button>' +
            '<div id="cap-gear-menu" class="cap-gear-menu" style="display:none">' +
            '<button id="cap-gear-more" type="button">More Controls</button>' +
            '<button id="cap-gear-hotkeys" type="button">Hotkeys Help</button>' +
            '<button id="cap-gear-silent" type="button">Silent Logs: ' + (State.silentLogging ? 'ON' : 'OFF') + '</button>' +
            '</div>' +
            '</div>' +
            '<button id="cap-minimize" title="Minimize">-</button>' +
            '<button id="cap-maximize" title="Restore">+</button>' +
            '<button id="cap-close" title="Close">x</button>' +
            '</div>' +
            '</div>' +
            '<div class="cap-tabs">' +
            '<div class="cap-tab active" data-tab="tab-engine">Engine</div>' +
            '<div class="cap-tab" data-tab="tab-premove">Premove</div>' +
            '<div class="cap-tab" data-tab="tab-control">Time</div>' +
            '<div class="cap-tab" data-tab="tab-display">Display</div>' +
            '<div class="cap-tab" data-tab="tab-opening">Book</div>' +
            '<div class="cap-tab" data-tab="tab-moves">Moves</div>' +
            '<div class="cap-tab" data-tab="tab-settings">More</div>' +
            '</div>' +
            '<div class="cap-content" id="cap-content-area">' +

            '<div id="tab-engine" class="cap-tab-content">' +
            '<div class="cap-group"><label>Engine Mode</label>' +
            '<button id="btn-eval-mode" class="cap-toggle ' + modeClass + '" data-value="' + mode + '">' + modeText + '</button></div>' +
            '<div id="human-group" class="cap-group" style="' + (mode === "human" ? "" : "display:none") + '">' +
            '<label>Human Level</label><select id="sel-human-level">' + eloOptions + '</select></div>' +
            '<div id="human-elo-group" class="cap-group" style="' + (mode === "human" ? "" : "display:none") + '">' +
            '<label>ELO: <strong id="elo-display">' + State.eloRating + '</strong></label>' +
            '<input type="range" id="sld-elo" min="300" max="3200" step="10" value="' + State.eloRating + '"></div>' +
            '<div class="cap-row">' +
            '<div class="cap-group cap-half"><label>Depth: <strong id="depth-display">' + State.customDepth + '</strong></label>' +
            '<input type="range" id="sld-depth" min="1" max="' + CONFIG.MAX_DEPTH + '" value="' + State.customDepth + '"></div>' +
            '<div class="cap-group cap-half"><label>Skill: <strong id="skill-display">' + State.skillLevel + '</strong></label>' +
            '<input type="range" id="sld-skill" min="0" max="20" value="' + State.skillLevel + '"></div>' +
            '</div>' +
            '<div class="cap-row">' +
            '<div class="cap-group cap-half"><label>Auto Depth by Opponent</label>' +
            '<button id="btn-auto-depth" class="cap-toggle ' + (State.autoDepthAdapt ? "on" : "off") + '">' + (State.autoDepthAdapt ? "ON" : "OFF") + '</button></div>' +
            '<div class="cap-group cap-half"><label>Move Execution Mode</label><div class="cap-btn-row">' +
            '<button class="cap-color-btn ' + (State.moveExecutionMode === "click" ? "active" : "") + '" id="btn-mode-click" data-mode="click">CLICK</button>' +
            '<button class="cap-color-btn ' + (State.moveExecutionMode === "drag" ? "active" : "") + '" id="btn-mode-drag" data-mode="drag">DRAG</button>' +
            '</div></div>' +
            '</div>' +
            '<div class="cap-row">' +
            '<div class="cap-group cap-half"><label>Auto Run</label><button id="btn-auto-run" class="cap-toggle ' + (State.autoRun ? "on" : "off") + '">' + (State.autoRun ? "ON" : "OFF") + '</button></div>' +
            '<div class="cap-group cap-half"><label>Auto Move</label><button id="btn-auto-move" class="cap-toggle ' + (State.autoMovePiece ? "on" : "off") + '">' + (State.autoMovePiece ? "ON" : "OFF") + '</button></div>' +
            '<div class="cap-group cap-half"><label>Auto Play</label><button id="btn-auto-match" class="cap-toggle ' + (State.autoMatch ? "on" : "off") + '">' + (State.autoMatch ? "ON" : "OFF") + '</button></div>' +
            '</div>' +
            '<div class="cap-group"><label>Analysis Mode</label><button id="btn-analysis" class="cap-toggle ' + (State.analysisMode ? "on" : "off") + '">' + (State.analysisMode ? "ON" : "OFF") + '</button></div>' +
            '<div id="analysis-colors-group" class="cap-group" style="' + (State.analysisMode ? "" : "display:none") + '">' +
            '<label>Auto Play Color</label><div class="cap-btn-row">' +
            '<button class="cap-color-btn ' + (State.autoAnalysisColor === "white" ? "active" : "") + '" data-color="white">White</button>' +
            '<button class="cap-color-btn ' + (State.autoAnalysisColor === "black" ? "active" : "") + '" data-color="black">Black</button>' +
            '<button class="cap-color-btn ' + (State.autoAnalysisColor === "none" ? "active" : "") + '" data-color="none">Off</button>' +
            '</div></div>' +
            '</div>' +

            '<div id="tab-premove" class="cap-tab-content" style="display:none">' +
            '<div class="cap-group"><label>Premove System</label>' +
            '<button id="btn-premove" class="cap-toggle ' + (State.premoveEnabled ? "on" : "off") + '">' + (State.premoveEnabled ? "ON" : "OFF") + '</button></div>' +
            '<div id="premove-settings" style="' + (State.premoveEnabled ? "" : "display:none") + '">' +
            '<div class="cap-group"><label>Premove Mode</label><select id="sel-premove-mode">' +
            '<option value="every"' + (State.premoveMode === "every" ? " selected" : "") + '>Every Move</option>' +
            '<option value="capture"' + (State.premoveMode === "capture" ? " selected" : "") + '>Captures Only</option>' +
            '<option value="filter"' + (State.premoveMode === "filter" ? " selected" : "") + '>Filtered Pieces</option></select></div>' +
            '<div class="cap-group"><label>Premove Expected</label><div id="premoveChanceDisplay" style="padding:8px;background:#313244;border:1px solid #45475a;border-radius:6px;font-family:monospace;font-size:11px;color:#cdd6f4;">-</div></div>' +
            '<div class="cap-group"><label>Premove Stats</label><div id="premoveStatsDisplay" style="padding:8px;background:#1e1e2e;border:1px solid #45475a;border-radius:6px;font-family:monospace;font-size:10px;color:#a6adc8;">A:0 OK:0 EX:0 BL:0 FL:0</div></div>' +
            '<div id="premove-piece-filters" class="cap-group" style="' + (State.premoveMode === "filter" ? "" : "display:none") + '">' +
            '<label>Allowed Pieces</label><div class="piece-filters">' +
            '<label class="chip"><input type="checkbox" data-piece="q"' + (State.premovePieces.q ? " checked" : "") + '><span>Q</span></label>' +
            '<label class="chip"><input type="checkbox" data-piece="r"' + (State.premovePieces.r ? " checked" : "") + '><span>R</span></label>' +
            '<label class="chip"><input type="checkbox" data-piece="b"' + (State.premovePieces.b ? " checked" : "") + '><span>B</span></label>' +
            '<label class="chip"><input type="checkbox" data-piece="n"' + (State.premovePieces.n ? " checked" : "") + '><span>N</span></label>' +
            '<label class="chip"><input type="checkbox" data-piece="p"' + (State.premovePieces.p ? " checked" : "") + '><span>P</span></label>' +
            '</div></div>' +

            '<div class="cap-group"><label>CCT Analysis (Checks, Captures, Threats)</label>' +
            '<button id="btn-cct-analysis" class="cap-toggle ' + (State.cctAnalysisEnabled ? "on" : "off") + '">' + (State.cctAnalysisEnabled ? "ON" : "OFF") + '</button></div>' +
            '<div id="cct-settings" class="cap-group" style="' + (State.cctAnalysisEnabled ? "" : "display:none") + '">' +
            '<label>CCT Components</label><div class="piece-filters">' +
            '<label class="chip"><input type="checkbox" id="cct-checks"' + (State.cctComponents.checks ? " checked" : "") + '><span>Checks</span></label>' +
            '<label class="chip"><input type="checkbox" id="cct-captures"' + (State.cctComponents.captures ? " checked" : "") + '><span>Captures</span></label>' +
            '<label class="chip"><input type="checkbox" id="cct-threats"' + (State.cctComponents.threats ? " checked" : "") + '><span>Threats</span></label>' +
            '</div>' +
            '<div style="margin-top:8px"><label style="display:flex;align-items:center;gap:6px;margin:0"><input type="checkbox" id="cct-debug-enabled"' + (State.cctDebugEnabled ? " checked" : "") + '><span>CCT Debug</span></label></div>' +
            '<div id="cctDebugDisplay" style="margin-top:8px;padding:8px;background:#1e1e2e;border:1px solid #45475a;border-radius:6px;font-family:monospace;font-size:10px;color:#a6adc8;line-height:1.5;max-height:92px;overflow:auto;">' +
            escapeHtml(String(State.cctLastDebugText || "CCT debug idle")) +
            '</div>' +
            '<div style="margin-top:8px;font-size:10px;color:#6c7086;line-height:1.5">' +
            '• <strong>Checks:</strong> Detect safe check opportunities<br>' +
            '• <strong>Captures:</strong> Analyze material exchanges<br>' +
            '• <strong>Threats:</strong> Detect forks, pins, discoveries' +
            '</div></div>' +
            '<div class="cap-info-box"><p><strong>How it works:</strong></p><ul style="margin:5px 0;padding-left:16px;font-size:11px">' +
            '<li>Analyzes opponent likely move</li><li>Pre-calculates your best response</li>' +
            '<li>Executes instantly when opponent moves</li><li>CCT safety checks prevent blunders</li></ul></div>' +
            '</div></div>' +

            '<div id="tab-control" class="cap-tab-content" style="display:none">' +
            '<div class="cap-row cap-delay-head-row">' +
            '<div class="cap-group cap-half cap-delay-head-group"><label>Delay Mode</label>' +
            '<button id="btn-delay-mode" class="cap-toggle ' + (State.clockSync ? "on" : "off") + '">' + (State.clockSync ? "Clock Sync" : "Normal") + '</button></div>' +
            '<div id="delay-presets-group" class="cap-group cap-half cap-delay-head-group" style="' + (State.clockSync ? "display:none" : "") + '"><label>Presets</label><div class="cap-btn-row" id="delay-presets-container">' +
            '<button class="cap-preset-btn" id="btn-preset-bullet" data-preset="bullet" title="Bullet: 0.5-1s">Bullet</button>' +
            '<button class="cap-preset-btn" id="btn-preset-blitz" data-preset="blitz" title="Blitz: 1-2s">Blitz</button>' +
            '<button class="cap-preset-btn" id="btn-preset-rapid" data-preset="rapid" title="Rapid: 2-4s">Rapid</button>' +
            '</div></div>' +
            '</div>' +
            '<div id="delay-normal" style="' + (State.clockSync ? "display:none" : "") + '">' +
            '<div class="cap-row">' +
            '<div class="cap-group cap-half"><label>Min (s)</label><input type="number" id="inp-min-delay" step="0.1" min="0.1" max="30" value="' + State.minDelay + '"></div>' +
            '<div class="cap-group cap-half"><label>Max (s)</label><input type="number" id="inp-max-delay" step="0.1" min="0.1" max="60" value="' + State.maxDelay + '"></div>' +
            '</div></div>' +
            '<div id="delay-fast" style="' + (State.clockSync ? "" : "display:none") + '">' +
            '<div id="clock-sync-group" class="cap-group">' +
            '<div style="font-size:10px;color:#6c7086;margin-bottom:8px;padding:6px;background:#1e1e2e;border-radius:4px;">' +
            'Normal delay mengikuti pengaturan Min/Max Delay di atas.' +
            '</div>' +
            '<div class="cap-row">' +
            '<div class="cap-group cap-half"><label>Normal Min (s)</label>' +
            '<input type="number" id="inp-clock-min-delay" step="0.1" min="0.1" max="30" value="' + State.minDelay + '" title="Delay normal minimum untuk Clock Sync"></div>' +
            '<div class="cap-group cap-half"><label>Normal Max (s)</label>' +
            '<input type="number" id="inp-clock-max-delay" step="0.1" min="0.1" max="60" value="' + State.maxDelay + '" title="Delay normal maksimum untuk Clock Sync"></div>' +
            '</div>' +
            '<div class="cap-row">' +
            '<div class="cap-group cap-half"><label>Quick if &lt; (s)</label>' +
            '<input type="number" id="inp-clock-low" min="1" max="300" step="1" value="' + State.clockSyncLowTimeQuickSec + '" title="Jika waktu tersisa di bawah ini (detik), pakai delay cepat"></div>' +
            '<div class="cap-group cap-half"><label>Quick Delay (ms)</label>' +
            '<input type="number" id="inp-clock-quick-delay" min="100" max="5000" step="100" value="' + (State.clockSyncQuickDelayMs || 300) + '" title="Delay cepat saat waktu tinggal sedikit (ms)"></div>' +
            '</div>' +
            '<div style="font-size:10px;color:#6c7086;margin-top:8px;padding:6px;background:#1e1e2e;border-radius:4px;">' +
            '💡 Jika waktu &lt; <span id="quick-threshold-display">' + State.clockSyncLowTimeQuickSec + '</span>s, delay otomatis = <span id="quick-delay-display">' + (State.clockSyncQuickDelayMs || 300) + '</span>ms' +
            '</div></div></div>' +
            '<div class="cap-group"><label>Auto Resign</label>' +
            '<button id="btn-auto-resign" class="cap-toggle ' + (State.autoResignEnabled ? "on" : "off") + '">' + (State.autoResignEnabled ? "ON" : "OFF") + '</button></div>' +
            '<div id="auto-resign-group" class="cap-group" style="' + (State.autoResignEnabled ? "" : "display:none") + '">' +
            '<div class="cap-row"><div class="cap-group cap-half"><label>Mode</label><select id="sel-resign-mode">' +
            '<option value="mate"' + (State.resignMode === "mate" ? " selected" : "") + '>Mate in</option>' +
            '<option value="cp"' + (State.resignMode === "cp" ? " selected" : "") + '>Centipawn</option></select></div>' +
            '<div class="cap-group cap-half" id="resign-mate-box" style="' + (State.resignMode === "mate" ? "" : "display:none") + '">' +
            '<label>Mate in</label><select id="sel-resign-m">' + resignMateOptions + '</select></div>' +
            '<div class="cap-group cap-half" id="resign-cp-box" style="' + (State.resignMode === "cp" ? "" : "display:none") + '">' +
            '<label>CP threshold</label><input type="number" id="inp-resign-cp" min="100" max="5000" step="50" value="' + State.autoResignThresholdCp + '"></div></div></div>' +
            '</div>' +

            '<div id="tab-display" class="cap-tab-content" style="display:none">' +
            '<div class="cap-row">' +
            '<div class="cap-group cap-third"><label>PV Arrows</label><button id="btn-pv-arrows" class="cap-toggle ' + (State.showPVArrows ? "on" : "off") + '">' + (State.showPVArrows ? "ON" : "OFF") + '</button></div>' +
            '<div class="cap-group cap-third"><label>Bestmove</label><button id="btn-bestmove-arrows" class="cap-toggle ' + (State.showBestmoveArrows ? "on" : "off") + '">' + (State.showBestmoveArrows ? "ON" : "OFF") + '</button></div>' +
            '<div class="cap-group cap-third"><label>Highlights</label><button id="btn-highlight" class="cap-toggle ' + (State.highlightEnabled ? "on" : "off") + '">' + (State.highlightEnabled ? "ON" : "OFF") + '</button></div>' +
            '</div>' +
            '<div class="cap-group"><label>PV Depth: <strong id="pv-depth-display">' + State.maxPVDepth + '</strong> moves</label>' +
            '<input type="range" id="sld-pv-depth" min="2" max="10" value="' + State.maxPVDepth + '"></div>' +
            '<div class="cap-group"><label>Arrow Color (Auto)</label><div class="cap-color-row">' +
            '<input type="color" id="inp-color1" value="' + State.highlightColor1 + '">' +
            '<div class="cap-presets" data-target="inp-color1">' +
            '<span class="cap-preset" data-c="#eb6150" style="background:#eb6150"></span>' +
            '<span class="cap-preset" data-c="#4287f5" style="background:#4287f5"></span>' +
            '<span class="cap-preset" data-c="#4caf50" style="background:#4caf50"></span>' +
            '<span class="cap-preset" data-c="#ff9800" style="background:#ff9800"></span>' +
            '</div></div></div>' +
            '<div class="cap-group"><label>Arrow Color (PV)</label><div class="cap-color-row">' +
            '<input type="color" id="inp-pv-color-active" value="' + (State.pvArrowColors[1] || "#4287f5") + '">' +
            '<div class="cap-presets cap-pv-presets" id="pv-color-presets">' +
            '<span class="cap-preset cap-pv-color active" data-pv-rank="1" style="background:' + (State.pvArrowColors[1] || "#4287f5") + '" title="PV #1"></span>' +
            '<span class="cap-preset cap-pv-color" data-pv-rank="2" style="background:' + (State.pvArrowColors[2] || "#eb6150") + '" title="PV #2"></span>' +
            '<span class="cap-preset cap-pv-color" data-pv-rank="3" style="background:' + (State.pvArrowColors[3] || "#4caf50") + '" title="PV #3"></span>' +
            '<span class="cap-preset cap-pv-color" data-pv-rank="4" style="background:' + (State.pvArrowColors[4] || "#9c27b0") + '" title="PV #4"></span>' +
            '<span class="cap-preset cap-pv-color" data-pv-rank="5" style="background:' + (State.pvArrowColors[5] || "#f38ba8") + '" title="PV #5"></span>' +
            '<span class="cap-preset cap-pv-color" data-pv-rank="6" style="background:' + (State.pvArrowColors[6] || "#fab387") + '" title="PV #6"></span>' +
            '<span class="cap-preset cap-pv-color" data-pv-rank="7" style="background:' + (State.pvArrowColors[7] || "#74c7ec") + '" title="PV #7"></span>' +
            '<span class="cap-preset cap-pv-color" data-pv-rank="8" style="background:' + (State.pvArrowColors[8] || "#f5c2e7") + '" title="PV #8"></span>' +
            '<span class="cap-preset cap-pv-color" data-pv-rank="9" style="background:' + (State.pvArrowColors[9] || "#b4befe") + '" title="PV #9"></span>' +
            '</div></div></div>' +
            '<div class="cap-group"><label>Arrow Color (Bestmove)</label><div class="cap-color-row">' +
            '<input type="color" id="inp-bestmove-color-active" value="' + (State.bestmoveArrowColors[1] || "#eb6150") + '">' +
            '<div class="cap-presets cap-bm-presets" id="bm-color-presets">' +
            '<span class="cap-preset cap-bm-color active" data-bm-rank="1" style="background:' + (State.bestmoveArrowColors[1] || "#eb6150") + '" title="Bestmove #1"></span>' +
            '<span class="cap-preset cap-bm-color" data-bm-rank="2" style="background:' + (State.bestmoveArrowColors[2] || "#89b4fa") + '" title="Bestmove #2"></span>' +
            '<span class="cap-preset cap-bm-color" data-bm-rank="3" style="background:' + (State.bestmoveArrowColors[3] || "#a6e3a1") + '" title="Bestmove #3"></span>' +
            '<span class="cap-preset cap-bm-color" data-bm-rank="4" style="background:' + (State.bestmoveArrowColors[4] || "#f38ba8") + '" title="Bestmove #4"></span>' +
            '<span class="cap-preset cap-bm-color" data-bm-rank="5" style="background:' + (State.bestmoveArrowColors[5] || "#cba6f7") + '" title="Bestmove #5"></span>' +
            '<span class="cap-preset cap-bm-color" data-bm-rank="6" style="background:' + (State.bestmoveArrowColors[6] || "#fab387") + '" title="Bestmove #6"></span>' +
            '<span class="cap-preset cap-bm-color" data-bm-rank="7" style="background:' + (State.bestmoveArrowColors[7] || "#74c7ec") + '" title="Bestmove #7"></span>' +
            '<span class="cap-preset cap-bm-color" data-bm-rank="8" style="background:' + (State.bestmoveArrowColors[8] || "#f5c2e7") + '" title="Bestmove #8"></span>' +
            '<span class="cap-preset cap-bm-color" data-bm-rank="9" style="background:' + (State.bestmoveArrowColors[9] || "#b4befe") + '" title="Bestmove #9"></span>' +
            '</div></div></div>' +
            '</div>' +

            '<div id="tab-opening" class="cap-tab-content" style="display:none">' +
            '<div class="cap-row cap-book-row">' +
            '<div class="cap-group cap-half"><label>Use Opening Book</label>' +
            '<button id="btn-book" class="cap-toggle ' + (State.useOpeningBook ? "on" : "off") + '">' + (State.useOpeningBook ? "ON" : "OFF") + '</button></div>' +
            '<div class="cap-group cap-half"><label>Current Opening</label>' +
            '<div class="cap-opening-inline"><div id="currentOpeningDisplay" class="cap-opening-name inline">Game Start</div></div></div>' +
            '</div>' +
            '<div class="cap-history cap-book-syzygy"><div class="cap-history-header"><strong>Syzygy Tablebase</strong><span class="cap-book-hint">&lt;=7 pieces</span></div>' +
            '<div class="cap-book-syzygy-body">' +
            '<div id="syzygyStatus" class="cap-book-syzygy-status">Idle</div>' +
            '<div class="cap-history-scroll cap-book-syzygy-scroll"><table id="syzygyTable"><thead><tr><th>#</th><th>Move</th><th>Category</th><th>DTZ/DTM</th></tr></thead><tbody id="syzygyTableBody"></tbody></table></div>' +
            '</div></div>' +
            '</div>' +

            '<div id="tab-moves" class="cap-tab-content" style="display:none">' +
            '<div class="cap-top-moves">' +
            topMovesRows +
            '</div>' +
            '<div class="cap-acpl"><div class="cap-acpl-header"><span>ACPL: <strong id="acplTextDisplay">W 0.00 / B 0.00</strong></span>' +
            '<span>Moves: <span id="cplMoveCountWhiteDisplay">0</span>/<span id="cplMoveCountBlackDisplay">0</span></span></div>' +
            '<div class="cap-acpl-bars"><div class="cap-acpl-bar-row"><span class="cap-acpl-label">W</span><div class="cap-acpl-bar-bg"><div id="acplBarWhite" class="cap-acpl-bar white"></div></div></div>' +
            '<div class="cap-acpl-bar-row"><span class="cap-acpl-label">B</span><div class="cap-acpl-bar-bg"><div id="acplBarBlack" class="cap-acpl-bar black"></div></div></div></div></div>' +
            '<div class="cap-history"><div class="cap-history-header"><strong>Move History</strong>' +
            '<button id="btn-clear-history" class="cap-clear-btn">Clear</button></div>' +
            '<div class="cap-group" style="margin-bottom:6px;padding:6px 8px"><label style="margin-bottom:4px">Search Move History</label><input type="text" id="inp-move-filter" placeholder="Filter by move/eval/grade/source"></div>' +
            '<div class="cap-history-scroll"><table id="moveHistoryTable"><thead><tr><th>#</th><th>Move</th><th>Eval</th><th>D</th><th>Grade</th><th>Source</th><th>Time</th></tr></thead>' +
            '<tbody id="moveHistoryTableBody"></tbody></table></div></div></div>' +

            '<div id="tab-settings" class="cap-tab-content" style="display:none">' +
            '<div class="cap-row">' +
            '<div class="cap-group cap-half"><button id="btn-reload-engine" class="cap-action-btn">Reload</button></div>' +
            '<div class="cap-group cap-half"><button id="btn-run-once" class="cap-action-btn green">Run</button></div>' +
            '<div class="cap-group cap-half"><button id="btn-stop-engine" class="cap-action-btn red">Stop</button></div>' +
            '</div>' +
            '<div class="setting-group"><h5>Principal Variation</h5><div class="divider"></div>' +
            '<div class="pv-display" id="pvDisplay">' + safePrincipalVariation + '</div></div>' +
            '<div class="setting-group"><h5>Status</h5><div class="divider"></div>' +
            '<div class="setting-row"><span class="setting-label">Current Status</span>' +
            '<span class="setting-value" id="infoStatus">' + safeStatusInfo + '</span></div></div>' +
            '</div>' +
            '</div>' +

            '<div id="cap-more-overlay" class="cap-overlay" style="display:none">' +
            '<div class="cap-overlay-backdrop"></div>' +
            '<div class="cap-overlay-modal" role="dialog" aria-modal="true" aria-labelledby="cap-more-title">' +
            '<div class="cap-overlay-header"><strong id="cap-more-title">More Controls</strong><button id="cap-more-close" type="button">x</button></div>' +
            '<div class="cap-overlay-body">' +
            '<div class="cap-row">' +
            '<div class="cap-group cap-half"><button id="btn-soft-reset-analysis" class="cap-action-btn">Soft Analysis Reset</button></div>' +
            '<div class="cap-group cap-half"><button id="btn-soft-reset-premove" class="cap-action-btn">Soft Premove Reset</button></div>' +
            '</div>' +
            '<div class="cap-row">' +
            '<div class="cap-group cap-half"><button id="btn-export-settings" class="cap-action-btn">Export Settings</button></div>' +
            '<div class="cap-group cap-half"><button id="btn-import-settings" class="cap-action-btn">Import Settings</button><input type="file" id="inp-import-settings" accept="application/json" style="display:none"></div>' +
            '</div>' +
            '<div class="cap-group"><label>Notation Sequence (UCI)</label>' +
            '<textarea id="txt-notation-sequence" style="width:100%;height:80px;background:#313244;color:#cdd6f4;border:1px solid #45475a;border-radius:6px;padding:8px;font-family:monospace;font-size:11px;resize:none" placeholder="e2e4 e7e5 g1f3 b8c6...">' + safeNotationSequence + '</textarea></div>' +
            '<div class="setting-group"><h5>Diagnostics</h5><div class="divider"></div>' +
            '<div class="setting-row"><span class="setting-label">Workers</span><span class="setting-value" id="diag-workers">M:- A:- P:-</span></div>' +
            '<div class="setting-row"><span class="setting-label">Caches</span><span class="setting-value" id="diag-caches">PR:0 CCT:0 TH:0</span></div>' +
            '<div class="setting-row"><span class="setting-label">Runtime</span><span class="setting-value" id="diag-runtime">T:0 L:0</span></div>' +
            '<div class="setting-row"><span class="setting-label">Errors</span><span class="setting-value" id="diag-errors">En:0 UI:0 Pr:0 Sy:0 Rt:0 O:0</span></div>' +
            '<div class="setting-row"><span class="setting-label">Self Test</span><span class="setting-value" id="diag-selftest">R:0 F:0 UIH:0 LH:0</span></div></div>' +
            '<div class="setting-group"><h5>Smart Controls</h5><div class="divider"></div>' +
            '<div class="cap-row">' +
            '<div class="cap-group cap-half"><label>Main Consensus Move</label>' +
            '<button id="btn-main-consensus" class="cap-toggle ' + (State.useMainConsensus ? "on" : "off") + '">' + (State.useMainConsensus ? "ON" : "OFF") + '</button></div>' +
            '<div class="cap-group cap-half"><label>Analysis Blunder Guard</label>' +
            '<button id="btn-analysis-blunder-guard" class="cap-toggle ' + (State.analysisBlunderGuard ? "on" : "off") + '">' + (State.analysisBlunderGuard ? "ON" : "OFF") + '</button></div>' +
            '</div>' +
            '<div class="cap-group"><label>Silent Logs</label><button id="btn-silent-logs" class="cap-toggle ' + (State.silentLogging ? "on" : "off") + '">' + (State.silentLogging ? "ON" : "OFF") + '</button></div>' +
            '<div class="cap-group"><label>Stable Updates Required</label>' +
            '<input type="number" id="inp-analysis-stable" min="1" max="5" step="1" value="' + (State.analysisMinStableUpdates || 2) + '"></div>' +
            '<div class="setting-row"><span class="setting-label">Analysis Stability</span><span class="setting-value" id="analysis-stability-indicator">' + State.analysisStableCount + 'x</span></div>' +
            '<div class="setting-row"><span class="setting-label">Guard Status</span><span class="setting-value" id="analysis-guard-indicator">Ready</span></div>' +
            '</div>' +
            '</div>' +
            '</div>' +
            '</div></div>' +

            '<div class="cap-eval-footer">' +
            '<div class="cap-eval-bar-wrap" title="Engine evaluation">' +
            '<div id="evaluationFillAutoRun" class="cap-eval-fill"></div>' +
            '<span id="autoRunStatusText" class="cap-eval-label">OFF</span></div>' +
            '<div class="cap-eval-bar-wrap small" title="Analysis evaluation">' +
            '<div id="evaluationFillAnalysis" class="cap-eval-fill analysis"></div></div>' +
            '</div></div>';
    }

    // =====================================================
    // Section 13: Panel CSS Styling
    // =====================================================
    function getPanelCSS() {
        return "#chess-assist-panel{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);width:" + CONFIG.PANEL_WIDTH + "px;background:#1e1e2e;border:1px solid #444;border-radius:10px;box-shadow:0 8px 32px rgba(0,0,0,0.6);z-index:99999;font-family:'Segoe UI',-apple-system,BlinkMacSystemFont,Roboto,sans-serif;color:#cdd6f4;font-size:12px;overflow:hidden;user-select:none}" +
            "#chess-assist-panel.minimized .cap-tabs,#chess-assist-panel.minimized .cap-content,#chess-assist-panel.minimized .cap-eval-footer{display:none!important}" +
            "#chess-assist-panel.closed{display:none!important}" +
            ".cap-panel{display:flex;flex-direction:column}" +
            ".cap-header{display:flex;justify-content:space-between;align-items:center;padding:8px 12px;background:#313244;cursor:grab;border-bottom:1px solid #45475a}" +
            ".cap-header:active{cursor:grabbing}" +
            ".cap-header-left{display:flex;align-items:center;gap:8px}" +
            ".cap-title{font-weight:700;font-size:13px;color:#a6e3a1;letter-spacing:0.5px}" +
            ".cap-leds{display:flex;gap:4px}" +
            ".cap-led{width:8px;height:8px;border-radius:50%;background:#45475a;transition:all .3s}" +
            ".cap-led.green.active{background:#a6e3a1;box-shadow:0 0 6px #a6e3a1}" +
            ".cap-led.blue.active{background:#89b4fa;box-shadow:0 0 6px #89b4fa}" +
            ".cap-led.red.active{background:#f38ba8;box-shadow:0 0 6px #f38ba8}" +
            ".cap-clock{font-family:'Courier New',monospace;font-size:11px;color:#6c7086}" +
            ".cap-header-btns{display:flex;gap:4px}" +
            ".cap-header-btns button{background:#45475a;border:none;color:#cdd6f4;width:22px;height:22px;border-radius:4px;cursor:pointer;font-size:13px;line-height:1;transition:background .2s}" +
            ".cap-header-btns #cap-gear{font-size:14px}" +
            ".cap-gear-wrap{position:relative}" +
            ".cap-gear-menu{position:absolute;top:28px;right:0;min-width:150px;background:#181825;border:1px solid #45475a;border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,.45);padding:6px;z-index:100120;display:flex;flex-direction:column;gap:4px}" +
            ".cap-gear-menu button{width:100%;height:auto;padding:7px 8px;border-radius:6px;text-align:left;font-size:11px;background:#313244;color:#cdd6f4}" +
            ".cap-gear-menu button:hover{background:#45475a}" +
            ".cap-overlay{position:fixed;inset:0;z-index:100260;display:flex;align-items:center;justify-content:center}" +
            ".cap-overlay-backdrop{position:absolute;inset:0;background:rgba(0,0,0,.62)}" +
            ".cap-overlay-modal{position:relative;width:min(620px,95vw);max-height:90vh;overflow:auto;background:#1e1e2e;border:1px solid #45475a;border-radius:10px;padding:12px;box-shadow:0 14px 44px rgba(0,0,0,.55)}" +
            ".cap-overlay-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px}" +
            ".cap-overlay-header button{width:22px;height:22px;border:none;border-radius:4px;background:#45475a;color:#cdd6f4;cursor:pointer}" +
            ".cap-overlay-body{padding-top:4px}" +
            ".cap-header-btns button:hover{background:#585b70}" +
            ".cap-tabs{display:flex;align-items:center;background:#181825;border-bottom:1px solid #45475a;overflow-x:auto;min-height:30px}" +
            ".cap-tab{flex:1;padding:6px 4px;text-align:center;font-size:9px;cursor:pointer;white-space:nowrap;background:#1e1e2e;transition:all .2s;border-right:1px solid #313244}" +
            ".cap-tab:last-child{border-right:none}" +
            ".cap-tab:hover{background:#313244}" +
            ".cap-tab.active{background:#a6e3a1;color:#1e1e2e;font-weight:700}" +
            ".cap-content{overflow-y:auto;height:360px;padding:12px;scrollbar-width:thin;scrollbar-color:#45475a #1e1e2e}" +
            ".cap-tab-content{animation:capFadeIn .2s ease}" +
            "@keyframes capFadeIn{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:none}}" +
            ".cap-group{margin-bottom:12px;padding:10px;background:#313244;border-radius:8px}" +
            ".cap-group label{display:block;margin-bottom:6px;font-size:11px;color:#a6adc8}" +
            ".cap-row{display:flex;gap:8px}" +
            ".cap-half{flex:1}" +
            ".cap-third{flex:1}" +
            ".cap-toggle{width:100%;padding:7px 12px;border:none;border-radius:6px;cursor:pointer;font-weight:600;font-size:12px;transition:all .2s}" +
            ".cap-toggle.on{background:#a6e3a1;color:#1e1e2e}" +
            ".cap-toggle.off{background:#45475a;color:#6c7086}" +
            ".cap-toggle:hover{filter:brightness(1.1)}" +
            "select,input[type=\"number\"]{width:100%;padding:6px 8px;background:#45475a;border:1px solid #585b70;color:#cdd6f4;border-radius:6px;font-size:12px}" +
            "select:focus,input:focus{outline:none;border-color:#a6e3a1}" +
            "input[type='range']{width:100%;-webkit-appearance:none;height:6px;background:linear-gradient(90deg,#3b3a38,#464442);border-radius:6px;outline:none}" +
            "input[type='range']::-webkit-slider-thumb{-webkit-appearance:none;width:22px;height:26px;background:linear-gradient(180deg,#d6d6d6,#9a9a9a);border-radius:4px;cursor:pointer;margin-top:-10px;box-shadow:inset 0 2px 2px rgba(255,255,255,.4),inset 0 -2px 2px rgba(0,0,0,.4),0 2px 6px rgba(0,0,0,.6);transition:all .2s;position:relative}" +
            "input[type='range']::-webkit-slider-thumb:before{content:'';position:absolute;left:50%;top:4px;transform:translateX(-50%);width:3px;height:18px;background:#333;border-radius:2px}" +
            "input[type='range']::-webkit-slider-thumb:hover{background:linear-gradient(180deg,#ffffff,#bcbcbc);transform:scale(1.05)}" +
            "input[type='range']::-moz-range-thumb{width:22px;height:26px;background:linear-gradient(180deg,#d6d6d6,#9a9a9a);border-radius:4px;border:none;cursor:pointer}" +
            "#sld-depth{-webkit-appearance:none;width:100%;height:7px;background:linear-gradient(90deg,#3b3a38,#464442);border-radius:6px;outline:none}" +
            "#sld-depth::-webkit-slider-thumb{-webkit-appearance:none;width:22px;height:26px;background:linear-gradient(180deg,#89b4fa,#5fa2ff);border-radius:4px;cursor:pointer;margin-top:-10px;box-shadow:inset 0 2px 2px rgba(255,255,255,.4),inset 0 -2px 2px rgba(0,0,0,.4),0 2px 6px rgba(0,0,0,.6);transition:all .2s;position:relative}" +
            "#sld-depth::-webkit-slider-thumb:before{content:'';position:absolute;left:50%;top:4px;transform:translateX(-50%);width:3px;height:18px;background:#333;border-radius:2px}" +
            "#sld-depth::-webkit-slider-thumb:hover{background:linear-gradient(180deg,#a6e3a1,#7edb87);transform:scale(1.05)}" +
            "#sld-depth::-moz-range-thumb{width:22px;height:26px;background:#89b4fa;border-radius:4px;border:none;cursor:pointer}" +
            "#sld-skill{-webkit-appearance:none;width:100%;height:7px;background:linear-gradient(90deg,#3b3a38,#464442);border-radius:6px;outline:none}" +
            "#sld-skill::-webkit-slider-thumb{-webkit-appearance:none;width:22px;height:26px;background:linear-gradient(180deg,#f9e2af,#f5c211);border-radius:4px;cursor:pointer;margin-top:-10px;box-shadow:inset 0 2px 2px rgba(255,255,255,.4),inset 0 -2px 2px rgba(0,0,0,.4),0 2px 6px rgba(0,0,0,.6);transition:all .2s;position:relative}" +
            "#sld-skill::-webkit-slider-thumb:hover{background:linear-gradient(180deg,#ffe066,#ffd700);transform:scale(1.05)}" +
            "#sld-skill::-moz-range-thumb{width:22px;height:26px;background:#f9e2af;border-radius:4px;border:none;cursor:pointer}" +
            ".mixer-btn{width:40px;height:40px;background:linear-gradient(180deg,#d6d6d6,#9a9a9a);border-radius:6px;box-shadow:inset 0 2px 2px rgba(255,255,255,.4),inset 0 -2px 2px rgba(0,0,0,.4),0 2px 4px rgba(0,0,0,.5);cursor:pointer;transition:all .2s;display:inline-flex;align-items:center;justify-content:center;margin:4px}" +
            ".mixer-btn:hover{background:linear-gradient(180deg,#ffffff,#bcbcbc);transform:scale(1.05)}" +
            ".mixer-btn i{font-size:18px;color:#333}" +
            "input[type=\"color\"]{width:50px;height:30px;border:none;border-radius:6px;cursor:pointer;vertical-align:middle}" +
            ".cap-color-row{display:flex;align-items:center;gap:8px}" +
            ".cap-presets{display:flex;gap:4px}" +
            ".cap-preset{width:22px;height:22px;border-radius:50%;border:2px solid transparent;cursor:pointer;transition:border-color .2s}" +
            ".cap-preset:hover{border-color:#fff}" +
            ".cap-pv-presets .cap-preset.active{border-color:#89b4fa;box-shadow:0 0 0 1px #89b4fa inset}" +
            ".cap-bm-presets .cap-preset.active{border-color:#a6e3a1;box-shadow:0 0 0 1px #a6e3a1 inset}" +
            ".cap-btn-row{display:flex;gap:6px}" +
            ".cap-color-btn{flex:1;padding:6px;border:none;border-radius:6px;background:#45475a;color:#a6adc8;cursor:pointer;font-size:11px;transition:all .2s}" +
            ".cap-color-btn.active{background:#a6e3a1;color:#1e1e2e;font-weight:600}" +
            ".cap-color-btn:hover{filter:brightness(1.1)}" +
            ".cap-preset-btn{flex:1;padding:8px 6px;border:2px solid #45475a;border-radius:6px;background:#313244;color:#a6adc8;cursor:pointer;font-size:11px;font-weight:600;transition:all .2s;white-space:nowrap}" +
            ".cap-preset-btn:hover{border-color:#a6e3a1;background:#45475a;filter:brightness(1.1)}" +
            ".cap-preset-btn.active{background:#a6e3a1;color:#1e1e2e;border-color:#a6e3a1;box-shadow:0 0 8px rgba(166,227,161,0.4)}" +
            ".cap-action-btn{width:100%;padding:10px;border:none;border-radius:6px;background:#45475a;color:#cdd6f4;font-weight:600;cursor:pointer;font-size:12px;transition:all .2s}" +
            ".cap-action-btn:hover{filter:brightness(1.2)}" +
            ".cap-action-btn.green{background:#a6e3a1;color:#1e1e2e}" +
            ".cap-action-btn.red{background:#f38ba8;color:#1e1e2e}" +
            ".setting-group{margin-bottom:12px;padding:10px;background:#313244;border-radius:8px}" +
            ".setting-group h5{margin:0 0 8px 0;font-size:12px;color:#a6adc8}" +
            ".pv-display{padding:8px;background:#181825;border:1px solid #45475a;border-radius:6px;font-family:monospace;font-size:10px;color:#cdd6f4;word-break:break-all}" +
            ".setting-row{display:flex;justify-content:space-between;align-items:center}" +
            ".setting-label{font-size:11px;color:#a6adc8}" +
            ".setting-value{font-weight:700;font-size:12px;color:#cdd6f4}" +
            ".divider{height:1px;background:#45475a;margin:8px 0}" +
            ".cap-opening-box{text-align:center;padding:20px;background:#313244;border-radius:8px;margin-bottom:12px}" +
            ".cap-opening-label{font-size:11px;color:#6c7086;margin-bottom:5px}" +
            ".cap-opening-name{font-size:18px;font-weight:700;color:#89b4fa}" +
            ".cap-book-row{align-items:flex-end;gap:8px;margin-bottom:8px}" +
            ".cap-book-row .cap-group{margin-bottom:0}" +
            ".cap-delay-head-row{align-items:stretch;gap:8px;margin-bottom:8px}" +
            ".cap-delay-head-row .cap-group{margin-bottom:0}" +
            ".cap-delay-head-group .cap-toggle{height:34px;padding:0 12px}" +
            "#delay-presets-container{height:34px}" +
            "#delay-presets-container .cap-preset-btn{padding:6px 4px}" +
            ".cap-opening-inline{height:34px;display:flex;align-items:center;padding:0 10px;background:#45475a;border:1px solid #585b70;border-radius:6px}" +
            ".cap-opening-name.inline{font-size:13px;font-weight:700;color:#89b4fa;line-height:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}" +
            ".cap-book-syzygy{margin-top:0}" +
            ".cap-book-hint{font-size:10px;color:#6c7086}" +
            ".cap-book-syzygy-body{padding:8px;background:#313244;border-radius:6px}" +
            ".cap-book-syzygy-status{font-size:10px;color:#a6adc8;margin-bottom:6px}" +
            ".cap-book-syzygy-scroll{max-height:120px}" +
            ".cap-top-moves{margin-bottom:12px}" +
            ".cap-move-row{display:flex;align-items:center;padding:8px 10px;background:#313244;border-radius:6px;margin-bottom:4px}" +
            ".cap-rank{width:30px;color:#a6e3a1;font-weight:700;font-size:11px}" +
            ".cap-move-text{flex:1;font-weight:700;font-family:monospace;font-size:13px}" +
            ".eval{text-align:right;font-weight:600;font-size:12px}" +
            ".eval-positive{color:#a6e3a1}" +
            ".eval-negative{color:#f38ba8}" +
            ".eval-equal{color:#f9e2af}" +
            ".eval-mate{color:#cba6f7}" +
            ".cap-acpl{margin-bottom:12px}" +
            ".cap-acpl-header{display:flex;justify-content:space-between;font-size:11px;margin-bottom:6px;color:#a6adc8}" +
            ".cap-acpl-bars{display:flex;flex-direction:column;gap:4px}" +
            ".cap-acpl-bar-row{display:flex;align-items:center;gap:6px}" +
            ".cap-acpl-label{width:16px;font-size:10px;font-weight:700}" +
            ".cap-acpl-bar-bg{flex:1;height:14px;background:#45475a;border-radius:3px;overflow:hidden}" +
            ".cap-acpl-bar{height:100%;width:0%;transition:width .4s;border-radius:3px}" +
            ".cap-acpl-bar.white{background:#a6e3a1}" +
            ".cap-acpl-bar.black{background:#f38ba8}" +
            ".cap-history-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:6px}" +
            ".cap-clear-btn{padding:4px 10px;background:#f38ba8;color:#1e1e2e;border:none;border-radius:4px;cursor:pointer;font-size:10px;font-weight:600}" +
            ".cap-history-scroll{max-height:140px;overflow-y:auto;background:#313244;border-radius:6px}" +
            "#inp-move-filter{width:100%;padding:6px 8px;background:#45475a;border:1px solid #585b70;color:#cdd6f4;border-radius:6px;font-size:11px}" +
            "#inp-move-filter:focus{outline:none;border-color:#a6e3a1}" +
            "#moveHistoryTable{width:100%;border-collapse:collapse;font-size:10px}" +
            "#moveHistoryTable th{background:#45475a;padding:5px 4px;text-align:center;position:sticky;top:0;z-index:1;color:#a6adc8}" +
            "#moveHistoryTable td{padding:4px;text-align:center;border-bottom:1px solid #45475a}" +
            "#syzygyTable{width:100%;border-collapse:collapse;font-size:10px;background:#2a2b3a}" +
            "#syzygyTable th{background:#45475a;padding:5px 6px;text-align:left;position:sticky;top:0;z-index:1;color:#a6adc8;font-weight:700;border-bottom:1px solid #585b70}" +
            "#syzygyTable td{padding:5px 6px;text-align:left;border-bottom:1px solid #45475a;color:#cdd6f4;font-family:monospace}" +
            "#syzygyTable tbody tr:nth-child(even){background:rgba(69,71,90,0.22)}" +
            "#syzygyTable tbody tr:last-child td{border-bottom:none}" +
            "#syzygyTable td:first-child,#syzygyTable th:first-child{width:28px;text-align:center;font-family:'Segoe UI',sans-serif}" +
            "#syzygyTable td:nth-child(2){font-weight:700;letter-spacing:0.2px}" +
            ".cap-eval-footer{padding:8px 12px;background:#313244;border-top:1px solid #45475a}" +
            ".cap-eval-bar-wrap{position:relative;height:22px;background:#45475a;border-radius:5px;overflow:hidden;margin-bottom:4px}" +
            ".cap-eval-bar-wrap.small{height:8px;margin-bottom:0}" +
            ".cap-eval-fill{height:100%;width:50%;background:#a6e3a1;transition:all .4s;border-radius:5px}" +
            ".cap-eval-fill.analysis{background:#89b4fa}" +
            ".cap-eval-label{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-size:10px;font-weight:600;text-shadow:0 0 3px #000;white-space:nowrap}" +
            ".cap-info-box{padding:10px;background:#313244;border-radius:6px;font-size:11px;line-height:1.6;margin-bottom:8px}" +
            ".cap-info-box ul{margin:4px 0 0 16px;padding:0}" +
            ".piece-filters{display:flex;gap:6px;flex-wrap:wrap}" +
            ".chip{display:flex;align-items:center;gap:4px;padding:4px 8px;background:#45475a;border-radius:4px;cursor:pointer;font-size:11px}" +
            ".chip input{margin:0}" +
            ".cap-content::-webkit-scrollbar,.cap-history-scroll::-webkit-scrollbar{width:5px}" +
            ".cap-content::-webkit-scrollbar-track,.cap-history-scroll::-webkit-scrollbar-track{background:transparent}" +
            ".cap-content::-webkit-scrollbar-thumb,.cap-history-scroll::-webkit-scrollbar-thumb{background:#45475a;border-radius:3px}" +
            ".chess-assist-arrow{position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:9999}" +
            ".chess-assist-arrow[data-analysis=\"true\"]{z-index:10001!important}" +
            ".chess-assist-pv-arrow{position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:9990}" +
            ".chess-assist-pv-arrow[data-analysis=\"true\"]{z-index:10090!important}" +
            ".chess-assist-bestmove-arrow{position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none}" +
            ".chess-assist-arrow,.chess-assist-pv-arrow,.chess-assist-bestmove-arrow{transition:opacity 0.2s ease}" +
            ".chess-assist-arrow rect{filter:drop-shadow(0 0 4px currentColor)}" +
            ".chess-assist-arrow[data-analysis=\"true\"] rect{filter:drop-shadow(0 0 6px currentColor)}" +
            "#premoveChanceDisplay.high-chance{color:#f38ba8;font-weight:bold;animation:pulse 1s infinite}" +
            "#premoveChanceDisplay.low-chance{color:#a6e3a1}" +
            "@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}" +
            ".chess-assist-pv-arrow line{stroke-linecap:round}" +
            ".chess-assist-pv-arrow circle{opacity:0.9}" +
            ".chess-assist-pv-arrow text{font-family:'Segoe UI',sans-serif}" +
            ".cap-welcome-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.72);z-index:100200;display:flex;align-items:center;justify-content:center;padding:16px}" +
            ".cap-welcome-modal{width:min(560px,94vw);background:#1e1e2e;border:1px solid #45475a;border-radius:12px;box-shadow:0 12px 40px rgba(0,0,0,0.6);padding:16px;color:#cdd6f4}" +
            ".cap-welcome-title{font-size:18px;font-weight:700;color:#a6e3a1;margin-bottom:8px}" +
            ".cap-welcome-subtitle{font-size:12px;color:#bac2de;line-height:1.5;margin-bottom:10px}" +
            ".cap-welcome-list{margin:0 0 10px 18px;padding:0;font-size:12px;line-height:1.6;color:#cdd6f4}" +
            ".cap-welcome-warning{background:#2a1d22;border:1px solid #5b3240;border-radius:8px;padding:10px;font-size:12px;line-height:1.5;color:#f2cdcd;margin-bottom:12px;text-align:center}" +
            ".cap-welcome-warning-line{height:2px;background:#f38ba8;border-radius:2px;margin:0 0 8px 0}" +
            ".cap-welcome-warning-title{display:block;font-weight:700;color:#f38ba8;margin-bottom:4px;text-transform:uppercase;letter-spacing:0.4px}" +
            ".cap-welcome-warning-body{display:block;color:#f2cdcd;line-height:1.55}" +
            ".cap-welcome-consent{display:flex;align-items:flex-start;gap:8px;font-size:12px;color:#cdd6f4;margin-bottom:12px}" +
            ".cap-welcome-consent input{margin-top:2px}" +
            ".cap-welcome-actions{display:flex;gap:8px;justify-content:flex-end}" +
            ".cap-welcome-btn{padding:8px 12px;border:none;border-radius:6px;cursor:pointer;font-weight:600;font-size:12px}" +
            ".cap-welcome-btn.primary{background:#a6e3a1;color:#1e1e2e}" +
            ".cap-welcome-btn.primary:disabled{background:#6c7086;color:#313244;cursor:not-allowed}" +
            ".cap-welcome-btn.secondary{background:#45475a;color:#cdd6f4}" +
            ".cap-hotkeys-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.72);z-index:100250;display:flex;align-items:center;justify-content:center;padding:16px}" +
            ".cap-hotkeys-modal{width:min(520px,94vw);background:#1e1e2e;border:1px solid #45475a;border-radius:12px;box-shadow:0 12px 40px rgba(0,0,0,0.6);padding:14px;color:#cdd6f4}" +
            ".cap-hotkeys-title{font-size:16px;font-weight:700;color:#a6e3a1;margin-bottom:8px}" +
            ".cap-hotkeys-table{width:100%;border-collapse:collapse;font-size:12px;background:#181825;border-radius:8px;overflow:hidden}" +
            ".cap-hotkeys-table th,.cap-hotkeys-table td{padding:8px 10px;border-bottom:1px solid #313244;text-align:left}" +
            ".cap-hotkeys-table th{color:#a6adc8;font-size:11px;background:#11111b}" +
            ".cap-hotkeys-actions{display:flex;justify-content:flex-end;margin-top:10px}" +
            "@media (max-width: 768px) {" +
            "#chess-assist-panel{width:90vw!important;height:auto;max-height:90vh;top:50%!important;left:50%!important;transform:translate(-50%,-50%)!important;border-radius:8px;box-shadow:0 4px 20px rgba(0,0,0,0.8)}" +
            ".cap-content{height:300px!important;overflow-y:auto}" +
            ".cap-header{padding:6px 10px}" +
            ".cap-title{font-size:12px}" +
            ".cap-tabs{font-size:9px}" +
            ".cap-group{margin-bottom:8px;padding:8px}" +
            ".cap-preset-btn{font-size:10px;padding:6px 4px}" +
            "select,input[type=\"number\"]{font-size:11px;padding:5px 6px}" +
            "input[type=\"range\"]::-webkit-slider-thumb{width:12px;height:12px}" +
            "}" +
            "@media (max-width: 480px) {" +
            "#chess-assist-panel{width:95vw!important;max-height:88vh}" +
            ".cap-content{height:250px!important;font-size:11px}" +
            ".cap-header{padding:5px 8px}" +
            ".cap-title{font-size:11px}" +
            ".cap-tabs{font-size:8px;overflow-x:auto}" +
            ".cap-tab{padding:5px 2px}" +
            ".cap-group{margin-bottom:6px;padding:6px;font-size:10px}" +
            ".cap-group label{font-size:10px;margin-bottom:4px}" +
            ".cap-toggle{padding:5px 8px;font-size:10px}" +
            ".cap-delay-head-row{gap:6px}" +
            ".cap-preset-btn{font-size:9px;padding:4px 2px}" +
            ".cap-header-btns button{width:20px;height:20px;font-size:12px}" +
            "select,input[type=\"number\"],input[type=\"text\"]{font-size:10px;padding:4px 5px}" +
            ".cap-row{gap:4px}" +
            ".cap-move-text{font-size:11px}" +
            ".cap-move-row{padding:6px 8px}" +
            ".eval{font-size:10px}" +
            "#moveHistoryTable{font-size:9px}" +
            "#moveHistoryTable th,#moveHistoryTable td{padding:2px 2px}" +
            "#syzygyTable{font-size:9px}" +
            "#syzygyTable th,#syzygyTable td{padding:3px 4px}" +
            ".cap-history-scroll{max-height:120px}" +
            ".cap-eval-footer{padding:6px 8px}" +
            ".cap-eval-bar-wrap{height:18px}" +
            ".cap-preset{width:18px;height:18px}" +
            "input[type=\"color\"]{width:40px;height:25px}" +
            ".cap-color-btn{padding:4px;font-size:9px}" +
            ".piece-filters{gap:4px}" +
            ".chip{padding:2px 4px;font-size:9px}" +
            ".cap-opening-name{font-size:14px}" +
            ".cap-acpl-bar-row{gap:4px}" +
            ".cap-acpl-bar-bg{height:10px}" +
            "}" +
            "@media (max-width: 380px) {" +
            "#chess-assist-panel{width:98vw!important}" +
            ".cap-content{height:200px!important}" +
            ".cap-header-btns button{width:18px;height:18px;font-size:11px}" +
            ".cap-title{font-size:10px}" +
            ".cap-group{padding:4px}" +
            "select,input{font-size:9px}" +
            ".cap-toggle{font-size:9px;padding:4px 6px}" +
            "}" +
            "@media (orientation: landscape) and (max-height: 500px) {" +
            "#chess-assist-panel{height:90vh!important;max-height:90vh!important}" +
            ".cap-content{height:60vh!important;max-height:60vh!important}" +
            ".cap-history-scroll{max-height:100px}" +
            "}";

    }

    // =====================================================
    // Section 14: Panel DOM Creation and Insertion
    // =====================================================
    function runHealthCheck() {
        const report = getDiagnosticsSnapshot();
        const runtime = report.runtime;
        const caches = report.caches;
        const workers = report.workers;

        log("[HealthCheck]", report);
        State.statusInfo = "Health check OK | Workers M=" + (workers.main ? 1 : 0) +
            " A=" + (workers.analysis ? 1 : 0) +
            " P=" + (workers.premove ? 1 : 0) +
            " | Caches CCT=" + caches.cctCache +
            " TH=" + caches.threatCache +
            " | Heals P=" + runtime.premoveHealCount +
            " M=" + runtime.mainHealCount +
            " A=" + runtime.analysisHealCount;
        if (UI && typeof UI.updateStatusInfo === "function") {
            UI.updateStatusInfo();
        }
    }

    function getDiagnosticsSnapshot() {
        const runtime = RuntimeGuard.getSnapshot();
        return {
            workers: {
                main: !!(Engine && Engine.main),
                analysis: !!(Engine && Engine.analysis),
                premove: !!(Engine && Engine.premove)
            },
            caches: {
                premoveProcessedFens: Engine && Engine._premoveProcessedFens ? Engine._premoveProcessedFens.size : 0,
                cctCache: CCTAnalyzer && CCTAnalyzer.cache ? CCTAnalyzer.cache.size : 0,
                threatCache: ThreatDetectionSystem && ThreatDetectionSystem.cache ? ThreatDetectionSystem.cache.size : 0
            },
            flags: {
                loopStarted: !!State.loopStarted,
                analysisMode: !!State.analysisMode,
                premoveEnabled: !!State.premoveEnabled,
                isThinking: !!State.isThinking,
                isAnalysisThinking: !!State.isAnalysisThinking
            },
            errors: {
                engine: ErrorTelemetry.moduleCounts.engine || 0,
                ui: ErrorTelemetry.moduleCounts.ui || 0,
                premove: ErrorTelemetry.moduleCounts.premove || 0,
                syzygy: ErrorTelemetry.moduleCounts.syzygy || 0,
                runtime: ErrorTelemetry.moduleCounts.runtime || 0,
                other: ErrorTelemetry.moduleCounts.other || 0,
                recent: ErrorTelemetry.recent.slice(-5)
            },
            runtime: {
                premoveHealCount: runtime.premoveHealCount,
                mainHealCount: runtime.mainHealCount,
                analysisHealCount: runtime.analysisHealCount,
                uiHealCount: runtime.uiHealCount,
                listenerHealCount: runtime.listenerHealCount,
                selfTestRuns: runtime.selfTestRuns,
                selfTestFailures: runtime.selfTestFailures
            }
        };
    }

    function softResetAnalysis(reason) {
        State.statusInfo = "Soft reset analysis" + (reason ? " (" + reason + ")" : "");
        UI.updateStatusInfo();
        if (Engine && typeof Engine.selfHealAnalysis === "function") {
            Engine.selfHealAnalysis(reason || "soft-reset");
        }
        if (State.analysisMode) {
            State._lastAnalysisFen = null;
            scheduleManagedTimeout(function () {
                analysisCheck();
            }, 120);
        }
    }

    function softResetPremove(reason) {
        State.statusInfo = "Soft reset premove" + (reason ? " (" + reason + ")" : "");
        UI.updateStatusInfo();
        if (Engine && typeof Engine.selfHealPremove === "function") {
            Engine.selfHealPremove(reason || "soft-reset");
        }
        if (typeof clearPremoveCaches === "function") {
            clearPremoveCaches();
        }
        if (State) {
            State.premoveAnalysisInProgress = false;
        }
    }

    function runSelfTest() {
        RuntimeGuard.selfTestRuns++;
        let checks = [];
        let failures = [];

        function check(name, pass, details) {
            checks.push({ name: name, pass: !!pass, details: details || "" });
            if (!pass) failures.push(name + (details ? (" (" + details + ")") : ""));
        }

        try {
            check("Board element", !!getBoardElement());
            check("Main engine object", !!(Engine && Engine.main), Engine && Engine._ready ? "ready" : "not ready");
            check("State object", !!State);
            check("UI object", !!UI);
            check("Panel exists", !!$("#chess-assist-panel"));
            check("Diagnostics getter", typeof getDiagnosticsSnapshot === "function");
            check("Premove engine set", !!(Engine && Engine._premoveProcessedFens));
        } catch (e) {
            failures.push("Exception: " + (e && e.message ? e.message : String(e)));
        }

        if (failures.length > 0) {
            RuntimeGuard.selfTestFailures++;
            State.statusInfo = "Self test FAIL: " + failures.join(" | ");
            err("[SelfTest] Failures:", failures);
        } else {
            State.statusInfo = "Self test OK (" + checks.length + " checks)";
            log("[SelfTest] All checks passed", checks);
        }

        UI.updateStatusInfo();
        UI.updateDiagnosticsDisplay();
        return { checks: checks, failures: failures };
    }

    function exportSettingsSnapshot() {
        let payload = {
            exportedAt: new Date().toISOString(),
            script: (GM_info && GM_info.script && GM_info.script.name) ? GM_info.script.name : "ChessAssistant",
            version: (GM_info && GM_info.script && GM_info.script.version) ? GM_info.script.version : "unknown",
            settings: {}
        };

        Object.keys(PERSISTED_SETTING_DEFAULTS).forEach(function (key) {
            payload.settings[key] = State[key];
        });

        return payload;
    }

    function exportSettingsToFile() {
        try {
            let payload = exportSettingsSnapshot();
            let blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
            let url = URL.createObjectURL(blob);
            let a = document.createElement("a");
            let stamp = new Date().toISOString().replace(/[:.]/g, "-");
            a.href = url;
            a.download = "chess-assistant-settings-" + stamp + ".json";
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
            State.statusInfo = "Settings exported";
            UI.updateStatusInfo();
        } catch (e) {
            err("Export settings failed:", e);
            State.statusInfo = "Export failed";
            UI.updateStatusInfo();
        }
    }

    function importSettingsFromObject(raw) {
        let src = raw && raw.settings ? raw.settings : raw;
        if (!src || typeof src !== "object") {
            throw new Error("Invalid settings payload");
        }

        Object.keys(PERSISTED_SETTING_DEFAULTS).forEach(function (key) {
            if (!Object.prototype.hasOwnProperty.call(src, key)) return;
            saveSetting(key, src[key]);
        });

        normalizeLoadedSettings();

        if (Engine && Engine.main) {
            if (State.evaluationMode === "human") Engine.setElo(State.eloRating);
            else Engine.setFullStrength();
        }

        renderAll();
        State.statusInfo = "Settings imported";
        UI.updateStatusInfo();
    }

    function importSettingsFromFile(file) {
        if (!file) return;
        let reader = new FileReader();
        reader.onload = function () {
            try {
                let parsed = JSON.parse(String(reader.result || "{}"));
                importSettingsFromObject(parsed);
            } catch (e) {
                err("Import settings failed:", e);
                State.statusInfo = "Import failed";
                UI.updateStatusInfo();
            }
        };
        reader.readAsText(file);
    }

    GM_registerMenuCommand("Run health check", runHealthCheck);
    GM_registerMenuCommand("Run self test", runSelfTest);
    GM_registerMenuCommand("Export settings", exportSettingsToFile);
    GM_registerMenuCommand("Toggle silent logs", function () {
        let nextVal = !isSilentLoggingEnabled();
        saveSetting("silentLogging", nextVal);
        State.statusInfo = nextVal ? "Silent logs enabled" : "Silent logs disabled";
        UI.updateStatusInfo();
    });

    function renderAll() {
        let panel = $("#chess-assist-panel");
        if (!panel) return;

        let contentArea = $("#cap-content-area");
        let scrollTop = contentArea ? contentArea.scrollTop : 0;
        let activeTab = $(".cap-tab.active")?.dataset.tab || "tab-engine";

        panel.innerHTML = getPanelHTML();

        setupDrag(panel);
        setupMenuTabs();
        setupAllListeners();

        if (activeTab) {
            let tab = $("[data-tab='" + activeTab + "']");
            if (tab) tab.click();
        }
        if (scrollTop && $("#cap-content-area")) {
            $("#cap-content-area").scrollTop = scrollTop;
        }

        if (UI && typeof UI.touchHeartbeat === "function") {
            UI.touchHeartbeat();
        }
        UI.updateTurnLEDs();
        if (UI && typeof UI.updateStatusInfo === 'function') {
            UI.updateStatusInfo();
        }
        UI.updateClock();
        UI.updatePremoveStatsDisplay();
        UI.updatePremoveChanceDisplay();
        if (typeof UI.updateSyzygyDisplay === "function") UI.updateSyzygyDisplay();
        if (typeof UI.updateCCTDebugDisplay === "function") UI.updateCCTDebugDisplay();
        if (typeof UI.updateAnalysisMonitorDisplay === "function") UI.updateAnalysisMonitorDisplay();
        if (typeof UI.updateDiagnosticsDisplay === "function") UI.updateDiagnosticsDisplay();
        if (State.analysisMode) UI.updateAnalysisBar(State.currentEvaluation || 0);
        else UI.updateEvalBar(State.currentEvaluation || 0, null, State.customDepth);
    }

    function createPanel() {

        if (!document.querySelector("meta[name='viewport']")) {
            let viewportMeta = document.createElement("meta");
            viewportMeta.name = "viewport";
            viewportMeta.content = "width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes";
            document.head.appendChild(viewportMeta);
        }

        let style = document.createElement("style");
        style.id = "chess-assist-styles";
        style.textContent = getPanelCSS();
        document.head.appendChild(style);

        let panel = document.createElement("div");
        panel.id = "chess-assist-panel";
        document.body.appendChild(panel);

        renderAll();

        if (State.panelTop !== null && State.panelLeft !== null) {
            panel.style.top = State.panelTop + "px";
            panel.style.left = State.panelLeft + "px";
            panel.style.transform = "none";
        }
        applyPanelState(State.panelState);
    }

    function showWelcomeConsentModal(onAccept) {
        if (!State.onboardingAccepted) {
            saveSetting("onboardingAccepted", true);
            State.onboardingAccepted = true;
        }
        if (typeof onAccept === "function") onAccept();
    }

    function setupDrag(panel) {
        let handle = $(".cap-drag-handle", panel);
        if (!handle || !panel) return;

        if (!setupDrag._state) {
            setupDrag._state = {
                panel: null,
                dragging: false,
                offsetX: 0,
                offsetY: 0
            };
        }

        let dragState = setupDrag._state;
        dragState.panel = panel;

        function startDrag(clientX, clientY, target) {
            if (target && target.tagName === "BUTTON") return;
            let activePanel = dragState.panel;
            if (!activePanel) return;
            dragState.dragging = true;
            let rect = activePanel.getBoundingClientRect();
            dragState.offsetX = clientX - rect.left;
            dragState.offsetY = clientY - rect.top;
            activePanel.style.transform = "none";
            activePanel.style.cursor = "grabbing";
            return true;
        }

        function moveDrag(clientX, clientY) {
            let activePanel = dragState.panel;
            if (!dragState.dragging || !activePanel) return;
            let x = clamp(clientX - dragState.offsetX, 0, window.innerWidth - activePanel.offsetWidth);
            let y = clamp(clientY - dragState.offsetY, 0, window.innerHeight - 40);
            activePanel.style.left = x + "px";
            activePanel.style.top = y + "px";
        }

        function endDrag() {
            let activePanel = dragState.panel;
            if (dragState.dragging && activePanel) {
                dragState.dragging = false;
                activePanel.style.cursor = "grab";
                let rect = activePanel.getBoundingClientRect();
                saveSetting("panelTop", rect.top);
                saveSetting("panelLeft", rect.left);
            }
        }

        if (!setupDrag._docHandlersBound) {
            setupDrag._docHandlersBound = true;

            let docMousemoveHandler = function (e) {
                moveDrag(e.clientX, e.clientY);
            };
            document.addEventListener("mousemove", docMousemoveHandler);
            _eventListeners.push({ element: document, type: "mousemove", handler: docMousemoveHandler });

            let docMouseupHandler = function () {
                endDrag();
            };
            document.addEventListener("mouseup", docMouseupHandler);
            _eventListeners.push({ element: document, type: "mouseup", handler: docMouseupHandler });

            let docTouchmoveHandler = function (e) {
                if (dragState.dragging && e.touches.length > 0) {
                    moveDrag(e.touches[0].clientX, e.touches[0].clientY);
                    e.preventDefault();
                }
            };
            document.addEventListener("touchmove", docTouchmoveHandler, false);
            _eventListeners.push({ element: document, type: "touchmove", handler: docTouchmoveHandler });

            let docTouchendHandler = function (e) {
                endDrag();
                e.preventDefault();
            };
            document.addEventListener("touchend", docTouchendHandler);
            _eventListeners.push({ element: document, type: "touchend", handler: docTouchendHandler });
        }

        bindElementEvent(handle, "mousedown", function (e) {
            startDrag(e.clientX, e.clientY, e.target);
            e.preventDefault();
        }, "_bound_drag_handle_mousedown");

        bindElementEvent(handle, "touchstart", function (e) {
            if (e.touches.length > 0) {
                startDrag(e.touches[0].clientX, e.touches[0].clientY, e.target);
                e.preventDefault();
            }
        }, "_bound_drag_handle_touchstart");

        bindElementEvent(handle, "touchmove", function (e) {
            if (dragState.dragging) e.preventDefault();
        }, "_bound_drag_handle_touchmove");
    }

    function setupMenuTabs() {
        $$(".cap-tab").forEach(function (tab) {
            bindElementEvent(tab, "click", function () {
                let panel = $("#chess-assist-panel");
                if (!panel) return;
                if (panel.classList.contains("minimized")) applyPanelState("maximized");
                $$(".cap-tab").forEach(function (t) {
                    t.classList.remove("active");
                });
                this.classList.add("active");
                let targetId = this.dataset.tab;
                $$(".cap-tab-content").forEach(function (p) {
                    p.style.display = "none";
                });
                let target = $("#" + targetId);
                if (target) target.style.display = "";
                if (targetId === "tab-opening") {
                    Syzygy.maybeProbe(getAccurateFen());
                    UI.updateSyzygyDisplay();
                }
            }, "_bound_tab_click");
        });
    }

    function syncToggleUI(btnId, isOn) {
        let btn = $("#" + btnId);
        if (!btn) return;
        btn.textContent = isOn ? "ON" : "OFF";
        btn.classList.toggle("on", isOn);
        btn.classList.toggle("off", !isOn);
    }

    function bindToggle(btnId, stateKey) {
        let btn = $("#" + btnId);
        if (!btn) return;
        bindElementEvent(btn, "click", function () {
            let newVal = !State[stateKey];
            saveSetting(stateKey, newVal);
            syncToggleUI(btnId, newVal);

            if (stateKey === "showPVArrows" && !newVal) UI.clearPVArrows();
            if (stateKey === "showPVArrows" && newVal) {
                if (State.analysisMode && State.analysisPVLine.length > 0) {
                    UI.drawPVArrows(State.analysisPVLine, State.analysisPVTurn, true);
                } else if (State.mainPVLine.length > 0) {
                    UI.drawPVArrows(State.mainPVLine, State.mainPVTurn, false);
                }
            }
            if (stateKey === "showBestmoveArrows" && !newVal) UI.clearBestmoveArrows();
            if (stateKey === "showBestmoveArrows" && newVal) UI.drawBestmoveArrows();
            if (stateKey === "highlightEnabled" && !newVal) UI.clearHighlights();
            if ((stateKey === "autoRun" || stateKey === "autoMovePiece") && newVal) {
                if (State.analysisMode) {
                    saveSetting("analysisMode", false);
                    syncToggleUI("btn-analysis", false);
                    let grp = $("#analysis-colors-group");
                    if (grp) grp.style.display = "none";
                    if (Engine.analysis) {
                        Engine.analysis.terminate();
                        Engine.analysis = null;
                    }
                }
            }
            if (stateKey === "autoMovePiece" && !newVal) {
                restoreSmartControlsIfForced("auto-move-off");
            }
            if (stateKey === "autoDepthAdapt" && newVal) applyAutoDepthFromOpponent();
        }, "_bound_toggle_" + btnId);
    }

    function bindElementEvent(el, eventType, handler, boundKey) {
        if (!el || typeof el.addEventListener !== "function") return null;
        let keyBase = boundKey || ("_bound_" + eventType);
        let key = keyBase;
        if (el[key]) return el;
        el[key] = true;
        el.addEventListener(eventType, function (evt) {
            try {
                handler.call(this, evt);
            } catch (e) {
                err("UI handler error:", eventType, e);
            }
        });
        return el;
    }

    function bindUIEvent(selector, eventType, handler, boundKey) {
        let el = $(selector);
        if (!el) return null;
        return bindElementEvent(el, eventType, handler, boundKey || ("_bound_" + selector + "_" + eventType));
    }

    function isAnalysisAutoPlayEnabled() {
        return !!(State.analysisMode && State.autoAnalysisColor && State.autoAnalysisColor !== "none");
    }

    function setSmartControlsEnabled(enabled) {
        let on = !!enabled;
        saveSetting("useMainConsensus", on);
        saveSetting("analysisBlunderGuard", on);
        syncToggleUI("btn-main-consensus", on);
        syncToggleUI("btn-analysis-blunder-guard", on);
    }

    let _syncSmartControlsLock = false;
    function syncSmartControlsForAnalysisAutoPlay(trigger) {
        if (_syncSmartControlsLock) return;
        _syncSmartControlsLock = true;
        try {
            if (isAnalysisAutoPlayEnabled()) {
                if (!State._smartControlsForcedByAutoPlay) {
                    State._preSmartControlsState = {
                        useMainConsensus: !!State.useMainConsensus,
                        analysisBlunderGuard: !!State.analysisBlunderGuard
                    };
                }
                State._smartControlsForcedByAutoPlay = true;
                setSmartControlsEnabled(false);
                return;
            }

            if (State._smartControlsForcedByAutoPlay) {
                let prev = State._preSmartControlsState || {
                    useMainConsensus: true,
                    analysisBlunderGuard: true
                };
                saveSetting("useMainConsensus", !!prev.useMainConsensus);
                saveSetting("analysisBlunderGuard", !!prev.analysisBlunderGuard);
                syncToggleUI("btn-main-consensus", !!State.useMainConsensus);
                syncToggleUI("btn-analysis-blunder-guard", !!State.analysisBlunderGuard);
                State._smartControlsForcedByAutoPlay = false;
            }
        } finally {
            _syncSmartControlsLock = false;
        }
    }

    function restoreSmartControlsIfForced(reason) {
        if (!State._smartControlsForcedByAutoPlay) return;
        let prev = State._preSmartControlsState || {
            useMainConsensus: true,
            analysisBlunderGuard: true
        };
        saveSetting("useMainConsensus", !!prev.useMainConsensus);
        saveSetting("analysisBlunderGuard", !!prev.analysisBlunderGuard);
        syncToggleUI("btn-main-consensus", !!State.useMainConsensus);
        syncToggleUI("btn-analysis-blunder-guard", !!State.analysisBlunderGuard);
        State._smartControlsForcedByAutoPlay = false;
    }

    function setupAllListeners() {
        function closeGearMenu() {
            let menu = $("#cap-gear-menu");
            if (menu) menu.style.display = "none";
        }

        bindUIEvent("#cap-gear", "click", function (e) {
            if (e) e.stopPropagation();
            let menu = $("#cap-gear-menu");
            if (!menu) return;
            menu.style.display = menu.style.display === "none" ? "flex" : "none";
        });
        bindUIEvent("#cap-gear-hotkeys", "click", function () {
            closeGearMenu();
            UI.showHotkeyHelp();
        });
        bindUIEvent("#cap-gear-more", "click", function () {
            closeGearMenu();
            let overlay = $("#cap-more-overlay");
            if (overlay) overlay.style.display = "flex";
        });
        bindUIEvent("#cap-gear-silent", "click", function () {
            let nextVal = !isSilentLoggingEnabled();
            saveSetting("silentLogging", nextVal);
            this.textContent = "Silent Logs: " + (nextVal ? "ON" : "OFF");
            State.statusInfo = nextVal ? "Silent logs enabled" : "Silent logs disabled";
            UI.updateStatusInfo();
            closeGearMenu();
            syncToggleUI("btn-silent-logs", nextVal);
        });
        bindUIEvent("#cap-more-close", "click", function () {
            let overlay = $("#cap-more-overlay");
            if (overlay) overlay.style.display = "none";
        });
        let moreBackdrop = $("#cap-more-overlay .cap-overlay-backdrop");
        if (moreBackdrop) {
            bindElementEvent(moreBackdrop, "click", function () {
                let overlay = $("#cap-more-overlay");
                if (overlay) overlay.style.display = "none";
            }, "_bound_more_overlay_backdrop");
        }

        if (!_gearMenuDocBound) {
            _gearMenuDocBound = true;
            let gearMenuDocClick = function (e) {
                let menu = $("#cap-gear-menu");
                if (!menu || menu.style.display === "none") return;
                let wrap = $(".cap-gear-wrap");
                if (wrap && wrap.contains(e.target)) return;
                menu.style.display = "none";
            };
            document.addEventListener("click", gearMenuDocClick, true);
            _eventListeners.push({ element: document, type: "click", handler: gearMenuDocClick, options: true });
        }

        bindUIEvent("#cap-minimize", "click", function () {
            applyPanelState("minimized");
        });
        bindUIEvent("#cap-maximize", "click", function () {
            applyPanelState("maximized");
        });
        bindUIEvent("#cap-close", "click", function () {
            applyPanelState("closed");
        });

        if (!_panelHotkeysBound) {
            _panelHotkeysBound = true;

            let panelHotkeysHandler = function (e) {

                if (e.key === "Escape") {
                    e.preventDefault();
                    let newState = State.panelState === "closed" ? "maximized" : "closed";
                    applyPanelState(newState);
                    return;
                }

                if (State.panelState === "closed") return;

                let target = e && e.target ? e.target : null;
                let targetTag = target && target.tagName ? target.tagName : "";
                let isInputField = ["INPUT", "SELECT", "TEXTAREA"].includes(targetTag);
                let isEditable = !!(target && target.isContentEditable);
                let isInEditableContainer = !!(target && target.closest && target.closest("[contenteditable]"));

                if (isInputField || isEditable || isInEditableContainer) return;

                if (!e.altKey) return;

                let depthMap = {
                    q: 1, w: 2, e: 3, r: 4, t: 5, y: 6, u: 7, i: 8, o: 9, p: 10,
                    a: 11, s: 12, d: 13, f: 14, g: 15, h: 16, j: 17, k: 18, l: 19,
                    z: 20, x: 21, c: 22, v: 23, b: 24, n: 25, m: 26
                };

                let key = e.key.toLowerCase();
                let newDepth = depthMap[key];

                if (newDepth) {
                    e.preventDefault();

                    saveSetting("customDepth", newDepth);

                    let depthSlider = $("#sld-depth");
                    let depthDisplay = $("#depth-display");

                    if (depthSlider) depthSlider.value = State.customDepth;
                    if (depthDisplay) depthDisplay.textContent = State.customDepth;

                    if (State.analysisMode) {
                        State._lastAnalysisFen = null;
                        analysisCheck();
                    } else {
                        runEngineNow();
                    }
                }
            };
            document.addEventListener("keydown", panelHotkeysHandler);
            _eventListeners.push({ element: document, type: "keydown", handler: panelHotkeysHandler });
        }

        let quickDelayInput = $("#inp-clock-quick-delay");
        if (quickDelayInput) {
            bindElementEvent(quickDelayInput, "change", function () {
                let val = parseInt(this.value, 10);
                if (!isNaN(val) && val >= 100 && val <= 5000) {
                    saveSetting("clockSyncQuickDelayMs", val);
                    updateQuickDelayDisplay();
                }
            }, "_bound_quick_delay_change");
        }

        let lowTimeInput = $("#inp-clock-low");
        if (lowTimeInput) {
            bindElementEvent(lowTimeInput, "change", function () {
                let v = parseInt(this.value, 10);
                if (!isNaN(v) && v >= 1) {
                    saveSetting("clockSyncLowTimeQuickSec", v);
                }
                updateQuickDelayDisplay();
            }, "_bound_low_time_change");
        }

        function updateQuickDelayDisplay() {
            let threshold = $("#inp-clock-low")?.value || State.clockSyncLowTimeQuickSec;
            let quickDelay = $("#inp-clock-quick-delay")?.value || State.clockSyncQuickDelayMs || 300;
            let disp1 = $("#quick-threshold-display");
            let disp2 = $("#quick-delay-display");
            if (disp1) disp1.textContent = threshold;
            if (disp2) disp2.textContent = quickDelay;
        }

        bindUIEvent("#btn-eval-mode", "click", function () {
            let newMode = State.evaluationMode === "engine" ? "human" : "engine";
            saveSetting("evaluationMode", newMode);
            this.dataset.value = newMode;
            if (newMode === "engine") {
                this.textContent = "ENGINE";
                this.classList.add("on");
                this.classList.remove("off");
                Engine.setFullStrength();
            } else {
                this.textContent = "HUMAN";
                this.classList.add("off");
                this.classList.remove("on");
                Engine.setElo(State.eloRating);
            }
            let hg = $("#human-group");
            let he = $("#human-elo-group");
            if (hg) hg.style.display = newMode === "human" ? "" : "none";
            if (he) he.style.display = newMode === "human" ? "" : "none";
        });

        bindUIEvent("#sel-human-level", "change", function () {
            saveSetting("humanLevel", this.value);
            let cfg = ELO_LEVELS[this.value];
            if (cfg) {
                saveSetting("eloRating", cfg.elo);
                let sld = $("#sld-elo");
                let disp = $("#elo-display");
                if (sld) sld.value = cfg.elo;
                if (disp) disp.textContent = cfg.elo;
                if (State.evaluationMode === "human") Engine.setElo(cfg.elo);
            }
        });

        bindUIEvent("#sld-elo", "input", function () {
            let v = parseInt(this.value);
            saveSetting("eloRating", v);
            let eloDisplay = $("#elo-display");
            if (eloDisplay) eloDisplay.textContent = v;
            if (State.evaluationMode === "human") Engine.setElo(v);
        });

        bindUIEvent("#sld-depth", "input", function () {
            saveSetting("customDepth", parseInt(this.value));
            let depthDisplay = $("#depth-display");
            if (depthDisplay) depthDisplay.textContent = State.customDepth;
        });

        bindUIEvent("#sld-skill", "input", function () {
            let val = parseInt(this.value);
            saveSetting("skillLevel", val);
            let skillDisplay = $("#skill-display");
            if (skillDisplay) skillDisplay.textContent = val;
            Engine.setSkillLevel(val);
        });

        bindUIEvent("#btn-auto-depth", "click", function () {
            if (State.autoDepthAdapt) {

                scheduleManagedTimeout(function () {
                    applyAutoDepthFromOpponent();
                }, 100);
            }
        });

        bindToggle("btn-auto-run", "autoRun");
        bindToggle("btn-auto-move", "autoMovePiece");
        bindToggle("btn-auto-match", "autoMatch");
        bindToggle("btn-highlight", "highlightEnabled");
        bindToggle("btn-book", "useOpeningBook");
        bindToggle("btn-auto-depth", "autoDepthAdapt");
        bindToggle("btn-pv-arrows", "showPVArrows");
        bindToggle("btn-bestmove-arrows", "showBestmoveArrows");
        bindToggle("btn-main-consensus", "useMainConsensus");
        bindToggle("btn-analysis-blunder-guard", "analysisBlunderGuard");
        bindToggle("btn-silent-logs", "silentLogging");

        let stableInput = $("#inp-analysis-stable");
        if (stableInput) {
            bindElementEvent(stableInput, "change", function () {
                let v = parseInt(this.value, 10);
                if (!isNaN(v)) {
                    saveSetting("analysisMinStableUpdates", clamp(v, 1, 5));
                    this.value = State.analysisMinStableUpdates;
                }
            }, "_bound_analysis_stable_change");
        }

        let pvDepthSlider = $("#sld-pv-depth");
        if (pvDepthSlider) {
            bindElementEvent(pvDepthSlider, "input", function () {
                let v = parseInt(this.value);
                saveSetting("maxPVDepth", v);
                let disp = $("#pv-depth-display");
                if (disp) disp.textContent = v;
                if (State.showPVArrows) {
                    if (State.analysisMode && State.analysisPVLine.length > 0) {
                        UI.clearPVArrows();
                        UI.drawPVArrows(State.analysisPVLine, State.analysisPVTurn, true);
                    } else if (State.mainPVLine.length > 0) {
                        UI.clearPVArrows();
                        UI.drawPVArrows(State.mainPVLine, State.mainPVTurn, false);
                    }
                }
            }, "_bound_pv_depth_input");
        }

        let cctBtn = $("#btn-cct-analysis");
        if (cctBtn) {
            bindElementEvent(cctBtn, "click", function () {
                let newVal = !State.cctAnalysisEnabled;
                saveSetting("cctAnalysisEnabled", newVal);
                syncToggleUI("btn-cct-analysis", newVal);
                let settings = $("#cct-settings");
                if (settings) settings.style.display = newVal ? "" : "none";
            }, "_bound_cct_click");
        }

        ['cct-checks', 'cct-captures', 'cct-threats'].forEach(function (id) {
            let chk = $("#" + id);
            if (chk) {
                bindElementEvent(chk, "change", function () {
                    let component = id.replace('cct-', '');
                    State.cctComponents[component] = this.checked;
                    saveSetting("cctComponents", State.cctComponents);
                }, "_bound_cct_component_change");
            }
        });

        let cctDebugChk = $("#cct-debug-enabled");
        if (cctDebugChk) {
            bindElementEvent(cctDebugChk, "change", function () {
                saveSetting("cctDebugEnabled", !!this.checked);
                UI.updateCCTDebugDisplay();
            }, "_bound_cct_debug_toggle");
        }

        bindUIEvent("#btn-analysis", "click", function () {
            let newVal = !State.analysisMode;
            saveSetting("analysisMode", newVal);
            syncToggleUI("btn-analysis", newVal);

            let grp = $("#analysis-colors-group");
            if (grp) grp.style.display = newVal ? "" : "none";

            if (newVal) {
                State.gameEnded = false;
                State.analysisGuardStateText = "Monitoring";
                State._preAnalysisState = {
                    autoRun: State.autoRun,
                    autoMovePiece: State.autoMovePiece,
                    autoMatch: State.autoMatch,
                    highlightEnabled: State.highlightEnabled,
                    showPVArrows: State.showPVArrows
                };
                cancelModePendingTimers("analysis-on");
                Engine.stop();

                if (!State.premoveEnabled) {
                    saveSetting("highlightEnabled", true);
                    syncToggleUI("btn-highlight", true);
                    saveSetting("showPVArrows", true);
                    syncToggleUI("btn-pv-arrows", true);
                }

                saveSetting("autoRun", false);
                syncToggleUI("btn-auto-run", false);
                saveSetting("autoMovePiece", false);
                syncToggleUI("btn-auto-move", false);
                saveSetting("autoMatch", false);
                syncToggleUI("btn-auto-match", false);

                UI.clearAll();
                Engine.loadAnalysisEngine();
                let analysisHistoryBody = $("#moveHistoryTableBody");
                if (analysisHistoryBody) analysisHistoryBody.innerHTML = "";
                State.analysisHistoryCursor = 0;
                State.analysisAcplFen = "";
                State.analysisEvalText = "0.00";
                State.analysisLastRecordedKey = "";
                syncAnalysisMoveHistory();
                State._lastAnalysisFen = null;
                analysisCheck();
                UI.updateAnalysisMonitorDisplay();
                syncSmartControlsForAnalysisAutoPlay("analysis-on");

            } else {
                cancelModePendingTimers("analysis-off");
                let prev = State._preAnalysisState || {};
                saveSetting("highlightEnabled", prev.highlightEnabled !== undefined ? prev.highlightEnabled : true);
                syncToggleUI("btn-highlight", State.highlightEnabled);
                saveSetting("showPVArrows", prev.showPVArrows !== undefined ? prev.showPVArrows : false);
                syncToggleUI("btn-pv-arrows", State.showPVArrows);
                if (Engine.analysis) {
                    Engine.analysis.terminate();
                    Engine.analysis = null;
                }
                State.analysisPVLine = [];
                State.analysisPVTurn = "w";
                State.analysisStableCount = 0;
                State.analysisLastBestMove = "";
                State.analysisPrevEvalCp = null;
                State.analysisLastEvalCp = null;
                State.analysisHistoryCursor = getGameHistory().length;
                State.analysisAcplFen = "";
                State.analysisEvalText = "0.00";
                State.analysisLastRecordedKey = "";
                State.analysisGuardStateText = "Ready";
                UI.clearAll();
                State._lastAnalysisFen = null;
                UI.updateAnalysisMonitorDisplay();
                syncSmartControlsForAnalysisAutoPlay("analysis-off");
            }
        });

        $$("[data-color]").forEach(function (btn) {
            bindElementEvent(btn, "click", function () {
                let color = this.dataset.color;
                saveSetting("autoAnalysisColor", color);
                $$("[data-color]").forEach(function (b) {
                    b.classList.toggle("active", b.dataset.color === color);
                });
                if (State.analysisMode && Engine.analysis) {
                    State._lastAnalysisFen = null;
                    analysisCheck();
                }
                syncSmartControlsForAnalysisAutoPlay("analysis-color-change");
            }, "_bound_analysis_color_click");
        });

        let premoveBtn = $("#btn-premove");
        if (premoveBtn) {
            bindElementEvent(premoveBtn, "click", function () {
                let newVal = !State.premoveEnabled;
                saveSetting("premoveEnabled", newVal);
                syncToggleUI("btn-premove", newVal);
                cancelModePendingTimers("premove-toggle");
                let settings = $("#premove-settings");
                if (settings) settings.style.display = newVal ? "" : "none";

                if (newVal) {
                    if (State.analysisMode) {
                        State.statusInfo = "Premove disabled in Analysis Mode";
                        UI.updateStatusInfo();
                        return;
                    }

                    State._prePremoveState = {
                        highlightEnabled: State.highlightEnabled,
                        showPVArrows: State.showPVArrows
                    };
                    saveSetting("highlightEnabled", false);
                    syncToggleUI("btn-highlight", false);
                    saveSetting("showPVArrows", false);
                    syncToggleUI("btn-pv-arrows", false);
                    UI.clearPVArrows();
                    UI.clearHighlights();

                    State.premoveLiveChance = 0;
                    State.premoveTargetChance = clamp(State.premoveMinConfidence || 0, 0, 100);
                    State.premoveLastEvalDisplay = "-";
                    State.premoveLastMoveDisplay = "-";
                    State.premoveChanceReason = "Waiting for engine PV";
                    State.premoveChanceUpdatedTs = 0;
                    UI.updatePremoveChanceDisplay();
                } else {
                    let prev = State._prePremoveState || {};
                    saveSetting("highlightEnabled", prev.highlightEnabled !== undefined ? prev.highlightEnabled : true);
                    syncToggleUI("btn-highlight", State.highlightEnabled);
                    saveSetting("showPVArrows", prev.showPVArrows !== undefined ? prev.showPVArrows : false);
                    syncToggleUI("btn-pv-arrows", State.showPVArrows);

                    State.premoveLiveChance = 0;
                    State.premoveTargetChance = 0;
                    State.premoveLastEvalDisplay = "-";
                    State.premoveLastMoveDisplay = "-";
                    State.premoveChanceReason = "Disabled";
                    State.premoveChanceUpdatedTs = 0;
                    UI.updatePremoveChanceDisplay();
                }
            }, "_bound_premove_click");
        }

        let premoveModeSelect = $("#sel-premove-mode");
        if (premoveModeSelect && !premoveModeSelect._bound) {
            premoveModeSelect._bound = true;
            bindElementEvent(premoveModeSelect, "change", function () {
                saveSetting("premoveMode", this.value);
                let filters = $("#premove-piece-filters");
                if (filters) filters.style.display = this.value === "filter" ? "" : "none";
                if (this.value !== "every" && this.value !== "capture" && this.value !== "filter") {
                    warn("Unknown premoveMode:", this.value);
                }
            }, "_bound_premove_mode_change");
        }

        $$("#premove-piece-filters input[type=\"checkbox\"]").forEach(function (chk) {
            if (chk._bound) return;
            chk._bound = true;
            bindElementEvent(chk, "change", function () {
                let p = this.dataset.piece;
                if (!/^[qrbnp]$/.test(p)) {
                    warn("Unknown piece filter key:", p);
                    return;
                }
                State.premovePieces[p] = this.checked ? 1 : 0;
                saveSetting("premovePieces", State.premovePieces);
            }, "_bound_premove_piece_change");
        });

        bindUIEvent("#btn-delay-mode", "click", function () {
            let newVal = !State.clockSync;
            saveSetting("clockSync", newVal);
            this.textContent = newVal ? "Clock Sync" : "Normal";
            this.classList.toggle("on", newVal);
            this.classList.toggle("off", !newVal);
            let delayNormal = $("#delay-normal");
            let delayFast = $("#delay-fast");
            let delayPresetsGroup = $("#delay-presets-group");
            if (delayNormal) delayNormal.style.display = newVal ? "none" : "";
            if (delayFast) delayFast.style.display = newVal ? "" : "none";
            if (delayPresetsGroup) delayPresetsGroup.style.display = newVal ? "none" : "";

            let clockMinInput = $("#inp-clock-min-delay");
            let clockMaxInput = $("#inp-clock-max-delay");
            if (clockMinInput) clockMinInput.value = State.minDelay;
            if (clockMaxInput) clockMaxInput.value = State.maxDelay;
        });

        let delayPresets = {
            "bullet": { min: 0.5, max: 1.0 },
            "blitz": { min: 1.0, max: 2.0 },
            "rapid": { min: 2.0, max: 4.0 }
        };

        $$(".cap-preset-btn").forEach(function (btn) {
            bindElementEvent(btn, "click", function () {
                let preset = this.dataset.preset;
                if (delayPresets[preset]) {
                    let config = delayPresets[preset];

                    saveSetting("minDelay", config.min);
                    saveSetting("maxDelay", config.max);

                    let minInput = $("#inp-min-delay");
                    let maxInput = $("#inp-max-delay");
                    let clockMinInput = $("#inp-clock-min-delay");
                    let clockMaxInput = $("#inp-clock-max-delay");
                    if (minInput) minInput.value = config.min;
                    if (maxInput) maxInput.value = config.max;
                    if (clockMinInput) clockMinInput.value = config.min;
                    if (clockMaxInput) clockMaxInput.value = config.max;

                    $$(".cap-preset-btn").forEach(function (b) {
                        b.classList.remove("active");
                    });
                    this.classList.add("active");

                    State.statusInfo = "Preset: " + preset.charAt(0).toUpperCase() + preset.slice(1) + " (" + config.min + "s - " + config.max + "s)";
                    UI.updateStatusInfo();
                }
            }, "_bound_delay_preset_click");
        });

        $$('[id^=\'btn-mode-\']').forEach(function (btn) {
            bindElementEvent(btn, "click", function () {
                let mode = this.dataset.mode;
                State.moveExecutionMode = mode;
                saveSetting("moveExecutionMode", mode);

                let modeClickBtn = $("#btn-mode-click");
                let modeDragBtn = $("#btn-mode-drag");
                if (modeClickBtn) modeClickBtn.classList.toggle("active", mode === "click");
                if (modeDragBtn) modeDragBtn.classList.toggle("active", mode === "drag");

                State.statusInfo = "Move Mode: " + mode.toUpperCase() + (mode === "drag" ? " (Bezier)" : " (Simple)");
                UI.updateStatusInfo();
            }, "_bound_mode_button_click");
        });

        let delayInputs = {
            "inp-min-delay": "minDelay",
            "inp-max-delay": "maxDelay",
            "inp-clock-min-delay": "minDelay",
            "inp-clock-max-delay": "maxDelay"
        };
        Object.keys(delayInputs).forEach(function (id) {
            let el = $("#" + id);
            if (el) {
                bindElementEvent(el, "change", function () {
                    let v = parseFloat(this.value);
                    if (!isNaN(v) && v > 0) {
                        saveSetting(delayInputs[id], v);
                        let minInput = $("#inp-min-delay");
                        let maxInput = $("#inp-max-delay");
                        let clockMinInput = $("#inp-clock-min-delay");
                        let clockMaxInput = $("#inp-clock-max-delay");
                        if (minInput) minInput.value = State.minDelay;
                        if (maxInput) maxInput.value = State.maxDelay;
                        if (clockMinInput) clockMinInput.value = State.minDelay;
                        if (clockMaxInput) clockMaxInput.value = State.maxDelay;
                    }
                }, "_bound_delay_input_change");
            }
        });

        bindUIEvent("#inp-color1", "input", function () {
            saveSetting("highlightColor1", this.value);
        });
        let pvActiveRank = 1;
        let pvActiveInput = $("#inp-pv-color-active");
        if (pvActiveInput) {
            bindElementEvent(pvActiveInput, "input", function () {
                let colors = Object.assign({}, State.pvArrowColors || {});
                colors[pvActiveRank] = this.value;
                saveSetting("pvArrowColors", colors);
                let swatch = $(".cap-pv-color[data-pv-rank='" + pvActiveRank + "']");
                if (swatch) swatch.style.background = this.value;
                if (State.showPVArrows) {
                    if (State.analysisMode && State.analysisPVLine.length > 0) {
                        UI.clearPVArrows();
                        UI.drawPVArrows(State.analysisPVLine, State.analysisPVTurn, true);
                    } else if (State.mainPVLine.length > 0) {
                        UI.clearPVArrows();
                        UI.drawPVArrows(State.mainPVLine, State.mainPVTurn, false);
                    }
                }
            }, "_bound_pv_active_input");
        }

        $$(".cap-pv-color").forEach(function (swatch) {
            bindElementEvent(swatch, "click", function () {
                let rank = parseInt(this.dataset.pvRank, 10);
                if (!rank || rank < 1 || rank > 9) return;
                pvActiveRank = rank;
                $$(".cap-pv-color").forEach(function (el) {
                    el.classList.toggle("active", el.dataset.pvRank === String(rank));
                });
                if (pvActiveInput) {
                    let colors = State.pvArrowColors || {};
                    pvActiveInput.value = colors[rank] || colors[String(rank)] || "#4287f5";
                }
            }, "_bound_pv_color_click");
        });

        let bmActiveRank = 1;
        let bmActiveInput = $("#inp-bestmove-color-active");
        if (bmActiveInput) {
            bindElementEvent(bmActiveInput, "input", function () {
                let colors = Object.assign({}, State.bestmoveArrowColors || {});
                colors[bmActiveRank] = this.value;
                saveSetting("bestmoveArrowColors", colors);
                if (bmActiveRank === 1) {
                    saveSetting("bestmoveArrowColor", this.value);
                }
                let swatch = $(".cap-bm-color[data-bm-rank='" + bmActiveRank + "']");
                if (swatch) swatch.style.background = this.value;
                if (State.showBestmoveArrows) {
                    UI.drawBestmoveArrows();
                }
            }, "_bound_bestmove_active_input");
        }

        $$(".cap-bm-color").forEach(function (swatch) {
            bindElementEvent(swatch, "click", function () {
                let rank = parseInt(this.dataset.bmRank, 10);
                if (!rank || rank < 1 || rank > 9) return;
                bmActiveRank = rank;
                $$(".cap-bm-color").forEach(function (el) {
                    el.classList.toggle("active", el.dataset.bmRank === String(rank));
                });
                if (bmActiveInput) {
                    let colors = State.bestmoveArrowColors || {};
                    bmActiveInput.value = colors[rank] || colors[String(rank)] || "#eb6150";
                }
            }, "_bound_bestmove_color_click");
        });

        $$(".cap-preset").forEach(function (p) {
            bindElementEvent(p, "click", function () {
                if (!this.dataset.c) return;
                let parent = this.closest(".cap-presets");
                if (!parent || !parent.dataset || !parent.dataset.target) return;
                let targetId = parent.dataset.target;
                let input = $("#" + targetId);
                if (input) {
                    input.value = this.dataset.c;
                    input.dispatchEvent(new Event("input"));
                }
            }, "_bound_color_preset_click");
        });

        bindUIEvent("#btn-reload-engine", "click", function () {
            State.statusInfo = "🔄 Reloading all engines...";
            UI.updateStatusInfo();

            this.disabled = true;
            this.textContent = "⏳";
            this.style.opacity = "0.7";

            Engine.reloadAllEngines().then(function (success) {
                let btn = $("#btn-reload-engine");
                if (btn) {
                    btn.disabled = false;
                    btn.textContent = "Reload";
                    btn.style.opacity = "1";
                }

                if (success) {
                    State.statusInfo = "✅ All engines reloaded!";
                    UI.updateStatusInfo();

                    if (State.analysisMode) {
                        State._lastAnalysisFen = null;
                        analysisCheck();
                    }
                } else {
                    State.statusInfo = "❌ Engine reload failed";
                    UI.updateStatusInfo();
                }
            });
        });

        bindUIEvent("#btn-run-once", "click", function () {
            if (State.analysisMode) {
                State._lastAnalysisFen = null;
                analysisCheck();
            } else {
                runEngineNow();
            }
        });

        bindUIEvent("#btn-stop-engine", "click", function () {
            Engine.stop();
            if (State.analysisMode && Engine.analysis) {
                Engine.analysis.postMessage("stop");
            }
            UI.clearAll();
        });

        bindUIEvent("#btn-soft-reset-analysis", "click", function () {
            softResetAnalysis("ui-button");
        });

        bindUIEvent("#btn-soft-reset-premove", "click", function () {
            softResetPremove("ui-button");
        });

        bindUIEvent("#btn-export-settings", "click", function () {
            exportSettingsToFile();
        });

        bindUIEvent("#btn-import-settings", "click", function () {
            let fileInput = $("#inp-import-settings");
            if (fileInput) fileInput.click();
        });

        let importInput = $("#inp-import-settings");
        if (importInput) {
            bindElementEvent(importInput, "change", function () {
                let file = this.files && this.files.length ? this.files[0] : null;
                importSettingsFromFile(file);
                this.value = "";
            }, "_bound_import_settings_change");
        }

        bindUIEvent("#inp-move-filter", "input", function () {
            UI.applyMoveHistoryFilter(this.value || "");
        });

        bindUIEvent("#btn-clear-history", "click", function () {
            MoveHistory.clear();
        });

        bindUIEvent("#btn-auto-resign", "click", function () {
            let newVal = !State.autoResignEnabled;
            saveSetting("autoResignEnabled", newVal);
            syncToggleUI("btn-auto-resign", newVal);
            let autoResignGroup = $("#auto-resign-group");
            if (autoResignGroup) autoResignGroup.style.display = newVal ? "" : "none";
        });
        bindUIEvent("#sel-resign-mode", "change", function () {
            saveSetting("resignMode", this.value);
            let resignMateBox = $("#resign-mate-box");
            let resignCpBox = $("#resign-cp-box");
            if (resignMateBox) resignMateBox.style.display = this.value === "mate" ? "" : "none";
            if (resignCpBox) resignCpBox.style.display = this.value === "cp" ? "" : "none";
        });
        bindUIEvent("#sel-resign-m", "change", function () {
            let v = parseInt(this.value);
            if (!isNaN(v)) saveSetting("autoResignThresholdMate", v);
        });
        bindUIEvent("#inp-resign-cp", "change", function () {
            let v = parseInt(this.value);
            if (!isNaN(v)) saveSetting("autoResignThresholdCp", v);
        });

        bindUIEvent("#btn-clock-sync", "click", function () {
            let newVal = !State.clockSync;
            saveSetting("clockSync", newVal);
            syncToggleUI("btn-clock-sync", newVal);
            let clockSyncGroup = $("#clock-sync-group");
            if (clockSyncGroup) clockSyncGroup.style.display = newVal ? "" : "none";
        });
        bindUIEvent("#txt-notation-sequence", "input", function () {
            saveSetting("notationSequence", this.value.trim());
        });

        syncSmartControlsForAnalysisAutoPlay("setup-listeners");
    }

    function loadStockfishManually() {
        return EngineLoader.loadAsync();
    }

    // =====================================================
    // Section 15: Board and Game State Functions
    // =====================================================
    function getBoardElement() {
        return $("wc-chess-board") || $("chess-board") || $(".board");
    }

    function getGameController() {
        try {
            let board = getBoardElement();
            if (!board) return null;

            if (board.game && typeof board.game === 'object') return board.game;
            if (board._game && typeof board._game === 'object') return board._game;

            if (typeof unsafeWindow !== 'undefined' && unsafeWindow.chesscom && unsafeWindow.chesscom.game) {
                return unsafeWindow.chesscom.game;
            }
        } catch (e) {
        }
        return null;
    }

    function getGameHistory() {
        let gc = getGameController();
        if (!gc) return [];
        try {
            let log = (typeof gc.getLog === "function") ? gc.getLog() : (gc.log || []);
            if (Array.isArray(log)) {
                return log.map(m => m.uci || m.move?.uci).filter(m => !!m);
            }
        } catch (e) {
            warn("Error getting history:", e);
        }
        return [];
    }

    function getGame() {
        let now = Date.now();
        if (cachedGame && (now - cachedGameTimestamp) < GAME_CACHE_TTL) {
            try {
                if (typeof cachedGame.getFEN === "function") {
                    cachedGame.getFEN();
                    return cachedGame;
                }
            } catch (e) {
                cachedGame = null;
            }
        }
        cachedGame = getGameController();
        cachedGameTimestamp = now;
        return cachedGame;
    }

    function normalizeSide(val) {
        if (val === 1 || val === "w" || val === "white") return "w";
        if (val === 2 || val === "b" || val === "black") return "b";
        return null;
    }

    function getPlayingAs(game) {
        let g = game || getGameController();
        if (!g) return null;
        try {
            if (typeof g.getPlayingAs === "function") return normalizeSide(g.getPlayingAs());
        } catch (e) { }
        return null;
    }

    function detectPlayersTurnFromDOM() {
        try {
            let selectors = [
                ".clock-time-monospace[role='timer']",
                ".clock-time-monospace",
                ".clock-component .clock-time-monospace"
            ];

            let clocks = [];
            for (let i = 0; i < selectors.length; i++) {
                let found = Array.from(document.querySelectorAll(selectors[i])).filter(function (el) {
                    return !!(el && el.offsetParent !== null);
                });
                if (found.length >= 2) {
                    clocks = found;
                    break;
                }
            }
            if (clocks.length < 2) return null;

            let activeClock = clocks.find(function (el) {
                let cls = String((el.closest(".clock-component") || el).className || "").toLowerCase();
                return cls.includes("player-turn") || cls.includes("clock-player-turn");
            });
            if (!activeClock) return null;

            let sorted = clocks
            .map(function (el) { return { el: el, rect: el.getBoundingClientRect() }; })
            .sort(function (a, b) { return a.rect.top - b.rect.top; });

            let bottomClock = sorted[sorted.length - 1].el;
            return activeClock === bottomClock;
        } catch (e) {
            return null;
        }
    }

    function isPlayersTurn(game) {
        let g = game || getGame();
        if (!g) {
            let domTurn = detectPlayersTurnFromDOM();
            return domTurn === null ? false : domTurn;
        }
        try {
            let turn, playingAs;
            if (typeof g.getTurn === "function") turn = g.getTurn();
            if (typeof g.getPlayingAs === "function") playingAs = g.getPlayingAs();
            let normTurn = normalizeSide(turn);
            let normPlaying = normalizeSide(playingAs);
            if (normTurn !== null && normPlaying !== null) return normTurn === normPlaying;
        } catch (e) { }

        let domTurn = detectPlayersTurnFromDOM();
        return domTurn === null ? false : domTurn;
    }

    function isBoardFlipped() {
        let board = getBoardElement();
        if (!board) return false;
        return board.classList.contains("flipped") || board.getAttribute("data-flipped") === "true";
    }

    function getAccurateFen() {
        let game = getGameController();
        if (game) {
            try {
                if (typeof game.getFEN === "function") return game.getFEN();
                if (typeof game.fen === "function") return game.fen();
                if (game.fen && typeof game.fen === "string") return game.fen;
            } catch (e) { }
        }
        return buildFenFromDOM();
    }

    function hashFen(fen) {
        if (!fen || typeof fen !== "string") return "";
        return fen.split(' ').slice(0, 4).join(' ');
    }

    function normalizeFen(fen) {
        if (!fen) return "";
        let parts = fen.split(" ");
        return parts.slice(0, 4).join(" ");
    }

    function getCurrentTurn(fen) {
        if (!fen) return "w";
        let parts = fen.split(" ");
        return parts.length > 1 ? parts[1] : "w";
    }

    function updateMoveNumber(fen) {
        if (!fen) return;
        let parts = fen.split(" ");
        if (parts.length >= 6) {
            State.moveNumber = parseInt(parts[5], 10) || 1;
        }
    }

    function saveSetting(key, value) {
        if (!Object.prototype.hasOwnProperty.call(State, key)) return;
        const sanitized = sanitizeSettingValue(key, value);
        State[key] = sanitized;
        GM_setValue(key, sanitized);
    }

    // =====================================================
    // Section 16: FEN Construction from DOM
    // =====================================================
    function buildFenFromDOM() {
        let board = getBoardElement();
        if (!board) return null;
        let grid = [];
        let r, c;
        for (r = 0; r < 8; r++) {
            grid[r] = [];
            for (c = 0; c < 8; c++) {
                grid[r][c] = null;
            }
        }
        let pieces = $$(".piece", board);
        if (pieces.length === 0) return null;

        pieces.forEach(function (piece) {
            let classes = piece.className.split(/\s+/);
            let pieceType = null;
            let squareStr = null;
            for (let i = 0; i < classes.length; i++) {
                if (PIECE_CHAR[classes[i]]) pieceType = PIECE_CHAR[classes[i]];
                if (/^square-\d{2,}$/.test(classes[i])) squareStr = classes[i].replace("square-", "");
            }
            if (pieceType && squareStr) {
                let file = parseInt(squareStr.charAt(0)) - 1;
                let rank = parseInt(squareStr.charAt(1)) - 1;
                if (file >= 0 && file < 8 && rank >= 0 && rank < 8) {
                    grid[7 - rank][file] = pieceType;
                }
            }
        });

        let fenRows = [];
        for (r = 0; r < 8; r++) {
            let row = "";
            let empty = 0;
            for (c = 0; c < 8; c++) {
                if (grid[r][c]) {
                    if (empty > 0) {
                        row += empty;
                        empty = 0;
                    }
                    row += grid[r][c];
                } else {
                    empty++;
                }
            }
            if (empty > 0) row += empty;
            fenRows.push(row);
        }

        let turn = "w";
        let moveList = $$(".move-node, .move, [data-ply]");
        if (moveList.length > 0) turn = moveList.length % 2 === 0 ? "w" : "b";

        let castling = "";
        if (grid[7][4] === "K" && grid[7][7] === "R") castling += "K";
        if (grid[7][4] === "K" && grid[7][0] === "R") castling += "Q";
        if (grid[0][4] === "k" && grid[0][7] === "r") castling += "k";
        if (grid[0][4] === "k" && grid[0][0] === "r") castling += "q";
        if (!castling) castling = "-";

        return fenRows.join("/") + " " + turn + " " + castling + " - 0 1";
    }

    // =====================================================
    // Section 17: FEN and Piece Manipulation
    // =====================================================
    function fenCharAtSquare(fen, square) {
        if (!fen || !square) return null;
        let placement = fen.split(" ")[0];
        let ranks = placement.split("/");
        let file = "abcdefgh".indexOf(square[0]);
        let rankNum = parseInt(square[1], 10);
        if (file < 0 || rankNum < 1 || rankNum > 8 || ranks.length !== 8) return null;
        let row = 8 - rankNum;
        let rowStr = ranks[row];
        let col = 0;
        for (let i = 0; i < rowStr.length; i++) {
            let ch = rowStr[i];
            if (/\d/.test(ch)) {
                col += parseInt(ch, 10);
                if (col > file) return null;
            } else {
                if (col === file) return ch;
                col++;
            }
        }
        return null;
    }

    function pieceFromFenChar(ch) {
        if (!ch) return null;
        let isUpper = ch === ch.toUpperCase();
        return {
            color: isUpper ? "w" : "b",
            type: ch.toLowerCase()
        };
    }

    function findKing(fen, color) {
        let placement = fen.split(" ")[0];
        let ranks = placement.split("/");
        let kingChar = color === "w" ? "K" : "k";
        for (let rankIdx = 0; rankIdx < 8; rankIdx++) {
            let rank = 8 - rankIdx;
            let file = 0;
            for (let i = 0; i < ranks[rankIdx].length; i++) {
                let ch = ranks[rankIdx][i];
                if (/\d/.test(ch)) {
                    file += parseInt(ch, 10);
                } else {
                    if (ch === kingChar) return "abcdefgh"[file] + rank;
                    file++;
                }
            }
        }
        return null;
    }

    function isEnPassantCapture(fen, from, to, ourColor) {
        let parts = fen.split(" ");
        let ep = parts[3];
        let fromPiece = pieceFromFenChar(fenCharAtSquare(fen, from));
        if (!fromPiece || fromPiece.color !== ourColor || fromPiece.type !== "p") return false;
        return ep && ep !== "-" && to === ep && from[0] !== to[0];
    }

    function makeSimpleMove(fen, from, to, promotion) {
        if (!fen || !from || !to) return fen;
        try {
            let parts = fen.split(" ");
            let ranks = parts[0].split("/");
            let fromFile = from.charCodeAt(0) - 97;
            let fromRank = 8 - parseInt(from[1], 10);
            let toFile = to.charCodeAt(0) - 97;
            let toRank = 8 - parseInt(to[1], 10);

            if (fromFile < 0 || fromFile > 7 || toFile < 0 || toFile > 7 ||
                fromRank < 0 || fromRank > 7 || toRank < 0 || toRank > 7) return fen;

            let expand = function (r) {
                return r.replace(/\d/g, function (d) {
                    return ".".repeat(+d);
                });
            };
            let compress = function (r) {
                return r.replace(/\.{1,8}/g, function (m) {
                    return "" + m.length;
                });
            };

            let board = ranks.map(function (r) {
                return expand(r).split("");
            });
            let piece = board[fromRank][fromFile];
            if (!piece || piece === ".") return fen;

            let isPawn = piece.toLowerCase() === "p";
            let isKing = piece.toLowerCase() === "k";
            let isCapture = board[toRank][toFile] !== ".";

            if (isPawn && parts[3] && parts[3] !== "-" && to === parts[3]) {
                let epRank = piece === "P" ? toRank + 1 : toRank - 1;
                if (epRank >= 0 && epRank < 8) {
                    board[epRank][toFile] = ".";
                    isCapture = true;
                }
            }

            board[fromRank][fromFile] = ".";

            if (isPawn && (toRank === 0 || toRank === 7)) {
                let promoChar = promotion || "q";
                board[toRank][toFile] = piece === piece.toUpperCase() ? promoChar.toUpperCase() : promoChar.toLowerCase();
            } else {
                board[toRank][toFile] = piece;
            }

            if (isKing && Math.abs(fromFile - toFile) === 2) {
                let rookFromFile = toFile > fromFile ? 7 : 0;
                let rookToFile = toFile > fromFile ? toFile - 1 : toFile + 1;
                board[toRank][rookToFile] = board[toRank][rookFromFile];
                board[toRank][rookFromFile] = ".";
            }

            parts[0] = board.map(function (r) {
                return compress(r.join(""));
            }).join("/");

            let currentSide = parts[1] || "w";
            parts[1] = currentSide === "w" ? "b" : "w";

            let castling = parts[2] || "-";
            if (castling !== "-") {
                if (isKing) {
                    if (piece === 'K') castling = castling.replace(/[KQ]/g, '');
                    else castling = castling.replace(/[kq]/g, '');
                }
                if (from === 'a1' || to === 'a1') castling = castling.replace('Q', '');
                if (from === 'h1' || to === 'h1') castling = castling.replace('K', '');
                if (from === 'a8' || to === 'a8') castling = castling.replace('q', '');
                if (from === 'h8' || to === 'h8') castling = castling.replace('k', '');
                if (castling === '') castling = '-';
            }
            parts[2] = castling;

            if (isPawn && Math.abs(fromRank - toRank) === 2) {
                let epRankNum = 8 - ((fromRank + toRank) / 2);
                parts[3] = "abcdefgh"[fromFile] + epRankNum;
            } else {
                parts[3] = "-";
            }

            let halfmove = parseInt(parts[4] || "0", 10);
            if (isPawn || isCapture) halfmove = 0;
            else halfmove++;
            parts[4] = "" + halfmove;

            if (parts[1] === "w") {
                parts[5] = "" + (parseInt(parts[5] || "1", 10) + 1);
            }

            return parts.join(" ");
        } catch (e) {
            return fen;
        }
    }

    function getPredictedFen(fen, pvMoves) {
        if (!pvMoves || pvMoves.length === 0) return fen;
        let predictedFen = fen;
        let oppMove = pvMoves[0];
        if (oppMove && oppMove.length >= 4) {
            let oppFrom = oppMove.substring(0, 2);
            let oppTo = oppMove.substring(2, 4);
            let oppPromo = oppMove.length > 4 ? oppMove[4] : null;
            predictedFen = makeSimpleMove(predictedFen, oppFrom, oppTo, oppPromo);
        }
        return predictedFen;
    }

    // =====================================================
    // Section 18: Attack and Threat Detection
    // =====================================================
    function getAttackersOfSquare(fen, targetSquare, attackerColor) {
        let attackers = [];
        let tFile = "abcdefgh".indexOf(targetSquare[0]);
        let tRank = parseInt(targetSquare[1], 10);
        if (tFile < 0 || tRank < 1 || tRank > 8) return attackers;

        let checkSquare = function (file, rank, pieceTypes) {
            if (file < 0 || file > 7 || rank < 1 || rank > 8) return;
            let sq = "abcdefgh"[file] + rank;
            let ch = fenCharAtSquare(fen, sq);
            let p = pieceFromFenChar(ch);
            if (p && p.color === attackerColor && pieceTypes.includes(p.type)) {
                attackers.push({ square: sq, piece: p.type });
            }
        };

        let pawnDir = attackerColor === "w" ? 1 : -1;
        checkSquare(tFile - 1, tRank - pawnDir, ["p"]);
        checkSquare(tFile + 1, tRank - pawnDir, ["p"]);

        let knightMoves = [
            [2, 1],
            [2, -1],
            [-2, 1],
            [-2, -1],
            [1, 2],
            [1, -2],
            [-1, 2],
            [-1, -2]
        ];
        knightMoves.forEach(function (m) {
            checkSquare(tFile + m[0], tRank + m[1], ["n"]);
        });

        for (let df = -1; df <= 1; df++) {
            for (let dr = -1; dr <= 1; dr++) {
                if (df === 0 && dr === 0) continue;
                checkSquare(tFile + df, tRank + dr, ["k"]);
            }
        }

        let directions = [
            { dx: 1, dy: 0, pieces: ["r", "q"] }, { dx: -1, dy: 0, pieces: ["r", "q"] },
            { dx: 0, dy: 1, pieces: ["r", "q"] }, { dx: 0, dy: -1, pieces: ["r", "q"] },
            { dx: 1, dy: 1, pieces: ["b", "q"] }, { dx: 1, dy: -1, pieces: ["b", "q"] },
            { dx: -1, dy: 1, pieces: ["b", "q"] }, { dx: -1, dy: -1, pieces: ["b", "q"] }
        ];

        directions.forEach(function (dir) {
            let f = tFile + dir.dx;
            let r = tRank + dir.dy;
            while (f >= 0 && f <= 7 && r >= 1 && r <= 8) {
                let sq = "abcdefgh"[f] + r;
                let ch = fenCharAtSquare(fen, sq);
                if (ch) {
                    let p = pieceFromFenChar(ch);
                    if (p && p.color === attackerColor && dir.pieces.includes(p.type)) {
                        attackers.push({ square: sq, piece: p.type });
                    }
                    break;
                }
                f += dir.dx;
                r += dir.dy;
            }
        });

        return attackers;
    }

    function isSquareAttackedBy(fen, square, attackerColor) {
        return getAttackersOfSquare(fen, square, attackerColor).length > 0;
    }

    function isCheckmate(fen, colorInCheck) {
        let kingPos = findKing(fen, colorInCheck);
        if (!kingPos) return false;
        let oppColor = colorInCheck === "w" ? "b" : "w";
        if (!isSquareAttackedBy(fen, kingPos, oppColor)) return false;

        let kf = "abcdefgh".indexOf(kingPos[0]);
        let kr = parseInt(kingPos[1]);

        for (let df = -1; df <= 1; df++) {
            for (let dr = -1; dr <= 1; dr++) {
                if (df === 0 && dr === 0) continue;
                let nf = kf + df,
                    nr = kr + dr;
                if (nf < 0 || nf > 7 || nr < 1 || nr > 8) continue;

                let sq = "abcdefgh"[nf] + nr;
                let ch = fenCharAtSquare(fen, sq);
                let piece = pieceFromFenChar(ch);

                if (piece && piece.color === colorInCheck) continue;

                let testFen = makeSimpleMove(fen, kingPos, sq);
                let newKingPos = sq;

                if (!isSquareAttackedBy(testFen, newKingPos, oppColor)) {
                    return false;
                }
            }
        }
        return true;
    }



    // =====================================================
    // Section 19: Premove Safety Check
    // =====================================================
    const PremoveSafety = {

        cache: new Map(),
        CACHE_DURATION: 1000,

        RISK: {
            CRITICAL: 100,
            VERY_HIGH: 80,
            HIGH: 60,
            MEDIUM: 40,
            LOW: 20,
            SAFE: 0
        },

        PIECE_RISK: {
            q: 10,
            r: 8,
            b: 5,
            n: 5,
            p: 3
        },

        check(fen, uci, ourColor) {

            if (!fen || !uci || uci.length < 4) {
                return this._createResult(false, "Invalid move", this.RISK.CRITICAL, null);
            }

            const cacheKey = `${fen}|${uci}`;
            const cached = this.cache.get(cacheKey);
            if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
                return cached.result;
            }

            const from = uci.substring(0, 2);
            const to = uci.substring(2, 4);
            const oppColor = ourColor === "w" ? "b" : "w";

            const movingCh = fenCharAtSquare(fen, from);
            const movingPiece = pieceFromFenChar(movingCh);

            if (!movingPiece || movingPiece.color !== ourColor) {
                return this._createResult(false, "Not our piece", this.RISK.CRITICAL, null);
            }

            const newFen = makeSimpleMove(fen, from, to);
            if (!newFen) {
                return this._createResult(false, "Invalid move", this.RISK.CRITICAL, null);
            }

            const ourKingPos = findKing(newFen, ourColor);
            if (ourKingPos && isSquareAttackedBy(newFen, ourKingPos, oppColor)) {
                return this._createResult(false, "Exposes king to check", this.RISK.CRITICAL, null);
            }

            const oppKingPos = findKing(newFen, oppColor);
            const givesCheck = oppKingPos && isSquareAttackedBy(newFen, oppKingPos, ourColor);

            if (givesCheck && isCheckmate(newFen, oppColor)) {
                return this._createResult(true, "Checkmate!", this.RISK.SAFE, null);
            }

            const cct = State.cctAnalysisEnabled
            ? analyzeCCT(fen, uci, ourColor)
            : null;

            const analysis = this._analyzeSafety(fen, newFen, from, to, movingPiece, ourColor, oppColor, givesCheck, cct);

            const result = this._createResult(
                analysis.safe,
                analysis.reasons.join(", ") || (analysis.safe ? "Safe" : "Risky"),
                analysis.riskLevel,
                cct
            );

            updateCCTDebugSnapshot("PremoveSafety", uci, cct, result, result.reason);

            this.cache.set(cacheKey, {
                result: result,
                timestamp: Date.now()
            });

            if (this.cache.size > 100) {
                const entries = [...this.cache.entries()];
                const cutoff = Date.now() - this.CACHE_DURATION;
                entries.forEach(([key, value]) => {
                    if (value.timestamp < cutoff) {
                        this.cache.delete(key);
                    }
                });
            }

            return result;
        },

        _analyzeSafety(fen, newFen, from, to, movingPiece, ourColor, oppColor, givesCheck, cct) {
            let riskLevel = 0;
            const reasons = [];
            const destCh = fenCharAtSquare(fen, to);
            const destPiece = pieceFromFenChar(destCh);

            if (cct && cct.givesCheck) {
                if (cct.checkIsSafe) {
                    reasons.push("✓ Safe check");
                    riskLevel -= 15;
                } else {
                    reasons.push("⚠ Check (may be recaptured)");
                    riskLevel -= 5;
                }
            }

            if (cct && cct.captureAnalysis) {
                const netGain = cct.captureAnalysis.netMaterialGain;

                if (netGain < 0) {
                    const lossPenalty = givesCheck ? 8 : 12;
                    reasons.push(`✗ Loses material: ${netGain}`);
                    riskLevel += Math.abs(netGain) * lossPenalty;
                } else if (netGain > 0) {
                    reasons.push(`✓ Wins material: +${netGain}`);
                    riskLevel -= netGain * 3;
                }

                if (cct.captureAnalysis.ourPieceHanging && !destPiece) {
                    if (!givesCheck) {
                        const pieceValue = PIECE_VALUES[movingPiece.type] || 0;
                        riskLevel += 25 + (pieceValue * 5);
                        reasons.push(`✗ Piece hanging (${movingPiece.type})`);
                    } else {
                        reasons.push("⚠ Piece exposed but gives check");
                        riskLevel += 10;
                    }
                }
            }

            if (cct && cct.threats) {

                if (cct.threats.created && cct.threats.created.length > 0) {
                    const majorThreats = cct.threats.created.filter(t => t.severity === 'high');
                    if (majorThreats.length > 0) {
                        reasons.push(`✓ Creates ${majorThreats.length} major threat(s)`);
                        riskLevel -= 8 * Math.min(majorThreats.length, 2);
                    }
                }

                if (cct.threats.weFallInto && cct.threats.weFallInto.length > 0) {
                    const highThreats = cct.threats.weFallInto.filter(t => t.severity === 'high');
                    const mediumThreats = cct.threats.weFallInto.filter(t => t.severity === 'medium');

                    if (highThreats.length > 0) {
                        if (!givesCheck) {
                            reasons.push(`✗ Falls into ${highThreats.length} HIGH threat(s)`);
                            riskLevel += 50 * highThreats.length;
                        } else {
                            reasons.push(`⚠ HIGH threats but gives check`);
                            riskLevel += 20 * highThreats.length;
                        }
                    }

                    if (mediumThreats.length > 0 && !givesCheck) {
                        reasons.push(`⚠ Falls into ${mediumThreats.length} medium threat(s)`);
                        riskLevel += 20 * mediumThreats.length;
                    }
                }
            }

            if (movingPiece.type === "k") {
                if (isSquareAttackedBy(fen, to, oppColor)) {
                    reasons.push("✗ CRITICAL: King into check");
                    riskLevel = this.RISK.CRITICAL;
                }
            }

            if (movingPiece.type !== "k") {
                const ourKingPos = findKing(fen, ourColor);
                if (ourKingPos && isPiecePinned(fen, from, ourKingPos, ourColor, oppColor)) {
                    reasons.push("✗ Piece is PINNED to king");
                    riskLevel += 70;

                    if (!givesCheck) {
                        reasons.push("✗ CRITICAL: Illegal move");
                        riskLevel = this.RISK.CRITICAL;
                    }
                }
            }

            if (movingPiece.type === "q") {
                const queenRisk = this._analyzeQueenRisk(newFen, to, oppColor, ourColor, destPiece, givesCheck, cct);
                riskLevel += queenRisk.risk;
                reasons.push(...queenRisk.reasons);
            }

            if (movingPiece.type === "r") {
                const rookRisk = this._analyzeRookRisk(newFen, to, oppColor, ourColor, destPiece, givesCheck, cct);
                riskLevel += rookRisk.risk;
                reasons.push(...rookRisk.reasons);
            }

            if (movingPiece.type === "p") {
                const pawnBonus = this._analyzePawnAdvancement(to, ourColor, cct);
                riskLevel += pawnBonus.risk;
                reasons.push(...pawnBonus.reasons);
            }

            if (!destPiece && !givesCheck) {
                const hangingRisk = this._analyzeHangingPiece(newFen, to, oppColor, ourColor, movingPiece, cct);
                riskLevel += hangingRisk.risk;
                reasons.push(...hangingRisk.reasons);
            }

            riskLevel = Math.max(-25, Math.min(100, riskLevel));
            const safe = riskLevel < 30;

            return {
                safe,
                riskLevel: Math.max(0, riskLevel),
                reasons
            };
        },

        _analyzeQueenRisk(newFen, to, oppColor, ourColor, destPiece, givesCheck, cct) {
            let risk = 0;
            const reasons = [];

            const attackers = getAttackersOfSquare(newFen, to, oppColor);
            const defenders = getAttackersOfSquare(newFen, to, ourColor);

            if (attackers.length > 0 && !destPiece) {

                if (cct && cct.threats && cct.threats.weFallInto) {
                    const queenTrapped = cct.threats.weFallInto.some(t => t.type === 'queen_trapped');
                    if (queenTrapped) {
                        if (!givesCheck) {
                            reasons.push("✗ QUEEN TRAP!");
                            risk = 95;
                        } else {
                            reasons.push("⚠ Queen may be trapped but gives check");
                            risk += 40;
                        }
                        return { risk, reasons };
                    }
                }

                if (!givesCheck) {
                    const exchangePenalty = defenders.length === 0 ? 60 : 45;
                    risk += exchangePenalty + (attackers.length * 15);

                    const hasCounterplay = cct && cct.threats && cct.threats.created && cct.threats.created.length > 0;
                    if (!hasCounterplay) {
                        reasons.push("✗ Undefended QUEEN - HIGH RISK!");
                    } else {
                        reasons.push("⚠ Undefended queen but has counterplay");
                    }
                } else if (defenders.length === 0) {
                    risk += 35;
                    reasons.push("⚠ Queen undefended but gives check");
                } else {
                    risk += 20;
                    reasons.push("⚠ Queen exposed but defended & checks");
                }

                if (attackers.some(a => a.piece === 'r')) {
                    risk += 25;
                    reasons.push("⚠ Queen exposed to enemy rook");
                }
            }

            return { risk, reasons };
        },

        _analyzeRookRisk(newFen, to, oppColor, ourColor, destPiece, givesCheck, cct) {
            let risk = 0;
            const reasons = [];

            const attackers = getAttackersOfSquare(newFen, to, oppColor);
            const defenders = getAttackersOfSquare(newFen, to, ourColor);

            if (attackers.length > 0) {
                const captureValue = destPiece ? PIECE_VALUES[destPiece.type] : 0;

                if (cct && cct.captureAnalysis && cct.captureAnalysis.exchangeResult < 0) {
                    if (!givesCheck) {
                        risk += 50;
                        reasons.push("✗ Bad exchange for rook");
                    } else {
                        risk += 25;
                        reasons.push("⚠ Rook exchange but gives check");
                    }
                }

                if (defenders.length === 0) {
                    risk += 40;
                    reasons.push(`✗ Rook UNDEFENDED (${attackers.length} attackers)`);
                } else if (captureValue < 5) {
                    const hasCounterplay = cct && cct.threats && cct.threats.created && cct.threats.created.length > 0;
                    if (!hasCounterplay && !givesCheck) {
                        risk += 40;
                        reasons.push("✗ Rook exposed without compensation");
                    }
                }
            }

            return { risk, reasons };
        },

        _analyzePawnAdvancement(to, ourColor, cct) {
            let risk = 0;
            const reasons = [];

            const promoRank = ourColor === "w" ? 8 : 1;
            const currentRank = parseInt(to[1]);
            const distanceToPromo = Math.abs(currentRank - promoRank);

            if (currentRank === promoRank) {
                reasons.push("✓ Promotes!");
                risk -= 20;
                return { risk, reasons };
            }

            if (distanceToPromo <= 2) {
                if (cct && cct.threats && cct.threats.created) {
                    const hasPromoThreat = cct.threats.created.some(t => t.type === 'promotion_threat');
                    if (hasPromoThreat) {
                        reasons.push("✓ Promotion threat");
                        risk -= 15;
                    }
                }
            }

            return { risk, reasons };
        },

        _analyzeHangingPiece(newFen, to, oppColor, ourColor, movingPiece, cct) {
            let risk = 0;
            const reasons = [];

            const attackers = getAttackersOfSquare(newFen, to, oppColor);
            const defenders = getAttackersOfSquare(newFen, to, ourColor);

            if (attackers.length > 0) {
                if (defenders.length === 0) {
                    const pieceCoefficient = this.PIECE_RISK[movingPiece.type] || 5;
                    risk += 20 + (attackers.length * pieceCoefficient);

                    const hasCounterplay = cct && cct.threats && cct.threats.created && cct.threats.created.length > 0;
                    if (!hasCounterplay) {
                        reasons.push(`✗ Undefended ${movingPiece.type.toUpperCase()} - HIGH RISK!`);
                    } else {
                        reasons.push(`⚠ Undefended ${movingPiece.type.toUpperCase()} but has counterplay`);
                    }
                } else if (defenders.length === 1 && attackers.length >= 2) {
                    risk += 20;
                    reasons.push("⚠ Piece may be captured in exchange");
                }
            }

            return { risk, reasons };
        },

        _createResult(safe, reason, riskLevel, cct) {
            return {
                safe: safe,
                reason: reason,
                riskLevel: Math.max(0, Math.min(100, riskLevel)),
                cct: cct
            };
        },

        clearCache() {
            this.cache.clear();
        }

    };

    function checkPremoveSafety(fen, uci, ourColor) {
        return PremoveSafety.check(fen, uci, ourColor);
    }

    // =====================================================
    // Section 20: Checks, Captures, and Threats Analysis (CCT)
    // =====================================================
    const CCTAnalyzer = {

        cache: new Map(),
        CACHE_DURATION: 1000,

        analyze(fen, uci, ourColor) {

            if (!fen || !uci || uci.length < 4 || !ourColor) {
                return this._createEmptyResult();
            }

            const cacheKey = `${fen}|${uci}|${ourColor}`;
            const cached = this.cache.get(cacheKey);
            if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
                return cached.result;
            }

            const from = uci.substring(0, 2);
            const to = uci.substring(2, 4);
            const oppColor = ourColor === "w" ? "b" : "w";

            const movingCh = fenCharAtSquare(fen, from);
            const movingPiece = pieceFromFenChar(movingCh);

            if (!movingPiece || movingPiece.color !== ourColor) {
                return this._createEmptyResult();
            }

            const capturedCh = fenCharAtSquare(fen, to);
            const capturedPiece = pieceFromFenChar(capturedCh);

            const newFen = makeSimpleMove(fen, from, to);
            if (!newFen) {
                return this._createEmptyResult();
            }

            const result = {
                givesCheck: false,
                checkIsSafe: false,
                captureAnalysis: null,
                threats: { created: [], weFallInto: [], prevented: [] }
            };

            const oppKingPos = findKing(newFen, oppColor);
            if (oppKingPos) {
                result.givesCheck = isSquareAttackedBy(newFen, oppKingPos, ourColor);
                if (result.givesCheck) {
                    result.checkIsSafe = this._isSafeCheck(fen, newFen, from, to, movingPiece, oppColor);
                }
            }

            result.captureAnalysis = this._analyzeCaptures(
                fen, newFen, from, to, movingPiece, capturedPiece, oppColor
            );

            result.threats = this._analyzeThreats(
                fen, newFen, from, to, movingPiece, capturedPiece, ourColor, oppColor
            );

            this.cache.set(cacheKey, {
                result: result,
                timestamp: Date.now()
            });

            if (this.cache.size > 300) {
                const cutoff = Date.now() - this.CACHE_DURATION;
                for (const [k, v] of this.cache.entries()) {
                    if (v.timestamp < cutoff) {
                        this.cache.delete(k);
                    }
                }

                if (this.cache.size > 250) {
                    const overflow = this.cache.size - 250;
                    const keys = Array.from(this.cache.keys()).slice(0, overflow);
                    keys.forEach((k) => this.cache.delete(k));
                }
            }

            return result;
        },

        _isSafeCheck(oldFen, newFen, from, to, movingPiece, oppColor) {
            const attackers = getAttackersOfSquare(newFen, to, oppColor);

            if (attackers.length === 0) return true;

            const ourValue = PIECE_VALUES[movingPiece.type] || 0;

            let minAttackerValue = Infinity;
            attackers.forEach(a => {
                const v = PIECE_VALUES[a.piece] || 0;
                if (v < minAttackerValue) {
                    minAttackerValue = v;
                }
            });

            return minAttackerValue >= ourValue;
        },

        _analyzeCaptures(oldFen, newFen, from, to, movingPiece, capturedPiece, oppColor) {
            const result = {
                isCapture: !!capturedPiece,
                capturedValue: capturedPiece ? (PIECE_VALUES[capturedPiece.type] || 0) : 0,
                ourPieceHanging: false,
                exchangeResult: 0,
                netMaterialGain: 0
            };

            const ourPieceValue = PIECE_VALUES[movingPiece.type] || 0;

            const newAttackers = getAttackersOfSquare(newFen, to, oppColor);
            const newDefenders = getAttackersOfSquare(newFen, to, movingPiece.color);

            if (newAttackers.length > 0) {

                result.ourPieceHanging = newDefenders.length === 0;

                const attackerValues = newAttackers.map(a => PIECE_VALUES[a.piece] || 0);
                const lowestAttacker = Math.min(...attackerValues);

                if (result.isCapture) {

                    if (result.ourPieceHanging) {

                        result.netMaterialGain = result.capturedValue - ourPieceValue;
                    } else {

                        if (lowestAttacker < ourPieceValue) {

                            result.netMaterialGain = result.capturedValue - ourPieceValue;
                        } else {

                            result.netMaterialGain = result.capturedValue - (newDefenders.length > 0 ? 0 : ourPieceValue);
                        }
                    }
                } else {

                    if (result.ourPieceHanging) {
                        result.netMaterialGain = -ourPieceValue;
                    }
                }
            } else {

                result.netMaterialGain = result.capturedValue;
            }

            result.exchangeResult = result.netMaterialGain;
            return result;
        },

        _analyzeThreats(oldFen, newFen, from, to, movingPiece, capturedPiece, ourColor, oppColor) {
            const threats = {
                created: [],
                weFallInto: [],
                prevented: []
            };

            const forks = this._detectForks(newFen, to, movingPiece.type, ourColor, oppColor);
            threats.created.push(...forks);

            const discovered = this._detectDiscoveredAttack(oldFen, newFen, from, to, ourColor, oppColor);
            if (discovered) {
                threats.created.push(discovered);
            }

            const pin = this._detectPinPotential(newFen, to, movingPiece.type, ourColor, oppColor);
            if (pin) {
                threats.created.push(pin);
            }

            if (movingPiece.type === 'p') {
                const promoThreat = this._detectPromotionThreat(to, ourColor);
                if (promoThreat) {
                    threats.created.push(promoThreat);
                }
            }

            const backRank = this._detectBackRankThreat(newFen, movingPiece.type, ourColor, oppColor);
            if (backRank) {
                threats.created.push(backRank);
            }

            const oppForks = this._detectOpponentForks(newFen, ourColor, oppColor);
            threats.weFallInto.push(...oppForks);

            if (movingPiece.type === 'q') {
                const queenTrap = this._detectQueenTrap(newFen, to, ourColor, oppColor);
                if (queenTrap) {
                    threats.weFallInto.push(queenTrap);
                }
            }

            const leftBehind = this._detectLeftBehind(oldFen, newFen, from, ourColor, oppColor);
            threats.weFallInto.push(...leftBehind);

            const oppPins = this._detectOpponentPins(newFen, ourColor, oppColor);
            threats.weFallInto.push(...oppPins);

            const prevented = this._detectPreventedThreats(oldFen, newFen, from, to, ourColor, oppColor);
            threats.prevented.push(...prevented);

            return threats;
        },

        _detectForks(fen, square, pieceType, ourColor, oppColor) {
            const forks = [];

            const attacked = this._getAttackedPieces(fen, square, ourColor, oppColor);

            if (attacked.length >= 2) {

                const totalValue = attacked.reduce((sum, p) => sum + (PIECE_VALUES[p.type] || 0), 0);

                const hasKing = attacked.some(p => p.type === 'k');
                const hasQueen = attacked.some(p => p.type === 'q');

                const severity = hasKing ? 'high' : (hasQueen || totalValue >= 8) ? 'high' : 'medium';

                forks.push({
                    type: 'fork',
                    severity: severity,
                    targets: attacked.map(p => p.square),
                    value: totalValue,
                    description: `Fork attacking ${attacked.length} pieces (value: ${totalValue})`
                });
            }

            return forks;
        },

        _detectDiscoveredAttack(oldFen, newFen, from, to, ourColor, oppColor) {

            const longRangePieces = getAllPieces(oldFen, ourColor).filter(p =>
                                                                          p.type === 'q' || p.type === 'r' || p.type === 'b'
                                                                         );

            for (const piece of longRangePieces) {
                if (piece.square === from) continue;

                const attackedBefore = this._getAttackedSquares(oldFen, piece.square, piece.type, ourColor);
                const attackedAfter = this._getAttackedSquares(newFen, piece.square, piece.type, ourColor);

                const newlyAttacked = attackedAfter.filter(sq => !attackedBefore.includes(sq));

                for (const sq of newlyAttacked) {
                    const targetPiece = pieceFromFenChar(fenCharAtSquare(newFen, sq));
                    if (targetPiece && targetPiece.color === oppColor) {
                        const value = PIECE_VALUES[targetPiece.type] || 0;

                        return {
                            type: 'discovered_attack',
                            severity: value >= 5 ? 'high' : 'medium',
                            target: sq,
                            attacker: piece.square,
                            value: value,
                            description: `Discovered attack on ${targetPiece.type} at ${sq}`
                        };
                    }
                }
            }

            return null;
        },

        _detectPinPotential(fen, square, pieceType, ourColor, oppColor) {

            if (!['q', 'r', 'b'].includes(pieceType)) return null;

            const directions = this._getPieceDirections(pieceType);
            const oppKing = findKing(fen, oppColor);
            if (!oppKing) return null;

            for (const dir of directions) {
                const ray = this._castRay(fen, square, dir);

                if (ray.length >= 2) {
                    const lastSquare = ray[ray.length - 1];
                    if (lastSquare === oppKing && ray.length === 2) {
                        const pinnedSquare = ray[0];
                        const pinnedPiece = pieceFromFenChar(fenCharAtSquare(fen, pinnedSquare));

                        if (pinnedPiece && pinnedPiece.color === oppColor) {
                            return {
                                type: 'pin',
                                severity: 'medium',
                                target: pinnedSquare,
                                description: `Pinning ${pinnedPiece.type} to king`
                            };
                        }
                    }
                }
            }

            return null;
        },

        _detectPromotionThreat(to, ourColor) {
            const promoRank = ourColor === "w" ? 8 : 1;
            const currentRank = parseInt(to[1]);
            const distance = Math.abs(currentRank - promoRank);

            if (distance <= 2) {
                return {
                    type: 'promotion_threat',
                    severity: distance === 1 ? 'high' : 'medium',
                    distance: distance,
                    description: `Pawn ${distance} square(s) from promotion`
                };
            }

            return null;
        },

        _detectBackRankThreat(fen, pieceType, ourColor, oppColor) {
            if (pieceType !== 'r' && pieceType !== 'q') return null;

            const backRank = oppColor === "w" ? "1" : "8";
            const oppKing = findKing(fen, oppColor);

            if (oppKing && oppKing[1] === backRank) {

                const escape = this._canKingEscape(fen, oppKing, oppColor);
                if (!escape) {
                    return {
                        type: 'back_rank',
                        severity: 'high',
                        description: 'Back rank mate threat'
                    };
                }
            }

            return null;
        },

        _detectOpponentForks(fen, ourColor, oppColor) {
            const forks = [];
            const oppPieces = getAllPieces(fen, oppColor);

            for (const piece of oppPieces) {
                const attacked = this._getAttackedPieces(fen, piece.square, oppColor, ourColor);

                if (attacked.length >= 2) {
                    const hasKing = attacked.some(p => p.type === 'k');
                    const hasQueen = attacked.some(p => p.type === 'q');
                    const totalValue = attacked.reduce((sum, p) => sum + (PIECE_VALUES[p.type] || 0), 0);

                    forks.push({
                        type: 'opponent_fork',
                        severity: hasKing ? 'high' : (hasQueen || totalValue >= 8) ? 'high' : 'medium',
                        attacker: piece.square,
                        targets: attacked.map(p => p.square),
                        description: `Opponent ${piece.type} forks ${attacked.length} pieces`
                    });
                }
            }

            return forks;
        },

        _detectQueenTrap(fen, queenSquare, ourColor, oppColor) {

            const queenMoves = this._getQueenMoves(fen, queenSquare, ourColor);

            const safeSquares = queenMoves.filter(sq => {
                const testFen = makeSimpleMove(fen, queenSquare, sq);
                return !isSquareAttackedBy(testFen, sq, oppColor);
            });

            if (safeSquares.length <= 2) {
                return {
                    type: 'queen_trapped',
                    severity: 'high',
                    escapeSquares: safeSquares.length,
                    description: `Queen has only ${safeSquares.length} safe escape(s)`
                };
            }

            return null;
        },

        _detectLeftBehind(oldFen, newFen, from, ourColor, oppColor) {
            const threats = [];
            const ourPieces = getAllPieces(newFen, ourColor);

            for (const piece of ourPieces) {
                if (piece.square === from) continue;

                const wasDefended = getAttackersOfSquare(oldFen, piece.square, ourColor).length > 0;
                const isDefendedNow = getAttackersOfSquare(newFen, piece.square, ourColor).length > 0;
                const isAttacked = getAttackersOfSquare(newFen, piece.square, oppColor).length > 0;

                if (wasDefended && !isDefendedNow && isAttacked) {
                    const value = PIECE_VALUES[piece.type] || 0;

                    threats.push({
                        type: 'undefended_piece',
                        severity: value >= 5 ? 'high' : 'medium',
                        square: piece.square,
                        pieceType: piece.type,
                        value: value,
                        description: `${piece.type} at ${piece.square} left undefended`
                    });
                }
            }

            return threats;
        },

        _detectOpponentPins(fen, ourColor, oppColor) {
            const pins = [];
            const ourKing = findKing(fen, ourColor);
            if (!ourKing) return pins;

            const oppLongRange = getAllPieces(fen, oppColor).filter(p =>
                                                                    p.type === 'q' || p.type === 'r' || p.type === 'b'
                                                                   );

            for (const piece of oppLongRange) {
                const directions = this._getPieceDirections(piece.type);

                for (const dir of directions) {
                    const ray = this._castRay(fen, piece.square, dir);

                    if (ray.length >= 2 && ray[ray.length - 1] === ourKing) {
                        const pinnedSquare = ray[0];
                        const pinnedPiece = pieceFromFenChar(fenCharAtSquare(fen, pinnedSquare));

                        if (pinnedPiece && pinnedPiece.color === ourColor) {
                            pins.push({
                                type: 'opponent_pin',
                                severity: 'medium',
                                pinnedPiece: pinnedSquare,
                                description: `Our ${pinnedPiece.type} pinned by opponent ${piece.type}`
                            });
                        }
                    }
                }
            }

            return pins;
        },

        _detectPreventedThreats(oldFen, newFen, from, to, ourColor, oppColor) {
            const prevented = [];

            const capturedPiece = pieceFromFenChar(fenCharAtSquare(oldFen, to));
            if (capturedPiece && capturedPiece.color === oppColor) {
                const threats = this._getPieceThreats(oldFen, to, oppColor, ourColor);
                if (threats.length > 0) {
                    prevented.push({
                        type: 'threat_removed',
                        severity: 'medium',
                        description: `Removed threatening ${capturedPiece.type}`
                    });
                }
            }

            const blocked = this._detectBlockedAttack(oldFen, newFen, to, ourColor, oppColor);
            if (blocked) {
                prevented.push(blocked);
            }

            return prevented;
        },

        _getAttackedPieces(fen, square, attackerColor, defenderColor) {
            const attacked = [];
            const moves = this._getPossibleMoves(fen, square, attackerColor);

            for (const move of moves) {
                const piece = pieceFromFenChar(fenCharAtSquare(fen, move));
                if (piece && piece.color === defenderColor) {
                    attacked.push({ square: move, type: piece.type });
                }
            }

            return attacked;
        },

        _getAttackedSquares(fen, square, pieceType, color) {

            return this._getPossibleMoves(fen, square, color);
        },

        _getPossibleMoves(fen, square, color) {

            const piece = pieceFromFenChar(fenCharAtSquare(fen, square));
            if (!piece) return [];

            const allSquares = [];
            for (let file = 0; file < 8; file++) {
                for (let rank = 1; rank <= 8; rank++) {
                    const sq = "abcdefgh"[file] + rank;
                    allSquares.push(sq);
                }
            }

            return allSquares.filter(sq => {
                const testFen = makeSimpleMove(fen, square, sq);
                return testFen !== fen;
            });
        },

        _getPieceDirections(pieceType) {
            switch (pieceType) {
                case 'q': return [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
                case 'r': return [[1, 0], [-1, 0], [0, 1], [0, -1]];
                case 'b': return [[1, 1], [1, -1], [-1, 1], [-1, -1]];
                default: return [];
            }
        },

        _castRay(fen, square, direction) {
            const ray = [];
            const [dx, dy] = direction;
            let file = "abcdefgh".indexOf(square[0]);
            let rank = parseInt(square[1]);

            while (true) {
                file += dx;
                rank += dy;

                if (file < 0 || file > 7 || rank < 1 || rank > 8) break;

                const sq = "abcdefgh"[file] + rank;
                const piece = fenCharAtSquare(fen, sq);

                ray.push(sq);

                if (piece && piece !== '.') break;
            }

            return ray;
        },

        _canKingEscape(fen, kingSquare, color) {
            const kingMoves = this._getKingMoves(kingSquare);
            const oppColor = color === "w" ? "b" : "w";

            for (const move of kingMoves) {
                const piece = fenCharAtSquare(fen, move);
                const pieceObj = pieceFromFenChar(piece);

                if (pieceObj && pieceObj.color === color) continue;

                const testFen = makeSimpleMove(fen, kingSquare, move);
                if (!isSquareAttackedBy(testFen, move, oppColor)) {
                    return true;
                }
            }

            return false;
        },

        _getKingMoves(square) {
            const moves = [];
            const file = "abcdefgh".indexOf(square[0]);
            const rank = parseInt(square[1]);

            const offsets = [
                [-1, -1], [-1, 0], [-1, 1],
                [0, -1], [0, 1],
                [1, -1], [1, 0], [1, 1]
            ];

            for (const [dx, dy] of offsets) {
                const newFile = file + dx;
                const newRank = rank + dy;

                if (newFile >= 0 && newFile <= 7 && newRank >= 1 && newRank <= 8) {
                    moves.push("abcdefgh"[newFile] + newRank);
                }
            }

            return moves;
        },

        _getQueenMoves(fen, square, color) {

            const moves = [];
            const directions = this._getPieceDirections('q');

            for (const dir of directions) {
                const ray = this._castRay(fen, square, dir);
                moves.push(...ray);
            }

            return moves;
        },

        _getPieceThreats(fen, square, pieceColor, targetColor) {
            const attacked = this._getAttackedPieces(fen, square, pieceColor, targetColor);
            return attacked.filter(p => (PIECE_VALUES[p.type] || 0) >= 3);
        },

        _detectBlockedAttack(oldFen, newFen, blockSquare, ourColor, oppColor) {

            const oppLongRange = getAllPieces(oldFen, oppColor).filter(p =>
                                                                       p.type === 'q' || p.type === 'r' || p.type === 'b'
                                                                      );

            for (const piece of oppLongRange) {
                const directions = this._getPieceDirections(piece.type);

                for (const dir of directions) {
                    const rayBefore = this._castRay(oldFen, piece.square, dir);
                    const rayAfter = this._castRay(newFen, piece.square, dir);

                    if (rayAfter.includes(blockSquare) && rayBefore.length > rayAfter.length) {
                        return {
                            type: 'blocked_attack',
                            severity: 'medium',
                            description: `Blocked ${piece.type} attack`
                        };
                    }
                }
            }

            return null;
        },

        _createEmptyResult() {
            return {
                givesCheck: false,
                checkIsSafe: false,
                captureAnalysis: {
                    isCapture: false,
                    capturedValue: 0,
                    ourPieceHanging: false,
                    exchangeResult: 0,
                    netMaterialGain: 0
                },
                threats: { created: [], weFallInto: [], prevented: [] }
            };
        },

        clearCache() {
            this.cache.clear();
        }

    };

    function analyzeCCT(fen, uci, ourColor) {
        return CCTAnalyzer.analyze(fen, uci, ourColor);
    }

    function updateCCTDebugSnapshot(stage, uci, cct, safety, extra) {
        if (!State) return;

        let safeStage = String(stage || "CCT");
        let safeUci = String(uci || "-").toUpperCase();
        let checkText = cct && cct.givesCheck ? (cct.checkIsSafe ? "check:safe" : "check:risky") : "check:no";
        let capText = "cap:0";
        if (cct && cct.captureAnalysis) {
            capText = "cap:" + (cct.captureAnalysis.netMaterialGain || 0);
        }
        let threatText = "th:0/0";
        if (cct && cct.threats) {
            let created = Array.isArray(cct.threats.created) ? cct.threats.created.length : 0;
            let danger = Array.isArray(cct.threats.weFallInto) ? cct.threats.weFallInto.length : 0;
            threatText = "th:" + created + "/" + danger;
        }
        let riskText = "risk:-";
        if (safety && typeof safety.riskLevel === "number") {
            riskText = "risk:" + Math.round(safety.riskLevel);
        }
        let extraText = extra ? (" | " + String(extra)) : "";
        State.cctLastDebugText = "[" + safeStage + "] " + safeUci + " | " + checkText + " | " + capText + " | " + threatText + " | " + riskText + extraText;

        if (State.cctDebugEnabled && UI && typeof UI.updateCCTDebugDisplay === "function") {
            UI.updateCCTDebugDisplay();
        }
    }

    // =====================================================
    // Section 21: Threat Detection System
    // =====================================================
    const ThreatDetectionSystem = {

        cache: new Map(),
        CACHE_TTL: 1000,

        detectForks(fen, square, pieceType, ourColor) {
            const cacheKey = `fork|${fen}|${square}|${pieceType}|${ourColor}`;
            const cached = this._getCache(cacheKey);
            if (cached) return cached;

            const oppColor = ourColor === "w" ? "b" : "w";
            const threats = [];

            if (!['n', 'q', 'p', 'b', 'r', 'k'].includes(pieceType)) {
                return this._setCache(cacheKey, threats);
            }

            const attackSquares = getSquaresAttackedByPiece(fen, square, pieceType, ourColor);
            const attackedPieces = [];

            for (const sq of attackSquares) {
                const ch = fenCharAtSquare(fen, sq);
                const piece = pieceFromFenChar(ch);

                if (piece && piece.color === oppColor) {
                    const value = PIECE_VALUES[piece.type] || 0;

                    if (value >= 3 || piece.type === 'k') {
                        attackedPieces.push({
                            square: sq,
                            type: piece.type,
                            value: value
                        });
                    }
                }
            }

            if (attackedPieces.length >= 2) {
                const totalValue = attackedPieces.reduce((sum, p) => sum + p.value, 0);
                const hasKing = attackedPieces.some(p => p.type === 'k');
                const hasQueen = attackedPieces.some(p => p.type === 'q');

                threats.push({
                    type: 'fork',
                    severity: hasKing ? 'high' : (hasQueen || totalValue >= 10 ? 'high' : 'medium'),
                    attacker: pieceType,
                    attackerSquare: square,
                    targets: attackedPieces,
                    totalValue: totalValue,
                    description: `${pieceType.toUpperCase()} fork on ${attackedPieces.map(p => p.type.toUpperCase()).join(" and ")}`
                });
            }

            return this._setCache(cacheKey, threats);
        },

        detectDiscoveredAttack(oldFen, newFen, from, to, ourColor) {
            const cacheKey = `disco|${oldFen}|${from}|${to}`;
            const cached = this._getCache(cacheKey);
            if (cached !== undefined) return cached;

            const oppColor = ourColor === "w" ? "b" : "w";
            const ourPieces = getAllPieces(newFen, ourColor);
            const oppPieces = getAllPieces(newFen, oppColor);

            const longRangePieces = ourPieces.filter(p =>
                                                     ['q', 'r', 'b'].includes(p.type) && p.square !== to
                                                    );

            const valuablePieces = oppPieces.filter(p =>
                                                    (PIECE_VALUES[p.type] || 0) >= 5 || p.type === 'k'
                                                   );

            for (const ourPiece of longRangePieces) {
                for (const oppPiece of valuablePieces) {
                    if (canPieceAttackSquare(newFen, ourPiece, oppPiece.square)) {
                        if (wasBlocked(oldFen, from, ourPiece.square, oppPiece.square)) {
                            const result = {
                                type: 'discovered_attack',
                                severity: oppPiece.type === 'k' ? 'high' : 'medium',
                                attacker: ourPiece.type,
                                attackerSquare: ourPiece.square,
                                target: oppPiece.type,
                                targetSquare: oppPiece.square,
                                value: PIECE_VALUES[oppPiece.type] || 0,
                                description: `Discovered attack: ${ourPiece.type.toUpperCase()} -> ${oppPiece.type.toUpperCase()}`
                            };
                            return this._setCache(cacheKey, result);
                        }
                    }
                }
            }

            return this._setCache(cacheKey, null);
        },

        detectPinPotential(fen, square, pieceType, ourColor) {
            const cacheKey = `pin|${fen}|${square}|${pieceType}`;
            const cached = this._getCache(cacheKey);
            if (cached !== undefined) return cached;

            if (!['q', 'r', 'b'].includes(pieceType)) {
                return this._setCache(cacheKey, null);
            }

            const oppColor = ourColor === "w" ? "b" : "w";
            const oppKing = findKing(fen, oppColor);
            if (!oppKing) return this._setCache(cacheKey, null);

            const directions = this._getPinDirections(pieceType);
            const [tFile, tRank] = this._parseSquare(square);

            for (const dir of directions) {
                let f = tFile + dir.dx;
                let r = tRank + dir.dy;
                const piecesInLine = [];

                while (f >= 0 && f <= 7 && r >= 1 && r <= 8) {
                    const sq = "abcdefgh"[f] + r;
                    const ch = fenCharAtSquare(fen, sq);

                    if (ch && ch !== '.') {
                        const piece = pieceFromFenChar(ch);
                        if (!piece) break;

                        piecesInLine.push({ square: sq, piece: piece });

                        if (piecesInLine.length === 2) {
                            const [first, second] = piecesInLine;

                            if (first.piece.color === oppColor &&
                                second.piece.color === oppColor &&
                                second.piece.type === 'k' &&
                                (PIECE_VALUES[first.piece.type] || 0) >= 3) {

                                const result = {
                                    type: 'pin',
                                    severity: 'medium',
                                    pinner: pieceType,
                                    pinnerSquare: square,
                                    pinnedPiece: first.piece.type,
                                    pinnedSquare: first.square,
                                    description: `${pieceType.toUpperCase()} pins ${first.piece.type.toUpperCase()} to king`
                                };
                                return this._setCache(cacheKey, result);
                            }
                            break;
                        }
                    }
                    f += dir.dx;
                    r += dir.dy;
                }
            }

            return this._setCache(cacheKey, null);
        },

        detectOpponentForks(fen, ourColor) {
            const cacheKey = `oppfork|${fen}|${ourColor}`;
            const cached = this._getCache(cacheKey);
            if (cached) return cached;

            const oppColor = ourColor === "w" ? "b" : "w";
            const threats = [];

            const oppPieces = getAllPieces(fen, oppColor);

            for (const oppPiece of oppPieces) {

                if (oppPiece.type === 'p') continue;

                const attacked = getSquaresAttackedByPiece(fen, oppPiece.square, oppPiece.type, oppColor);
                const ourAttackedPieces = [];

                for (const sq of attacked) {
                    const ch = fenCharAtSquare(fen, sq);
                    const piece = pieceFromFenChar(ch);

                    if (piece && piece.color === ourColor) {
                        const value = PIECE_VALUES[piece.type] || 0;
                        if (value >= 1) {
                            ourAttackedPieces.push({
                                square: sq,
                                type: piece.type,
                                value: value
                            });
                        }
                    }
                }

                if (ourAttackedPieces.length >= 2) {
                    const totalValue = ourAttackedPieces.reduce((sum, p) => sum + p.value, 0);
                    const hasKing = ourAttackedPieces.some(p => p.type === 'k');
                    const hasQueen = ourAttackedPieces.some(p => p.type === 'q');

                    threats.push({
                        type: 'opponent_fork',
                        severity: hasKing ? 'high' : (hasQueen || totalValue >= 10 ? 'high' : 'medium'),
                        attacker: oppPiece.type,
                        attackerSquare: oppPiece.square,
                        targets: ourAttackedPieces,
                        totalValue: totalValue,
                        description: `Opponent ${oppPiece.type.toUpperCase()} forks ${ourAttackedPieces.map(p => p.type.toUpperCase()).join(" and ")}`
                    });
                }
            }

            const ourPieces = getAllPieces(fen, ourColor);
            for (const ourPiece of ourPieces) {
                const value = PIECE_VALUES[ourPiece.type] || 0;
                if (value < 5) continue;

                const attackers = getAttackersOfSquare(fen, ourPiece.square, oppColor);
                if (attackers.length >= 2) {
                    threats.push({
                        type: 'multiple_attackers',
                        severity: 'high',
                        target: ourPiece.type,
                        targetSquare: ourPiece.square,
                        attackerCount: attackers.length,
                        attackers: attackers.map(a => ({ type: a.piece, square: a.square })),
                        description: `${ourPiece.type.toUpperCase()} attacked ${attackers.length} times`
                    });
                }
            }

            return this._setCache(cacheKey, threats);
        },

        detectQueenTrap(fen, queenSquare, ourColor) {
            const cacheKey = `qtrap|${fen}|${queenSquare}`;
            const cached = this._getCache(cacheKey);
            if (cached !== undefined) return cached;

            const oppColor = ourColor === "w" ? "b" : "w";
            const escapeSquares = getQueenEscapeSquares(fen, queenSquare, ourColor);

            const safeEscapes = escapeSquares.filter(sq => {
                const attackers = getAttackersOfSquare(fen, sq, oppColor);
                return attackers.length === 0;
            });

            const nearbyOppPieces = getPiecesInRadius(fen, queenSquare, 2, oppColor);
            const [file, rank] = this._parseSquare(queenSquare);
            const isEdge = file === 0 || file === 7 || rank === 1 || rank === 8;
            const isCorner = (file === 0 || file === 7) && (rank === 1 || rank === 8);

            const isTrapped =
                  (isCorner && safeEscapes.length <= 1) ||
                  (isEdge && safeEscapes.length <= 1 && nearbyOppPieces.length >= 3) ||
                  (!isEdge && safeEscapes.length <= 2 && nearbyOppPieces.length >= 4);

            return this._setCache(cacheKey, isTrapped);
        },

        detectLeftBehind(oldFen, newFen, from, to, ourColor) {
            const cacheKey = `leftbehind|${oldFen}|${from}|${to}`;
            const cached = this._getCache(cacheKey);
            if (cached) return cached;

            const threats = [];
            const oppColor = ourColor === "w" ? "b" : "w";
            const ourPieces = getAllPieces(oldFen, ourColor);

            for (const piece of ourPieces) {
                if (piece.square === from) continue;

                const wasDefended = isSquareDefendedBy(oldFen, piece.square, from);

                if (wasDefended) {
                    const stillDefendedByMovedPiece = isSquareDefendedBy(newFen, piece.square, to);
                    const hasOtherDefenders = getAttackersOfSquare(newFen, piece.square, ourColor).length > 0;
                    const stillDefended = stillDefendedByMovedPiece || hasOtherDefenders;

                    if (!stillDefended) {
                        const attackers = getAttackersOfSquare(newFen, piece.square, oppColor);
                        if (attackers.length > 0) {
                            const value = PIECE_VALUES[piece.type] || 0;
                            threats.push({
                                type: 'left_undefended',
                                severity: value >= 5 ? 'high' : 'medium',
                                piece: piece.type,
                                square: piece.square,
                                value: value,
                                attackers: attackers.length,
                                description: `${piece.type.toUpperCase()} left undefended at ${piece.square}`
                            });
                        }
                    }
                }
            }

            return this._setCache(cacheKey, threats);
        },

        detectPreventedThreats(oldFen, newFen, uci, ourColor) {
            const cacheKey = `prevented|${oldFen}|${uci}`;
            const cached = this._getCache(cacheKey);
            if (cached) return cached;

            const prevented = [];
            const oppColor = ourColor === "w" ? "b" : "w";
            const to = uci.substring(2, 4);

            const capturedPiece = pieceFromFenChar(fenCharAtSquare(oldFen, to));
            if (capturedPiece && capturedPiece.color === oppColor) {
                const capturedThreats = this._getPieceThreats(oldFen, to, oppColor, ourColor);
                if (capturedThreats > 0) {
                    prevented.push({
                        type: 'threat_removed',
                        severity: 'medium',
                        removedPiece: capturedPiece.type,
                        description: `Removed threatening ${capturedPiece.type.toUpperCase()}`
                    });
                }
            }

            const oppPieces = getAllPieces(newFen, oppColor);
            for (const oppPiece of oppPieces) {
                const wasAttacked = isSquareAttackedBy(oldFen, oppPiece.square, ourColor);
                const nowAttacked = isSquareAttackedBy(newFen, oppPiece.square, ourColor);

                if (!wasAttacked && nowAttacked) {
                    const value = PIECE_VALUES[oppPiece.type] || 0;
                    if (value >= 3) {
                        prevented.push({
                            type: 'new_attack',
                            severity: value >= 5 ? 'high' : 'medium',
                            target: oppPiece.type,
                            square: oppPiece.square,
                            value: value,
                            description: `Now attacking ${oppPiece.type.toUpperCase()} at ${oppPiece.square}`
                        });
                    }
                }
            }

            const blocked = this._detectBlockedAttack(oldFen, newFen, to, ourColor, oppColor);
            if (blocked) {
                prevented.push(blocked);
            }

            return this._setCache(cacheKey, prevented);
        },

        _getPieceThreats(fen, square, pieceColor, targetColor) {
            const attacked = getSquaresAttackedByPiece(fen, square,
                                                       pieceFromFenChar(fenCharAtSquare(fen, square)).type, pieceColor);

            let threatCount = 0;
            for (const sq of attacked) {
                const piece = pieceFromFenChar(fenCharAtSquare(fen, sq));
                if (piece && piece.color === targetColor) {
                    const value = PIECE_VALUES[piece.type] || 0;
                    if (value >= 3) threatCount++;
                }
            }
            return threatCount;
        },

        _detectBlockedAttack(oldFen, newFen, blockSquare, ourColor, oppColor) {
            const oppLongRange = getAllPieces(oldFen, oppColor).filter(p =>
                                                                       ['q', 'r', 'b'].includes(p.type)
                                                                      );

            for (const piece of oppLongRange) {
                const directions = this._getPinDirections(piece.type);

                for (const dir of directions) {
                    const rayBefore = this._castRay(oldFen, piece.square, dir);
                    const rayAfter = this._castRay(newFen, piece.square, dir);

                    if (rayAfter.includes(blockSquare) && rayBefore.length > rayAfter.length) {
                        return {
                            type: 'blocked_attack',
                            severity: 'medium',
                            blockedPiece: piece.type,
                            description: `Blocked ${piece.type.toUpperCase()} attack`
                        };
                    }
                }
            }

            return null;
        },

        _getPinDirections(pieceType) {
            const directions = [];
            if (pieceType === 'r' || pieceType === 'q') {
                directions.push(
                    { dx: 1, dy: 0 }, { dx: -1, dy: 0 },
                    { dx: 0, dy: 1 }, { dx: 0, dy: -1 }
                );
            }
            if (pieceType === 'b' || pieceType === 'q') {
                directions.push(
                    { dx: 1, dy: 1 }, { dx: 1, dy: -1 },
                    { dx: -1, dy: 1 }, { dx: -1, dy: -1 }
                );
            }
            return directions;
        },

        _castRay(fen, square, direction) {
            const ray = [];
            const [startFile, startRank] = this._parseSquare(square);
            let f = startFile + direction.dx;
            let r = startRank + direction.dy;

            while (f >= 0 && f <= 7 && r >= 1 && r <= 8) {
                const sq = "abcdefgh"[f] + r;
                ray.push(sq);

                const ch = fenCharAtSquare(fen, sq);
                if (ch && ch !== '.') break;

                f += direction.dx;
                r += direction.dy;
            }

            return ray;
        },

        _parseSquare(square) {
            return [
                "abcdefgh".indexOf(square[0]),
                parseInt(square[1])
            ];
        },

        _getCache(key) {
            const cached = this.cache.get(key);
            if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
                return cached.value;
            }
            return undefined;
        },

        _setCache(key, value) {
            this.cache.set(key, { value, timestamp: Date.now() });

            if (this.cache.size > 200) {
                const cutoff = Date.now() - this.CACHE_TTL;
                for (const [k, v] of this.cache.entries()) {
                    if (v.timestamp < cutoff) {
                        this.cache.delete(k);
                    }
                }
            }

            return value;
        },

        clearCache() {
            this.cache.clear();
        }

    };

    function getSquaresAttackedByPiece(fen, square, pieceType, color) {
        let squares = [];
        let f = "abcdefgh".indexOf(square[0]);
        let r = parseInt(square[1]);

        if (pieceType === 'n') {
            let moves = [
                [2, 1],
                [2, -1],
                [-2, 1],
                [-2, -1],
                [1, 2],
                [1, -2],
                [-1, 2],
                [-1, -2]
            ];
            moves.forEach(function (m) {
                let nf = f + m[0],
                    nr = r + m[1];
                if (nf >= 0 && nf <= 7 && nr >= 1 && nr <= 8) {
                    squares.push("abcdefgh"[nf] + nr);
                }
            });
        }

        if (pieceType === 'p') {
            let dir = color === 'w' ? 1 : -1;
            [-1, 1].forEach(function (df) {
                let nf = f + df,
                    nr = r + dir;
                if (nf >= 0 && nf <= 7 && nr >= 1 && nr <= 8) {
                    squares.push("abcdefgh"[nf] + nr);
                }
            });
        }

        if (['q', 'r', 'b'].includes(pieceType)) {
            let directions = [];
            if (pieceType === 'q' || pieceType === 'r') {
                directions.push([1, 0], [-1, 0], [0, 1], [0, -1]);
            }
            if (pieceType === 'q' || pieceType === 'b') {
                directions.push([1, 1], [1, -1], [-1, 1], [-1, -1]);
            }

            directions.forEach(function (d) {
                let nf = f + d[0],
                    nr = r + d[1];
                while (nf >= 0 && nf <= 7 && nr >= 1 && nr <= 8) {
                    let sq = "abcdefgh"[nf] + nr;
                    squares.push(sq);
                    if (fenCharAtSquare(fen, sq)) break;
                    nf += d[0];
                    nr += d[1];
                }
            });
        }

        if (pieceType === 'k') {
            for (let df = -1; df <= 1; df++) {
                for (let dr = -1; dr <= 1; dr++) {
                    if (df === 0 && dr === 0) continue;
                    let nf = f + df,
                        nr = r + dr;
                    if (nf >= 0 && nf <= 7 && nr >= 1 && nr <= 8) {
                        squares.push("abcdefgh"[nf] + nr);
                    }
                }
            }
        }

        return squares;
    }

    function getAllPieces(fen, color) {
        let pieces = [];
        let placement = fen.split(" ")[0];
        let ranks = placement.split("/");

        for (let rankIdx = 0; rankIdx < 8; rankIdx++) {
            let rank = 8 - rankIdx;
            let file = 0;
            for (let i = 0; i < ranks[rankIdx].length; i++) {
                let ch = ranks[rankIdx][i];
                if (/\d/.test(ch)) {
                    file += parseInt(ch, 10);
                } else {
                    let isUpper = ch === ch.toUpperCase();
                    let pieceColor = isUpper ? 'w' : 'b';
                    if (pieceColor === color) {
                        pieces.push({ square: "abcdefgh"[file] + rank, type: ch.toLowerCase(), char: ch, color: pieceColor });
                    }
                    file++;
                }
            }
        }

        return pieces;
    }

    function canPieceAttackSquare(fen, piece, targetSquare) {
        let squares = getSquaresAttackedByPiece(fen, piece.square, piece.type, piece.color);
        return squares.includes(targetSquare);
    }

    function wasBlocked(fen, movedFrom, attackerSquare, targetSquare) {
        let af = "abcdefgh".indexOf(attackerSquare[0]);
        let ar = parseInt(attackerSquare[1]);
        let tf = "abcdefgh".indexOf(targetSquare[0]);
        let tr = parseInt(targetSquare[1]);
        let mf = "abcdefgh".indexOf(movedFrom[0]);
        let mr = parseInt(movedFrom[1]);

        let df = tf - af;
        let dr = tr - ar;

        if (df === 0 && dr === 0) return false;
        if (df !== 0 && dr !== 0 && Math.abs(df) !== Math.abs(dr)) return false;

        let stepF = df === 0 ? 0 : (df > 0 ? 1 : -1);
        let stepR = dr === 0 ? 0 : (dr > 0 ? 1 : -1);

        if (mf === af && mr === ar) return false;
        if (mf === tf && mr === tr) return false;

        let dmf = mf - af;
        let dmr = mr - ar;

        if (stepF === 0) {
            if (mf !== af) return false;

            if (stepR > 0) {
                if (!(mr > ar && mr < tr)) return false;
            } else {
                if (!(mr < ar && mr > tr)) return false;
            }
        } else if (stepR === 0) {
            if (mr !== ar) return false;

            if (stepF > 0) {
                if (!(mf > af && mf < tf)) return false;
            } else {
                if (!(mf < af && mf > tf)) return false;
            }
        } else {
            if (Math.abs(dmf) !== Math.abs(dmr)) return false;

            let movedStepF = dmf > 0 ? 1 : -1;
            let movedStepR = dmr > 0 ? 1 : -1;
            if (movedStepF !== stepF || movedStepR !== stepR) return false;

            if (Math.abs(dmf) >= Math.abs(df)) return false;
        }

        return true;
    }

    function isSquareDefendedBy(fen, square, defenderSquare) {
        let ch = fenCharAtSquare(fen, defenderSquare);
        let piece = pieceFromFenChar(ch);
        if (!piece) return false;

        let attacked = getSquaresAttackedByPiece(fen, defenderSquare, piece.type, piece.color);
        return attacked.includes(square);
    }

    function isPiecePinned(fen, pieceSquare, kingSquare, ourColor, oppColor) {
        const pf = "abcdefgh".indexOf(pieceSquare[0]);
        const pr = parseInt(pieceSquare[1], 10);
        const kf = "abcdefgh".indexOf(kingSquare[0]);
        const kr = parseInt(kingSquare[1], 10);

        const df = kf - pf;
        const dr = kr - pr;

        if (df !== 0 && dr !== 0 && Math.abs(df) !== Math.abs(dr)) return false;

        const stepF = df === 0 ? 0 : -(df / Math.abs(df));
        const stepR = dr === 0 ? 0 : -(dr / Math.abs(dr));

        let f = pf + stepF;
        let r = pr + stepR;

        while (f >= 0 && f <= 7 && r >= 1 && r <= 8) {
            const sq = "abcdefgh"[f] + r;
            const ch = fenCharAtSquare(fen, sq);
            if (ch) {
                const p = pieceFromFenChar(ch);
                if (!p || p.color === ourColor) return false;
                if (
                    ((stepF === 0 || stepR === 0) && (p.type === 'r' || p.type === 'q')) ||
                    ((stepF !== 0 && stepR !== 0) && (p.type === 'b' || p.type === 'q'))
                ) {
                    return true;
                }
                return false;
            }
            f += stepF;
            r += stepR;
        }
        return false;
    }

    function getQueenEscapeSquares(fen, queenSquare, color) {
        let escapes = [];
        let directions = [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
            [1, 1],
            [1, -1],
            [-1, 1],
            [-1, -1]
        ];
        let f = "abcdefgh".indexOf(queenSquare[0]);
        let r = parseInt(queenSquare[1]);

        directions.forEach(function (d) {
            let nf = f + d[0],
                nr = r + d[1];
            while (nf >= 0 && nf <= 7 && nr >= 1 && nr <= 8) {
                let sq = "abcdefgh"[nf] + nr;
                if (!fenCharAtSquare(fen, sq)) {
                    escapes.push(sq);
                } else {
                    break;
                }
                nf += d[0];
                nr += d[1];
            }
        });

        return escapes;
    }

    function getPiecesInRadius(fen, centerSquare, radius, color) {
        let pieces = [];
        let allPieces = getAllPieces(fen, color);
        let cf = "abcdefgh".indexOf(centerSquare[0]);
        let cr = parseInt(centerSquare[1]);

        allPieces.forEach(function (p) {
            let pf = "abcdefgh".indexOf(p.square[0]);
            let pr = parseInt(p.square[1]);
            let dist = Math.max(Math.abs(cf - pf), Math.abs(cr - pr));
            if (dist <= radius) {
                pieces.push(p);
            }
        });

        return pieces;
    }

    // =====================================================
    // Section 22: Cache Management
    // =====================================================
    function clearPremoveCaches() {
        if (Engine && Engine._premoveProcessedFens && typeof Engine._premoveProcessedFens.clear === "function") {
            Engine._premoveProcessedFens.clear();
        }
    }

    function trimCaches() {
        function trimMap(map, maxSize, keepRatio) {
            if (!map || typeof map.size !== "number" || map.size <= maxSize) return;
            let ratio = typeof keepRatio === "number" ? keepRatio : 0.75;
            let keysToDelete = map.size - Math.floor(maxSize * ratio);
            let keys = Array.from(map.keys()).slice(0, Math.max(0, keysToDelete));
            keys.forEach(function (k) { map.delete(k); });
        }

        if (Syzygy && Syzygy.cache) {
            trimMap(Syzygy.cache, 60, 0.7);
        }
    }

    // =====================================================
    // Section 23: Evaluation Parsing
    // =====================================================
    function normalizeEvaluation(evaluation) {
        if (evaluation === null || evaluation === undefined || evaluation === "-" || evaluation === "Error") {
            return null;
        }

        if (typeof evaluation === "object" && evaluation !== null) {
            if ("mate" in evaluation && evaluation.mate !== 0) {
                return { mate: evaluation.mate };
            }
            if ("cp" in evaluation) {
                return { cp: evaluation.cp };
            }
            return null;
        }

        if (typeof evaluation === "string") {
            const mateMatch = evaluation.match(/([+-])?M([+-]?\d+)/i);
            if (mateMatch) {
                const sign = mateMatch[1] === "-" ? -1 : 1;
                const moves = Math.abs(parseInt(mateMatch[2], 10));
                return { mate: sign * moves };
            }

            const num = parseFloat(evaluation);
            if (!isNaN(num)) {
                return { cp: Math.round(num * 100) };
            }
            return null;
        }

        if (typeof evaluation === "number") {
            return { cp: Math.round(evaluation * 100) };
        }

        return null;
    }

    // =====================================================
    // Section 24: Premove Chance Calculation
    // =====================================================
    function getBaseChanceFromParsedEval(parsed) {
        if (!parsed) return 0;
        if ("mate" in parsed) {
            let mateDistance = Math.abs(parsed.mate);
            if (parsed.mate > 0) return 2;
            if (mateDistance <= 2) return 75;
            if (mateDistance <= 4) return 65;
            if (mateDistance <= 6) return 55;
            return 45;
        }

        let evalFromSTM = parsed.cp / 100;
        let ourEval = -evalFromSTM;
        if (ourEval >= 10.0) return 80;
        if (ourEval >= 6.0) return 70;
        if (ourEval >= 3.5) return 55;
        if (ourEval >= 2.0) return 45;
        if (ourEval >= 1.0) return 35;
        if (ourEval >= 0.3) return 25;
        if (ourEval >= 0) return 18;
        if (ourEval >= -0.5) return 12;
        if (ourEval >= -1.5) return 8;
        if (ourEval >= -3.0) return 5;
        return 2;
    }

    function getEvalBasedPremoveChance(evaluation, ourColor) {
        if (!State.premoveEnabled) return 0;
        let game = getGame();
        if (!game || isPlayersTurn(game)) return 0;
        let parsed = normalizeEvaluation(evaluation);
        if (!parsed) return 0;
        return getBaseChanceFromParsedEval(parsed);
    }

    function parsePVMoves(pv) {
        if (!pv || typeof pv !== "string") return [];
        let tokenRe = /^[a-h][1-8][a-h][1-8](?:[qrbn])?$/i;
        let trimmed = pv.trim();
        if (!trimmed) return [];
        return trimmed.split(/\s+/).filter(function (t) { return tokenRe.test(t); });
    }

    function getOurMoveFromPV(pv, ourColor, sideToMove) {
        if (!pv) return null;
        let moves = parsePVMoves(pv);
        if (!moves.length) return null;
        let idx = (sideToMove === ourColor) ? 0 : 1;
        if (idx >= moves.length) {
            State.statusInfo = "[PV] PV too short for premove. Length:" + moves.length + " needed idx:" + idx;
            UI.updateStatusInfo();
            return null;
        }
        return moves[idx];
    }

    // =====================================================
    // Section 25: Time and Clock Functions
    // =====================================================
    function parseTimeString(timeString) {
        if (!timeString || typeof timeString !== "string") return null;
        let clean = timeString.replace(/[^\d:.]/g, "");
        if (!/\d/.test(clean)) return null;
        let parts = clean.split(":").map(function (p) { return parseFloat(p); });
        if (parts.some(isNaN)) return null;
        let total = 0;
        if (parts.length === 3) total = parts[0] * 3600 + parts[1] * 60 + parts[2];
        else if (parts.length === 2) total = parts[0] * 60 + parts[1];
        else if (parts.length === 1) total = parts[0];
        return total >= 0 ? total : null;
    }

    function getClockTimes() {
        try {
            const clockSelectors = [
                ".clock-time-monospace[role=\"timer\"]",
                ".clock-time-monospace",
                ".clock-component .clock-time-monospace"
            ];
            let allClockElements = [];

            for (let si = 0; si < clockSelectors.length; si++) {
                const elements = Array.from(document.querySelectorAll(clockSelectors[si]))
                .filter(function (el) { return el && el.offsetParent !== null; });
                if (elements.length > 0) {
                    allClockElements = elements;
                    break;
                }
            }

            if (allClockElements.length === 0) {
                return { opponentTime: null, playerTime: null, found: false };
            }

            const getElementTime = function (el) {
                const text = (el.textContent || el.innerText || "").trim();
                return parseTimeString(text);
            };

            let opponentTime = null;
            let playerTime = null;

            if (allClockElements.length >= 2) {
                const sorted = allClockElements
                .map(function (el) { return { el: el, rect: el.getBoundingClientRect() }; })
                .sort(function (a, b) { return a.rect.top - b.rect.top; })
                .map(function (obj) { return obj.el; });
                playerTime = getElementTime(sorted[sorted.length - 1]);
                opponentTime = getElementTime(sorted[0]);
            } else {
                playerTime = getElementTime(allClockElements[0]);
            }

            return { opponentTime: opponentTime, playerTime: playerTime, found: true };

        } catch (e) {
            return { opponentTime: null, playerTime: null, found: false };
        }
    }

    // =====================================================
    // Section 26: Syzygy Tablebase Probe
    // =====================================================
    let Syzygy = {
        cache: new Map(),
        inFlight: false,
        lastFenHash: "",
        lastRequestTs: 0,
        THROTTLE_MS: 1200,
        MAX_CACHE_SIZE: 120,
        MAX_PIECES: 7,
        USE_FETCH_FIRST: true,

        _countPieces: function (fen) {
            if (!fen || typeof fen !== "string") return 99;
            let placement = fen.split(" ")[0] || "";
            let matches = placement.match(/[pnbrqkPNBRQK]/g);
            return matches ? matches.length : 0;
        },

        _toFenHash: function (fen) {
            return hashFen(fen || "");
        },

        _toApiFenParam: function (fenHash) {
            return encodeURIComponent(String(fenHash || "").replace(/\s+/g, "_"));
        },

        _setStateFromResult: function (fenHash, payload, source) {
            State.syzygyLastFen = fenHash;
            State.syzygySource = source || "api";
            State.syzygyError = "";
            State.syzygyMeta = {
                category: payload && payload.category ? payload.category : "unknown",
                dtz: payload && typeof payload.dtz === "number" ? payload.dtz : null,
                dtm: payload && typeof payload.dtm === "number" ? payload.dtm : null,
                checkmate: !!(payload && payload.checkmate),
                stalemate: !!(payload && payload.stalemate)
            };
            State.syzygyMoves = Array.isArray(payload && payload.moves) ? payload.moves.slice(0, 10) : [];
            State.syzygyStatus = "Ready";
            UI.updateSyzygyDisplay();
        },

        _setUnavailable: function (statusText, errText) {
            State.syzygyStatus = statusText || "Unavailable";
            State.syzygyError = errText || "";
            State.syzygyMoves = [];
            State.syzygyMeta = null;
            UI.updateSyzygyDisplay();
        },

        _categoryToEvalCp: function (category) {
            let c = String(category || "").toLowerCase();
            if (c.includes("win")) return 900;
            if (c.includes("cursed")) return 120;
            if (c.includes("draw")) return 0;
            if (c.includes("blessed")) return -120;
            if (c.includes("loss")) return -900;
            return 0;
        },

        tryUseForAnalysis: function (fen) {
            if (!State.analysisMode) return false;
            let fenHash = this._toFenHash(fen);
            if (!fenHash) return false;
            if (this._countPieces(fenHash) > this.MAX_PIECES) return false;
            if (State.syzygyLastFen !== fenHash) return false;

            let moves = Array.isArray(State.syzygyMoves) ? State.syzygyMoves : [];
            if (!moves.length) return false;

            let maxRows = clamp(State.numberOfMovesToShow || 5, 2, 10);
            State.topMoves = [];
            State.topMoveInfos = {};

            for (let i = 0; i < maxRows; i++) {
                let mv = moves[i];
                if (!mv || !mv.uci) {
                    UI.updateMove(i + 1, "...", "-", "eval-equal");
                    continue;
                }
                let cat = String(mv.category || "draw").toLowerCase();
                let evalCp = this._categoryToEvalCp(cat);
                let evalText = (cat === "draw" ? "0.00" : String(mv.category || "TB"));
                let evalClass = evalCp > 0 ? "eval-positive" : (evalCp < 0 ? "eval-negative" : "eval-equal");
                let uci = String(mv.uci);

                State.topMoves[i] = uci;
                State.topMoveInfos[i + 1] = {
                    move: uci,
                    evalText: evalText,
                    evalClass: evalClass,
                    depth: 99,
                    rawCp: evalCp
                };
                UI.updateMove(i + 1, uci, evalText, evalClass);
            }

            let best = moves[0];
            if (!best || !best.uci) return false;
            let bestUci = String(best.uci);
            let bestCat = String(best.category || "draw");
            let bestEval = this._categoryToEvalCp(bestCat);
            State.analysisEvalText = bestCat === "draw" ? "0.00" : bestCat;

            State.analysisPVLine = [bestUci];
            State.principalVariation = bestUci;
            State.currentEvaluation = bestEval;
            State.analysisStableCount = Math.max(State.analysisStableCount || 0, State.analysisMinStableUpdates || 2);
            State.analysisLastBestMove = bestUci;
            State.analysisGuardStateText = "Syzygy";
            State.isAnalysisThinking = false;
            State.statusInfo = "Syzygy analysis: " + bestUci + " (" + bestCat + ")";

            if (State.analysisAcplFen !== fenHash) {
                ACPL.onNewEval(bestEval, null);
                State.analysisAcplFen = fenHash;
            }

            recordAnalysisBestmove(bestUci, State.analysisEvalText, 99, fenHash);

            UI.updateStatusInfo();
            UI.updateAnalysisBar(bestEval);
            if (State.showPVArrows) {
                UI.clearPVArrows();
                UI.drawPVArrows(State.analysisPVLine, State.analysisPVTurn, true);
            }
            if (State.showBestmoveArrows) {
                UI.drawBestmoveArrows();
            }
            if (State.highlightEnabled) {
                UI.highlightMove(bestUci, State.highlightColor2, true);
            }
            UI.updatePVDisplay();
            return true;
        },

        maybeProbe: function (fen) {
            if (State.gameEnded && !State.analysisMode) return;
            if (!fen) return;
            let fenHash = this._toFenHash(fen);
            if (!fenHash) return;

            let pieceCount = this._countPieces(fenHash);
            if (pieceCount > this.MAX_PIECES) {
                if (State.syzygyStatus !== "Not available (>7 pieces)") {
                    State.syzygyStatus = "Not available (>7 pieces)";
                    State.syzygyError = "";
                    State.syzygyMoves = [];
                    State.syzygyMeta = null;
                    UI.updateSyzygyDisplay();
                }
                return;
            }

            let cached = this.cache.get(fenHash);
            if (cached && (Date.now() - cached.ts) < 300000) {
                this._setStateFromResult(fenHash, cached.payload, "cache");
                this.tryUseForAnalysis(fenHash);
                return;
            }

            let now = Date.now();
            if (this.inFlight && this.lastFenHash === fenHash) return;
            if ((now - this.lastRequestTs) < this.THROTTLE_MS && this.lastFenHash === fenHash) return;

            this.lastRequestTs = now;
            this.lastFenHash = fenHash;
            this.inFlight = true;

            State.syzygyStatus = "Loading...";
            State.syzygyError = "";
            UI.updateSyzygyDisplay();

            let url = "https://tablebase.lichess.ovh/standard?fen=" + this._toApiFenParam(fenHash);
            let self = this;

            let handlePayload = function (payload, source) {
                self.cache.set(fenHash, { payload: payload, ts: Date.now() });
                if (self.cache.size > self.MAX_CACHE_SIZE) {
                    let keys = Array.from(self.cache.keys()).slice(0, self.cache.size - self.MAX_CACHE_SIZE);
                    keys.forEach(function (k) { self.cache.delete(k); });
                }
                self._setStateFromResult(fenHash, payload, source);
                self.tryUseForAnalysis(fenHash);
            };

            if (typeof fetch !== "function") {
                self.inFlight = false;
                self._setUnavailable("Unavailable", "Fetch not supported");
                return;
            }

            fetch(url, {
                method: "GET",
                mode: "cors",
                credentials: "omit",
                cache: "no-store"
            }).then(function (resp) {
                if (!resp || !resp.ok) throw new Error("HTTP " + ((resp && resp.status) || 0));
                return resp.json();
            }).then(function (payload) {
                self.inFlight = false;
                handlePayload(payload || {}, "api-fetch");
            }).catch(function (fetchErr) {
                self.inFlight = false;
                self._setUnavailable("Unavailable", (fetchErr && fetchErr.message) ? fetchErr.message : "Fetch failed");
            });
        },

        clear: function () {
            this.cache.clear();
            this.inFlight = false;
            this.lastFenHash = "";
            this.lastRequestTs = 0;
            State.syzygyStatus = "Idle";
            State.syzygyLastFen = "";
            State.syzygySource = "";
            State.syzygyMoves = [];
            State.syzygyMeta = null;
            State.syzygyError = "";
        }
    };

    // =====================================================
    // Section 27: Advanced Time Management
    // =====================================================
    let TimeManager = {
        lastMoveTime: 0,
        moveTimes: [],
        isTimePressure: false,

        calculateHumanizedDelay: function () {
            if (State.clockSync) return this._calculateClockSyncDelay();

            let range = this._getValidatedDelayRange();
            let minD = range.min;
            let maxD = range.max;
            let minMs = minD * 1000;
            let maxMs = maxD * 1000;
            let baseDelay = (Math.random() * (maxD - minD) + minD) * 1000;

            this.isTimePressure = false;

            if (CONFIG.STEALTH.RANDOMIZE_DELAYS) {
                let complexity = this._estimatePositionComplexity();
                let complexityBonus = complexity * 0.15;
                baseDelay *= (1 + complexityBonus);

                if (State.moveNumber <= 10) baseDelay *= 0.85;
            }

            baseDelay = Math.max(minMs, Math.min(maxMs, baseDelay));

            let jitter = 1 + (Math.random() - 0.5) * 0.1;
            baseDelay *= jitter;

            this.moveTimes.push(baseDelay);
            if (this.moveTimes.length > 10) this.moveTimes.shift();

            return Math.max(100, Math.round(baseDelay));
        },

        _lastClockData: null,
        _lastClockTs: 0,

        _getCachedClockData: function () {
            let now = Date.now();
            if (this._lastClockData && now - this._lastClockTs < 500) return this._lastClockData;
            this._lastClockData = getClockTimes();
            this._lastClockTs = now;
            return this._lastClockData;
        },

        _detectIncrement: function () {
            let clockData = this._getCachedClockData();
            if (!clockData || !clockData.found) return 0;
            try {
                let selectors = [
                    "[data-cy='clock-component']",
                    ".clock-component",
                    ".board-layout-top .clock-component",
                    ".board-layout-bottom .clock-component"
                ];
                for (let i = 0; i < selectors.length; i++) {
                    let el = document.querySelector(selectors[i]);
                    if (!el) continue;
                    let text = (el.textContent || el.innerText || "").trim();
                    let incMatch = text.match(/\+(\d+)/);
                    if (incMatch) return parseInt(incMatch[1], 10);
                }
                let gameInfo = document.querySelector("[data-cy='game-info-time']");
                if (gameInfo) {
                    let txt = (gameInfo.textContent || "").trim();
                    let m = txt.match(/\|?\s*\+(\d+)/);
                    if (m) return parseInt(m[1], 10);
                }
            } catch (e) { }
            return 0;
        },

        _calculateClockSyncDelay: function () {
            let clockData = this._getCachedClockData();
            if (!clockData || !clockData.found || clockData.playerTime === null) {
                return this._calculateRandomDelay();
            }

            let myTimeSec = clockData.playerTime;

            if (myTimeSec <= 0) {
                this.isTimePressure = true;
                return 100;
            }

            let quickThreshold = State.clockSyncLowTimeQuickSec;
            let quickDelayMs = State.clockSyncQuickDelayMs || 300;

            if (myTimeSec <= quickThreshold) {
                let ratio = myTimeSec / quickThreshold;
                let urgencyFactor;
                if (myTimeSec <= 3) urgencyFactor = 0.5;
                else if (myTimeSec <= 10) urgencyFactor = Math.max(0.5, ratio * 0.8);
                else urgencyFactor = Math.max(0.6, ratio);

                let adjustedDelay = Math.round(quickDelayMs * urgencyFactor);
                adjustedDelay = Math.max(200, Math.min(adjustedDelay, quickDelayMs));

                let jitter = 1 + (Math.random() - 0.5) * 0.15;
                adjustedDelay = Math.round(adjustedDelay * jitter);

                log("[TimeManager] LOW TIME! " + myTimeSec.toFixed(1) + "s → delay: " + adjustedDelay + "ms (factor:" + urgencyFactor.toFixed(2) + ")");
                this.isTimePressure = true;
                return Math.max(150, adjustedDelay);
            }

            this.isTimePressure = false;

            let incrementSec = this._detectIncrement();
            let myTimeMs = myTimeSec * 1000;
            let incrementMs = incrementSec * 1000;
            let moveNum = State.moveNumber;
            let estimatedTotalMoves = this._estimateGameLength(clockData);
            let remainingMoves = Math.max(5, estimatedTotalMoves - moveNum);

            let phaseMultiplier = 1.0;
            if (moveNum <= 10) phaseMultiplier = 0.6;
            else if (moveNum <= 25) phaseMultiplier = 1.2;
            else if (moveNum <= 40) phaseMultiplier = 1.0;
            else phaseMultiplier = 0.7;

            let timeForThisMove = (myTimeMs / remainingMoves) * phaseMultiplier;
            timeForThisMove += (incrementMs * 0.4);

            let minTime = State.clockSyncMinDelay * 1000;
            let maxTime = State.clockSyncMaxDelay * 1000;
            if (minTime > maxTime) { let tmp = minTime; minTime = maxTime; maxTime = tmp; }

            let finalDelay = Math.min(Math.max(timeForThisMove, minTime), maxTime);

            let jitter = 1 + (Math.random() - 0.5) * 0.2;
            finalDelay = Math.round(finalDelay * jitter);

            log("[TimeManager] Clock sync: " + myTimeSec.toFixed(1) + "s left, inc+" + incrementSec + "s, move#" + moveNum + ", delay: " + finalDelay + "ms");
            return Math.max(150, finalDelay);
        },

        _estimatePositionComplexity: function () {
            let fen = getAccurateFen();
            if (!fen) return 1.0;
            let pieceCount = (fen.match(/[pnbrqkPNBRQK]/g) || []).length;
            let baseComplexity = pieceCount / 32;
            let kingExposure = this._estimateKingExposure(fen);
            return Math.min(2.0, baseComplexity + kingExposure);
        },

        _estimateKingExposure: function (fen) {
            let parts = fen.split(" ");
            let castling = parts[2] || "-";
            return castling === "-" ? 0.3 : 0.1;
        },

        _estimateGameLength: function (clockData) {
            let tc = this._detectTimeControl(clockData);
            if (tc === "bullet") return 40;
            if (tc === "blitz") return 50;
            if (tc === "rapid") return 60;
            return 70;
        },

        _detectTimeControl: function (clockData) {
            let data = clockData || this._getCachedClockData();
            if (!data || !data.found) return "rapid";

            let remainingTime = data.playerTime || 0;
            let moveNum = State.moveNumber || 1;
            let incrementSec = this._detectIncrement();

            let avgMoveTime = moveNum > 1 ? 3 + incrementSec : 5;
            let estimatedInitialTime = remainingTime + (moveNum * avgMoveTime);

            if (estimatedInitialTime <= 120) return "bullet";
            if (estimatedInitialTime <= 420) return "blitz";
            if (estimatedInitialTime <= 1500) return "rapid";
            return "classical";
        },

        _getValidatedDelayRange: function () {
            let minD = Number(State.minDelay);
            let maxD = Number(State.maxDelay);

            if (!isFinite(minD) || minD <= 0) minD = 0.1;
            if (!isFinite(maxD) || maxD <= 0) maxD = minD;
            if (minD > maxD) {
                let tmp = minD;
                minD = maxD;
                maxD = tmp;
            }

            return {
                min: minD,
                max: maxD
            };
        },

        _calculateRandomDelay: function () {
            let range = this._getValidatedDelayRange();
            let minD = range.min;
            let maxD = range.max;
            return (Math.random() * (maxD - minD) + minD) * 1000;
        }
    };

    function getCalculatedDelay() {
        return TimeManager.calculateHumanizedDelay();
    }

    function cancelPendingMove() {
        if (pendingMoveTimeoutId) {
            clearTimeout(pendingMoveTimeoutId);
            pendingMoveTimeoutId = null;
        }
        State.moveExecutionInProgress = false;
    }

    function cancelModePendingTimers(reason) {
        cancelPendingMove();
        if (Engine && Engine._premoveTimeoutId) {
            clearTimeout(Engine._premoveTimeoutId);
            Engine._premoveTimeoutId = null;
        }
        if (Engine) {
            Engine._premoveProcessing = false;
            Engine._premoveEngineBusy = false;
        }
        State.premoveAnalysisInProgress = false;
        State.currentDelayMs = 0;
    }

    // =====================================================
    // Section 28: Opponent Rating and Depth Adaptation
    // =====================================================
    function extractOpponentRating() {
        try {

            let selectors = [

                "#board-layout-player-top .rating",
                "#board-layout-player-bottom .rating",
                "#board-layout-player-top [class*='rating']",
                "#board-layout-player-bottom [class*='rating']",

                ".user-tagline-rating",
                ".player-component .rating",
                ".player-top .rating",
                ".player-bottom .rating",

                ".board-layout-player-top .rating",
                ".board-layout-player-bottom .rating"
            ];

            for (let i = 0; i < selectors.length; i++) {
                let el = document.querySelector(selectors[i]);
                if (el && el.textContent) {
                    let rating = parseInt(el.textContent.replace(/\D/g, ""), 10);
                    if (!isNaN(rating) && rating > 100) return rating;
                }
            }

            let boardArea = document.querySelector("#board-layout-chessboard") ||
                document.querySelector("chess-board") ||
                document.querySelector(".board");

            if (boardArea) {
                let allText = boardArea.parentElement.textContent || "";
                let ratingMatches = allText.match(/\d{3,4}\s*[♙♘♗♖♕♔⚫⚪]/g);
                if (ratingMatches && ratingMatches.length >= 2) {

                    return parseInt(ratingMatches[0].replace(/\D/g, ""), 10);
                }
            }

            let game = getGame();
            if (game && game.players) {
                let myColor = getPlayingAs();
                for (let color in game.players) {
                    if (color !== myColor && game.players[color].rating) {
                        return parseInt(game.players[color].rating, 10);
                    }
                }
            }

        } catch (e) {
            console.error("[ChessAssistant] Error extracting rating:", e);
        }
        return null;
    }

    function mapRatingToDepth(r) {
        if (!r || r < 600) return 1;
        if (r < 900) return 3;
        if (r < 1100) return 5;
        if (r < 1300) return 7;
        if (r < 1500) return 9;
        if (r < 1700) return 12;
        if (r < 1900) return 15;
        if (r < 2100) return 18;
        if (r < 2300) return 22;
        if (r < 2500) return 24;
        return Math.min(26, CONFIG.MAX_DEPTH);
    }

    function mapRatingToElo(r) {
        if (!r || !Number.isFinite(r)) return 1600;
        let mapped = clamp(Math.round(r / 10) * 10, 300, 3200);
        return mapped;
    }

    function applyAutoDepthFromOpponent() {
        if (!State.autoDepthAdapt) {
            return;
        }

        let opp = extractOpponentRating();
        if (!opp) {
            console.log("[ChessAssistant] Could not extract opponent rating");
            State.statusInfo = "Auto Depth: No rating found";
            UI.updateStatusInfo();
            return;
        }

        let newDepth = mapRatingToDepth(opp);
        let newElo = mapRatingToElo(opp);

        console.log("[ChessAssistant] Opponent rating:", opp, "-> Depth:", newDepth, "ELO:", newElo);

        saveSetting("customDepth", newDepth);
        saveSetting("eloRating", newElo);

        if (State.evaluationMode === "human") {
            Engine.setElo(newElo);
        }

        _updateDepthSliderUI(newDepth, newElo, opp);

        State.statusInfo = "Auto Adapt: " + opp + " -> Depth " + newDepth + " | ELO " + newElo;
        UI.updateStatusInfo();
    }

    function _updateDepthSliderUI(depth, elo, rating) {
        let attempts = 0;
        let maxAttempts = 5;

        function tryUpdate() {
            let sld = $("#sld-depth");
            let disp = $("#depth-display");
            let eloSlider = $("#sld-elo");
            let eloDisplay = $("#elo-display");

            if (sld && disp) {

                sld.value = depth;
                disp.textContent = depth;

                let event = new Event('input', { bubbles: true });
                sld.dispatchEvent(event);

                let changeEvent = new Event('change', { bubbles: true });
                sld.dispatchEvent(changeEvent);

                if (eloSlider && eloDisplay && Number.isFinite(elo)) {
                    eloSlider.value = elo;
                    eloDisplay.textContent = elo;
                    eloSlider.dispatchEvent(new Event("input", { bubbles: true }));
                }

                console.log("[ChessAssistant] Auto-adapt UI updated depth:", depth, "elo:", elo, "opp:", rating);
                return true;
            }

            attempts++;
            if (attempts < maxAttempts) {
                scheduleManagedTimeout(tryUpdate, 100);
            } else {
                console.warn("[ChessAssistant] Could not find depth slider after", maxAttempts, "attempts");
            }
            return false;
        }

        tryUpdate();
    }

    // =====================================================
    // Section 29: Engine Management
    // =====================================================
    let Engine = {
        main: null,
        mainBlobURL: null,
        _ready: false,
        analysis: null,
        analysisBlobURL: null,
        premove: null,
        premoveBlobURL: null,
        _activeBlobURLs: new Set(),

        _premoveEngineBusy: false,
        _premoveProcessedFens: new Set(),
        _premoveProcessing: false,
        _premoveLastFen: null,
        _premoveTimeoutId: null,
        _premoveCandidates: Object.create(null),
        _premoveAttemptedFens: new Set(),
        _premoveLastActivityTs: 0,
        _mainLastActivityTs: 0,
        _analysisLastActivityTs: 0,

        init: function () {
            let self = this;
            let src = "";
            try {
                src = GM_getResourceText("stockfishjs");
            } catch (e) { }

            if (!src || src.length < 1000) {
                State.statusInfo = "GM_getResourceText unavailable, trying manual load...";
                UI.updateStatusInfo();
                return loadStockfishManually().then(function (loaded) {
                    if (!loaded) {
                        err("All Stockfish load methods failed");
                        return false;
                    }
                    return self.loadMainEngine();
                });
            }
            return self.loadMainEngine();
        },

        _registerBlobURL: function (url) {
            if (!url) return;
            try {
                this._activeBlobURLs.add(url);
            } catch (e) { }
        },

        _revokeBlobURL: function (url) {
            if (!url) return;
            try {
                URL.revokeObjectURL(url);
            } catch (e) { }
            try {
                this._activeBlobURLs.delete(url);
            } catch (e) { }
        },

        _revokeAllActiveBlobURLs: function () {
            try {
                this._activeBlobURLs.forEach(function (url) {
                    try { URL.revokeObjectURL(url); } catch (e) { }
                });
            } catch (e) { }
            try {
                this._activeBlobURLs.clear();
            } catch (e) { }
        },

        _createWorker: function (existingBlobURL) {
            if (existingBlobURL) {
                this._revokeBlobURL(existingBlobURL);
            }
            let src = "";
            try {
                src = GM_getResourceText("stockfishjs");
            } catch (e) { }
            if (!src || src.length < 1000) src = EngineLoader.stockfishSourceCode;
            if (!src || src.length < 1000) {
                err("No Stockfish source available");
                return {
                    worker: null,
                    blobURL: null
                };
            }
            try {
                let blob = new Blob([src], {
                    type: "application/javascript"
                });
                let blobURL = URL.createObjectURL(blob);
                this._registerBlobURL(blobURL);
                let worker = new Worker(blobURL);
                worker._blobURL = blobURL;
                return {
                    worker: worker,
                    blobURL: blobURL
                };
            } catch (e) {
                err("Worker creation failed:", e);
                return {
                    worker: null,
                    blobURL: null
                };
            }
        },

        _waitForSignal: function (engineWorker, signal, timeout) {
            return new Promise(function (resolve, reject) {
                let timer;
                let handler = function (e) {
                    if (typeof e.data === "string" && e.data.includes(signal)) {
                        clearTimeout(timer);
                        engineWorker.removeEventListener("message", handler);
                        resolve();
                    }
                };
                engineWorker.addEventListener("message", handler);
                timer = setTimeout(function () {
                    clearTimeout(timer);
                    engineWorker.removeEventListener("message", handler);
                    reject(new Error("Timeout waiting for: " + signal));
                }, timeout);
            });
        },

        loadMainEngine: function () {
            let self = this;
            try {
                if (self.main) {
                    self.main.terminate();
                    self.main = null;
                }
                let result = self._createWorker(self.mainBlobURL);
                if (!result.worker) return Promise.resolve(false);
                self.main = result.worker;
                self.mainBlobURL = result.blobURL;
                self._ready = false;

                self.main.onmessage = function (e) {
                    self._onMainMessage(e.data);
                };
                self.main.onerror = function () {
                    self._ready = false;
                    if (self.main && self.main._blobURL) {
                        self._revokeBlobURL(self.main._blobURL);
                    }
                };

                return new Promise(function (resolve) {
                    let attempt = function (n) {
                        if (n > 3) {
                            resolve(false);
                            return;
                        }
                        self.main.postMessage("uci");
                        self._waitForSignal(self.main, "uciok", 8000).then(function () {
                            self._configureMainEngine();
                            self.main.postMessage("isready");
                            return self._waitForSignal(self.main, "readyok", 5000);
                        }).then(function () {
                            self._ready = true;
                            self._mainLastActivityTs = Date.now();
                            let led = $("#engine-status-led");
                            if (led) led.classList.add("active");
                            resolve(true);
                        }).catch(function () {
                            scheduleManagedTimeout(function () {
                                attempt(n + 1);
                            }, 1000 * n);
                        });
                    };
                    attempt(1);
                });
            } catch (e) {
                err("Main engine init failed:", e);
                return Promise.resolve(false);
            }
        },

        _configureMainEngine: function () {
            let mpv = clamp(State.numberOfMovesToShow || 5, 2, 10);
            this.main.postMessage("setoption name MultiPV value " + mpv);
            this.main.postMessage("setoption name Skill Level value " + (State.skillLevel !== undefined ? State.skillLevel : 20));
            if (State.evaluationMode === "human") {
                this.main.postMessage("setoption name UCI_LimitStrength value true");
                this.main.postMessage("setoption name UCI_Elo value " + State.eloRating);
            } else {
                this.main.postMessage("setoption name UCI_LimitStrength value false");
            }
            this.main.postMessage("ucinewgame");
        },

        go: function (fen, depth) {
            if (!this.main || !this._ready) return;
            if (State.analysisMode) {
                State.statusInfo = "Main engine blocked: Analysis mode active";
                UI.updateStatusInfo();
                return;
            }

            State.isThinking = true;
            State.statusInfo = "Analyzing...";
            UI.updateStatusInfo();
            State.topMoves = [];
            State.topMoveInfos = {};
            State.topMovesFen = fen;
            State.mainBestHistory = [];
            State.mainPVLine = [];
            State.mainPVTurn = getCurrentTurn(fen);
            State._mainDepthByPv = {};

            let maxRows = clamp(State.numberOfMovesToShow || 5, 2, 10);
            for (let i = 1; i <= maxRows; i++) {
                UI.updateMove(i, "...", "0.00", "eval-equal");
            }
            UI.clearBestmoveArrows();

            UI.clearHighlights();
            this.main.postMessage("stop");
            this.main.postMessage("position fen " + fen);
            this._mainLastActivityTs = Date.now();
            if (State.evaluationMode === "human") {
                let level = ELO_LEVELS[State.humanLevel] || ELO_LEVELS.intermediate;
                let ms = Math.floor((level.moveTime.min + Math.random() * (level.moveTime.max - level.moveTime.min)) * 1000);
                this.main.postMessage("go movetime " + ms);
            } else {
                this.main.postMessage("go depth " + depth);
            }
            UI.updateStatusInfo();
        },

        stop: function () {
            if (this.main) this.main.postMessage("stop");
            State.isThinking = false;
            State.statusInfo = "Ready";
            UI.updateStatusInfo();
        },

        setElo: function (elo) {
            if (!this.main) return;
            this.main.postMessage("setoption name UCI_LimitStrength value true");
            this.main.postMessage("setoption name UCI_Elo value " + elo);
            this.main.postMessage("isready");
        },

        setFullStrength: function () {
            if (!this.main) return;
            this.main.postMessage("setoption name UCI_LimitStrength value false");
            this.main.postMessage("setoption name Skill Level value " + (State.skillLevel !== undefined ? State.skillLevel : 20));
            this.main.postMessage("isready");
        },

        setSkillLevel: function (level) {
            if (!this.main) return;
            let val = clamp(level, 0, 20);
            this.main.postMessage("setoption name Skill Level value " + val);
            this.main.postMessage("isready");
            log("[Engine] Skill Level set to " + val);
        },

        _onMainMessage: function (data) {
            if (typeof data !== "string") return;
            this._mainLastActivityTs = Date.now();
            if (State.analysisMode) {
                if (data.indexOf("bestmove") === 0) State.isThinking = false;
                return;
            }

            if (data.indexOf("info") === 0 && data.includes(" pv ")) {
                this._parseMainInfo(data);
            } else if (data.indexOf("bestmove") === 0) {
                this._handleMainBestMove(data);
            }
        },

        _parseMainInfo: function (data) {
            let tokens = data.split(" ");
            let get = function (key) {
                let i = tokens.indexOf(key);
                return (i !== -1 && i + 1 < tokens.length) ? tokens[i + 1] : null;
            };

            let multipv = parseInt(get("multipv")) || 1;
            let depth = parseInt(get("depth")) || 0;
            if (!State._mainDepthByPv) State._mainDepthByPv = {};
            let lastDepth = State._mainDepthByPv[multipv] || 0;
            if (depth < lastDepth) return;
            State._mainDepthByPv[multipv] = depth;
            let pvIdx = tokens.indexOf("pv");
            if (pvIdx === -1) return;
            let bestMove = tokens[pvIdx + 1];

            let pvMoves = tokens.slice(pvIdx + 1).filter(function (m) {
                return /^[a-h][1-8][a-h][1-8](?:[qrbn])?$/i.test(m);
            });

            let scoreIdx = tokens.indexOf("score");
            if (scoreIdx === -1) return;
            let scoreType = tokens[scoreIdx + 1];
            let scoreValue = parseInt(tokens[scoreIdx + 2]) || 0;

            let maxTrackedMoves = clamp(State.numberOfMovesToShow || 5, 2, 10);
            if (multipv >= 1 && multipv <= maxTrackedMoves) State.topMoves[multipv - 1] = bestMove;

            let evalText = "0.00";
            let evalClass = "eval-equal";
            let rawCp = 0;
            let mateVal = null;

            if (scoreType === "cp") {
                rawCp = scoreValue;
                evalText = (rawCp >= 0 ? "+" : "") + (rawCp / 100).toFixed(2);
                evalClass = rawCp > 30 ? "eval-positive" : rawCp < -30 ? "eval-negative" : "eval-equal";
            } else if (scoreType === "mate") {
                mateVal = scoreValue;
                rawCp = scoreValue > 0 ? CONFIG.MATE_VALUE : -CONFIG.MATE_VALUE;
                evalText = (scoreValue > 0 ? "M+" : "M") + scoreValue;
                evalClass = scoreValue > 0 ? "eval-positive" : "eval-negative";
            }

            if (multipv >= 1 && multipv <= maxTrackedMoves) {
                State.topMoveInfos[multipv] = {
                    move: bestMove,
                    evalText: evalText,
                    evalClass: evalClass,
                    depth: depth,
                    rawCp: rawCp
                };
                UI.updateMove(multipv, bestMove, evalText, evalClass);
                if (State.showBestmoveArrows && !State.analysisMode) {
                    UI.drawBestmoveArrows();
                }
            }

            if (multipv === 1) {
                let oldPV = State.mainPVLine.join(" ");
                let newPV = pvMoves.join(" ");

                State.mainBestHistory.push({ move: bestMove, depth: depth, ts: Date.now() });
                if (State.mainBestHistory.length > 8) {
                    State.mainBestHistory = State.mainBestHistory.slice(-8);
                }

                State.mainPVLine = pvMoves;
                State.principalVariation = newPV;
                State.lastTopMove1 = bestMove;
                State.lastEvalText1 = evalText;
                State.lastEvalClass1 = evalClass;
                State.currentEvaluation = rawCp;
                State._lastScoreInfo = {
                    type: scoreType,
                    value: scoreValue,
                    display: evalText
                };

                if (depth >= 8) checkAutoResign(scoreType, scoreValue);

                UI.updateMove(1, bestMove, evalText, evalClass);
                UI.updateEvalBar(rawCp, mateVal, depth);
                ACPL.onNewEval(rawCp, mateVal);

                if (State.premoveEnabled) {
                    let game = getGame();
                    UI.updatePremoveChanceDisplay(game, rawCp, evalText, bestMove, 1);
                }

                if (!State.analysisMode && State.showPVArrows) {
                    if (oldPV !== newPV || pvMoves[0] !== State.lastRenderedMainPV.split(" ")[0]) {
                        UI._removePVArrowsByType(false);
                        UI.drawPVArrows(pvMoves, State.mainPVTurn, false);
                    }
                }

                UI.updatePVDisplay();
            }
        },

        _handleMainBestMove: function (data) {
            let tokens = data.split(" ");
            let finalMove = tokens[1];
            if (!finalMove || finalMove === "(none)") {
                State.isThinking = false;
                return;
            }

            let game = getGame();
            if (!isPlayersTurn(game)) {
                State.isThinking = false;
                State.statusInfo = "Waiting for opponent";
                UI.updateStatusInfo();
                return;
            }

            let lastScore = State._lastScoreInfo;
            if (lastScore) checkAutoResign(lastScore.type, lastScore.value);

            if (State.analysisMode) {
                State.isThinking = false;
                return;
            }

            finalMove = getMainConsensusMove(finalMove);

            if (State.evaluationMode === "human" && State.topMoves.length >= 2 && State.topMoves[1]) {
                let currentFen = getAccurateFen();
                if (State.topMovesFen === currentFen) {
                    let level = ELO_LEVELS[State.humanLevel] || ELO_LEVELS.intermediate;
                    let uniqueMoves = State.topMoves.filter(function (mv, idx, arr) {
                        return !!mv && arr.indexOf(mv) === idx;
                    });
                    let ourColor = getPlayingAs();
                    let humanFallback = pickHumanFallbackMove(currentFen, uniqueMoves, level, ourColor);
                    if (humanFallback && humanFallback !== finalMove) {
                        finalMove = humanFallback;
                    }
                }
            }

            let fen = getAccurateFen();
            let currentPV = State.mainPVLine;
            let needsRedraw = false;

            if (currentPV.length === 0) {
                State.mainPVLine = [finalMove];
                State.principalVariation = finalMove;
                needsRedraw = true;
            } else if (currentPV[0] !== finalMove) {
                State.statusInfo = "Bestmove changed: " + currentPV[0] + " -> " + finalMove;
                UI.updateStatusInfo();
                State.mainPVLine = [finalMove].concat(currentPV.slice(1));
                State.principalVariation = State.mainPVLine.join(" ");
                needsRedraw = true;
            }

            State.lastRenderedMainPV = "";
            State.lastMainPVDrawTime = 0;

            if (!State.analysisMode && State.showPVArrows && needsRedraw) {
                UI._removePVArrowsByType(false);
                UI.drawPVArrows(State.mainPVLine, State.mainPVTurn, false);
            }

            UI.updatePVDisplay();
            MoveExecutor.recordMove(finalMove);
            State.isThinking = false;

            if (State.autoMovePiece) {
                executeAction(finalMove, fen);
            } else {
                State.statusInfo = "Best: " + finalMove + " (manual mode)";
                UI.updateStatusInfo();
            }
        },

        loadAnalysisEngine: function () {
            let self = this;
            try {
                if (self.analysis) {
                    self.analysis.terminate();
                    self.analysis = null;
                }
                let result = self._createWorker(self.analysisBlobURL);
                if (!result.worker) return false;
                self.analysis = result.worker;
                self.analysisBlobURL = result.blobURL;
                self._analysisLastActivityTs = Date.now();
                self.analysis.onmessage = function (e) {
                    self._onAnalysisMessage(e.data);
                };
                self.analysis.onerror = function () {
                    if (self.analysis && self.analysis._blobURL) {
                        self._revokeBlobURL(self.analysis._blobURL);
                    }
                };
                scheduleManagedTimeout(function () {
                    self.analysis.postMessage("uci");
                    self.analysis.postMessage("setoption name MultiPV value " + clamp(State.numberOfMovesToShow || 5, 2, 10));
                    self.analysis.postMessage("ucinewgame");
                    self.analysis.postMessage("isready");
                }, 100);
                State.statusInfo = "Analysis engine loaded";
                UI.updateStatusInfo();
                return true;
            } catch (e) {
                err("Analysis engine load failed:", e);
                return false;
            }
        },

        _onAnalysisMessage: function (data) {
            if (typeof data !== "string") return;
            this._analysisLastActivityTs = Date.now();
            if (!State.analysisMode) return;

            let currentFen = getAccurateFen();
            if (!currentFen) return;
            if (State._lastAnalysisFen && normalizeFen(currentFen) !== normalizeFen(State._lastAnalysisFen)) {
                State.statusInfo = "FEN changed during analysis, skipping update";
                UI.updateStatusInfo();
                return;
            }

            if (data.indexOf("info") === 0 && data.includes(" pv ")) {
                let tokens = data.split(" ");
                let pvIdx = tokens.indexOf("pv");
                let scoreIdx = tokens.indexOf("score");
                let depthIdx = tokens.indexOf("depth");
                if (pvIdx === -1 || scoreIdx === -1) return;

                let multipvIdx = tokens.indexOf("multipv");
                let multipv = multipvIdx !== -1 ? (parseInt(tokens[multipvIdx + 1], 10) || 1) : 1;
                let maxTrackedMoves = clamp(State.numberOfMovesToShow || 5, 2, 10);

                let currentDepth = depthIdx !== -1 ? (parseInt(tokens[depthIdx + 1]) || 0) : 0;
                if (!State._analysisDepthByPv) State._analysisDepthByPv = {};
                let lastDepth = State._analysisDepthByPv[multipv] || 0;
                if (currentDepth < lastDepth) return;
                State._analysisDepthByPv[multipv] = currentDepth;
                let scoreType = tokens[scoreIdx + 1];
                let scoreValue = parseInt(tokens[scoreIdx + 2]) || 0;

                let rawCp = scoreType === "cp" ? scoreValue :
                scoreType === "mate" ? (scoreValue > 0 ? CONFIG.MATE_VALUE : -CONFIG.MATE_VALUE) : 0;

                let pvMoves = tokens.slice(pvIdx + 1).filter(function (m) {
                    return /^[a-h][1-8][a-h][1-8](?:[qrbn])?$/i.test(m);
                });

                if (pvMoves.length === 0) return;
                let bestMove = pvMoves[0];

                let evalText = "0.00";
                let evalClass = "eval-equal";
                if (scoreType === "cp") {
                    evalText = (rawCp >= 0 ? "+" : "") + (rawCp / 100).toFixed(2);
                    evalClass = rawCp > 30 ? "eval-positive" : rawCp < -30 ? "eval-negative" : "eval-equal";
                } else if (scoreType === "mate") {
                    evalText = (scoreValue > 0 ? "M+" : "M") + scoreValue;
                    evalClass = scoreValue > 0 ? "eval-positive" : "eval-negative";
                }
                State.analysisEvalText = evalText;

                if (multipv >= 1 && multipv <= maxTrackedMoves) {
                    State.topMoves[multipv - 1] = bestMove;
                    State.topMoveInfos[multipv] = {
                        move: bestMove,
                        evalText: evalText,
                        evalClass: evalClass,
                        depth: currentDepth,
                        rawCp: rawCp
                    };
                    UI.updateMove(multipv, bestMove, evalText, evalClass);
                }

                if (multipv === 1) {
                    if (bestMove === State.analysisLastBestMove) {
                        State.analysisStableCount++;
                    } else {
                        State.analysisLastBestMove = bestMove;
                        if (isAnalysisAutoPlayEnabled() && State.analysisStableCount > 1) {
                            State.analysisStableCount = Math.max(1, State.analysisStableCount - 1);
                        } else {
                            State.analysisStableCount = 1;
                        }
                    }

                    if (currentDepth >= (State._lastAnalysisDepth || 0)) {
                        State.analysisPrevEvalCp = State.analysisLastEvalCp;
                        State.analysisLastEvalCp = rawCp;
                    }

                    State.analysisGuardStateText = "Monitoring";
                    UI.updateAnalysisMonitorDisplay();

                    State.statusInfo = "Analysis D" + currentDepth + " | " + bestMove + " | PV: " + pvMoves.slice(0, 3).join(" ");
                    UI.updateStatusInfo();
                    if (currentDepth >= State._lastAnalysisDepth) {
                        State._lastAnalysisDepth = currentDepth;
                        State._lastAnalysisBestPV = pvMoves.slice();
                        State._lastAnalysisBestMove = bestMove;
                    }

                    State.analysisPVLine = pvMoves;
                    State.principalVariation = pvMoves.join(" ");
                    State.currentEvaluation = rawCp;

                    if (State.analysisAcplFen !== currentFen) {
                        let mateVal = scoreType === "mate" ? scoreValue : null;
                        ACPL.onNewEval(rawCp, mateVal);
                        State.analysisAcplFen = currentFen;
                    }

                    UI.updateAnalysisBar(rawCp);
                    UI.clearAll();

                    if (State.highlightEnabled) UI.highlightMove(bestMove, State.highlightColor2, true);
                    if (State.showPVArrows) UI.drawPVArrows(pvMoves, State.analysisPVTurn, true);
                    if (State.showBestmoveArrows) UI.drawBestmoveArrows();
                    UI.updatePVDisplay();
                } else if (State.showBestmoveArrows) {
                    UI.drawBestmoveArrows();
                }
            }

            if (data.indexOf("bestmove") === 0 && State.analysisMode) {
                let bmTokens = data.split(" ");
                let finalBestMove = bmTokens[1];

                if (finalBestMove && finalBestMove !== "(none)") {
                    State.statusInfo = "Analysis: " + finalBestMove;
                    UI.updateStatusInfo();

                    if (State._lastAnalysisBestPV.length > 0 && State._lastAnalysisBestPV[0] === finalBestMove) {
                        State.analysisPVLine = State._lastAnalysisBestPV.slice();
                    } else {
                        State.analysisPVLine = [finalBestMove];
                    }

                    State.principalVariation = State.analysisPVLine.join(" ");
                    State.analysisPVTurn = getCurrentTurn(State._lastAnalysisFen || getAccurateFen());

                    recordAnalysisBestmove(
                        finalBestMove,
                        State.analysisEvalText || State.lastEvalText1 || "0.00",
                        State._lastAnalysisDepth || State.customDepth,
                        State._lastAnalysisFen || getAccurateFen()
                    );

                    UI.clearAll();
                    if (State.showPVArrows) UI.drawPVArrows(State.analysisPVLine, State.analysisPVTurn, true);
                    if (State.showBestmoveArrows) UI.drawBestmoveArrows();
                    if (State.highlightEnabled) UI.highlightMove(finalBestMove, State.highlightColor2, true);
                    UI.updatePVDisplay();

                    if (shouldAutoAnalysisMove(finalBestMove)) {
                        let delay = getCalculatedDelay();
                        State.currentDelayMs = delay;
                        let moveToPlay = finalBestMove;
                        let fenAtDecision = getAccurateFen();
                        scheduleManagedTimeout(function () {
                            if (!State.analysisMode || State.autoAnalysisColor === "none") return;
                            let currentFen = getAccurateFen();
                            if (!currentFen) return;
                            let turn = getCurrentTurn(currentFen);
                            let stillMyTurn = (State.autoAnalysisColor === "white" && turn === "w") ||
                                (State.autoAnalysisColor === "black" && turn === "b");
                            if (!stillMyTurn) return;
                            if (currentFen !== fenAtDecision) return;
                            State.analysisPrevEvalCp = null;
                            State.analysisLastEvalCp = null;
                            State._analysisAutoPlayApproved = false;
                            State._analysisAutoPlayMove = null;
                            MoveExecutor.movePiece(
                                moveToPlay.substring(0, 2),
                                moveToPlay.substring(2, 4),
                                moveToPlay.length > 4 ? moveToPlay.substring(4) : null
                            ).then(function (moved) {
                                if (!moved) log("[Analysis] Auto-play move failed, will retry next cycle");
                            }).catch(function (e) {
                                warn("[Analysis] Auto-play error:", e);
                            });
                        }, delay);
                    }
                }

                State._lastAnalysisDepth = 0;
                State._lastAnalysisBestPV = [];
                State._lastAnalysisBestMove = null;
                State.isAnalysisThinking = false;
                State.statusInfo = "Ready";
                UI.updateStatusInfo();
                UI.updateAnalysisMonitorDisplay();
            }
        },

        loadPremoveEngine: function () {
            let self = this;
            try {

                if (self.premove) {
                    self.premove.terminate();
                    self.premove = null;
                }

                self._premoveProcessedFens.clear();
                self._premoveAttemptedFens.clear();
                self._premoveCandidates = Object.create(null);
                self._premoveProcessing = false;
                self._premoveEngineBusy = false;
                self._premoveLastFen = null;
                self._premoveLastActivityTs = Date.now();
                if (self._premoveTimeoutId) {
                    clearTimeout(self._premoveTimeoutId);
                    self._premoveTimeoutId = null;
                }

                let result = self._createWorker(self.premoveBlobURL);
                if (!result.worker) {
                    err("Failed to create premove worker");
                    return false;
                }

                self.premove = result.worker;
                self.premoveBlobURL = result.blobURL;

                self.premove.onmessage = function (e) {
                    self._onPremoveMessage(e.data);
                };

                self.premove.onerror = function (workerErr) {
                    err("Premove engine error:", workerErr);
                    self._premoveEngineBusy = false;
                    self._premoveProcessing = false;
                    if (self.premove && self.premove._blobURL) {
                        self._revokeBlobURL(self.premove._blobURL);
                    }
                };

                scheduleManagedTimeout(function () {
                    if (!self.premove) return;
                    self.premove.postMessage("uci");
                    self.premove.postMessage("setoption name MultiPV value 2");
                    self.premove.postMessage("ucinewgame");
                    self.premove.postMessage("isready");
                }, 100);

                log("[Engine] Premove engine loaded successfully");
                return true;
            } catch (e) {
                err("Premove engine load failed:", e);
                return false;
            }
        },

        _onPremoveMessage: async function (data) {
            this._premoveLastActivityTs = Date.now();

            if (typeof data !== "string") return;
            if (State.analysisMode) return;

            const currentFen = getAccurateFen();
            if (!currentFen) return;

            const currentFenHash = hashFen(currentFen);

            if (this._premoveProcessedFens.has(currentFenHash)) {
                State.statusInfo = "[Premove] Already processed FEN: " + currentFenHash.substring(0, 30);
                return;
            }

            const game = getGame();
            if (game && isPlayersTurn(game)) {
                this._premoveProcessedFens.add(currentFenHash);
                return;
            }

            if (data.indexOf("info") === 0 && data.includes(" pv ")) {
                if (this._premoveProcessing) return;
                if (!this._premoveEngineBusy) return;

                this._premoveProcessing = true;
                State.premoveAnalysisInProgress = true;

                try {
                    const tokens = data.split(" ");
                    const pvIdx = tokens.indexOf("pv");
                    const scoreIdx = tokens.indexOf("score");

                    if (pvIdx === -1) return;

                    const pvMoves = tokens.slice(pvIdx + 1).filter(m => /^[a-h][1-8][a-h][1-8]/i.test(m));
                    if (pvMoves.length === 0) return;

                    let scoreInfo = null;
                    if (scoreIdx !== -1) {
                        const type = tokens[scoreIdx + 1];
                        const value = parseInt(tokens[scoreIdx + 2]);
                        scoreInfo = {
                            type,
                            value,
                            display: type === 'mate' ? `M${value}` : (value / 100).toFixed(2)
                        };
                        State._lastPremoveScoreInfo = scoreInfo;
                    }

                    const ourColor = getPlayingAs();
                    const stm = getCurrentTurn(currentFen);

                    if (!ourColor || stm === ourColor) return;

                    const ourUci = getOurMoveFromPV(pvMoves.join(" "), ourColor, stm);
                    if (!ourUci) return;

                    if (this._premoveProcessedFens.has(currentFenHash)) return;

                    const multiPvIdx = tokens.indexOf("multipv");
                    const multiPv = multiPvIdx !== -1 ? (parseInt(tokens[multiPvIdx + 1], 10) || 1) : 1;
                    const candidateBucket = this._premoveCandidates[currentFenHash] || [];

                    const existingCandidateIdx = candidateBucket.findIndex(c => c.multiPv === multiPv);
                    const candidatePayload = {
                        multiPv: multiPv,
                        ourUci: ourUci,
                        pvMoves: pvMoves.slice(0, 6),
                        scoreInfo: scoreInfo
                    };
                    if (existingCandidateIdx >= 0) candidateBucket[existingCandidateIdx] = candidatePayload;
                    else candidateBucket.push(candidatePayload);
                    this._premoveCandidates[currentFenHash] = candidateBucket;

                    let selectedMove = ourUci;
                    let selectedDecision = null;
                    let selectedCandidate = null;
                    const rankedCandidates = candidateBucket.slice().sort((a, b) => a.multiPv - b.multiPv).slice(0, 2);

                    for (let ci = 0; ci < rankedCandidates.length; ci++) {
                        const candidate = rankedCandidates[ci];
                        const decision = SmartPremove.shouldPremove(currentFen, candidate.ourUci, candidate.pvMoves, candidate.scoreInfo);
                        if (!selectedDecision || (decision.allowed && (!selectedDecision.allowed || (decision.confidence || 0) > (selectedDecision.confidence || 0)))) {
                            selectedDecision = decision;
                            selectedMove = candidate.ourUci;
                            selectedCandidate = candidate;
                        }
                    }

                    const decision = selectedDecision || SmartPremove.shouldPremove(currentFen, ourUci, pvMoves, scoreInfo);
                    const finalScoreInfo = selectedCandidate ? selectedCandidate.scoreInfo : scoreInfo;

                    let confidence = Math.round(decision.confidence || 0);
                    let requiredConfidence = Math.round((decision.required !== undefined && decision.required !== null) ? decision.required : ((SmartPremove.AGGRESSION_CONFIG[State.premoveMode] || SmartPremove.AGGRESSION_CONFIG.every).minConfidence || 0));
                    State.premoveLiveChance = clamp(confidence, 0, 100);
                    State.premoveTargetChance = clamp(requiredConfidence, 0, 100);
                    State.premoveLastEvalDisplay = finalScoreInfo ? String(finalScoreInfo.display || "-") : "-";
                    State.premoveLastMoveDisplay = selectedMove ? String(selectedMove).toUpperCase() : "-";
                    State.premoveChanceReason = decision.allowed ? "Ready" : (decision.reason || "Blocked");
                    State.premoveChanceUpdatedTs = Date.now();
                    UI.updatePremoveChanceDisplay();

                    const firstAttemptForFen = !this._premoveAttemptedFens.has(currentFenHash);
                    if (firstAttemptForFen) {
                        this._premoveAttemptedFens.add(currentFenHash);
                        State.premoveStats.attempted++;
                    }

                    if (decision.allowed) {
                        if (firstAttemptForFen) State.premoveStats.allowed++;
                        this._premoveProcessedFens.add(currentFenHash);

                        const MAX_ENGINE_CACHE = Math.min(10, CONFIG.PREMOVE.MAX_EXECUTED_FENS || 50);
                        if (this._premoveProcessedFens.size > MAX_ENGINE_CACHE) {
                            const toDelete = this._premoveProcessedFens.size - Math.floor(MAX_ENGINE_CACHE * 0.6);
                            for (let i = 0; i < toDelete; i++) {
                                const iter = this._premoveProcessedFens.values();
                                const first = iter.next().value;
                                if (first) this._premoveProcessedFens.delete(first);
                            }
                        }

                        let success = await SmartPremove.execute(currentFen, selectedMove, decision);
                        if (!success) {
                            this._premoveProcessedFens.delete(currentFenHash);
                            State.premoveStats.failed++;
                        } else {
                            State.premoveStats.executed++;
                        }
                        UI.updatePremoveStatsDisplay();
                    } else {
                        if (firstAttemptForFen) State.premoveStats.blocked++;
                        State.statusInfo = `Premove: ${decision.reason}`;
                        UI.updateStatusInfo();
                        UI.updatePremoveStatsDisplay();
                        this._premoveProcessedFens.add(currentFenHash);
                    }
                } catch (e) {
                    err("[Engine] _onPremoveMessage loop error:", e);
                } finally {
                    this._premoveProcessing = false;
                    State.premoveAnalysisInProgress = false;
                }
            }

            if (data.indexOf("bestmove") === 0) {
                this._premoveEngineBusy = false;
                if (this._premoveTimeoutId) {
                    clearTimeout(this._premoveTimeoutId);
                    this._premoveTimeoutId = null;
                }

                const tokens = data.split(" ");
                const bestMove = tokens[1];
                if (!bestMove || bestMove === "(none)") return;

                if (!this._premoveProcessedFens.has(currentFenHash)) {
                    State.statusInfo = "[Premove] Got bestmove but no execution yet, waiting for PV...";
                }
            }
        },

        resetPremoveState: function () {
            log("[Engine] Resetting premove state");
            this._premoveProcessedFens.clear();
            this._premoveAttemptedFens.clear();
            this._premoveCandidates = Object.create(null);
            this._premoveProcessing = false;
            this._premoveEngineBusy = false;
            this._premoveLastFen = null;
            this._premoveLastActivityTs = Date.now();
            if (this._premoveTimeoutId) {
                clearTimeout(this._premoveTimeoutId);
                this._premoveTimeoutId = null;
            }
            if (this.premove) {
                this.premove.postMessage("stop");
                this.premove.postMessage("ucinewgame");
            }
        },

        selfHealPremove: function (reason) {
            warn("[Engine] Self-healing premove:", reason || "unknown");
            try {
                if (this._premoveTimeoutId) {
                    clearTimeout(this._premoveTimeoutId);
                    this._premoveTimeoutId = null;
                }

                if (this.premove) {
                    try {
                        this.premove.terminate();
                    } catch (e) { }
                    this.premove = null;
                }

                this._premoveProcessing = false;
                this._premoveEngineBusy = false;
                this._premoveLastFen = null;
                this._premoveLastActivityTs = Date.now();
                State.premoveAnalysisInProgress = false;

                this.loadPremoveEngine();
            } catch (e) {
                err("[Engine] selfHealPremove failed:", e);
            }
        },

        selfHealMain: function (reason) {
            warn("[Engine] Self-healing main:", reason || "unknown");
            try {
                this.stop();
                this._ready = false;
                this._mainLastActivityTs = Date.now();

                if (this.main) {
                    try {
                        this.main.terminate();
                    } catch (e) { }
                    this.main = null;
                }

                this.loadMainEngine().then(function (ok) {
                    if (!ok) {
                        err("[Engine] selfHealMain reload failed");
                    }
                });
            } catch (e) {
                err("[Engine] selfHealMain failed:", e);
            }
        },

        selfHealAnalysis: function (reason) {
            warn("[Engine] Self-healing analysis:", reason || "unknown");
            try {
                State.isAnalysisThinking = false;
                this._analysisLastActivityTs = Date.now();

                if (this.analysis) {
                    try {
                        this.analysis.terminate();
                    } catch (e) { }
                    this.analysis = null;
                }

                if (State.analysisMode) {
                    const ok = this.loadAnalysisEngine();
                    if (!ok) {
                        err("[Engine] selfHealAnalysis reload failed");
                        return;
                    }
                    State._lastAnalysisFen = null;
                }
            } catch (e) {
                err("[Engine] selfHealAnalysis failed:", e);
            }
        },

        reloadAllEngines: function () {
            let self = this;

            return new Promise(function (resolve) {
                console.log("[Engine] 🔄 Starting full reload sequence...");

                self.stop();
                if (self.analysis) self.analysis.postMessage("stop");
                if (self.premove) self.premove.postMessage("stop");

                scheduleManagedTimeout(function () {

                    self._terminateAllWorkers();

                    self._revokeAllBlobURLs();

                    self._resetAllEngineState();

                    console.log("[Engine] Re-initializing main engine...");
                    self.init().then(function (mainOk) {
                        if (!mainOk) {
                            console.error("[Engine] ❌ Main engine failed");
                            resolve(false);
                            return;
                        }
                        console.log("[Engine] ✅ Main engine ready");

                        if (State.analysisMode) {
                            console.log("[Engine] Loading analysis engine...");
                            let analysisOk = self.loadAnalysisEngine();
                            console.log("[Engine]", analysisOk ? "✅ Analysis ready" : "❌ Analysis failed");
                        }

                        if (State.premoveEnabled) {
                            console.log("[Engine] Loading premove engine...");
                            let premoveOk = self.loadPremoveEngine();
                            console.log("[Engine]", premoveOk ? "✅ Premove ready" : "❌ Premove failed");
                        }

                        let led = $("#engine-status-led");
                        if (led && self._ready) led.classList.add("active");

                        console.log("[Engine] 🎉 Full reload complete!");
                        resolve(true);
                    });
                }, 500);
            });
        },

        _terminateAllWorkers: function () {
            console.log("[Engine] Terminating workers...");

            [this.main, this.analysis, this.premove].forEach(function (worker, idx) {
                if (worker) {
                    try {
                        worker.terminate();
                        console.log("[Engine] Terminated:", ["Main", "Analysis", "Premove"][idx]);
                    } catch (e) {
                        console.warn("[Engine] Error terminating:", e);
                    }
                }
            });

            this.main = null;
            this.analysis = null;
            this.premove = null;
            this._ready = false;
        },

        _revokeAllBlobURLs: function () {
            console.log("[Engine] Revoking blob URLs...");

            let self = this;
            [this.mainBlobURL, this.analysisBlobURL, this.premoveBlobURL].forEach(function (url, idx) {
                if (url) {
                    self._revokeBlobURL(url);
                    console.log("[Engine] Revoked:", ["Main", "Analysis", "Premove"][idx]);
                }
            });

            this._revokeAllActiveBlobURLs();

            this.mainBlobURL = null;
            this.analysisBlobURL = null;
            this.premoveBlobURL = null;
        },

        _resetAllEngineState: function () {
            console.log("[Engine] Resetting state...");

            this._premoveEngineBusy = false;
            this._premoveProcessing = false;
            this._premoveProcessedFens.clear();
            this._premoveAttemptedFens.clear();
            this._premoveCandidates = Object.create(null);
            this._premoveLastFen = null;
            this._premoveLastActivityTs = Date.now();

            if (this._premoveTimeoutId) {
                clearTimeout(this._premoveTimeoutId);
                this._premoveTimeoutId = null;
            }

            SmartPremove.resetExecutionTracking();

            clearPremoveCaches();

            State.isThinking = false;
            State.isAnalysisThinking = false;
            State.premoveAnalysisInProgress = false;
            State.premoveExecutedForFen = null;
            State.statusInfo = "Engines reset";
            UI.updateStatusInfo();
        },

        terminate: function () {
            let self = this;
            let urls = [this.mainBlobURL, this.analysisBlobURL, this.premoveBlobURL];
            urls.forEach(function (url) {
                if (url) {
                    self._revokeBlobURL(url);
                }
            });
            this._revokeAllActiveBlobURLs();
            this.mainBlobURL = null;
            this.analysisBlobURL = null;
            this.premoveBlobURL = null;

            if (this.main) {
                this.main.terminate();
                this.main = null;
            }
            if (this.analysis) {
                this.analysis.terminate();
                this.analysis = null;
            }
            if (this.premove) {
                this.premove.terminate();
                this.premove = null;
            }

            this._premoveProcessedFens.clear();
            this._premoveAttemptedFens.clear();
            this._premoveCandidates = Object.create(null);
            this._premoveProcessing = false;
            this._premoveEngineBusy = false;
        }
    };

    // =====================================================
    // Section 30: Engine Module Facade
    // =====================================================
    Engine.Modules = {
        Lifecycle: {
            init: Engine.init.bind(Engine),
            terminate: Engine.terminate.bind(Engine),
            reloadAll: Engine.reloadAllEngines.bind(Engine),
            resetPremoveState: Engine.resetPremoveState.bind(Engine)
        },
        Workers: {
            loadMain: Engine.loadMainEngine.bind(Engine),
            loadAnalysis: Engine.loadAnalysisEngine.bind(Engine),
            loadPremove: Engine.loadPremoveEngine.bind(Engine),
            createWorker: Engine._createWorker.bind(Engine)
        },
        Runtime: {
            go: Engine.go.bind(Engine),
            stop: Engine.stop.bind(Engine),
            onMainMessage: Engine._onMainMessage.bind(Engine),
            onAnalysisMessage: Engine._onAnalysisMessage.bind(Engine),
            onPremoveMessage: Engine._onPremoveMessage.bind(Engine)
        },
        Recovery: {
            selfHealMain: Engine.selfHealMain.bind(Engine),
            selfHealAnalysis: Engine.selfHealAnalysis.bind(Engine),
            selfHealPremove: Engine.selfHealPremove.bind(Engine)
        },
        Config: {
            setElo: Engine.setElo.bind(Engine),
            setFullStrength: Engine.setFullStrength.bind(Engine),
            setSkillLevel: Engine.setSkillLevel.bind(Engine),
            configureMain: Engine._configureMainEngine.bind(Engine)
        }
    };

    function isHumanCriticalPosition(fen, ourColor) {
        if (!fen || !ourColor) return false;

        let oppColor = ourColor === "w" ? "b" : "w";
        let ourKing = findKing(fen, ourColor);
        if (ourKing) {
            let kingAttackers = getAttackersOfSquare(fen, ourKing, oppColor).length;
            if (kingAttackers >= (CONFIG.HUMAN.CRITICAL_KING_ATTACKERS || 1)) {
                return true;
            }
        }

        let score = State._lastScoreInfo;
        if (score && score.type === "mate" && score.value < 0 && Math.abs(score.value) <= (CONFIG.HUMAN.CRITICAL_MATE_PLY || 8)) {
            return true;
        }
        if (score && score.type === "cp" && score.value <= (CONFIG.HUMAN.CRITICAL_CP_THRESHOLD || -120)) {
            return true;
        }

        return false;
    }

    function getHumanLevelTuning(levelName) {
        let tunings = (CONFIG.HUMAN && CONFIG.HUMAN.LEVEL_TUNING) ? CONFIG.HUMAN.LEVEL_TUNING : null;
        if (!tunings) {
            return { errorMult: 1, blunderMult: 1, criticalErrorMult: 0.55, criticalBlunderMult: 0.20, safetyRiskCap: 60 };
        }
        return tunings[levelName] || tunings.intermediate ||
            { errorMult: 1, blunderMult: 1, criticalErrorMult: 0.55, criticalBlunderMult: 0.20, safetyRiskCap: 60 };
    }

    function filterHumanCandidatesBySafety(fen, candidates, ourColor, riskCap) {
        if (!fen || !ourColor || !Array.isArray(candidates)) return [];
        let cap = typeof riskCap === "number" ? riskCap : 60;

        return candidates.filter(function (mv) {
            let safety = checkPremoveSafety(fen, mv, ourColor);
            return safety && safety.riskLevel < cap;
        });
    }

    function pickHumanFallbackMove(fen, uniqueMoves, level, ourColor) {
        if (!Array.isArray(uniqueMoves) || uniqueMoves.length < 2) return null;

        let critical = isHumanCriticalPosition(fen, ourColor);
        let tuning = getHumanLevelTuning(State.humanLevel || "intermediate");
        let errorRate = clamp((level.errorRate || 0) * (tuning.errorMult || 1), 0, 1);
        let blunderRate = clamp((level.blunderRate || 0) * (tuning.blunderMult || 1), 0, 1);
        let safetyRiskCap = clamp(tuning.safetyRiskCap || 60, 30, 90);
        let debug = !!(CONFIG.HUMAN && CONFIG.HUMAN.DEBUG_DECISION);
        let selected = null;

        if (critical) {
            errorRate = clamp(errorRate * (tuning.criticalErrorMult || 0.55), 0, 1);
            blunderRate = clamp(blunderRate * (tuning.criticalBlunderMult || 0.20), 0, 1);
        }

        let softCandidates = uniqueMoves.slice(1, Math.min(3, uniqueMoves.length));
        let blunderCandidates = uniqueMoves.slice(3);
        if (blunderCandidates.length === 0 && uniqueMoves[2]) {
            blunderCandidates = [uniqueMoves[2]];
        }

        if (critical) {
            let safeSoft = filterHumanCandidatesBySafety(fen, softCandidates, ourColor, safetyRiskCap);
            if (safeSoft.length > 0) softCandidates = safeSoft;

            let safeBlunders = filterHumanCandidatesBySafety(fen, blunderCandidates, ourColor, safetyRiskCap);
            if (safeBlunders.length > 0) blunderCandidates = safeBlunders;
        } else if (State.humanLevel === "advanced" || State.humanLevel === "expert") {
            let saferBlunders = filterHumanCandidatesBySafety(fen, blunderCandidates, ourColor, safetyRiskCap);
            if (saferBlunders.length > 0) blunderCandidates = saferBlunders;
        }

        if (blunderCandidates.length > 0 && Math.random() < blunderRate) {
            selected = blunderCandidates[randomInt(0, blunderCandidates.length - 1)];
            if (debug) {
                log("[HumanMode] blunder pick", selected, "critical=", critical, "level=", State.humanLevel,
                    "blunderRate=", blunderRate.toFixed(3), "riskCap=", safetyRiskCap);
            }
            return selected;
        }

        if (softCandidates.length > 0 && Math.random() < errorRate) {
            selected = softCandidates[randomInt(0, softCandidates.length - 1)];
            if (debug) {
                log("[HumanMode] soft pick", selected, "critical=", critical, "level=", State.humanLevel,
                    "errorRate=", errorRate.toFixed(3), "riskCap=", safetyRiskCap);
            }
            return selected;
        }

        if (debug) {
            log("[HumanMode] keep best", uniqueMoves[0], "critical=", critical,
                "level=", State.humanLevel,
                "errorRate=", errorRate.toFixed(3), "blunderRate=", blunderRate.toFixed(3),
                "riskCap=", safetyRiskCap);
        }

        return null;
    }

    // =====================================================
    // Section 31: Auto Analysis Functions
    // =====================================================
    function shouldAutoAnalysisMove(bestMoveCandidate) {
        if (!State.analysisMode || State.autoAnalysisColor === "none") return false;

        if (State._analysisAutoPlayApproved && State._analysisAutoPlayMove === bestMoveCandidate) {
            State._analysisAutoPlayApproved = false;
            State._analysisAutoPlayMove = null;
            State.analysisGuardStateText = "Guard OK (approved)";
            UI.updateAnalysisMonitorDisplay();
            return true;
        }

        let fen = getAccurateFen();
        if (!fen) return false;
        let turn = getCurrentTurn(fen);
        let colorMatch = (State.autoAnalysisColor === "white" && turn === "w") ||
            (State.autoAnalysisColor === "black" && turn === "b");
        if (!colorMatch) return false;

        let requiredStable = State.analysisMinStableUpdates || 2;
        if (State.analysisStableCount < requiredStable) {
            State.analysisGuardStateText = "Stability " + State.analysisStableCount + "/" + requiredStable;
            UI.updateAnalysisMonitorDisplay();
            return false;
        }

        if (bestMoveCandidate && State.analysisLastBestMove && bestMoveCandidate !== State.analysisLastBestMove) {
            State.analysisGuardStateText = "Bestmove changed";
            UI.updateAnalysisMonitorDisplay();
            return false;
        }

        if (State.analysisBlunderGuard &&
            typeof State.analysisPrevEvalCp === "number" &&
            typeof State.analysisLastEvalCp === "number" &&
            State._lastAnalysisDepth >= 8) {

            let evalDrop = State.analysisLastEvalCp - State.analysisPrevEvalCp;
            if (evalDrop < -300) {
                State.analysisGuardStateText = "Blunder guard (" + evalDrop + "cp)";
                UI.updateAnalysisMonitorDisplay();
                log("[AnalysisGuard] Eval drop " + evalDrop + "cp, blocking move");
                return false;
            }
        }

        State._analysisAutoPlayApproved = true;
        State._analysisAutoPlayMove = bestMoveCandidate;

        State.analysisGuardStateText = "Guard OK";
        UI.updateAnalysisMonitorDisplay();
        return true;
    }

    function getMainConsensusMove(fallbackMove) {
        if (!State.useMainConsensus) return fallbackMove;
        let history = State.mainBestHistory || [];
        if (!history.length) return fallbackMove;

        let recent = history.slice(-6).filter(function (h) { return h.depth >= 8; });
        if (recent.length < 3) return fallbackMove;

        let counts = Object.create(null);
        recent.forEach(function (h) {
            counts[h.move] = (counts[h.move] || 0) + 1;
        });

        let best = fallbackMove;
        let bestCount = 0;
        Object.keys(counts).forEach(function (mv) {
            if (counts[mv] > bestCount) {
                best = mv;
                bestCount = counts[mv];
            }
        });

        if (best && bestCount >= 3 && best !== fallbackMove) {
            State.statusInfo = "Consensus move selected: " + best + " (" + bestCount + "/" + recent.length + ")";
            UI.updateStatusInfo();
            return best;
        }

        return fallbackMove;
    }

    // =====================================================
    // Section 32: Stealth Move Executor
    // =====================================================
    let MoveExecutor = {
        _squareCache: new Map(),

        recordMove: function (moveStr) {
            if (!moveStr || moveStr.length < 4) return;
            let from = moveStr.substring(0, 2);
            let to = moveStr.substring(2, 4);
            UI.highlightBestMove(from, to);

            let currentMoveTime = null;
            if (State.moveStartTime && State.moveStartTime > 0) {
                currentMoveTime = Date.now() - State.moveStartTime;
                State.moveStartTime = 0;
            } else if (TimeManager.moveTimes && TimeManager.moveTimes.length > 0) {
                currentMoveTime = TimeManager.moveTimes[TimeManager.moveTimes.length - 1];
            } else if (State.currentDelayMs && State.currentDelayMs > 0) {
                currentMoveTime = State.currentDelayMs;
            }

            MoveHistory.add(moveStr, State.lastEvalText1, State.customDepth, State.lastMoveGrade, currentMoveTime);
        },

        movePiece: function (from, to, promotion, isPremove) {
            let self = this;
            promotion = promotion || "q";
            let beforeFen = getAccurateFen();

            let isPromo = self._isPromotion(from, to, beforeFen);
            if (isPromo) return self._handlePromotionOld(from, to, beforeFen, isPremove);

            if (State.moveExecutionMode === "drag" && !isPremove) {
                return self._executeHumanizedMove(from, to, beforeFen);
            } else {
                return self._clickMoveClassic(from, to, beforeFen, isPremove);
            }
        },

        _clickMoveClassic: function (from, to, beforeFen, isPremove) {
            let self = this;
            let fromCenter = self._getSquareXY(from, true);
            let toCenter = self._getSquareXY(to, true);

            if (!fromCenter || !toCenter) {
                console.error("[ChessAssistant] Cannot get square coordinates:", from, to);
                return Promise.resolve(false);
            }

            let board = getBoardElement();
            if (!board) return Promise.resolve(false);

            this._squareCache.clear();

            return self._dispatchAt(fromCenter, "pointerdown", board)
                .then(() => sleep(20))
                .then(() => self._dispatchAt(fromCenter, "pointerup", board))
                .then(() => sleep(50))
                .then(() => self._dispatchAt(toCenter, "pointerdown", board))
                .then(() => sleep(20))
                .then(() => self._dispatchAt(toCenter, "pointerup", board))
                .then(() => true)
                .catch(function (e) {
                warn("Click strategy failed:", e);
                return false;
            }).then(function (success) {
                if (!success) return false;
                if (isPremove) return true;
                return self._waitFenChange(beforeFen, 1500);
            });
        },

        _executeHumanizedMove: function (from, to, beforeFen) {
            let self = this;
            let moveDuration = self._calculateMoveDuration(from, to);
            let steps = self._generateBezierPath(from, to, moveDuration);
            self._squareCache.clear();

            let board = getBoardElement();
            let startRect = board ? board.getBoundingClientRect() : null;
            let startFlipped = isBoardFlipped();
            let rectSig = startRect ? [startRect.left, startRect.top, startRect.width, startRect.height, startFlipped].join("|") : "";

            self._dragToken = (self._dragToken || 0) + 1;
            const dragToken = self._dragToken;

            function boardChanged() {
                let b = getBoardElement();
                if (!b) return false;
                let r = b.getBoundingClientRect();
                let sig = [r.left, r.top, r.width, r.height, isBoardFlipped()].join("|");
                if (sig !== rectSig) {
                    rectSig = sig;
                    return true;
                }
                return false;
            }

            return new Promise(function (resolve) {
                let stepIndex = 0;

                function nextStep() {
                    if (self._dragToken !== dragToken) {
                        resolve(false);
                        return;
                    }

                    if (boardChanged()) {
                        moveDuration = Math.max(220, Math.floor(moveDuration * 0.75));
                        steps = self._generateBezierPath(from, to, moveDuration);
                        stepIndex = 0;
                    }

                    if (stepIndex >= steps.length) {
                        scheduleManagedTimeout(function () {
                            if (self._dragToken !== dragToken) {
                                resolve(false);
                                return;
                            }
                            self._dispatchAt(steps[steps.length - 1], "pointerup")
                                .then(() => resolve(true))
                                .catch(() => resolve(false));
                        }, randomInt(250, 500));
                        return;
                    }

                    let point = steps[stepIndex];
                    let eventType = stepIndex === 0 ? "pointerdown" :
                    stepIndex === steps.length - 1 ? "pointerup" : "pointermove";

                    self._dispatchAt(point, eventType).then(function () {
                        stepIndex++;

                        let delay = Math.floor(moveDuration / steps.length);
                        delay = Math.max(15, Math.min(40, delay));

                        scheduleManagedTimeout(nextStep, delay);
                    }).catch(function () {
                        resolve(false);
                    });
                }
                nextStep();
            }).then(function (success) {
                if (!success) return false;
                return self._waitFenChange(beforeFen, 1500);
            });
        },

        _calculateMoveDuration: function (from, to) {
            let fromFile = from.charCodeAt(0) - 97;
            let fromRank = parseInt(from[1]);
            let toFile = to.charCodeAt(0) - 97;
            let toRank = parseInt(to[1]);

            let distance = Math.sqrt(Math.pow(toFile - fromFile, 2) + Math.pow(toRank - fromRank, 2));

            let baseDuration = 200 + (distance * 100);
            let variance = (Math.random() - 0.5) * 80;

            if (TimeManager.isTimePressure) baseDuration *= 0.75;

            return Math.max(120, Math.min(1200, baseDuration + variance));
        },

        _generateBezierPath: function (from, to, duration) {
            let fromXY = this._getSquareXY(from);
            let toXY = this._getSquareXY(to);
            if (!fromXY || !toXY) return [fromXY, toXY];

            let midX = (fromXY.x + toXY.x) / 2 + (Math.random() - 0.5) * 20;
            let midY = (fromXY.y + toXY.y) / 2 + (Math.random() - 0.5) * 20;

            let points = [];
            let steps = Math.min(40, Math.max(3, Math.floor(duration / 20)));

            for (let i = 0; i <= steps; i++) {
                let t = i / steps;
                t = t * t * (3 - 2 * t);

                let x = (1 - t) * (1 - t) * fromXY.x + 2 * (1 - t) * t * midX + t * t * toXY.x;
                let y = (1 - t) * (1 - t) * fromXY.y + 2 * (1 - t) * t * midY + t * t * toXY.y;

                x += (Math.random() - 0.5) * 0.5;
                y += (Math.random() - 0.5) * 0.5;

                points.push({ x, y });
            }
            return points;
        },

        _clickMove: function (from, to, promotion, isPremove) {
            let beforeFen = getAccurateFen();
            if (this._isPromotion(from, to, beforeFen)) {
                return this._handlePromotionOld(from, to, beforeFen, isPremove);
            }
            return this._clickMoveClassic(from, to, beforeFen, isPremove);
        },

        _dispatchAt: function (pos, type, fallbackEl) {
            return new Promise(function (resolve) {
                if (!pos || typeof pos.x !== 'number' || typeof pos.y !== 'number') {
                    resolve(); return;
                }

                let el = document.elementFromPoint(pos.x, pos.y) || fallbackEl;
                if (!el) { resolve(); return; }

                let board = getBoardElement();
                let isBoardChild = board && (el === board || board.contains(el));
                let isBoardParent = board && el.contains && el.contains(board);

                if (!isBoardChild && !isBoardParent) {
                    resolve(); return;
                }

                if (el.closest && (el.closest('#chess-assist-panel') || el.closest('.cap-overlay'))) {
                    resolve(); return;
                }

                let isDown = type.includes("down");
                let isUp = type.includes("up");
                let isMove = type.includes("move");

                let options = {
                    bubbles: true,
                    cancelable: true,
                    composed: true,
                    clientX: pos.x,
                    clientY: pos.y,
                    button: 0,
                    buttons: (isDown || isMove) ? 1 : 0,
                    pointerId: 1,
                    pointerType: "mouse",
                    isPrimary: true,
                    pressure: isDown ? 0.5 : (isMove ? 0.3 : 0),
                    detail: 1
                };

                try {
                    if (typeof PointerEvent === 'function') {
                        if (isDown) {
                            el.dispatchEvent(new PointerEvent("pointerover", options));
                            el.dispatchEvent(new PointerEvent("pointerenter", options));
                        }
                        el.dispatchEvent(new PointerEvent(type, options));
                    }
                    if (isDown) {
                        el.dispatchEvent(new MouseEvent("mousedown", options));
                    } else if (isUp) {
                        el.dispatchEvent(new MouseEvent("mouseup", options));
                        el.dispatchEvent(new MouseEvent("click", options));
                    } else if (isMove) {
                        el.dispatchEvent(new MouseEvent("mousemove", options));
                    }
                } catch (e) {
                }
                resolve();
            });
        },

        _getSquareXY: function (square, addOffset) {
            let board = getBoardElement();
            if (!board) return null;

            let useCache = addOffset !== false;
            let cacheKey = square + (isBoardFlipped() ? "_f" : "_n");
            if (useCache && this._squareCache.has(cacheKey)) return this._squareCache.get(cacheKey);

            let rect = board.getBoundingClientRect();
            let file = square.charCodeAt(0) - 97;
            let rank = parseInt(square.charAt(1)) - 1;

            let flipped = isBoardFlipped();
            let squareSize = rect.width / 8;

            let xIdx, yIdx;
            if (flipped) {
                xIdx = 7 - file;
                yIdx = rank;
            } else {
                xIdx = file;
                yIdx = 7 - rank;
            }

            let offsetX = 0, offsetY = 0;
            if (addOffset !== false) {
                offsetX = (Math.random() - 0.5) * squareSize * 0.6;
                offsetY = (Math.random() - 0.5) * squareSize * 0.6;
            }

            let result = {
                x: rect.left + (xIdx + 0.5) * squareSize + offsetX,
                y: rect.top + (yIdx + 0.5) * squareSize + offsetY
            };

            if (useCache) this._squareCache.set(cacheKey, result);
            return result;
        },

        _waitFenChange: function (prevFen, timeout) {
            let start = Date.now();
            let check = function () {
                if (Date.now() - start >= timeout) return Promise.resolve(false);
                let current = getAccurateFen();
                if (current !== prevFen) return Promise.resolve(true);
                return sleep(50).then(check);
            };
            return check();
        },

        _handlePromotionOld: async function (from, to, beforeFen, isPremove) {
            let self = this;
            let moved = await self._clickMoveClassic(from, to, beforeFen, true);
            if (!moved) return false;
            let promoDetected = false;
            for (let i = 0; i < 30; i++) {
                let found =
                    document.querySelector(".promotion-piece") ||
                    document.querySelector("[data-cy='promotion-queen']") ||
                    document.querySelector(".promotion-window") ||
                    document.querySelector("[class*='promotion']");
                if (found) {
                    promoDetected = true;
                    break;
                }
                await sleep(50);
            }
            if (promoDetected) {
                let promoted = await self._handlePromotionDialog();
                if (!promoted) return false;
            }
            if (isPremove) return true;
            return self._waitFenChange(beforeFen, 2500);
        },

        _isPromotion: function (from, to, fen) {
            if (!fen) return false;
            let piece = this._getPieceAt(from, fen);
            if (!piece) return false;
            let rankTo = parseInt(to.charAt(1));
            return (piece === "P" && rankTo === 8) || (piece === "p" && rankTo === 1);
        },

        _getPieceAt: function (square, fen) {
            if (!fen || !square) return null;
            let rows = fen.split(" ")[0].split("/");
            let file = square.charCodeAt(0) - 97;
            let rank = 8 - parseInt(square.charAt(1));
            if (rank < 0 || rank > 7 || file < 0 || file > 7) return null;
            let col = 0;
            for (let i = 0; i < rows[rank].length; i++) {
                let ch = rows[rank][i];
                if (/\d/.test(ch)) {
                    col += parseInt(ch);
                } else {
                    if (col === file) return ch;
                    col++;
                }
            }
            return null;
        },

        _handlePromotionDialog: async function () {
            for (let attempt = 0; attempt < 40; attempt++) {
                let queenBtn =
                    document.querySelector('[data-cy="promotion-queen"]') ||
                    document.querySelector('.promotion-piece.wq') ||
                    document.querySelector('.promotion-piece.bq') ||
                    document.querySelector('[data-piece="q"]');
                if (queenBtn) {
                    let rect = queenBtn.getBoundingClientRect();
                    let x = rect.left + rect.width / 2;
                    let y = rect.top + rect.height / 2;
                    let opts = {
                        bubbles: true,
                        cancelable: true,
                        clientX: x,
                        clientY: y,
                        button: 0
                    };
                    queenBtn.dispatchEvent(new PointerEvent("pointerdown", opts));
                    queenBtn.dispatchEvent(new MouseEvent("mousedown", opts));
                    queenBtn.dispatchEvent(new PointerEvent("pointerup", opts));
                    queenBtn.dispatchEvent(new MouseEvent("mouseup", opts));
                    queenBtn.dispatchEvent(new MouseEvent("click", opts));
                    return true;
                }
                await sleep(50);
            }
            return false;
        },
    };

    // =====================================================
    // Section 33: Auto Move Execution
    // =====================================================
    function executeAction(selectedUci, analysisFen) {
        if (!selectedUci || selectedUci.length < 4) return;
        let from = selectedUci.substring(0, 2);
        let to = selectedUci.substring(2, 4);
        let promotionChar = selectedUci.length >= 5 ? selectedUci[4] : null;

        if (!State.autoMovePiece) return;

        let game = getGame();
        if (!game || !isPlayersTurn(game)) {
            State.statusInfo = "Waiting for opponent";
            UI.updateStatusInfo();
            return;
        }

        cancelPendingMove();

        let Delay = getCalculatedDelay();
        State.moveStartTime = Date.now();
        State.statusInfo = "Moving in " + (Delay / 1000).toFixed(1) + "s";
        UI.updateStatusInfo();

        pendingMoveTimeoutId = scheduleManagedTimeout(function () {
            pendingMoveTimeoutId = null;
            if (!_allLoopsActive) return;
            let freshGame = getGameController();
            if (!freshGame || !isPlayersTurn(freshGame)) {
                State.moveExecutionInProgress = false;
                State.statusInfo = "Move canceled (not our turn)";
                UI.updateStatusInfo();
                return;
            }
            let currentFen = getAccurateFen();
            if (currentFen !== analysisFen) {
                State.moveExecutionInProgress = false;
                State.statusInfo = "Move canceled (position changed)";
                UI.updateStatusInfo();
                return;
            }
            State.moveExecutionInProgress = true;
            State.statusInfo = "Making move...";
            UI.updateStatusInfo();
            MoveExecutor.movePiece(from, to, promotionChar, false).then(function (success) {
                State.moveExecutionInProgress = false;
                State.statusInfo = success ? "Move made!" : "Move failed";
                UI.updateStatusInfo();
                if (!success) {
                    scheduleManagedTimeout(function () {
                        if (State.autoRun && isPlayersTurn(getGame())) runEngineNow();
                    }, 800);
                }
            }).catch(function () {
                State.moveExecutionInProgress = false;
            });
        }, Delay);
    }

    // =====================================================
    // Section 34: ACPL Tracking
    // =====================================================
    let ACPL = {
        onNewEval: function (newCp, mateVal) {
            if (!State.acplInitialized) {
                State.previousEvaluation = newCp;
                State.acplInitialized = true;
                return;
            }
            let fen = getAccurateFen();
            if (!fen) return;
            let turnToMove = getCurrentTurn(fen);
            let whoJustMoved = turnToMove === "w" ? "b" : "w";
            let cpl = 0;
            if (whoJustMoved === "w") {
                cpl = Math.max(0, State.previousEvaluation - newCp);
            } else {
                cpl = Math.max(0, newCp - State.previousEvaluation);
            }
            State.lastMoveGrade = this._grade(cpl, mateVal !== null);
            let prevIsMate = Math.abs(State.previousEvaluation) >= CONFIG.MATE_VALUE;
            let curIsMate = Math.abs(newCp) >= CONFIG.MATE_VALUE;
            if (!prevIsMate && !curIsMate) {
                if (whoJustMoved === "w") {
                    State.totalCplWhite += cpl;
                    State.cplMoveCountWhite++;
                    State.acplWhite = (State.totalCplWhite / State.cplMoveCountWhite / 100).toFixed(2);
                } else {
                    State.totalCplBlack += cpl;
                    State.cplMoveCountBlack++;
                    State.acplBlack = (State.totalCplBlack / State.cplMoveCountBlack / 100).toFixed(2);
                }
            }
            State.previousEvaluation = newCp;
            UI.updateACPL();
        },

        _grade: function (cpl, isMateRelated) {
            if (isMateRelated || cpl <= 5) return "Terbaik";
            if (cpl < 25) return "Sangat Baik";
            if (cpl < 75) return "Bagus";
            if (cpl < 150) return "Kurang Tepat";
            if (cpl < 250) return "Kesalahan";
            return "Blunder";
        },

        reset: function () {
            State.totalCplWhite = 0;
            State.cplMoveCountWhite = 0;
            State.acplWhite = "0.00";
            State.totalCplBlack = 0;
            State.cplMoveCountBlack = 0;
            State.acplBlack = "0.00";
            State.previousEvaluation = 0;
            State.acplInitialized = false;
            State.lastMoveGrade = "Book";
            clearPremoveCaches();
            UI.updateACPL();
        }
    };

    // =====================================================
    // Section 35: Opening Book Management
    // =====================================================
    function weightedRandomMove(movesObj) {
        if (!movesObj) return null;
        let total = Object.values(movesObj).reduce((a, b) => a + (typeof b === 'number' ? b : (b.weight || 0)), 0);
        if (total === 0) return Object.keys(movesObj)[0] || null;
        let rand = Math.random() * total;
        for (let move in movesObj) {
            let weight = typeof movesObj[move] === 'number' ? movesObj[move] : (movesObj[move].weight || 0);
            rand -= weight;
            if (rand < 0) return move;
        }
        return Object.keys(movesObj)[0] || null;
    }

    let OpeningBook = {
        _noEpIndex: null,
        _noEpIndexVersion: -1,
        _firstMoveNames: {
            e2e4: "King's Pawn Opening",
            d2d4: "Queen's Pawn Game",
            c2c4: "English Opening",
            g1f3: "Réti Opening",
            f2f4: "Bird's Opening",
            b2b3: "Nimzowitsch-Larsen Attack",
            b2b4: "Polish Opening",
            g2g3: "King's Indian Attack"
        },
        _buildNoEpIndex: function () {
            if (this._noEpIndex && this._noEpIndexVersion === _openingBookVersion) return;
            this._noEpIndex = new Map();
            let keys = Object.keys(OPENING_BOOK);
            for (let i = 0; i < keys.length; i++) {
                let parts = keys[i].split(" ");
                let key3 = parts.slice(0, 3).join(" ");
                if (!this._noEpIndex.has(key3)) {
                    this._noEpIndex.set(key3, OPENING_BOOK[keys[i]]);
                }
            }
            this._noEpIndexVersion = _openingBookVersion;
        },
        _getOpeningName: function (fen, move, history) {
            if (!move) return "Book Move";

            if (OPENING_NAMES[move]) {
                return OPENING_NAMES[move];
            }

            let startFen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -";
            if (normalizeFen(fen) === startFen && this._firstMoveNames[move]) {
                return this._firstMoveNames[move];
            }

            if (Array.isArray(history) && history.length > 0) {
                let firstMove = history[0];
                if (firstMove && this._firstMoveNames[firstMove]) {
                    return this._firstMoveNames[firstMove];
                }
            }

            return "Book Move";
        },
        getMove: function (fen, history) {
            if (!State.useOpeningBook || !fen) return null;

            let notationMove = this.getNotationMove(history);
            if (notationMove) {
                let display = $("#currentOpeningDisplay");
                if (display) {
                    display.textContent = "Notation Book";
                    display.style.color = "#FFD700";
                }
                State.statusInfo = "Notation move: " + notationMove;
                UI.updateStatusInfo();
                return notationMove;
            }

            let key = normalizeFen(fen);
            let movesObj = OPENING_BOOK[key];

            if (!movesObj) {
                this._buildNoEpIndex();
                let parts = fen.split(" ");
                let key3 = parts.slice(0, 3).join(" ");
                movesObj = this._noEpIndex.get(key3);
            }

            if (!movesObj) return null;

            let move = weightedRandomMove(movesObj);
            if (!move) return null;

            let name = this._getOpeningName(fen, move, history);
            let display = $("#currentOpeningDisplay");
            if (display) {
                display.textContent = name;
                display.style.color = "#1E90FF";
            }
            State.statusInfo = "Opening book move: " + move + " (" + name + ")";
            UI.updateStatusInfo();
            return move;
        },
        getNotationMove: function (history) {
            if (!State.notationSequence || !history || history.length === 0) return null;

            let sequence = State.notationSequence.replace(/\d+\./g, " ").trim().split(/\s+/);
            if (sequence.length === 0) return null;

            for (let i = 0; i < history.length; i++) {
                if (i >= sequence.length || history[i] !== sequence[i]) {
                    return null;
                }
            }

            if (history.length < sequence.length) {
                return sequence[history.length];
            }
            return null;
        }
    };

    // =====================================================
    // Section 36: Move History and Records
    // =====================================================
    let MoveHistory = {
        add: function (move, evalText, depth, grade, moveTime, source) {
            let tbody = $("#moveHistoryTableBody");
            if (!tbody) return;
            let moveNum = tbody.children.length + 1;
            let row = document.createElement("tr");

            let evalClass = "eval-equal";
            if (typeof evalText === "string") {
                if (evalText.includes("M")) evalClass = "eval-mate";
                else {
                    let v = parseFloat(evalText);
                    if (!isNaN(v)) evalClass = v > 0.4 ? "eval-positive" : v < -0.4 ? "eval-negative" : "eval-equal";
                }
            }

            let gradeColors = {
                "Terbaik": "#7fa650", "Bagus": "#4caf50", "Cukup Baik": "#aeea00",
                "Tidak Akurat": "#ffc107", "Kesalahan": "#ff9800", "Blunder": "#f44336", "Book": "#888"
            };
            let gc = gradeColors[grade] || "#888";

            let safeMove = escapeHtml(String(move || ""));
            let safeEval = escapeHtml(String(evalText || "0.00"));
            let safeGrade = escapeHtml(String(grade || "Book"));
            let safeSource = escapeHtml(String(source || "Engine"));

            let timerDisplay = "-";
            if (typeof moveTime === "number" && moveTime > 0) {
                timerDisplay = (moveTime / 1000).toFixed(2) + "s";
            }
            let safeTime = escapeHtml(String(timerDisplay || "-"));

            row.innerHTML =
                "<td>" + moveNum + "</td>" +
                "<td style=\"font-weight:bold\">" + safeMove + "</td>" +
                "<td class=\"" + evalClass + "\">" + safeEval + "</td>" +
                "<td>" + (depth || "-") + "</td>" +
                "<td style=\"font-weight:bold;color:" + gc + "\">" + safeGrade + "</td>" +
                "<td style=\"color:#a6adc8\">" + safeSource + "</td>" +
                "<td style=\"color:#89b4fa;font-weight:bold\">" + safeTime + "</td>";
            tbody.insertBefore(row, tbody.firstChild);
            while (tbody.children.length > CONFIG.MAX_HISTORY_SIZE) tbody.removeChild(tbody.lastChild);
            let filterInput = $("#inp-move-filter");
            if (filterInput && UI && typeof UI.applyMoveHistoryFilter === "function") {
                UI.applyMoveHistoryFilter(filterInput.value || "");
            }
        },
        clear: function () {
            let tbody = $("#moveHistoryTableBody");
            if (tbody) tbody.innerHTML = "";
            ACPL.reset();
        }
    };

    // =====================================================
    // Section 37: User Interface Management
    // =====================================================
    let UI = {
        _arrowElements: [],
        _pvArrowElements: [],
        _bestmoveArrowElements: [],
        _arrowLimit: 60,
        _lastDrawnIsAnalysis: null,
        _lastHighlightedMove: null,
        _lastArrowMoves: null,
        _isStreamProof: false,
        _panicMode: false,
        _panicHotkeysBound: false,
        _lastHeartbeatTs: 0,

        touchHeartbeat: function () { this._lastHeartbeatTs = Date.now(); },

        initPanicKey: function () {
            if (this._panicHotkeysBound) return;
            this._panicHotkeysBound = true;
            let self = this;
            let panicHotkeysHandler = function (e) {
                if (e.ctrlKey && e.shiftKey && e.key === 'H') { e.preventDefault(); self.togglePanicMode(); }
                if (e.ctrlKey && e.shiftKey && e.key === 'S') { e.preventDefault(); self.toggleStreamProof(); }
                if (e.ctrlKey && e.shiftKey && e.key === 'M') { e.preventDefault(); self.toggleMoveMode(); }
                if (e.ctrlKey && e.shiftKey && (e.key === '?' || e.key === '/')) { e.preventDefault(); self.showHotkeyHelp(); }
            };
            document.addEventListener('keydown', panicHotkeysHandler);
            _eventListeners.push({ element: document, type: 'keydown', handler: panicHotkeysHandler });
        },

        togglePanicMode: function () {
            this._panicMode = !this._panicMode;
            let panel = $("#chess-assist-panel");
            if (this._panicMode) {
                if (panel) panel.style.opacity = '0';
                this.clearAll(); this._removeAllVisuals();
                State.statusInfo = "PANIC MODE - All hidden";
            } else {
                if (panel) panel.style.opacity = '1';
                State.statusInfo = "Normal mode restored";
            }
            UI.updateStatusInfo();
        },

        toggleStreamProof: function () {
            this._isStreamProof = !this._isStreamProof;
            if (this._isStreamProof) { this._applyStreamProofStyles(); State.statusInfo = "Stream-proof mode ON"; }
            else { this._removeStreamProofStyles(); State.statusInfo = "Stream-proof mode OFF"; }
            UI.updateStatusInfo();
        },

        toggleMoveMode: function () {
            let newMode = State.moveExecutionMode === "click" ? "drag" : "click";
            State.moveExecutionMode = newMode;
            saveSetting("moveExecutionMode", newMode);
            State.statusInfo = "Move Mode: " + newMode.toUpperCase() + (newMode === "drag" ? " (Bezier)" : " (Simple)");
            UI.updateStatusInfo();
        },

        showHotkeyHelp: function () {
            let existing = $("#cap-hotkeys-overlay");
            if (existing) return;
            let overlay = document.createElement("div");
            overlay.id = "cap-hotkeys-overlay";
            overlay.className = "cap-hotkeys-overlay";
            overlay.innerHTML =
                '<div class="cap-hotkeys-modal" role="dialog" aria-modal="true" aria-labelledby="cap-hotkeys-title">' +
                '<div id="cap-hotkeys-title" class="cap-hotkeys-title">Hotkeys</div>' +
                '<table class="cap-hotkeys-table"><thead><tr><th>Shortcut</th><th>Action</th></tr></thead><tbody>' +
                '<tr><td>Ctrl+Shift+H</td><td>Toggle Panic Mode</td></tr>' +
                '<tr><td>Ctrl+Shift+S</td><td>Toggle Stream Proof</td></tr>' +
                '<tr><td>Ctrl+Shift+M</td><td>Toggle Move Execution Mode</td></tr>' +
                '<tr><td>Ctrl+Shift+?</td><td>Open Hotkeys Help</td></tr>' +
                '<tr><td>Alt + A..Z</td><td>Set Engine Depth (1..26)</td></tr>' +
                '<tr><td>Esc</td><td>Toggle panel open/closed</td></tr>' +
                '</tbody></table>' +
                '<div class="cap-hotkeys-actions"><button id="btn-hotkeys-close" class="cap-welcome-btn secondary" type="button">Close</button></div>' +
                '</div>';
            document.body.appendChild(overlay);
            let closeBtn = $("#btn-hotkeys-close", overlay);
            if (closeBtn) { closeBtn.addEventListener("click", function () { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); }); }
            overlay.addEventListener("click", function (e) { if (e.target === overlay && overlay.parentNode) { overlay.parentNode.removeChild(overlay); } });
        },

        applyMoveHistoryFilter: function (query) {
            let tbody = $("#moveHistoryTableBody");
            if (!tbody) return;
            let q = String(query || "").trim().toLowerCase();
            let rows = Array.from(tbody.querySelectorAll("tr"));
            rows.forEach(function (row) { let text = (row.textContent || "").toLowerCase(); row.style.display = !q || text.includes(q) ? "" : "none"; });
        },

        _hardRemoveElements: function (list, selector) {
            if (Array.isArray(list)) { list.forEach(function (el) { try { if (el && el.classList) el.classList.remove("fade"); if (el && typeof el.remove === "function") el.remove(); else if (el && el.parentNode) el.parentNode.removeChild(el); } catch (e) { } }); list.length = 0; }
            if (selector) { try { $$(selector).forEach(function (el) { try { if (el && typeof el.remove === "function") el.remove(); else if (el && el.parentNode) el.parentNode.removeChild(el); } catch (e) { } }); } catch (e) { } }
        },

        _limitArrowArray: function (list, max) {
            if (!Array.isArray(list)) return;
            if (list.length <= max) return;
            let overflow = list.length - max;
            for (let i = 0; i < overflow; i++) { let el = list.shift(); try { if (el && typeof el.remove === "function") el.remove(); else if (el && el.parentNode) el.parentNode.removeChild(el); } catch (e) { } }
        },

        _applyStreamProofStyles: function () {
            let style = document.getElementById('stream-proof-styles');
            if (!style) {
                style = document.createElement('style');
                style.id = 'stream-proof-styles';
                style.textContent = `.chess-assist-arrow rect{stroke-width:2px!important;opacity:0.4!important;filter:none!important}.chess-assist-pv-arrow line{stroke-width:2px!important;opacity:0.3!important}.chess-assist-pv-arrow circle{r:6!important;opacity:0.4!important}.chess-assist-pv-arrow text{display:none!important}`;
                document.head.appendChild(style);
            }
        },

        _removeStreamProofStyles: function () { let style = document.getElementById('stream-proof-styles'); if (style) style.remove(); },

        _removeAllVisuals: function () {
            let arrows = document.querySelectorAll(".chess-assist-arrow, .chess-assist-pv-arrow, .chess-assist-bestmove-arrow");
            arrows.forEach(function (el) { el.remove(); });
            this._arrowElements = []; this._pvArrowElements = []; this._bestmoveArrowElements = [];
        },

        updateMove: function (num, move, evalText, evalClass) {
            let moveEl = $("#topMove" + num); let evalEl = $("#topMoveEval" + num);
            if (moveEl) moveEl.textContent = move || "...";
            if (evalEl) { evalEl.textContent = evalText || "0.00"; evalEl.className = "eval " + (evalClass || "eval-equal"); }
        },

        _refreshEvalBarStatus: function () {
            let status = this._resolveEvalBarStatus();
            if (State._lastShownEvalBarStatus === status) return;
            State._lastShownEvalBarStatus = status;
            if (typeof State._lastEvalBarCp === "number") {
                this.updateEvalBar(State._lastEvalBarCp, State._lastEvalBarMate, State._lastEvalBarDepth);
            }
        },

        _resolveEvalBarStatus: function () {
            if (State.moveExecutionInProgress) {
                let elapsed = State.moveStartTime ? ((Date.now() - State.moveStartTime) / 1000).toFixed(1) : "0.0";
                return "Moving in " + elapsed + "s";
            }
            if (!Engine || (!Engine._ready && !Engine.main)) return "Engine Loading...";
            if (!Engine._ready && Engine.main) return "Engine Init...";
            if (State.isThinking) return "Analyzing...";
            if (State.isAnalysisThinking) return "Analysis Running";
            if (!isPlayersTurn()) return "Opponent's Turn";
            if (State.autoRun) return "⏳ Waiting";
            return "Ready";
        },

        updateEvalBar: function (rawCp, mateVal, depth) {
            let fill = $("#evaluationFillAutoRun"); let text = $("#autoRunStatusText");
            if (!fill || !text) return;
            State._lastEvalBarCp = rawCp; State._lastEvalBarMate = mateVal; State._lastEvalBarDepth = depth;
            fill.style.transition = "width 0.5s ease, background-color 0.5s ease";
            let pct = 50, color = "#9E9E9E", label = "0.00", emo = "";
            let deltaCp = 0;
            if (typeof rawCp === "number") {
                if (typeof State._lastEvalRawCp === "number") { deltaCp = rawCp - State._lastEvalRawCp; }
                State._lastEvalRawCp = rawCp; State.lastEvalDeltaCp = deltaCp;
            }
            if (mateVal !== null) {
                pct = mateVal > 0 ? 100 : 0; color = mateVal > 0 ? "#4CAF50" : "#FF4500";
                label = (mateVal > 0 ? "M+" : "M") + mateVal; emo = mateVal > 0 ? "😊 Unggul" : "😟 Tertekan";
                State.evalBarInitialized = false;
            } else {
                if (!State.evalBarInitialized) { State.evalBarSmoothedCp = rawCp; State.evalBarInitialized = true; }
                else { State.evalBarSmoothedCp = (State.evalBarSmoothedCp * 0.75) + (rawCp * 0.25); }
                let smoothCp = State.evalBarSmoothedCp;
                let capped = clamp(smoothCp, -CONFIG.MAX_BAR_CAP, CONFIG.MAX_BAR_CAP);
                pct = 50 + (capped / CONFIG.MAX_BAR_CAP) * 50;
                color = smoothCp >= 0 ? "#4CAF50" : "#FF4500";
                label = (smoothCp >= 0 ? "+" : "") + (smoothCp / 100).toFixed(2);
                if (Math.abs(smoothCp) < 20) { emo = "😐 Seimbang"; color = "#9E9E9E"; }
                else { emo = smoothCp > 0 ? "😊 Unggul" : "😟 Tertekan"; }
            }
            fill.style.width = pct + "%"; fill.style.backgroundColor = color;
            let status = this._resolveEvalBarStatus();
            let deltaText = "";
            if (typeof State.lastEvalDeltaCp === "number" && State.lastEvalDeltaCp !== 0) {
                let deltaPawn = (State.lastEvalDeltaCp / 100).toFixed(2);
                if (State.lastEvalDeltaCp > 0) deltaText = " Δ+" + deltaPawn; else deltaText = " Δ" + deltaPawn;
            }
            let safeLabel = escapeHtml(String(label)); let safeEmo = escapeHtml(String(emo)); let safeStatus = escapeHtml(String(status));
            text.innerHTML = "<span style=\"font-weight:bold;color:" + color + "\">" + safeLabel + " " + safeEmo + "</span>" +
                "<span style=\"font-size:10px;margin-left:8px;opacity:0.7\">D" + (depth || 0) + deltaText + " " + safeStatus + "</span>";
        },

        updateAnalysisBar: function (rawCp) {
            let fill = $("#evaluationFillAnalysis"); if (!fill) return;
            let analysisFen = State._lastAnalysisFen || getAccurateFen();
            let stm = getCurrentTurn(analysisFen);
            let whiteCp = stm === "b" ? -rawCp : rawCp;
            let pct = 50;
            if (Math.abs(whiteCp) >= CONFIG.MATE_VALUE) { pct = whiteCp > 0 ? 100 : 0; }
            else { let capped = clamp(whiteCp, -CONFIG.MAX_BAR_CAP, CONFIG.MAX_BAR_CAP); pct = 50 + (capped / CONFIG.MAX_BAR_CAP) * 50; }
            fill.style.width = pct + "%"; fill.style.backgroundColor = "#f8fafc";
        },

        updateACPL: function () {
            let el = $("#acplTextDisplay"); if (el) el.textContent = "W " + State.acplWhite + " / B " + State.acplBlack;
            let wc = $("#cplMoveCountWhiteDisplay"); let bc = $("#cplMoveCountBlackDisplay");
            if (wc) wc.textContent = State.cplMoveCountWhite; if (bc) bc.textContent = State.cplMoveCountBlack;
            let wBar = $("#acplBarWhite"); let bBar = $("#acplBarBlack");
            if (wBar && bBar) {
                let wCp = Math.min(parseFloat(State.acplWhite) * 100, CONFIG.MAX_ACPL_DISPLAY);
                let bCp = Math.min(parseFloat(State.acplBlack) * 100, CONFIG.MAX_ACPL_DISPLAY);
                wBar.style.width = (wCp / CONFIG.MAX_ACPL_DISPLAY * 100) + "%";
                bBar.style.width = (bCp / CONFIG.MAX_ACPL_DISPLAY * 100) + "%";
            }
        },

        updatePVDisplay: function () { let el = $("#pvDisplay"); if (!el) return; el.textContent = State.principalVariation && State.principalVariation.length > 0 ? State.principalVariation : "Waiting for analysis..."; },

        updateStatusInfo: function () {
            this.touchHeartbeat();
            let statusEl = $('#infoStatus'); if (!statusEl) return;
            let statusText = State.statusInfo || 'Ready';
            statusEl.textContent = statusText;
            statusEl.classList.remove('ready', 'analyzing', 'waiting', 'error', 'countdown');
            let statusLower = statusText.toLowerCase();
            if (statusLower.includes('⏳') || statusLower.includes('moving in')) { statusEl.classList.add('countdown'); statusEl.style.color = '#f9e2af'; statusEl.style.fontWeight = 'bold'; }
            else if (statusLower.includes('ready') || statusLower.includes('✓')) { statusEl.classList.add('ready'); statusEl.style.color = '#a6e3a1'; }
            else if (statusLower.includes('analyz') || statusLower.includes('🔄')) { statusEl.classList.add('analyzing'); statusEl.style.color = '#89b4fa'; }
            else if (statusLower.includes('wait') || statusLower.includes('⏳')) { statusEl.classList.add('waiting'); statusEl.style.color = '#fab387'; }
            else if (statusLower.includes('error') || statusLower.includes('❌')) { statusEl.classList.add('error'); statusEl.style.color = '#f38ba8'; }
            else { statusEl.style.color = '#cdd6f4'; }
        },

        updatePremoveChanceDisplay: function (game, rawCp, evalText, bestMove, moveNumber) {
            let chanceEl = document.getElementById('premoveChanceDisplay'); if (!chanceEl) return;
            if (!State.premoveEnabled) { chanceEl.innerHTML = '<span style="color:#6c7086">-</span>'; return; }
            if (typeof rawCp === 'number' && typeof evalText !== 'undefined' && typeof bestMove === 'string') {
                let ourColor = getPlayingAs(game || getGame());
                let baselineChance = Math.round(Number(getEvalBasedPremoveChance(rawCp / 100, ourColor)) || 0);
                let displayNum = typeof moveNumber === 'number' ? moveNumber : 1;
                if (State.premoveChanceUpdatedTs <= 0) { State.premoveLiveChance = baselineChance; }
                State.premoveLastEvalDisplay = String(evalText || '0.00');
                State.premoveLastMoveDisplay = bestMove.length >= 4 ? bestMove.substring(0, 4).toUpperCase() : String(bestMove).toUpperCase();
                State.premoveChanceReason = 'Tracking';
                if (!State.premoveTargetChance || State.premoveTargetChance <= 0) {
                    let modeCfg = SmartPremove.AGGRESSION_CONFIG[State.premoveMode] || SmartPremove.AGGRESSION_CONFIG.every;
                    State.premoveTargetChance = clamp(Math.round(modeCfg.minConfidence || 0), 0, 100);
                }
                State.premoveLastMoveDisplay = "#" + displayNum + " " + State.premoveLastMoveDisplay;
            }
            if (State.premoveChanceUpdatedTs <= 0) {
                let ourColorFallback = getPlayingAs(game || getGame());
                let fallbackChance = Math.round(Number(getEvalBasedPremoveChance((Number(State.currentEvaluation) || 0) / 100, ourColorFallback)) || 0);
                State.premoveLiveChance = clamp(fallbackChance, 0, 100);
                let modeCfgFallback = SmartPremove.AGGRESSION_CONFIG[State.premoveMode] || SmartPremove.AGGRESSION_CONFIG.every;
                State.premoveTargetChance = clamp(Math.round(modeCfgFallback.minConfidence || 0), 0, 100);
                State.premoveChanceReason = "Waiting for engine PV";
                if (!State.premoveLastEvalDisplay || State.premoveLastEvalDisplay === "-") { State.premoveLastEvalDisplay = typeof State.currentEvaluation === 'number' ? (State.currentEvaluation / 100).toFixed(2) : "-"; }
            }
            let liveChance = clamp(Math.round(Number(State.premoveLiveChance) || 0), 0, 100);
            let targetChance = clamp(Math.round(Number(State.premoveTargetChance) || 0), 0, 100);
            let progressToTarget = targetChance > 0 ? clamp(Math.round((liveChance / targetChance) * 100), 0, 100) : 100;
            let chanceColor = liveChance >= targetChance ? '#a6e3a1' : liveChance <= 20 ? '#ff9800' : '#f9e2af';
            let safeEval = escapeHtml(String(State.premoveLastEvalDisplay || '-'));
            let safeMove = escapeHtml(String(State.premoveLastMoveDisplay || '-'));
            let safeReason = escapeHtml(String(State.premoveChanceReason || 'Tracking'));
            chanceEl.innerHTML =
                '<strong>#Premove</strong> ' +
                '[Eval: <span style="color:#a6adc8;">' + safeEval + '</span>] ' +
                '[Move: <span style="color:#89b4fa;">' + safeMove + '</span>] ' +
                '[Chance: <span style="color:' + chanceColor + ';">' + liveChance + '%</span>] ' +
                '[Target: <span style="color:#cba6f7;">' + targetChance + '%</span>] ' +
                '[Progress: <span style="color:#74c7ec;">' + progressToTarget + '%</span>] ' +
                '<span style="color:#6c7086;">(' + safeReason + ')</span>';
            chanceEl.style.color = '#cdd6f4';
        },

        updatePremoveStatsDisplay: function () {
            let el = $("#premoveStatsDisplay"); if (!el) return;
            let s = State.premoveStats || { attempted: 0, allowed: 0, executed: 0, blocked: 0, failed: 0 };
            el.textContent = "A:" + s.attempted + " OK:" + s.allowed + " EX:" + s.executed + " BL:" + s.blocked + " FL:" + s.failed;
        },

        updateCCTDebugDisplay: function () {
            let el = $("#cctDebugDisplay"); if (!el) return;
            if (!State.cctDebugEnabled) { el.textContent = "CCT debug disabled"; el.style.opacity = "0.72"; return; }
            let txt = State.cctLastDebugText || "CCT debug idle"; el.textContent = String(txt); el.style.opacity = "1";
        },

        updateAnalysisMonitorDisplay: function () {
            let stableEl = $("#analysis-stability-indicator"); let guardEl = $("#analysis-guard-indicator");
            if (stableEl) { stableEl.textContent = (State.analysisStableCount || 0) + "x"; }
            if (guardEl) {
                guardEl.textContent = State.analysisGuardStateText || "Ready";
                let txt = (State.analysisGuardStateText || "").toLowerCase();
                if (txt.includes("blocked")) guardEl.style.color = "#f38ba8";
                else if (txt.includes("waiting") || txt.includes("changed")) guardEl.style.color = "#f9e2af";
                else guardEl.style.color = "#a6e3a1";
            }
        },

        updateDiagnosticsDisplay: function () {
            this.touchHeartbeat();
            let workersEl = $("#diag-workers"); let cachesEl = $("#diag-caches"); let runtimeEl = $("#diag-runtime"); let errorsEl = $("#diag-errors"); let selfTestEl = $("#diag-selftest");
            if (!workersEl && !cachesEl && !runtimeEl && !errorsEl && !selfTestEl) return;
            let report = getDiagnosticsSnapshot();
            if (workersEl) { workersEl.textContent = "M:" + (report.workers.main ? "ON" : "OFF") + " A:" + (report.workers.analysis ? "ON" : "OFF") + " P:" + (report.workers.premove ? "ON" : "OFF"); }
            if (cachesEl) { cachesEl.textContent = "PR:" + report.caches.premoveProcessedFens + " CCT:" + report.caches.cctCache + " TH:" + report.caches.threatCache; }
            if (runtimeEl) { runtimeEl.textContent = "H(P/M/A):" + report.runtime.premoveHealCount + "/" + report.runtime.mainHealCount + "/" + report.runtime.analysisHealCount + " L:" + (State.loopStarted ? 1 : 0); }
            if (errorsEl) { let cnt = ErrorTelemetry.moduleCounts; errorsEl.textContent = "E En:" + (cnt.engine || 0) + " UI:" + (cnt.ui || 0) + " Pr:" + (cnt.premove || 0) + " Sy:" + (cnt.syzygy || 0) + " Rt:" + (cnt.runtime || 0) + " O:" + (cnt.other || 0); }
            if (selfTestEl) { selfTestEl.textContent = "SelfTest R:" + (report.runtime.selfTestRuns || 0) + " F:" + (report.runtime.selfTestFailures || 0) + " UIH:" + (report.runtime.uiHealCount || 0) + " LH:" + (report.runtime.listenerHealCount || 0); }
        },

        updateSyzygyDisplay: function () {
            let statusEl = $("#syzygyStatus"); let bodyEl = $("#syzygyTableBody"); if (!statusEl || !bodyEl) return;
            let meta = State.syzygyMeta || null; let source = State.syzygySource ? (" [" + State.syzygySource + "]") : ""; let metaText = "";
            if (meta) { let cat = meta.category ? String(meta.category).toUpperCase() : "UNKNOWN"; let dtz = (typeof meta.dtz === "number") ? (" DTZ " + meta.dtz) : ""; let dtm = (typeof meta.dtm === "number") ? (" DTM " + meta.dtm) : ""; metaText = " | " + cat + dtz + dtm; }
            let errText = State.syzygyError ? (" | " + String(State.syzygyError)) : "";
            statusEl.textContent = String(State.syzygyStatus || "Idle") + source + metaText + errText;
            let moves = Array.isArray(State.syzygyMoves) ? State.syzygyMoves : [];
            if (!moves.length) { bodyEl.innerHTML = '<tr><td colspan="4" style="color:#6c7086">No tablebase line</td></tr>'; return; }
            let rows = "";
            for (let i = 0; i < moves.length; i++) { let mv = moves[i] || {}; let uci = escapeHtml(String(mv.uci || mv.san || "-")); let category = escapeHtml(String(mv.category || "-")); let dtz = (typeof mv.dtz === "number") ? ("DTZ " + mv.dtz) : ""; let dtm = (typeof mv.dtm === "number") ? ("DTM " + mv.dtm) : ""; let score = escapeHtml((dtz + (dtz && dtm ? " | " : "") + dtm) || "-"); rows += "<tr><td>" + (i + 1) + "</td><td style=\"font-family:monospace\">" + uci + "</td><td>" + category + "</td><td>" + score + "</td></tr>"; }
            bodyEl.innerHTML = rows;
        },

        highlightBestMove: function (from, to, isAnalysis) {
            this._removeHighlightSquares(); if (!State.highlightEnabled) return;
            if (!from || !to || from.length !== 2 || to.length !== 2) { warn("Invalid highlight move:", from, to); return; }
            let color = isAnalysis ? State.highlightColor2 : State.highlightColor1;
            this._drawSquareHighlight(from, to, color, isAnalysis);
            this._lastHighlightedMove = { from: from, to: to, isAnalysis: isAnalysis, time: Date.now() };
        },

        highlightMove: function (move, color, isAnalysis) {
            this._removeHighlightSquares(); if (!move || move.length < 4) { warn("Invalid move for highlight:", move); return; }
            let from = move.substring(0, 2); let to = move.substring(2, 4);
            let actualColor = isAnalysis ? State.highlightColor2 : color;
            this._drawSquareHighlight(from, to, actualColor, isAnalysis);
            this._lastHighlightedMove = { from: from, to: to, move: move, isAnalysis: isAnalysis, time: Date.now() };
        },

        _removeHighlightSquares: function () { this._hardRemoveElements(this._arrowElements, ".chess-assist-arrow"); },

        _drawSquareHighlight: function (from, to, color, isAnalysis) {
            let board = getBoardElement(); if (!board) return;
            let fromXY = MoveExecutor._getSquareXY(from, false); let toXY = MoveExecutor._getSquareXY(to, false);
            if (!fromXY || !toXY) return;
            let container = (board.tagName && board.tagName.toLowerCase() === "wc-chess-board") ? (board.parentElement || board) : board;
            let boardRect = board.getBoundingClientRect(); let containerRect = container.getBoundingClientRect(); let squareSize = boardRect.width / 8;
            let fx = fromXY.x - containerRect.left - squareSize / 2; let fy = fromXY.y - containerRect.top - squareSize / 2;
            let tx = toXY.x - containerRect.left - squareSize / 2; let ty = toXY.y - containerRect.top - squareSize / 2;
            let svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
            svg.setAttribute("class", "chess-assist-arrow");
            let zIndex = isAnalysis ? 10001 : 9999;
            svg.style.cssText = "position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:" + zIndex + ";";
            svg.setAttribute("data-analysis", isAnalysis ? "true" : "false");
            let glowSize = isAnalysis ? 6 : 4; let opacity = isAnalysis ? "0.98" : "0.95";
            let borderRadius = Math.max(4, squareSize * 0.15); let fontSize = Math.max(10, squareSize * 0.15);
            svg.innerHTML =
                "<rect x=\"" + fx + "\" y=\"" + fy + "\" width=\"" + squareSize + "\" height=\"" + squareSize + "\" fill=\"none\" stroke=\"" + color + "\" stroke-width=\"4\" rx=\"" + borderRadius + "\" ry=\"" + borderRadius + "\" opacity=\"" + opacity + "\" style=\"filter:drop-shadow(0 0 " + glowSize + "px " + color + ");\" />" +
                "<rect x=\"" + tx + "\" y=\"" + ty + "\" width=\"" + squareSize + "\" height=\"" + squareSize + "\" fill=\"none\" stroke=\"" + color + "\" stroke-width=\"4\" rx=\"" + borderRadius + "\" ry=\"" + borderRadius + "\" opacity=\"" + opacity + "\" style=\"filter:drop-shadow(0 0 " + (glowSize + 2) + "px " + color + ");\" />" +
                "<text x=\"" + (fx + 2) + "\" y=\"" + (fy + 2) + "\" font-size=\"" + fontSize + "px\" fill=\"#000000\" font-weight=\"bold\" pointer-events=\"none\" writing-mode=\"tb\" text-anchor=\"start\">" + from.toUpperCase() + "</text>" +
                "<text x=\"" + (tx + 2) + "\" y=\"" + (ty + 2) + "\" font-size=\"" + fontSize + "px\" fill=\"#000000\" font-weight=\"bold\" pointer-events=\"none\" writing-mode=\"tb\" text-anchor=\"start\">" + to.toUpperCase() + "</text>";
            container.style.position = container.style.position || "relative";
            container.appendChild(svg);
            this._arrowElements.push(svg);
            this._limitArrowArray(this._arrowElements, this._arrowLimit);
        },

        drawPVArrows: function (pvMoves, startingTurn, isAnalysis) {
            if (!pvMoves || pvMoves.length === 0 || !State.showPVArrows) return;
            let validMoves = pvMoves.filter(function (m) { return m && m.length >= 4 && /^[a-h][1-8][a-h][1-8]/.test(m); });
            if (validMoves.length === 0) return;
            let board = getBoardElement(); if (!board) return;
            let container = (board.tagName && board.tagName.toLowerCase() === "wc-chess-board") ? (board.parentElement || board) : board;
            let pvStr = validMoves.join(" "); let now = Date.now();
            let lastRendered = isAnalysis ? State.lastRenderedAnalysisPV : State.lastRenderedMainPV;
            let lastDrawTime = isAnalysis ? State.lastAnalysisPVDrawTime : State.lastMainPVDrawTime;
            if (pvStr === lastRendered && now - lastDrawTime < 100) return;
            if (this._lastDrawnIsAnalysis !== isAnalysis) { this._removePVArrowsByType(!isAnalysis); }
            this._removePVArrowsByType(isAnalysis);
            if (isAnalysis) { State.lastRenderedAnalysisPV = pvStr; State.lastAnalysisPVDrawTime = now; }
            else { State.lastRenderedMainPV = pvStr; State.lastMainPVDrawTime = now; }
            this._lastDrawnIsAnalysis = isAnalysis;
            this._doPVDraw(validMoves, startingTurn, pvStr, board, container, isAnalysis);
        },

        drawBestmoveArrows: function () {
            if (!State.showBestmoveArrows) return;
            let board = getBoardElement(); if (!board) return;
            let container = (board.tagName && board.tagName.toLowerCase() === "wc-chess-board") ? (board.parentElement || board) : board;
            this.clearBestmoveArrows();
            let infos = State.topMoveInfos || {}; let moveCount = clamp(State.numberOfMovesToShow || 5, 2, 10);
            let frag = document.createDocumentFragment();
            for (let i = 1; i <= moveCount; i++) {
                let info = infos[i]; if (!info || !info.move || info.move.length < 4) continue;
                let from = info.move.substring(0, 2); let to = info.move.substring(2, 4);
                let badge = info.evalText || ""; let alpha = i === 1 ? 0.95 : Math.max(0.55, 0.9 - (i * 0.08));
                let bmColors = State.bestmoveArrowColors || {};
                let basePalette = [bmColors[1] || bmColors["1"] || State.bestmoveArrowColor || "#eb6150", bmColors[2] || bmColors["2"] || "#89b4fa", bmColors[3] || bmColors["3"] || "#a6e3a1", bmColors[4] || bmColors["4"] || "#f38ba8", bmColors[5] || bmColors["5"] || "#cba6f7", bmColors[6] || bmColors["6"] || "#fab387", bmColors[7] || bmColors["7"] || "#74c7ec", bmColors[8] || bmColors["8"] || "#f5c2e7", bmColors[9] || bmColors["9"] || "#b4befe"];
                let color = basePalette[(i - 1) % 9] || "#f9e2af";
                let arrow = this._createBestmoveArrowSVG(from, to, color, alpha, i, badge, board, container);
                if (arrow) { this._bestmoveArrowElements.push(arrow); frag.appendChild(arrow); this._limitArrowArray(this._bestmoveArrowElements, this._arrowLimit); }
            }
            if (this._bestmoveArrowElements.length > 0) { container.style.position = container.style.position || "relative"; container.appendChild(frag); }
        },

        _createBestmoveArrowSVG: function (from, to, color, opacity, rank, badge, board, container) {
            let fromXY = MoveExecutor._getSquareXY(from, false); let toXY = MoveExecutor._getSquareXY(to, false);
            if (!fromXY || !toXY) return null;
            let containerRect = (container || board).getBoundingClientRect();
            let x1 = fromXY.x - containerRect.left, y1 = fromXY.y - containerRect.top, x2 = toXY.x - containerRect.left, y2 = toXY.y - containerRect.top;
            let uid = "bm-" + rank + "-" + Date.now(); let angle = Math.atan2(y2 - y1, x2 - x1);
            let strokeWidth = 4, circleRadius = 10, arrowHeadSize = Math.max(8, strokeWidth * 2);
            let markerWidth = Math.max(6, strokeWidth * 1.5), markerHeight = Math.max(4, strokeWidth);
            let endX = x2 - Math.cos(angle) * arrowHeadSize, endY = y2 - Math.sin(angle) * arrowHeadSize;
            let midX = (x1 + endX) / 2, midY = (y1 + endY) / 2;
            let safeBadge = escapeHtml(String(badge || ""));
            let svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
            svg.setAttribute("class", "chess-assist-bestmove-arrow");
            svg.style.cssText = "position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:" + (9980 + rank) + ";";
            let badgeWidth = Math.max(22, safeBadge.length * 4.5 + 6);
            let badgeSvg = safeBadge ? "<rect x=\"" + (midX - badgeWidth / 2) + "\" y=\"" + (midY - 10) + "\" width=\"" + badgeWidth + "\" height=\"10\" rx=\"3\" ry=\"3\" fill=\"rgba(0,0,0,0.62)\" /><text x=\"" + midX + "\" y=\"" + (midY - 2) + "\" text-anchor=\"middle\" font-size=\"7\" font-weight=\"700\" fill=\"#f1f1f1\">" + safeBadge + "</text>" : "";
            svg.innerHTML = "<defs><marker id=\"bmh-" + uid + "\" markerWidth=\"" + markerWidth + "\" markerHeight=\"" + markerHeight + "\" refX=\"" + (markerWidth - 1) + "\" refY=\"" + (markerHeight / 2) + "\" orient=\"auto\"><polygon points=\"0 0," + markerWidth + " " + (markerHeight / 2) + ",0 " + markerHeight + "\" fill=\"" + color + "\" opacity=\"" + opacity + "\" /></marker></defs>" +
                "<line x1=\"" + x1 + "\" y1=\"" + y1 + "\" x2=\"" + endX + "\" y2=\"" + endY + "\" stroke=\"" + color + "\" stroke-width=\"" + strokeWidth + "\" stroke-linecap=\"round\" opacity=\"" + Math.max(0.25, opacity * 0.6) + "\" style=\"filter:blur(1.5px);\" />" +
                "<line x1=\"" + x1 + "\" y1=\"" + y1 + "\" x2=\"" + endX + "\" y2=\"" + endY + "\" stroke=\"" + color + "\" stroke-width=\"" + strokeWidth + "\" stroke-linecap=\"round\" marker-end=\"url(#bmh-" + uid + ")\" opacity=\"" + opacity + "\" />" +
                "<circle cx=\"" + x1 + "\" cy=\"" + y1 + "\" r=\"" + circleRadius + "\" fill=\"none\" stroke=\"" + color + "\" stroke-width=\"3\" opacity=\"" + Math.min(1, opacity + 0.1) + "\" />" +
                "<circle cx=\"" + x1 + "\" cy=\"" + y1 + "\" r=\"" + (circleRadius - 4) + "\" fill=\"" + color + "\" opacity=\"0.88\" />" +
                "<text x=\"" + x1 + "\" y=\"" + (y1 + 3) + "\" text-anchor=\"middle\" font-size=\"9\" font-weight=\"800\" fill=\"#111\">" + rank + "</text>" + badgeSvg;
            return svg;
        },

        _doPVDraw: function (pvMoves, startingTurn, pvStr, board, container, isAnalysis) {
            this._lastDrawnIsAnalysis = isAnalysis;
            let maxMoves = Math.min(pvMoves.length, State.maxPVDepth); let frag = document.createDocumentFragment();
            let pvColors = State.pvArrowColors || {};
            let pvPalette = [pvColors[1] || pvColors["1"] || "#4287f5", pvColors[2] || pvColors["2"] || "#eb6150", pvColors[3] || pvColors["3"] || "#4caf50", pvColors[4] || pvColors["4"] || "#9c27b0", pvColors[5] || pvColors["5"] || "#f38ba8", pvColors[6] || pvColors["6"] || "#fab387", pvColors[7] || pvColors["7"] || "#74c7ec", pvColors[8] || pvColors["8"] || "#f5c2e7", pvColors[9] || pvColors["9"] || "#b4befe"];
            this._lastArrowMoves = [];
            for (let i = 0; i < maxMoves; i++) {
                let move = pvMoves[i]; if (!move || move.length < 4) continue;
                let from = move.substring(0, 2), to = move.substring(2, 4);
                let opacity = Math.max(0.55, 0.95 - (i * 0.05)); let color = pvPalette[i % pvPalette.length];
                this._lastArrowMoves.push({ from: from, to: to, index: i });
                let evalBadge = "";
                if (i === 0) {
                    let cpValue = null;
                    if (State.topMoveInfos && State.topMoveInfos[1] && typeof State.topMoveInfos[1].rawCp === "number") { cpValue = State.topMoveInfos[1].rawCp; }
                    else if (typeof State.currentEvaluation === "number") { cpValue = State.currentEvaluation; }
                    if (typeof cpValue === "number" && isFinite(cpValue) && Math.abs(cpValue) < CONFIG.MATE_VALUE) { let pct = 50 + (45 * Math.tanh(cpValue / 300)); evalBadge = pct.toFixed(1) + "%"; }
                    else if (State.lastEvalText1) { evalBadge = State.lastEvalText1; }
                }
                let el = this._createPVArrowSVG(from, to, color, opacity, 4, i, board, container, isAnalysis, evalBadge);
                if (el) { this._pvArrowElements.push(el); frag.appendChild(el); this._limitArrowArray(this._pvArrowElements, this._arrowLimit); }
            }
            container.style.position = container.style.position || "relative"; container.appendChild(frag);
        },

        _createPVArrowSVG: function (from, to, color, opacity, strokeWidth, index, board, container, isAnalysis, evalBadge) {
            function getContrastColor(hexColor) { if (!hexColor) return "#000000"; let c = hexColor.replace("#", ""); if (c.length === 3) { c = c.split("").map(function (x) { return x + x; }).join(""); } let r = parseInt(c.substr(0, 2), 16), g = parseInt(c.substr(2, 2), 16), b = parseInt(c.substr(4, 2), 16); let brightness = (r * 299 + g * 587 + b * 114) / 1000; return brightness > 150 ? "#000000" : "#ffffff"; }
            let fromXY = MoveExecutor._getSquareXY(from, false); let toXY = MoveExecutor._getSquareXY(to, false);
            if (!fromXY || !toXY) return null;
            let containerRect = (container || board).getBoundingClientRect();
            let x1 = fromXY.x - containerRect.left, y1 = fromXY.y - containerRect.top, x2 = toXY.x - containerRect.left, y2 = toXY.y - containerRect.top;
            let angle = Math.atan2(y2 - y1, x2 - x1); let arrowHeadSize = Math.max(8, strokeWidth * 2);
            let endX = x2 - Math.cos(angle) * arrowHeadSize, endY = y2 - Math.sin(angle) * arrowHeadSize;
            let uid = "pv-" + (isAnalysis ? "a-" : "m-") + index + "-" + Date.now();
            let svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
            svg.setAttribute("class", "chess-assist-pv-arrow"); svg.setAttribute("data-analysis", isAnalysis ? "true" : "false");
            let zIndex = 9990 + index + (isAnalysis ? 100 : 0);
            svg.style.cssText = "position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:" + zIndex + ";";
            let blurAmount = isAnalysis ? "2px" : "1.5px", circleRadius = isAnalysis ? 12 : 10, textYOffset = isAnalysis ? 5 : 4;
            let markerWidth = Math.max(6, strokeWidth * 1.5), markerHeight = Math.max(4, strokeWidth);
            let textColor = getContrastColor(color), textStroke = textColor === "#ffffff" ? "#000000" : "#ffffff";
            let numberBgOpacity = 0.85, midX = (x1 + endX) / 2, midY = (y1 + endY) / 2;
            let safeEvalBadge = escapeHtml(String(evalBadge || "")); let evalBadgeWidth = Math.max(24, safeEvalBadge.length * 4.4 + 6);
            let evalBadgeSvg = safeEvalBadge ? "<rect x=\"" + (midX - (evalBadgeWidth / 2)) + "\" y=\"" + (midY - 10) + "\" width=\"" + evalBadgeWidth + "\" height=\"10\" rx=\"3\" ry=\"3\" fill=\"rgba(0,0,0,0.58)\" /><text x=\"" + midX + "\" y=\"" + (midY - 2) + "\" text-anchor=\"middle\" font-size=\"7\" font-weight=\"700\" fill=\"#eaeaea\" pointer-events=\"none\">" + safeEvalBadge + "</text>" : "";
            svg.innerHTML =
                "<defs><marker id=\"pvah-" + uid + "\" markerWidth=\"" + markerWidth + "\" markerHeight=\"" + markerHeight + "\" refX=\"" + (markerWidth - 1) + "\" refY=\"" + (markerHeight / 2) + "\" orient=\"auto\"><polygon points=\"0 0," + markerWidth + " " + (markerHeight / 2) + ",0 " + markerHeight + "\" fill=\"" + color + "\" opacity=\"" + opacity + "\" /></marker></defs>" +
                "<line x1=\"" + x1 + "\" y1=\"" + y1 + "\" x2=\"" + endX + "\" y2=\"" + endY + "\" stroke=\"" + color + "\" stroke-width=\"" + strokeWidth + "\" stroke-linecap=\"round\" opacity=\"" + Math.max(0.25, opacity * 0.6) + "\" style=\"filter:blur(" + blurAmount + ");\" />" +
                "<line x1=\"" + x1 + "\" y1=\"" + y1 + "\" x2=\"" + endX + "\" y2=\"" + endY + "\" stroke=\"" + color + "\" stroke-width=\"" + strokeWidth + "\" stroke-linecap=\"round\" marker-end=\"url(#pvah-" + uid + ")\" opacity=\"" + opacity + "\" />" +
                "<circle cx=\"" + x1 + "\" cy=\"" + y1 + "\" r=\"" + circleRadius + "\" fill=\"none\" stroke=\"" + color + "\" stroke-width=\"3\" opacity=\"" + Math.min(1, opacity + 0.1) + "\" />" +
                "<circle cx=\"" + x1 + "\" cy=\"" + y1 + "\" r=\"" + (circleRadius - 3) + "\" fill=\"none\" stroke=\"" + color + "\" stroke-width=\"1\" opacity=\"" + (opacity * 0.5) + "\" />" +
                "<circle cx=\"" + x1 + "\" cy=\"" + y1 + "\" r=\"" + (circleRadius - 4) + "\" fill=\"" + color + "\" opacity=\"" + numberBgOpacity + "\" />" +
                "<text x=\"" + x1 + "\" y=\"" + (y1 + textYOffset) + "\" text-anchor=\"middle\" font-size=\"11\" font-weight=\"900\" fill=\"" + textColor + "\" stroke=\"" + textStroke + "\" stroke-width=\"0.8\" paint-order=\"stroke\" pointer-events=\"none\">" + (index + 1) + "</text>" + evalBadgeSvg;
            return svg;
        },

        _removePVArrowsByType: function (isAnalysis) {
            for (let i = this._pvArrowElements.length - 1; i >= 0; i--) { let el = this._pvArrowElements[i]; let elIsAnalysis = el.getAttribute("data-analysis") === "true"; if (elIsAnalysis === isAnalysis) { if (el.parentNode) el.parentNode.removeChild(el); this._pvArrowElements.splice(i, 1); } }
        },

        _removePVArrowsDOM: function () {
            this._pvArrowElements.forEach(function (el) { if (el.parentNode) el.parentNode.removeChild(el); }); this._pvArrowElements = [];
            $$(".chess-assist-pv-arrow").forEach(function (el) { el.remove(); });
        },

        clearBestmoveArrows: function () {
            this._bestmoveArrowElements.forEach(function (el) { if (el.parentNode) el.parentNode.removeChild(el); }); this._bestmoveArrowElements = [];
            $$(".chess-assist-bestmove-arrow").forEach(function (el) { el.remove(); });
        },

        clearPVArrows: function () {
            this._pvArrowElements = []; this._removePVArrowsDOM();
            State.lastRenderedMainPV = ""; State.lastRenderedAnalysisPV = ""; State.lastMainPVDrawTime = 0; State.lastAnalysisPVDrawTime = 0;
            this._lastDrawnIsAnalysis = null; this._lastArrowMoves = null;
        },

        clearHighlights: function () { this._removeHighlightSquares(); this._lastHighlightedMove = null; },

        clearAll: function () {
            this._removeHighlightSquares(); this._removePVArrowsDOM(); this.clearBestmoveArrows();
            this._lastDrawnIsAnalysis = null; this._lastHighlightedMove = null; this._lastArrowMoves = null;
            State.lastRenderedMainPV = ""; State.lastRenderedAnalysisPV = ""; State.lastMainPVDrawTime = 0; State.lastAnalysisPVDrawTime = 0;
        },

        updateTurnLEDs: function () {
            let myTurnLed = $("#GILIRAN-SAYA"); let oppTurnLed = $("#GILIRAN-LAWAN"); let engineLed = $("#engine-status-led");
            if (engineLed) engineLed.classList.toggle("active", State.isThinking || State.isAnalysisThinking);
            if (!myTurnLed || !oppTurnLed) return;
            let myTurn = isPlayersTurn(); myTurnLed.classList.toggle("active", myTurn); oppTurnLed.classList.toggle("active", !myTurn);
        },

        updateClock: function () {
            this.touchHeartbeat(); const clock = $("#digital-clock");
            if (clock) { const timeString = new Date().toLocaleTimeString("en-US", { hour12: false }); clock.textContent = timeString; }
        }
    };

    // =====================================================
    // Section 38: UI Module Facade
    // =====================================================
    UI.Modules = {
        Core: { updateStatusInfo: UI.updateStatusInfo.bind(UI), updateClock: UI.updateClock.bind(UI), updateTurnLEDs: UI.updateTurnLEDs.bind(UI), clearAll: UI.clearAll.bind(UI) },
        Visuals: { drawPVArrows: UI.drawPVArrows.bind(UI), drawBestmoveArrows: UI.drawBestmoveArrows.bind(UI), clearPVArrows: UI.clearPVArrows.bind(UI), clearBestmoveArrows: UI.clearBestmoveArrows.bind(UI), clearHighlights: UI.clearHighlights.bind(UI), removeAllVisuals: UI._removeAllVisuals.bind(UI) },
        Analysis: { updateAnalysisBar: UI.updateAnalysisBar.bind(UI), updateAnalysisMonitorDisplay: UI.updateAnalysisMonitorDisplay.bind(UI), updatePVDisplay: UI.updatePVDisplay.bind(UI) },
        History: { updateACPL: UI.updateACPL.bind(UI), applyMoveHistoryFilter: UI.applyMoveHistoryFilter.bind(UI), updateMove: UI.updateMove.bind(UI) },
        Diagnostics: { updateDiagnosticsDisplay: UI.updateDiagnosticsDisplay.bind(UI), updateCCTDebugDisplay: UI.updateCCTDebugDisplay.bind(UI), touchHeartbeat: UI.touchHeartbeat.bind(UI) },
        Modes: { togglePanicMode: UI.togglePanicMode.bind(UI), toggleStreamProof: UI.toggleStreamProof.bind(UI), toggleMoveMode: UI.toggleMoveMode.bind(UI), showHotkeyHelp: UI.showHotkeyHelp.bind(UI) }
    };

    // =====================================================
    // Section 39: Auto Resignation Logic
    // =====================================================
    let _resignInProgress = false;

    function resetResignState() {
        _resignTriggerCount = 0;
        _resignInProgress = false;
        if (_resignTimeout) { clearTimeout(_resignTimeout); _resignTimeout = null; }
        if (_resignObserver) { _resignObserver.disconnect(); _resignObserver = null; }
    }

    function checkAutoResign(scoreType, scoreValue) {
        if (!State.autoResignEnabled || State.gameEnded || _resignInProgress) return;

        let trigger = false;
        if (State.resignMode === "cp") {
            if (scoreType === "cp" && scoreValue <= -Math.abs(State.autoResignThresholdCp)) trigger = true;
        } else if (State.resignMode === "mate") {
            if (scoreType === "mate" && scoreValue < 0) {
                if (Math.abs(scoreValue) <= State.autoResignThresholdMate) trigger = true;
            }
        }

        if (trigger) {
            _resignTriggerCount++;
            State.statusInfo = "Auto-resign: " + scoreType + " " + scoreValue + " (" + _resignTriggerCount + "/" + _resignTriggerNeeded + ")";
            UI.updateStatusInfo();

            if (_resignTriggerCount >= _resignTriggerNeeded && !_resignTimeout) {
                _resignInProgress = true;
                log("[AutoResign] Threshold reached, resigning in 1.5s...");
                _resignTimeout = setTimeout(resignGame, 1500);
            }
        } else {
            if (_resignTriggerCount > 0) _resignTriggerCount--;
        }
    }

    function _clickButtonRobust(button) {
        if (!button) return false;
        try {
            let rect = button.getBoundingClientRect();
            let cx = rect.left + rect.width / 2;
            let cy = rect.top + rect.height / 2;
            let opts = { bubbles: true, cancelable: true, clientX: cx, clientY: cy, button: 0, buttons: 1 };
            button.dispatchEvent(new PointerEvent("pointerdown", Object.assign({ pointerId: 1, pointerType: "mouse", isPrimary: true }, opts)));
            button.dispatchEvent(new MouseEvent("mousedown", opts));
            button.dispatchEvent(new PointerEvent("pointerup", Object.assign({ pointerId: 1, pointerType: "mouse", isPrimary: true }, opts)));
            button.dispatchEvent(new MouseEvent("mouseup", opts));
            button.dispatchEvent(new MouseEvent("click", opts));
            return true;
        } catch (e) { }
        try { button.click(); return true; } catch (e2) { }
        return false;
    }

    function _findResignButton() {
        let selectors = [
            'button[data-cy="resign-button-with-confirmation"]',
            'button[data-cy="resign-button"]',
            'button[aria-label="Resign"]',
            'button[data-cy="game-controls-resign"]',
            '.resign-button'
        ];
        for (let i = 0; i < selectors.length; i++) {
            let el = document.querySelector(selectors[i]);
            if (el) return el;
        }
        return Array.from(document.querySelectorAll("button")).find(function (btn) {
            let text = (btn.getAttribute("aria-label") || btn.textContent || "").trim().toLowerCase();
            return text === "resign" || text === "menyerah";
        }) || null;
    }

    function _findResignConfirmButton() {
        let selectors = [
            '[data-cy="popover-resign-confirmation"] button[data-cy="confirmation-popover-confirm-button"]',
            '[data-cy="confirmation-popover"] button[data-cy="confirmation-popover-confirm-button"]',
            'button[data-cy="confirmation-popover-confirm-button"]',
            'button[data-cy="confirm-yes"]',
            'button[data-cy="confirm-modal-primary-button"].cc-button-danger'
        ];
        for (let i = 0; i < selectors.length; i++) {
            let el = document.querySelector(selectors[i]);
            if (el) return el;
        }
        return Array.from(document.querySelectorAll("button")).find(function (el) {
            if (!el || el.disabled) return false;
            let dataCy = (el.getAttribute("data-cy") || "").toLowerCase();
            let cls = (el.className || "").toLowerCase();
            let text = (el.textContent || "").trim().toLowerCase();
            return dataCy.includes("confirmation-popover-confirm-button") ||
                (cls.includes("cc-button-danger") && (text === "menyerah" || text === "resign"));
        }) || null;
    }

    function resignGame() {
        if (State.gameEnded) { resetResignState(); return; }

        let cleanupDone = false;
        function cleanup() {
            if (cleanupDone) return;
            cleanupDone = true;
            _resignInProgress = false;
            if (_resignObserver) { _resignObserver.disconnect(); _resignObserver = null; }
            if (_resignTimeout) { clearTimeout(_resignTimeout); _resignTimeout = null; }
        }

        let resignButton = _findResignButton();
        if (!resignButton) {
            warn("[AutoResign] Resign button not found");
            cleanup();
            return;
        }

        _resignObserver = new MutationObserver(function () {
            let confirmBtn = _findResignConfirmButton();
            if (confirmBtn) {
                log("[AutoResign] Confirm button found via observer");
                _clickButtonRobust(confirmBtn);
                State.gameEnded = true;
                cleanup();
            }
        });
        let modalContainer = document.querySelector('.modal-container') || document.body;
        _resignObserver.observe(modalContainer, { childList: true, subtree: true });

        log("[AutoResign] Clicking resign button");
        _clickButtonRobust(resignButton);

        let immediateConfirm = _findResignConfirmButton();
        if (immediateConfirm) {
            log("[AutoResign] Confirm found immediately");
            _clickButtonRobust(immediateConfirm);
            State.gameEnded = true;
            cleanup();
            return;
        }

        let pollCount = 0;
        let pollMax = 10;
        function pollConfirm() {
            if (cleanupDone || State.gameEnded) return;
            pollCount++;
            let btn = _findResignConfirmButton();
            if (btn) {
                log("[AutoResign] Confirm found via polling (attempt " + pollCount + ")");
                _clickButtonRobust(btn);
                State.gameEnded = true;
                cleanup();
                return;
            }
            if (pollCount < pollMax) {
                scheduleManagedTimeout(pollConfirm, 500);
            } else {
                warn("[AutoResign] Confirm button not found after " + pollMax + " polls");
                cleanup();
            }
        }
        scheduleManagedTimeout(pollConfirm, 500);

        _resignTimeout = setTimeout(function () {
            if (!cleanupDone) {
                warn("[AutoResign] Timeout — cleanup");
                cleanup();
            }
        }, 8000);
    }

    // =====================================================
    // Section 40: Auto Match System
    // =====================================================
    let AutoMatch = {
        inProgress: false, lastAttemptTime: 0, attemptCount: 0, MAX_ATTEMPTS: 5, ACTION_DELAY_MS: 5000, INITIAL_WAIT_MS: 3000, POLL_INTERVAL_MS: 1000, POLL_TIMEOUT_MS: 20000, CLICK_SETTLE_MS: 800, LANGUAGE_MODE: "auto",
        _isAllowedContext: function () { let pathname = String(window.location.pathname || ""); let allowedPathHints = ["/play", "/game", "/live", "/daily", "/computer"]; let hasAllowedPath = allowedPathHints.some(function (p) { return pathname.indexOf(p) !== -1; }); let hasBoard = !!getBoardElement(); let hasKnownGameShell = !!(document.querySelector("#board-layout-chessboard") || document.querySelector(".board-layout-chessboard") || document.querySelector("[data-cy='board-layout']")); if (hasAllowedPath && (hasBoard || hasKnownGameShell)) return true; if (String(window.location.href || "").indexOf("chess.com/play") !== -1 && hasBoard) return true; return false; },
        _resolveLexicon: function () { let mode = (this.LANGUAGE_MODE || "auto").toLowerCase(); let docLang = String(document.documentElement && document.documentElement.lang || "").toLowerCase(); let bodyText = String((document.body && document.body.textContent) || "").toLowerCase(); if (mode !== "auto") { return mode === "id" ? this._LEXICON_ID : this._LEXICON_EN; } let idSignals = ["menyerah", "batal", "tanding ulang", "game baru", "pertandingan baru", "tolak"]; let idScore = idSignals.reduce(function (acc, w) { return acc + (bodyText.indexOf(w) !== -1 ? 1 : 0); }, 0); if (docLang.indexOf("id") !== -1 || idScore >= 2) { return this._LEXICON_ID; } return this._LEXICON_EN; },
        _LEXICON_EN: { decline: ["decline", "reject", "no"], newGame: ["new game", "new 10 min", "new 5 min", "new 3 min", "new 1 min", "new 15 min", "new 30 min"], rematch: ["rematch", "play again"] },
        _LEXICON_ID: { decline: ["tolak", "reject", "tidak", "batal"], newGame: ["baru", "game baru", "pertandingan baru", "main baru", "mnt baru", "10 mnt baru", "5 mnt baru", "3 mnt baru", "1 mnt baru", "15 mnt baru", "30 mnt baru"], rematch: ["tanding ulang", "main lagi", "rematch"] },
        _visible: function (el) { if (!el) return false; return el.offsetParent !== null && el.offsetWidth > 0 && el.offsetHeight > 0 && !el.disabled && getComputedStyle(el).visibility !== 'hidden' && getComputedStyle(el).display !== 'none'; },
        _isButtonClickable: function (el) { if (!el) return false; let rect = el.getBoundingClientRect(); return rect.width > 0 && rect.height > 0 && rect.top >= 0 && rect.left >= 0 && rect.bottom <= window.innerHeight && rect.right <= window.innerWidth; },
        _findButton: function (selectors, predicate, priorityText) {
            let candidates = []; let self = this;
            for (let si = 0; si < selectors.length; si++) { let nodes; try { nodes = $$(selectors[si]); } catch (e) { continue; } for (let ni = 0; ni < nodes.length; ni++) { let el = nodes[ni]; if (!self._visible(el)) continue; let txt = (el.textContent || el.innerText || "").trim().toLowerCase(); let ariaLabel = (el.getAttribute("aria-label") || "").toLowerCase(); let title = (el.getAttribute("title") || "").toLowerCase(); let dataCy = (el.getAttribute("data-cy") || "").toLowerCase(); let score = 0; if (predicate) { if (predicate(txt, el)) score += 10; if (predicate(ariaLabel, el)) score += 8; if (predicate(title, el)) score += 6; } if (priorityText && priorityText.length > 0) { for (let pt of priorityText) { let ptLower = pt.toLowerCase(); if (txt === ptLower) score += 25; else if (txt.includes(ptLower)) score += 15; if (ariaLabel === ptLower) score += 20; else if (ariaLabel.includes(ptLower)) score += 12; } } if (dataCy.includes("decline")) score += 30; if (dataCy.includes("new-game")) score += 25; if (dataCy.includes("rematch")) score += 20; if (score > 0) { candidates.push({ el, score, text: txt }); } } }
            candidates.sort((a, b) => b.score - a.score);
            if (candidates.length > 0) { log("[AutoMatch] Best candidate:", candidates[0].text, "score:", candidates[0].score); return candidates[0].el; } return null;
        },
        _clickElement: function (el, description) {
            if (!el) { warn("[AutoMatch] No element to click:", description); return false; }
            log("[AutoMatch] Clicking:", description, "| Text:", el.textContent?.trim());
            try { let rect = el.getBoundingClientRect(); let centerX = rect.left + rect.width / 2; let centerY = rect.top + rect.height / 2; const events = [['pointerdown', { bubbles: true, cancelable: true, clientX: centerX, clientY: centerY, pointerId: 1, pointerType: 'mouse', isPrimary: true }], ['mousedown', { bubbles: true, cancelable: true, clientX: centerX, clientY: centerY, button: 0, buttons: 1 }], ['pointerup', { bubbles: true, cancelable: true, clientX: centerX, clientY: centerY, pointerId: 1, pointerType: 'mouse' }], ['mouseup', { bubbles: true, cancelable: true, clientX: centerX, clientY: centerY, button: 0 }], ['click', { bubbles: true, cancelable: true, clientX: centerX, clientY: centerY }]]; for (let [eventType, options] of events) { let event; if (eventType.startsWith('pointer')) { event = new PointerEvent(eventType, options); } else { event = new MouseEvent(eventType, options); } el.dispatchEvent(event); } scheduleManagedTimeout(() => { try { el.click(); } catch (e) { } }, 50); return true; } catch (e) { err("[AutoMatch] Click error:", e); try { el.click(); return true; } catch (e2) { return false; } }
        },
        _detectGameOver: function () {
            const selectors = [".game-result-component", ".game-over-modal-content", ".game-over-modal-component", ".game-over-ad-component", ".game-over-ad-container-component", ".daily-game-footer-game-over", "[data-cy='game-over-modal']", "[data-cy='game-result-modal']", ".game-over-secondary-actions-row-component", ".game-over-buttons-component", ".game-over-modal-buttons", "[data-cy='game-over-modal-new-game-button']", "[data-cy='game-over-modal-rematch-button']", "[data-cy='rematch-button']", "[data-cy='rematch-request-modal']", "[data-cy='rematch-offer-modal']", ".rematch-request-component", ".rematch-offer-component"];
            let self = this; for (let sel of selectors) { let el = $(sel); if (el && self._visible(el)) { log("[AutoMatch] Game over detected via:", sel); return true; } }
            let newGameBtn = $("[data-cy='game-over-modal-new-game-button']"); let rematchBtn = $("[data-cy='game-over-modal-rematch-button']"); let newBotBtn = $("[data-cy='game-over-modal-new-bot-button']"); let declineBtn = $("[data-cy='rematch-decline-button']");
            if ((newGameBtn && self._visible(newGameBtn)) || (rematchBtn && self._visible(rematchBtn)) || (newBotBtn && self._visible(newBotBtn)) || (declineBtn && self._visible(declineBtn))) { log("[AutoMatch] Game over detected via buttons"); return true; } return false;
        },
        _detectRematchRequest: function () {
            let self = this;
            const declineSelectors = ["[data-cy='rematch-decline-button']", "[data-cy='decline-rematch-button']", "button[data-cy*='decline']", "button[data-cy*='reject']"];
            const requestModalSelectors = ["[data-cy='rematch-request-modal']", "[data-cy='rematch-offer-modal']", ".rematch-request-component", ".rematch-offer-component", ".rematch-dialog-component"];
            for (let sel of requestModalSelectors) { let el = $(sel); if (el && self._visible(el)) { return true; } }
            for (let sel of declineSelectors) { let el = $(sel); if (el && self._visible(el)) { return true; } } return false;
        },
        _findActionableButton: function () {
            let lex = this._resolveLexicon();
            let self = this;

            let directBtn = document.querySelector("[data-cy='game-over-modal-new-game-button']");
            if (directBtn && self._visible(directBtn) && self._isButtonClickable(directBtn)) {
                let txt = (directBtn.textContent || "").trim().toLowerCase();
                let isRematch = (lex.rematch || []).some(function (kw) { return txt.includes(kw); });
                if (!isRematch) {
                    log("[AutoMatch] Direct match: data-cy new-game-button, text: " + txt);
                    return { el: directBtn, type: "newgame" };
                }
            }

            if (this._detectRematchRequest()) {
                let declineBtn = this._findButton(["[data-cy='rematch-decline-button']", "[data-cy='decline-rematch-button']", "button[data-cy*='decline']", "button[data-cy*='reject']", "button[data-cy*='tolak']"], function (txt) { return (lex.decline || []).some(function (kw) { return txt.includes(kw); }); }, (lex.decline || []).map(function (w) { return w.charAt(0).toUpperCase() + w.slice(1); }));
                if (declineBtn && this._isButtonClickable(declineBtn)) return { el: declineBtn, type: "decline" };
            }

            let newGameBtn = this._findButton(["[data-cy='game-over-modal-new-game-button']", "[data-cy='new-game-button']", "button[data-cy*='new-game']", "button[data-cy*='new_game']"], function (txt) { let hasNewGame = (lex.newGame || []).some(function (kw) { return txt.includes(kw); }); let isRematch = (lex.rematch || []).some(function (kw) { return txt.includes(kw); }) || txt.includes("lagi") || txt.includes("tanding"); return hasNewGame && !isRematch; }, (lex.newGame || []).map(function (w) { return w.split(" ").map(function (p) { return p.charAt(0).toUpperCase() + p.slice(1); }).join(" "); }));
            if (newGameBtn && this._isButtonClickable(newGameBtn)) return { el: newGameBtn, type: "newgame" };

            let fallbackBtn = this._findButton(["button", "a[role='button']", "[role='button']"], function (txt, el) {
                let dataCy = (el.getAttribute("data-cy") || "").toLowerCase();
                if (dataCy.includes("rematch")) return false;
                let ariaLabel = (el.getAttribute("aria-label") || "").toLowerCase();
                if (ariaLabel.includes("tanding") || ariaLabel.includes("rematch")) return false;
                if (txt.includes("tanding") || txt.includes("rematch") || txt.includes("lagi")) return false;
                return (lex.newGame || []).some(function (kw) { return txt.includes(kw); });
            });
            if (fallbackBtn && this._isButtonClickable(fallbackBtn)) return { el: fallbackBtn, type: "fallback" };

            return null;
        },

        try: function () {
            let now = Date.now();
            if (!this._isAllowedContext()) { this.attemptCount = 0; return; }
            if (now - this.lastAttemptTime < this.ACTION_DELAY_MS) return;
            this.lastAttemptTime = now;
            if (this.inProgress) return;
            if (!this._detectGameOver()) { this.attemptCount = 0; return; }
            this.inProgress = true;
            this.attemptCount++;
            log("[AutoMatch] Attempt", this.attemptCount, "— waiting for button...");

            let self = this;
            let pollStart = Date.now();

            sleep(self.INITIAL_WAIT_MS).then(function () {
                return new Promise(function (resolve) {
                    function poll() {
                        if (!_allLoopsActive || !State.autoMatch) { resolve(false); return; }
                        if (Date.now() - pollStart > self.POLL_TIMEOUT_MS) {
                            warn("[AutoMatch] Poll timeout — no button found in " + self.POLL_TIMEOUT_MS + "ms");
                            resolve(false);
                            return;
                        }

                        let found = self._findActionableButton();
                        if (found) {
                            log("[AutoMatch] Button found: " + found.type + " — settling " + self.CLICK_SETTLE_MS + "ms");
                            sleep(self.CLICK_SETTLE_MS).then(function () {
                                let recheck = self._findActionableButton();
                                if (recheck && recheck.el === found.el && self._isButtonClickable(recheck.el)) {
                                    resolve(recheck);
                                } else {
                                    log("[AutoMatch] Button disappeared after settle, re-polling...");
                                    scheduleManagedTimeout(poll, self.POLL_INTERVAL_MS);
                                }
                            });
                        } else {
                            scheduleManagedTimeout(poll, self.POLL_INTERVAL_MS);
                        }
                    }
                    poll();
                });
            }).then(function (found) {
                if (!found) {
                    self.inProgress = false;
                    if (self.attemptCount < self.MAX_ATTEMPTS) {
                        scheduleManagedTimeout(function () { self.try(); }, self.ACTION_DELAY_MS);
                    } else {
                        self.attemptCount = 0;
                    }
                    return;
                }

                if (found.type === "decline") {
                    self._clickElement(found.el, "Decline Rematch");
                    log("[AutoMatch] Declined rematch, will look for New Game next...");
                    self.inProgress = false;
                    scheduleManagedTimeout(function () { self.try(); }, 3000);
                    return;
                }

                _suppressNewGameActionUntil = Date.now() + 1500;
                self._clickElement(found.el, "New Game (" + found.type + ")");
                if (typeof handleNewGame === "function") handleNewGame();

                scheduleManagedTimeout(function () {
                    if (!State.autoRun && State.autoMatch) {
                        saveSetting("autoRun", true);
                        syncToggleUI("btn-auto-run", true);
                        log("[AutoMatch] Auto Run enabled after new game");
                    }
                }, 3000);

                self.inProgress = false;
                self.attemptCount = 0;
                log("[AutoMatch] New game started!");
            }).catch(function (e) {
                err("[AutoMatch] Error:", e);
                self.inProgress = false;
            });
        }
    };

    // =====================================================
    // Section 41: Panel State Management
    // =====================================================
    function applyPanelState(state) {
        let panel = $("#chess-assist-panel");
        if (!panel) return;
        panel.classList.remove("minimized", "maximized", "closed");
        if (state !== "maximized") panel.classList.add(state);
        saveSetting("panelState", state);
        if (state === "closed") {
            if (UI && typeof UI.clearAll === "function") UI.clearAll();
        }
    }

    // =====================================================
    // Section 42: New Game Action Detection
    // =====================================================
    let newGameActionMouseDownHandler = function (e) {
        if (Date.now() < _suppressNewGameActionUntil) return;
        if (AutoMatch && typeof AutoMatch._isAllowedContext === "function" && !AutoMatch._isAllowedContext()) {
            return;
        }
        if (e.button !== 0) return;

        let target = e.target;
        let btnText = (target.innerText || target.textContent || "").toLowerCase();
        let dataCy = (target.getAttribute("data-cy") || "").toLowerCase();

        let isActionButton = false;
        let actionType = "";

        if (dataCy.includes("new-game") || dataCy.includes("newgame")) {
            isActionButton = true;
            actionType = "new-game";
        } else if (dataCy.includes("new-bot") || dataCy.includes("bot")) {
            isActionButton = true;
            actionType = "new-bot";
        } else if (dataCy.includes("rematch")) {
            isActionButton = true;
            actionType = "rematch";
        }

        if (!isActionButton) {
            if (btnText.includes("new game") ||
                btnText.includes("baru") ||
                btnText.includes("10 mnt") ||
                btnText.includes("5 mnt") ||
                btnText.includes("3 mnt") ||
                btnText.includes("1 mnt") ||
                btnText.includes("game baru")) {
                isActionButton = true;
                actionType = "new-game";
            }
            else if (btnText.includes("new bot") ||
                     btnText.includes("bot baru") ||
                     btnText.includes("play bot") ||
                     btnText.includes("main bot")) {
                isActionButton = true;
                actionType = "new-bot";
            }
            else if (btnText.includes("rematch") ||
                     btnText.includes("tanding ulang") ||
                     btnText.includes("main lagi")) {
                isActionButton = true;
                actionType = "rematch";
            }
        }

        if (!isActionButton && target.closest) {
            let parentButton = target.closest("button");
            if (parentButton) {
                let parentDataCy = (parentButton.getAttribute("data-cy") || "").toLowerCase();

                if (parentDataCy.includes("new-game") ||
                    parentDataCy.includes("new-bot") ||
                    parentDataCy.includes("rematch")) {
                    isActionButton = true;
                    actionType = parentDataCy.includes("bot") ? "new-bot" :
                    parentDataCy.includes("rematch") ? "rematch" : "new-game";
                }
            }
        }

        if (isActionButton) {
            let now = Date.now();
            if (now - State.lastNewGameLogTs < 2000) return;
            State.lastNewGameLogTs = now;

            log("Action button detected:", actionType, "| Text:", btnText);

            scheduleManagedTimeout(() => handleNewGame(), 500);
        }
    };
    document.addEventListener("mousedown", newGameActionMouseDownHandler, true);
    _eventListeners.push({ element: document, type: "mousedown", handler: newGameActionMouseDownHandler, options: true });

    // =====================================================
    // Section 43: Initialization and Main Loop
    // =====================================================
    function handleNewGame() {
        log("[NewGame] Detected! Resetting all state");

        State.statusInfo = "New game detected";
        State.gameEnded = false;
        State.moveExecutionInProgress = false;
        resetResignState();

        UI.clearAll();

        CCTAnalyzer.clearCache();
        ThreatDetectionSystem.clearCache();

        MoveHistory.clear();

        SmartPremove.resetExecutionTracking();
        Engine.resetPremoveState();
        Syzygy.clear();

        State.lastAutoRunFen = null;
        State._lastAnalysisFen = null;

        State.mainPVLine = [];
        State.analysisPVLine = [];
        State.principalVariation = "";

        State.premoveExecutedForFen = null;
        State.premoveAnalysisInProgress = false;
        State.premoveLastAnalysisTime = 0;
        State.premoveRetryCount = 0;
        State.premoveLiveChance = 0;
        State.premoveTargetChance = clamp(State.premoveMinConfidence || 0, 0, 100);
        State.premoveLastEvalDisplay = "-";
        State.premoveLastMoveDisplay = "-";
        State.premoveChanceReason = "Waiting for engine PV";
        State.premoveChanceUpdatedTs = 0;
        State.analysisHistoryCursor = 0;
        State.analysisAcplFen = "";
        State.analysisEvalText = "0.00";
        State.analysisLastRecordedKey = "";
        State._analysisAutoPlayApproved = false;
        State._analysisAutoPlayMove = null;

        if (Engine.main) Engine.main.postMessage("ucinewgame");

        let openingDisp = $("#currentOpeningDisplay");
        if (openingDisp) {
            openingDisp.textContent = "Game Start";
            openingDisp.style.color = "#1E90FF";
        }

        _OPENING_BOOK_CACHE = null;
        _OPENING_NAMES_CACHE = null;
        _openingBookVersion = 0;

        State.statusInfo = "New Game Started";
        UI.updateStatusInfo();
        UI.updateSyzygyDisplay();
    }

    function startMainLoop() {
        if (State.loopStarted) {
            log("[MainLoop] Already started, skipping");
            return;
        }
        State.loopStarted = true;
        log("[MainLoop] Starting...");

        UI.initPanicKey();

        let clockLoop = function () {
            if (!_allLoopsActive) return;
            const startedAt = RuntimeGuard._nowMs();
            try {
                UI.updateClock();
                if (UI && typeof UI._refreshEvalBarStatus === "function") UI._refreshEvalBarStatus();
            } catch (e) { }
            RuntimeGuard.trackLoop("clockLoop", startedAt);
            scheduleManagedTimeout(clockLoop, 1000 + randomInt(-150, 150));
        };
        clockLoop();

        let mainLoop = function () {
            if (!_allLoopsActive) return;
            const startedAt = RuntimeGuard._nowMs();
            try {
                UI.updateTurnLEDs();

                if (State.analysisMode) {
                    if (State.gameEnded) State.gameEnded = false;
                    analysisCheck();
                    RuntimeGuard.trackLoop("mainLoop", startedAt);
                    scheduleNextMainLoop();
                    return;
                }

                if (State.gameEnded) {
                    RuntimeGuard.trackLoop("mainLoop", startedAt);
                    scheduleNextMainLoop();
                    return;
                }

                let myTurn = isPlayersTurn();

                if (myTurn) {

                    if (State.autoRun && Math.random() > 0.08) {
                        autoRunCheck();
                    }
                } else {

                    if (State.premoveEnabled && !State.premoveAnalysisInProgress) {
                        premoveCheck();
                    }
                }
            } catch (e) {
                warn("[MainLoop] Error:", e);
            }

            RuntimeGuard.trackLoop("mainLoop", startedAt);
            scheduleNextMainLoop();
        };

        let scheduleNextMainLoop = function () {
            if (!_allLoopsActive) return;
            let baseInterval = CONFIG.UPDATE_INTERVAL;
            let jitter = (Math.random() - 0.5) * 60;
            let nextInterval = Math.max(80, Math.floor(baseInterval + jitter));
            scheduleManagedTimeout(mainLoop, nextInterval);
        };

        scheduleNextMainLoop();

        let autoMatchAttempts = 0;
        let autoMatchLoop = function () {
            if (!_allLoopsActive) return;
            const startedAt = RuntimeGuard._nowMs();
            try {
                autoMatchCheck();
            } catch (e) { }
            RuntimeGuard.trackLoop("autoMatchLoop", startedAt);
            let baseDelay = Math.min(3000 + (autoMatchAttempts * 200), 8000);
            let nextCheck = baseDelay + randomInt(-400, 400);
            autoMatchAttempts = (autoMatchAttempts + 1) % 10;
            scheduleManagedTimeout(autoMatchLoop, nextCheck);
        };
        autoMatchLoop();

        let gameOverLoop = function () {
            if (!_allLoopsActive) return;
            const startedAt = RuntimeGuard._nowMs();
            try {
                if (State.analysisMode) {
                    if (State.gameEnded) State.gameEnded = false;
                    RuntimeGuard.trackLoop("gameOverLoop", startedAt);
                    scheduleManagedTimeout(gameOverLoop, 1500 + randomInt(-250, 250));
                    return;
                }

                let isGameOver = false;
                let endReason = "";

                let gameOverSelectors = [
                    ".game-over-modal-shell-container",
                    ".game-over-modal-container",
                    "[data-cy='game-over-modal-content']",
                    ".game-over-modal-shell-content",
                    "[data-cy='game-over-header']",
                    ".game-over-modal-header-component",
                    "[data-cy='game-over-ad-container']",
                    ".game-over-modal-shell-buttons",
                    "[data-cy='game-over-new-game-button']"
                ];

                for (let i = 0; i < gameOverSelectors.length; i++) {
                    if ($(gameOverSelectors[i])) {
                        isGameOver = true;
                        endReason = "DOM";
                        break;
                    }
                }

                if (!isGameOver) {
                    let fen = getAccurateFen();
                    if (fen) {
                        let game = getGame();
                        if (game && typeof game.isGameOver === 'function' && game.isGameOver()) {
                            isGameOver = true;
                            endReason = "API";
                        }
                    }
                }

                if (isGameOver && !State.gameEnded) {
                    log("[GameOver] Detected:", endReason);
                    State.statusInfo = "Game ended: " + endReason;
                    State.gameEnded = true;

                    saveSetting("autoRun", false);
                    syncToggleUI("btn-auto-run", false);

                    UI.clearAll();
                    UI._removeAllVisuals();

                    if (State.autoMatch) {
                        scheduleManagedTimeout(function () {
                            if (_allLoopsActive) AutoMatch.try();
                        }, 2000 + randomInt(0, 1000));
                    }
                }
            } catch (e) { }

            RuntimeGuard.trackLoop("gameOverLoop", startedAt);
            scheduleManagedTimeout(gameOverLoop, 1500 + randomInt(-250, 250));
        };
        gameOverLoop();

        let prevFen = "";
        let fenPollLoop = function () {
            if (!_allLoopsActive) return;
            const startedAt = RuntimeGuard._nowMs();
            try {
                let fen = getAccurateFen();
                if (!fen) {
                    RuntimeGuard.trackLoop("fenPollLoop", startedAt);
                    if (_allLoopsActive) scheduleManagedTimeout(fenPollLoop, CONFIG.FEN_POLL_INTERVAL);
                    return;
                }

                if (fen.indexOf("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR") === 0) {
                    if (prevFen && prevFen.indexOf("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR") !== 0) {
                        handleNewGame();
                    }
                }
                prevFen = fen;
                Syzygy.maybeProbe(fen);

                if (Math.random() < 0.1) {
                    applyAutoDepthFromOpponent();
                    updateMoveNumber(fen);
                    trimCaches();
                }
            } catch (e) { }

            RuntimeGuard.trackLoop("fenPollLoop", startedAt);
            if (_allLoopsActive) scheduleManagedTimeout(fenPollLoop, CONFIG.FEN_POLL_INTERVAL + randomInt(-30, 30));
        };
        fenPollLoop();

        let runtimeWatchdogLoop = function () {
            if (!_allLoopsActive) return;
            const startedAt = RuntimeGuard._nowMs();
            try {
                RuntimeGuard.checkCachePressure();
                RuntimeGuard.checkPremoveWatchdog();
                RuntimeGuard.checkEngineWatchdog();
                RuntimeGuard.checkUIWatchdog();
                RuntimeGuard.logSoakSummary();
                UI.updateDiagnosticsDisplay();
                trimTimeoutIds();
            } catch (e) {
                warn("[Watchdog] Error:", e);
            }
            RuntimeGuard.trackLoop("runtimeWatchdogLoop", startedAt);
            scheduleManagedTimeout(runtimeWatchdogLoop, 5000 + randomInt(-600, 600));
        };
        runtimeWatchdogLoop();

        _premoveCacheClearInterval = setInterval(function () {
            if (!_allLoopsActive) {
                clearInterval(_premoveCacheClearInterval);
                return;
            }
            try {
                trimCaches();
            } catch (e) { }
        }, 30000);
    }

    function init() {
        State.statusInfo = "Starting initialization...";

        let loadPromise = isTampermonkey ? Promise.resolve(true) : loadStockfishManually();

        loadPromise.then(function () {
            return sleep(1000);
        }).then(function () {
            let attempts = 0;
            let waitForBoard = function () {
                if (getBoardElement() || attempts >= 30) return Promise.resolve();
                attempts++;
                return sleep(500).then(waitForBoard);
            };
            return waitForBoard();
        }).then(function () {
            return Engine.init();
        }).then(function (engineOk) {
            if (!engineOk) {
                err("Engine failed to initialize");
                return sleep(2000).then(function () {
                    return Engine.init();
                });
            }
            return true;
        }).then(function () {

            createPanel();
            let completeStartup = function () {
                startMainLoop();
                UI.updatePVDisplay();
                State.statusInfo = "Ready";
                UI.updateStatusInfo();

                if (State.analysisMode) {
                    Engine.loadAnalysisEngine();
                    let analysisHistoryBody = $("#moveHistoryTableBody");
                    if (analysisHistoryBody) analysisHistoryBody.innerHTML = "";
                    State.analysisHistoryCursor = 0;
                    State.analysisAcplFen = "";
                    State.analysisEvalText = "0.00";
                    State.analysisLastRecordedKey = "";
                    syncAnalysisMoveHistory();
                    State._lastAnalysisFen = null;
                    analysisCheck();
                }

                log("Initialization complete!");
            };

            if (!State.onboardingAccepted) {
                showWelcomeConsentModal(completeStartup);
            } else {
                completeStartup();
            }
        }).catch(function (e) {
            err("Initialization error:", e);
        });
    }

    function cleanupAll() {
        _allLoopsActive = false;
        clearManagedTimeouts();
        State.moveExecutionInProgress = false;

        cleanupEventListeners();
        UI.clearAll();
        UI._removeAllVisuals();

        CCTAnalyzer.clearCache();
        ThreatDetectionSystem.clearCache();
        Syzygy.clear();

        if (_premoveCacheClearInterval) {
            clearInterval(_premoveCacheClearInterval);
            _premoveCacheClearInterval = null;
        }

        if (pendingMoveTimeoutId) {
            clearTimeout(pendingMoveTimeoutId);
            pendingMoveTimeoutId = null;
        }

        if (_resignTimeout) {
            clearTimeout(_resignTimeout);
            _resignTimeout = null;
        }

        if (_resignObserver) {
            _resignObserver.disconnect();
            _resignObserver = null;
        }

        let welcomeOverlay = $("#cap-welcome-overlay");
        if (welcomeOverlay && welcomeOverlay.parentNode) {
            welcomeOverlay.parentNode.removeChild(welcomeOverlay);
        }

        Engine.terminate();
        cancelPendingMove();
    }

    let _cleanupDone = false;
    function runCleanupOnce() {
        if (_cleanupDone) return;
        _cleanupDone = true;
        cleanupAll();
    }

    window.addEventListener("beforeunload", function () {
        runCleanupOnce();
    });

    let _initStarted = false;
    function startInitOnce() {
        if (_initStarted) return;
        _initStarted = true;
        init();
    }

    if (document.readyState === "loading") {
        let domReadyHandler = function () {
            document.removeEventListener("DOMContentLoaded", domReadyHandler);
            startInitOnce();
        };
        document.addEventListener("DOMContentLoaded", domReadyHandler);
    } else {
        scheduleManagedTimeout(startInitOnce, 500);
    }

    // =====================================================
    // End of Chess.com Assistant Pro
    // =====================================================

})();

/*
______
/ ____/___ ____ ___ ____ ____ ________ _____
/ / / __ / __ `__ / __ / __ / ___/ _ / ___/
/ /___/ /_/ / / / / / / /_/ / /_/ (__ ) __/ /
____/____/_/ /_/ /_/ .___/____/____/___/_/
/_/

version 1.2.0 2025-02-12 16:20:11
*/
