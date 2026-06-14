# Wmaps — Route Explorer

A driving companion web app that discovers and announces hidden stories along your route. Enter a start and destination, pick an explore mode, and Wmaps finds remarkable places along the way — announcing them hands-free as you drive past.

## Features

- **5 Explore Modes** — History, Dark & Weird, Pop Culture, Nature, Roadside Americana
- **Smart POI Discovery** — searches by type and keyword along your route polyline, filters for hidden gems
- **AI-Powered Story Hooks** — generates a one-line story for each place (e.g., *"Where Confederate gold vanished in 1865"*)
- **Hands-Free Voice Announcements** — announces places as you approach them, no screen interaction needed
- **"Tell Me More"** — tap for a 3-sentence AI-narrated story in the mode's tone
- **Turn-by-Turn Navigation** — next maneuver, distance, ETA — like Google Maps
- **Compass & Heading** — arrow marker follows your direction via GPS, device compass, or movement

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Map & Routing | Google Maps JavaScript API, Directions API |
| Place Discovery | Google Places API (Nearby Search) |
| AI Stories | Anthropic Claude API (`claude-sonnet-4-6`) |
| Voice | Web Speech API (built into browser) |
| Location | Browser Geolocation API + DeviceOrientation |
| Styling | Tailwind CSS (CDN) |
| Fonts | DM Serif Display + Inter (Google Fonts) |

**No backend. No build step. Single HTML file.**

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v16 or newer) — for the local dev server
- A modern browser (Chrome recommended, Safari works too)

### Step 1 — Clone the repo

```bash
git clone https://github.com/devashishbhat/Wmaps.git
cd Wmaps
```

### Step 2 — Get a Google Maps API Key

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or select an existing one)
3. Navigate to **APIs & Services → Library** and enable these three APIs:
   - **Maps JavaScript API**
   - **Directions API**
   - **Places API** (the standard one, not "Places API (New)")
4. Go to **APIs & Services → Credentials → Create Credentials → API Key**
5. Copy the key

> **Important:** You must enable billing on your Google Cloud project. Google provides $200/month in free credits — more than enough for development and demos. No charges unless you exceed the free tier.

### Step 3 — Get an Anthropic API Key

1. Go to [Anthropic Console](https://console.anthropic.com/)
2. Sign in or create an account
3. Go to **API Keys → Create Key**
4. Copy the key

> The Anthropic API is pay-per-use. Each "Tell me more" call costs roughly $0.003 (a fraction of a cent).

### Step 4 — Add your API keys

Create a file called `config.js` in the project root:

```js
var CONFIG = {
  GOOGLE_MAPS_KEY: 'your-google-maps-api-key-here',
  ANTHROPIC_API_KEY: 'your-anthropic-api-key-here',
};
```

This file is listed in `.gitignore` and will not be committed to git.

### Step 5 — Start the dev server

```bash
node serve.mjs
```

The app will be available at **http://localhost:3000**

### Step 6 — Use the app

1. Enter an origin and destination (autocomplete will help)
2. Click **Get Route** to see the driving route on the map
3. Click **Start Explore Mode** and pick a mode
4. Browse the discovered places listed in the bottom panel
5. Click **I'm Driving** to start — voice announcements will trigger as you approach places
6. Tap **Tell me more** on any POI card for a full AI-narrated story

---

## Project Structure

```
Wmaps/
├── index.html     ← entire app (single file)
├── config.js      ← your API keys (gitignored)
├── serve.mjs      ← local dev server
├── deck.html      ← pitch deck / presentation
├── .gitignore     ← keeps config.js out of git
└── WMAPS_PRD.md   ← product requirements document
```

## Presentation

A built-in slide deck is available at **http://localhost:3000/deck.html** for demos and pitches. Use arrow keys to navigate, `F` for fullscreen.

---

## How It Works

1. **Route drawn** via Google Directions API
2. **Polyline sampled** every ~15 miles along the route
3. **Places searched** at each sample point using Google Places Nearby Search (by type + keyword, 5km radius)
4. **Filtered & scored** — rating ≥ 3.8, reviews ≥ 15, deduplicated, hidden gem bonus for lesser-known spots
5. **Enriched with AI** — one Claude API call generates story hooks for all POIs
6. **Proximity triggered** — GPS tracks your position; within 300m of a POI, it announces via Web Speech API
7. **"Tell me more"** — on-demand Claude call for a 3-sentence story, cached per POI

## Notes

- API keys are embedded in client-side JavaScript. This is fine for personal use and demos — do not deploy to production without a backend proxy.
- Geolocation requires HTTPS on phones. On desktop, `localhost` works over HTTP.
- For the best mobile experience, use Chrome on Android. iOS Safari requires HTTPS for geolocation on non-localhost origins.
