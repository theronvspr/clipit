# clipit

**clipit** is a fast web-based video trimmer and compressor. It runs **100% in your browser**—meaning your video files never leave your computer and are processed locally without any cloud backend dependencies.

---

## Key Features

* **Lossless Cut (Fast Trim)**: Cuts videos by copy-streaming packets directly, snapped to the nearest keyframe.
* **Precise Trim (Frame-Accurate)**: Re-encodes clips to target precise start and end frames.
* **GPU Acceleration (WebCodecs)**: Uses the browser's native `VideoEncoder` API to render frame-accurate edits at up to 50x real-time speed (Chrome, Edge, and Safari utilize your physical GPU; Firefox falls back to optimized CPU-based native encoding via OpenH264).
* **CPU Fallback**: Automatically reverts to a highly optimized two-pass CPU re-encoding pipeline (`libx264` ultrafast preset) if hardware codecs are unsupported.
* **Audio Gain Control**: Attenuate or boost video volume up to 200% (+6dB) using the real-time Web Audio API node.
* **Size & Resolution Presets**:
  * **Discord Optimizations**: Snaps outputs to fits under Discord's 8MB, 25MB, or 50MB file size limits.
  * **Standard Profiles**: Presets for 1080p, 720p, or 480p targets.
  * **Custom Limits**: Target specific MB sizes with dynamic bitrate estimation.
  
---

## Technology Stack

* **Core**: React 19, TypeScript, Vite 8, Vanilla CSS
* **Video Encoding**: WebCodecs API (native hardware H.264 Baseline Profile `avc1.42e02a` to support Chrome, Edge, Safari, and Firefox's OpenH264)
* **Audio & Remuxing**: `ffmpeg.wasm` v0.12 (C-based compilation of FFmpeg running locally on WebAssembly)
* **Packaging**: `mp4-muxer` (lightweight, zero-dependency stream container packaging)
* **Sandbox Bypass**: `coi-serviceworker` (Cross-Origin Isolation Service Worker to enable `SharedArrayBuffer` in static hosting environments)

---

## Local Development

### Prerequisites
* **Node.js** (v18 or higher recommended)
* **npm** (v9 or higher)

### Setup & Run
1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/clipit.git
   cd clipit
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Launch the local development server:
   ```bash
   npm run dev
   ```
4. Open your browser and navigate to the address shown (default is `http://localhost:5173/clipit/`).
