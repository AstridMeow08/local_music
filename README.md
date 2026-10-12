# MyGroove — Progressive Web App (PWA) Cloud Music Player

MyGroove is a 100% client-side, installable Progressive Web App (PWA) music player that streams audio files directly from publicly shared Google Drive folders and Cloudflare R2 buckets with a sleek GitHub-inspired theme.

- **Zero backend**: No server, no database, no Node/Python backend.
- **Zero user logins / No OAuth**: No complex OAuth authorization flows or expiring tokens.
- **100% static & deployable anywhere**: GitHub Pages, Netlify, Vercel, Cloudflare Pages, AWS S3, or NGINX.
- **Installable PWA**: Runs as a standalone app on iOS, Android, macOS, Windows, and Linux with full offline caching.
- **Lock-Screen & Background Playback**: Complete Media Session API integration with high-res artwork, scrub control, and audio backgrounding.
- **GitHub Theme**: Authentic GitHub Primer Dark and Light design system.

---

## Architecture & Access Model

### 1. Public API Key vs. OAuth
Traditional Google Drive integrations use OAuth 2.0 with scopes such as `drive.readonly`. However:
- OAuth requires server-side token exchanges or client secrets.
- OAuth user access tokens expire after **60 minutes**, requiring active refresh tokens or re-authentication.
- OAuth prompts user consent modals, adding heavy friction for a simple music player.

MyGroove instead uses a **Google Cloud API Key** restricted in Google Cloud Console. Because:
- The key is restricted to the **Google Drive API** only.
- The key is restricted by **HTTP referrers** (your deployed domain or `http://localhost:*`), meaning third parties cannot hijack your key from other domains.
- The API key can **only access files/folders explicitly marked as "Anyone with the link"**. It cannot read private files, cannot view personal emails, and cannot write/modify anything.
- Public share links and API keys **do not expire**. Playback can stream continuously without token refresh interruptions.

### 2. Lock-Screen, Media Session & Background Audio
Mobile operating systems (iOS Safari, Android Chrome) aggressively suspend background tabs and throttle JavaScript timers down to 1Hz or completely stop them to save battery.

- **Why Wake Lock API is NOT Used**: The Screen Wake Lock API (`navigator.wakeLock.request('screen')`) is meant only to keep the physical device screen glowing (useful for video presentations or kitchen recipe displays). It does **not** keep background audio alive and will severely drain mobile battery in the user's pocket.
- **How MyGroove achieves continuous background playback**:
  1. Playback is initiated by a user gesture on a native `<audio>` element.
  2. The **Media Session API** (`navigator.mediaSession`) is registered with title, artist (parsed from filename), high-res album artwork, and transport action handlers (`play`, `pause`, `previoustrack`, `nexttrack`, `seekto`, `seekbackward`, `seekforward`).
  3. Lock-screen scrubbing is enabled via `navigator.mediaSession.setPositionState`.
  4. The `visibilitychange` event is monitored to ensure the audio element maintains decoding state when switching tabs or turning off the screen.

### 3. Range-Request Seek Bar Scrubbing
Google Drive's `https://www.googleapis.com/drive/v3/files/{fileId}?alt=media&key={key}` endpoint supports HTTP `Range: bytes=X-Y` requests out of the box. MyGroove hooks into the native `<audio>` element so scrubbing to any position in a 100MB+ audio file immediately fetches the corresponding byte range without needing to download the entire file first.

### 4. PWA Caching & Explicit "Pin for Offline" Opt-In
- **App Shell Precaching**: HTML, CSS, JS, fonts, and icons are precached via Workbox so the app opens instantly even in airplane mode.
- **Metadata Caching**: Drive folder file listings are cached with a `StaleWhileRevalidate` strategy, allowing the library to be browsed offline.
- **Explicit Offline Pinning**: Audio streams are **not** cached automatically (which would consume gigabytes of quota unexpectedly). Instead, users can tap the **"Pin for Offline"** button per track, which downloads the audio into IndexedDB as a Blob. When playing a pinned track, MyGroove routes playback directly from the local Blob URL, enabling 100% offline listening.
- **Auto-Updating Service Worker**: Implements `skipWaiting` and `clientsClaim` with a user-facing update toast when a newer version of the app is deployed.

---

## Step-by-Step Google Cloud & Drive Setup

