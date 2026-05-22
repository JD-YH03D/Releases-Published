<div align="center">

<img src="https://static.wikia.nocookie.net/logopedia/images/3/32/Chess.com_2012.png/revision/latest?cb=20221006102754" 
     alt="Bintang Toba Pro Hero Image"
     width="70%">

# 🏆 Bintang Toba Pro - Chess.com Assistant

</div>

**Version:** 1.0.0  
**License:** GPL-3.0-only  
**Author:** JD-YH03D  
**Platform:** Chess.com (via Tampermonkey/Violentmonkey)

---

## 📖 Description

**Bintang Toba Pro** is a premium userscript for Chess.com that provides various chess automation and analysis features using the Stockfish engine. This script is designed to help players understand positions, train their skills, and automate repetitive actions.

---

## ⚡ Main Features

### 🧠 Engine Analysis
- **Stockfish 10** integration with multi-PV support
- Real-time evaluation (CP & Mate)
- Principal Variation (PV) arrows visualization
- Best move arrows with color grading
- Position analysis mode

### 🎯 Auto Move Execution
- Auto-run with customizable delay
- Humanized move timing (anti-detection)
- Clock sync mode (adaptive delay based on remaining time)
- Opening book support (external JSON)
- Consensus move selection

### 🔄 Premove System
- Smart premove with safety check
- CCT analysis (Checks, Captures, Threats)
- Risk assessment & confidence scoring
- Multi-PV convergence check
- Recapture & forced move detection

### ♟️ Auto Resign
- Mate-based resignation (M1-M10)
- Centipawn-based resignation (-100cp to -5000cp)
- Instant trigger for mate evaluation
- Gradual decay for CP evaluation (anti-false-positive)

### 🎮 Auto Match
- Automatic new game detection
- Auto-click "New Game" button
- Support for Indonesian & English UI
- Auto-run enable after new game (3s delay)
- Rematch decline support

### 📊 Statistics & Tracking
- ACPL (Average Centipawn Loss) tracking
- Move history with grades
- Evaluation bar with delta indicator
- Real-time diagnostics display

### 🛡️ Safety Features
- Blunder guard for analysis mode
- Stability check before auto-play
- Position verification before move execution
- Token system for premove execution
- Error recovery & self-healing workers

---

## 📦 Installation

### Prerequisites
1. **Browser:** Chrome, Firefox, Edge, or Chromium/Gecko-based browsers
2. **Extension Manager:** Tampermonkey or Violentmonkey

### Installation Steps

#### Option 1: From GreasyFork (Recommended)
```
1. Visit the GreasyFork script page
2. Click the "Install script" button
3. Confirm installation in Tampermonkey
4. The script will activate automatically on chess.com
```

#### Option 2: Manual Installation
```
1. Download the engine.js file
2. Open Tampermonkey dashboard
3. Click "Create a new script"
4. Copy-paste the entire contents of engine.js
5. Save (Ctrl+S)
6. Enable the script
```

#### Option 3: From GitHub
```bash
# Clone repository
git clone https://github.com/JD-YH03D/release.git

# Or download directly
wget https://raw.githubusercontent.com/JD-YH03D/release/refs/heads/main/Chess.com%20-%20Play%20Chess%20Online%20-%20Free%20Games/version1.0.0-release.js
```

---

## ⚙️ Configuration

### Panel Settings

| Setting | Default | Range | Description |
|---------|---------|-------|-------------|
| **Min Delay** | 0.5s | 0.05-60s | Minimum delay for auto move |
| **Max Delay** | 3.0s | 0.05-60s | Maximum delay for auto move |
| **Custom Depth** | 15 | 1-30 | Engine analysis depth |
| **Skill Level** | 20 | 0-20 | Stockfish skill level |
| **ELO Rating** | 1600 | 300-3200 | Human mode ELO |
| **Auto Resign (Mate)** | M3 | M1-M10 | Resignation threshold for mate |
| **Auto Resign (CP)** | -1000 | -100 to -5000 | Resignation threshold for centipawn |
| **Clock Sync** | OFF | ON/OFF | Adaptive delay based on clock |
| **Premove** | OFF | ON/OFF | Enable smart premove system |

### Hotkeys

| Shortcut | Action |
|----------|--------|
| `Alt + A..Z` | Set engine depth (1-26) |
| `Ctrl + Shift + H` | Toggle Panic Mode (hide all) |
| `Ctrl + Shift + S` | Toggle Stream Proof Mode |
| `Ctrl + Shift + M` | Toggle Move Execution Mode (Click/Drag) |
| `Ctrl + Shift + ?` | Open Hotkeys Help |
| `Esc` | Toggle panel open/closed |

---

## 🎮 How to Use

### Normal Mode (Auto Run)
```
1. Enable "Auto Run" in the panel
2. Set delay according to preference (recommended: 1-3s)
3. The script will automatically analyze the position
4. Move will be executed after the delay
```

