# Wmaps — Project Requirements Document

## What We're Building

Wmaps is a driving companion web app. It gives users a normal route from A to B, then layers a discovery experience on top called **Explore Mode**. When Explore Mode is active and the user is driving, the app announces interesting places along the route as they approach — hands-free, like turn-by-turn navigation but for discovery instead of directions.

The experience should feel like having a knowledgeable, opinionated passenger who says *"hey, in 200 metres on your left there's a lighthouse built by Portuguese sailors in 1823 who never made it home"* — and then shuts up until the next interesting thing.

---

## Tech Stack

- **Pure frontend** — single `index.html`, no backend, no build step required
- **Tailwind CSS** via CDN
- **Google Maps JavaScript API** — map rendering
- **Google Directions API** — route drawing and polyline
- **Google Places Nearby Search API** — POI discovery along the route
- **Browser Geolocation API** (`watchPosition`) — real-time position tracking while driving
- **Web Speech API** (`SpeechSynthesisUtterance`) — hands-free audio announcements, built into every modern browser, no library needed
- **Anthropic Claude API** (`claude-sonnet-4-6`) — used only for "Tell me more" on demand, never for automatic POI lookup

---

## API Keys You Need

### 1. Google Maps API Key
**Where to get it:**
1. Go to https://console.cloud.google.com
2. Create a new project (or use existing)
3. Go to APIs & Services → Enable APIs
4. Enable these three APIs:
   - Maps JavaScript API
   - Directions API
   - Places API
5. Go to APIs & Services → Credentials → Create Credentials → API Key
6. Copy the key

**Where to put it:** Replace `YOUR_GOOGLE_MAPS_API_KEY` in the script tag at the bottom of `index.html`:
```html
<script src="https://maps.googleapis.com/maps/api/js?key=YOUR_GOOGLE_MAPS_API_KEY&libraries=places"></script>
```

> ⚠️ For the hackathon, leave the key unrestricted. Before going public, restrict it to your domain in the Google Console.

---

### 2. Anthropic API Key
**Where to get it:**
1. Go to https://console.anthropic.com
2. Sign in or create an account
3. Go to API Keys → Create Key
4. Copy the key

**Where to put it:** In the JS config object at the top of the script in `index.html`:
```js
const CONFIG = {
  ANTHROPIC_API_KEY: 'YOUR_ANTHROPIC_API_KEY',
  GOOGLE_MAPS_KEY: 'YOUR_GOOGLE_MAPS_API_KEY',
};
```

> ⚠️ This key will be visible in the browser. Fine for a hackathon demo — do not ship to production this way.

---

## Full User Flow

### Step 1 — Landing screen
The app opens to a clean screen with the Wmaps logo and a route input form:
- Origin field (with "Use my location" button)
- Destination field
- "Get Route" button

### Step 2 — Route drawn
After submitting, the map fills the screen and draws the route using Google Directions API. A bottom bar shows:
- Origin → Destination
- Estimated travel time
- Distance
- "Start Explore Mode" button

### Step 3 — Choose Explore Mode
Tapping "Start Explore Mode" opens a mode selector. The user picks one sub-mode:

| Mode | Icon | Google Places Types Used |
|---|---|---|
| History | 🏛 | `museum`, `church`, `cemetery`, `city_hall` |
| Dark & Weird | 👻 | `cemetery`, `natural_feature` |
| Pop Culture | 🎬 | `movie_theater`, `point_of_interest` |
| Nature | 🌿 | `park`, `natural_feature`, `campground` |
| Roadside Americana | 🍔 | `tourist_attraction` |

After picking a mode, a "Begin" button starts the experience.

### Step 4 — POI pre-loading
Before the driving experience starts, the app silently loads all POIs for the route:
1. Decode the route polyline into an array of coordinates
2. Sample one point every ~15 miles along the polyline
3. At each sampled point, call Google Places `nearbySearch` with:
   - `radius: 3000` (metres)
   - `type:` filtered by the selected mode (see table above)
4. Filter results: keep only places with `rating >= 4.2` AND `user_ratings_total >= 50`
5. Deduplicate by `place_id`
6. Score remaining places by `rating * log(user_ratings_total)` — this surfaces well-loved places over obscure ones
7. Keep the top 8–10 results for the whole route
8. For each kept POI, store:
```js
{
  place_id: string,
  name: string,
  lat: number,
  lng: number,
  vicinity: string,        // neighbourhood/area name from Places API
  rating: number,
  photo_reference: string, // first photo from Places API
  types: string[],
  announced: false,        // tracks whether this POI has been announced
}
```
9. Drop a pin on the map for each POI so the user can see all upcoming stops before driving