### Step 1: Create a Google Cloud Project
1. Open the [Google Cloud Console](https://console.cloud.google.com/).
2. Click the project dropdown at the top and select **New Project**.
3. Name your project (e.g., `MyGroove-Music-Player`) and click **Create**.

### Step 2: Enable the Google Drive API
1. In your project, go to **APIs & Services** → **Library**.
2. Search for **Google Drive API**.
3. Click on it and press **Enable**.

### Step 3: Generate an API Key
1. Go to **APIs & Services** → **Credentials**.
2. Click **+ Create Credentials** at the top and select **API Key**.
3. Copy the newly generated key.

### Step 4: Restrict the API Key (Recommended for Security)
1. On the same credentials page, click the edit icon (pencil) next to your newly created API key.
2. Under **Set application restrictions**, choose **Websites** (HTTP referrers).
3. Add your production domain and local dev domains:
   - `http://localhost:*`
   - `http://127.0.0.1:*`
   - `https://your-domain.netlify.app/*` (or `https://your-username.github.io/*`)
4. Under **API restrictions**, select **Restrict key**.
5. Check **Google Drive API** only and click **Save**.

### Step 5: Share your Google Drive Folder
1. Go to [Google Drive](https://drive.google.com/).
2. Create or navigate to the folder containing your music files (`.mp3`, `.m4a`, `.flac`, `.wav`, etc.).
3. Right-click the folder and click **Share** → **Share**.
4. Under **General access**, change the setting from *Restricted* to **"Anyone with the link"** (Role: **Viewer**).
5. Click **Copy link**.

---

## Local Development & Installation

### Prerequisites
- Node.js 18+ (tested on Node v20/v22)
- npm or yarn

### Installation
```bash
# Clone or navigate to the project directory
cd Music

# Install dependencies
npm install
```

### Configuration
No environment variables or `.env` files are required! API keys, Google Drive folders, and Cloudflare R2 buckets are entered directly in the UI (via **Settings** or the **+ Add Playlist** modal) and stored securely in your browser's local **IndexedDB** database. No server or backend needed.

### Run Development Server
```bash
npm run dev
```
Open your browser at `http://localhost:5173`.

### Production Build
```bash
npm run build
```
This generates the optimized, production-ready static assets in the `dist/` directory.

To test the production build locally:
```bash
npm run preview
```

---

## Deployment Instructions

Because MyGroove is 100% static client-side code, deploying is as simple as uploading the `dist/` folder:

### Vercel
```bash
npx vercel
# Build Command: npm run build
# Output Directory: dist
```

### Netlify
```bash
npx netlify-cli deploy --prod --dir=dist
```

### GitHub Pages
Configure your GitHub repository:
- Source: GitHub Actions or deploy `dist/` branch
- Build Command: `npm run build`

---

## Project Structure

```
├── public/
│   ├── icon.svg                 # High-resolution vector icon
│   ├── icon-192.png             # PWA app icon (192x192)
│   ├── icon-512.png             # PWA app icon (512x512)
│   ├── icon-maskable-192.png    # Maskable PWA icon for Android adaptive icons
│   ├── icon-maskable-512.png    # Maskable PWA icon (512x512)
│   └── favicon.ico              # Standard browser favicon
├── src/
│   ├── components/
│   │   ├── FolderInput.jsx      # Folder URL parser, history chips & loader
│   │   ├── Header.jsx           # App navbar, online/offline status, PWA install prompt
│   │   ├── Library.jsx          # Track list, search/filter, play, queue & offline buttons
│   │   ├── Player.jsx           # Bottom player dock, range seek bar, volume & vinyl animation
│   │   ├── PwaUpdateToast.jsx   # Service worker auto-update notification
│   │   ├── Queue.jsx            # Playlist queue drawer with drag-and-drop reordering
│   │   ├── SettingsModal.jsx    # API key setup, local storage quota & security guide
│   │   └── Toast.jsx            # Dynamic alert & status notification system
│   ├── db/
│   │   └── indexedDb.js         # idb persistence: settings, queue, metadata, offline audio blobs
│   ├── hooks/
│   │   ├── useMediaSession.js   # Lock screen, background audio, OS widgets & visibility handling
│   │   └── usePlayer.js         # Core audio lifecycle, range requests, shuffle/repeat, offline routing
│   ├── services/
│   │   └── driveApi.js          # Google Drive API v3 client with exponential backoff & URL parser
│   ├── utils/
│   │   └── formatters.js        # Duration (mm:ss) and byte size formatters
│   ├── App.jsx                  # Main application container
│   ├── index.css                # Tailwind base + custom glassmorphic styling
│   └── main.jsx                 # React root entry point
├── .env.example                 # Example environment variables
├── package.json
├── tailwind.config.js
└── vite.config.js               # Vite configuration with Workbox & PWA manifest
```

---

## License
MIT