### Analysis Mode
```
1. Enable "Analysis Mode" in the panel
2. Select auto-play color (White/Black/Off)
3. The script will analyze continuously
4. Auto-play move when stability threshold is reached
```

### Premove Mode
```
1. Enable "Premove System" in the panel
2. Select mode: Every/Capture/Filtered
3. Set confidence threshold (recommended: 60-80%)
4. The script will premove when confidence is high
```

### Auto Resign Setup
```
1. Enable "Auto Resign" in the panel
2. Select mode: Mate in or Centipawn
3. Set threshold:
   - Mate: M3 (resign at M3, M2, M1)
   - CP: -1000 (resign at -1000cp or worse)
4. The script will resign automatically when threshold is reached
```

---

## 🔧 Troubleshooting

### Script Not Working
```
✅ Make sure Tampermonkey/Violentmonkey is installed
✅ Make sure the script is enabled in the dashboard
✅ Make sure URL match: https://www.chess.com/*
✅ Refresh the chess.com page (Ctrl+F5)
✅ Check browser console for errors (F12)
```

### Engine Not Analyzing
```
✅ Check "Engine Status LED" in the panel (must be green)
✅ Click the "Reload" button in the More tab
✅ Make sure there are no script conflicts
✅ Clear browser cache
```

### Auto Move Not Executing
```
✅ Make sure "Auto Move Piece" is enabled
✅ Check if it's your turn (blue LED)
✅ Make sure delay is not too long
✅ Check console for error messages
```

### Premove Not Working
```
✅ Enable "Premove System"
✅ Make sure it's not your turn
✅ Check confidence threshold (lower if needed)
✅ See premove stats in the panel
```

### Auto Resign Not Triggering
```
✅ Make sure "Auto Resign" is enabled
✅ Check threshold setting (M4 vs M3)
✅ For CP: requires 3 consecutive triggers
✅ For Mate: instant trigger when threshold is reached
```

---

## 🤝 Contribution

### How to Contribute
```
1. Fork the repository
2. Create a feature branch (git checkout -b feature/AmazingFeature)
3. Commit changes (git commit -m 'Add AmazingFeature')
4. Push to branch (git push origin feature/AmazingFeature)
5. Open Pull Request
```

### Bug Report
If you find a bug, please create an issue with the following format:
```
**Describe the bug**
Clear description of the bug

**To Reproduce**
Steps to reproduce:
1. Go to '...'
2. Click on '....'
3. Scroll down to '....'
4. See error

**Expected behavior**
What should have happened

**Screenshots**
If any, add screenshots

**Environment:**
- Browser: [Chrome/Firefox/Edge]
- Tampermonkey Version: [x.x.x]
- Script Version: [1.2.0]
```

### Feature Request
```
**Is your feature request related to a problem?**
Problem description

**Describe the solution you'd like**
Desired solution

**Describe alternatives you've considered**
Alternatives you've considered

**Additional context**
Additional context
```

---

## 📄 License

Distributed under the **GPL-3.0-only License**.  
See [LICENSE](LICENSE) for more information.

### Commercial Use
❌ **Prohibited** for commercial use without permission  
✅ **Allowed** for personal use  
✅ **Allowed** for modification and distribution (with attribution)

---

## 🙏 Credits

- **Stockfish Team** - Chess engine
- **Chess.com** - Platform (unofficial script)
- **Tampermonkey** - Userscript manager
- **Contributors** - Everyone who has contributed

---

## 📞 Support

| Channel | Link |
|---------|------|
| **GitHub Issues** | [Report Bug / Request Feature](https://github.com/JD-YH03D/release/issues) |
| **GreasyFork** | [Script Discussion](https://greasyfork.org/id/users/1575724-qwerty-1) |

---

## ⚠️ Disclaimer

> **IMPORTANT:** This script is a tool for **learning and chess practice**.  
> Use for cheating in tournaments or rated games is **strictly prohibited** and may result in:
> - Account ban from Chess.com
> - Tournament disqualification
> - Rating reset

**Use wisely and responsibly!**

---

## 📝 Changelog

### v1.0.0 (Current)
- ✅ Fixed engine lock issue (_goLock immediate release)
- ✅ Opening book cache cleared on new game
- ✅ Timeout IDs auto-trimmed (memory optimization)
- ✅ Auto-resign instant trigger for mate evaluation
- ✅ Auto-match enable auto-run after new game
- ✅ Removed dead code & orphan variables
- ✅ Fixed AutoMatch button priority
- ✅ Fixed AutoMatch anti-"Rematch" filter

### v1.0.0 (Initial)
- Initial release

---

## 📊 Statistics

| Metric | Value |
|--------|-------|
| **Lines of Code** | ~10,577 |
| **Sections** | 43 |
| **Functions** | ~200+ |
| **Cache Systems** | 3 (CCT, Threat, Syzygy) |
| **Workers** | 3 (Main, Analysis, Premove) |
| **Supported Languages** | ID, EN |

---

**Made with ❤️ by JD-YH03D**