Show a loading indicator while this runs. If no POIs are found, show a message: "No [mode] spots found on this route. Try a different mode."

### Step 5 — Driving starts
User taps "I'm driving" to start. The app:
- Calls `navigator.geolocation.watchPosition()` with `{ enableHighAccuracy: true, maximumAge: 1000 }`
- Enters the trigger loop (see below)
- Map follows user position with a smooth pan

### Step 6 — Heads-up trigger
On every position update from `watchPosition`:

```
for each POI in the list:
  if POI.announced == true → skip
  calculate distance from current position to POI
  if distance < 300 metres:
    if time since last announcement > 120 seconds:
      mark POI.announced = true
      calculate which side of the road the POI is on (left or right)
      trigger announceAndShow(POI, distance, side)
```

**Left/right detection:**
```js
function getSide(userHeading, userLat, userLng, poiLat, poiLng) {
  const toRad = d => d * Math.PI / 180;
  const dLon = toRad(poiLng - userLng);
  const lat1 = toRad(userLat);
  const lat2 = toRad(poiLat);
  const x = Math.sin(dLon) * Math.cos(lat2);
  const y = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  const bearing = (Math.atan2(x, y) * 180 / Math.PI + 360) % 360;
  const diff = (bearing - userHeading + 360) % 360;
  return diff < 180 ? 'right' : 'left';
}
```

Use `position.coords.heading` from the Geolocation API for `userHeading`. If heading is null (user is stationary), default to 'ahead' and omit the side from the announcement.

### Step 7 — The announcement
Two things happen simultaneously when a POI triggers:

**Audio (Web Speech API):**
```js
const utterance = new SpeechSynthesisUtterance(
  `In ${Math.round(distance)} metres on your ${side} — ${poi.name}. ${poi.hook}.`
);
utterance.rate = 0.95;
utterance.pitch = 1.0;
window.speechSynthesis.speak(utterance);
```

**Visual (POI card):**
A card slides up from the bottom of the screen showing:
- Place photo (from Google Places photo reference)
- Place name (large)
- "In Xm on your left/right" (small, above the name)
- Star rating + review count
- One-line hook (see below)
- "Tell me more" button
- "Dismiss" button (or auto-dismisses after 15 seconds)

**The hook line:**
Use the place's `vicinity` and `types` to construct a short descriptor. Examples:
- If type includes `museum` → "Local history museum"
- If type includes `natural_feature` → "Natural landmark"
- If type includes `church` → "Historic church"
This is fallback only — if Google returns an `editorial_summary` in the place details, use that instead.

### Step 8 — "Tell me more"
Only fires when the user taps the button. Makes one Claude API call:

```js
const modeToTone = {
  history: "authoritative but warm, like Ken Burns narrating a documentary",
  dark: "eerie and suspenseful, like you're telling a campfire story",
  popculture: "casual and excited, like a movie fan explaining why a location matters",
  nature: "reverent and calm, like a nature documentary narrator",
  americana: "quirky and affectionate, like a road trip blogger who loves weird Americana"
};

const prompt = `You are a storytelling travel guide. In 3 sentences, tell an interesting story about "${poi.name}" near ${poi.vicinity}.
Be specific — use real names, dates, and events where possible.
Never use the words "fascinating", "interesting", or "notable".
Tone: ${modeToTone[currentMode]}.`;
```

API call:
```js
const response = await fetch('https://api.anthropic.com/v1/messages', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': CONFIG.ANTHROPIC_API_KEY,
    'anthropic-version': '2023-06-01',
    'anthropic-dangerous-direct-browser-access': 'true'
  },
  body: JSON.stringify({
    model: 'claude-sonnet-4-6',
    max_tokens: 1000,
    messages: [{ role: 'user', content: prompt }]
  })
});
```

The response text is:
1. Shown in an expanded version of the POI card
2. Read aloud via Web Speech API immediately

One call per POI maximum — cache the response so tapping "Tell me more" a second time replays the cached text, not a new API call.

---

## UI Layout

### Screen 1 — Route Input
```
┌─────────────────────────────┐
│         Wmaps               │  ← logo, top center
│                             │
│   Where are you going?      │
│                             │
│  [ 📍 Origin           ]    │
│  [ 🏁 Destination      ]    │
│                             │
│      [ Get Route ]          │
└─────────────────────────────┘
```

### Screen 2 — Map + Route
```
┌─────────────────────────────┐
│  [←]        Wmaps           │  ← back button, logo
├─────────────────────────────┤
│                             │
│      GOOGLE MAP             │
│      (full bleed)           │
│      route drawn            │
│      POI pins visible       │
│                             │
├─────────────────────────────┤
│  Charlotte → Asheville      │
│  1h 52m · 118 miles         │
│                             │
│   [ Start Explore Mode ]    │
└─────────────────────────────┘
```

### Mode Selector (bottom sheet)
```
┌─────────────────────────────┐
│  Choose your mode           │
│  ─────────────────          │
│  🏛  History                │
│  👻  Dark & Weird           │
│  🎬  Pop Culture            │
│  🌿  Nature                 │
│  🍔  Roadside Americana     │
│                             │
│       [ Begin ]             │
└─────────────────────────────┘
```

### POI Card (slides up while driving)
```
┌─────────────────────────────┐
│  In 200m on your left       │  ← small label
│  ┌──────┐                   │
│  │photo │  Blue Ridge       │  ← place name large
│  │      │  Tunnel           │
│  └──────┘  ★ 4.8 · 2.1k    │
│                             │
│  Historic railroad tunnel   │  ← hook line
│                             │
│  [ Tell me more ]  [  ✕  ] │
└─────────────────────────────┘
```

### Expanded Card (after "Tell me more")
Same card but the hook line is replaced with the full 3-sentence Claude story. Add a subtle scroll if the text is long.

---

## Design Direction

Wmaps lives on the road. The visual identity should feel like driving at dusk — not a sterile tech product, not a tourist brochure.

- **Color palette:** Deep asphalt (`#1a1a2e`), amber headlight (`#f5a623`), pale dawn sky (`#e8e0d5`), muted sage (`#7a9e7e`) as accent for nature mode. Dark background, warm accents.
- **Typography:** A characterful slab serif or condensed display face for the Wmaps logo and place names. A clean, highly legible sans-serif for all UI text and announcements — legibility at a glance is critical since this is used while driving.
- **The POI card is the signature moment** — it should feel like a cinema title card sliding in from the bottom. Weighted, cinematic, confident. Not a toast notification.
- **Map takes full screen** — UI chrome is minimal. The map is the product.
- **Mode selector icons** should feel tactile and distinct, not emoji-pasted-onto-a-list.
- **No transition-all.** Animate only `transform` and `opacity`. Spring-style easing on the card slide-up.
- **Every interactive element** needs hover, focus-visible, and active states.
- **Surfaces:** Base (map) → Elevated (bottom bar) → Floating (POI card). Each level has a distinct shadow treatment.

---

## State Management

All state lives in a single JS object at the top of the script:

```js
const state = {
  origin: null,            // { lat, lng, label }
  destination: null,       // { lat, lng, label }
  route: null,             // Google DirectionsResult
  exploreMode: null,       // 'history' | 'dark' | 'popculture' | 'nature' | 'americana'
  pois: [],                // array of POI objects (see above)
  driving: false,          // whether watchPosition is active
  lastAnnouncementTime: 0, // timestamp of last announcement
  activePOI: null,         // POI currently shown in card
  watchId: null,           // return value of watchPosition, for cleanup
};
```

---

## Error Handling

| Situation | What to show |
|---|---|
| Geolocation denied | "Location access is needed for Explore Mode. Please enable it in your browser settings." |
| No POIs found on route | "No [mode] spots found on this route. Try a different mode or a longer route." |
| Google Places API error | "Couldn't load places. Check your API key and try again." |
| Claude API error | "Story unavailable right now." — fail silently, do not block the driving experience |
| Speech synthesis not supported | Fall back to visual card only, no audio |

---

## Edge Cases to Handle

- **Two POIs within 500m of each other:** Keep only the higher-rated one. Prevents back-to-back announcements in dense areas.
- **User is stationary** (heading = null): Skip left/right, say "just ahead" instead.
- **Route has no waypoints to sample** (very short route under 15 miles): Use the midpoint of the route as a single sample point.
- **POI is behind the user** (they already passed it): If `announced` is still false but the user is now more than 500m past the POI, mark it `announced: true` without triggering — don't announce something they already passed.
- **Web Speech interrupted:** If a new announcement fires while one is playing, cancel the current speech and start the new one.
- **"Tell me more" tapped twice:** Replay the cached response, do not make a second API call.

---

## File Structure

```
wmaps/
├── index.html        ← entire app, single file
├── CLAUDE.md         ← AI coding rules (do not modify)
└── brand_assets/     ← put any logo files here if you have them
```

---

## What Is Explicitly Out of Scope

Do not build these — they are post-hackathon features:
- User accounts or saved routes
- Offline mode
- Native mobile app
- Turn-by-turn navigation (Wmaps is not a navigation replacement)
- Social sharing
- Multiple simultaneous explore modes
- Backend server of any kind
