# CLAUDE.md — Frontend Website Rules

## Always Do First
- **Invoke the `frontend-design` skill** before writing any frontend code, every session, no exceptions.

## Reference Images
- If a reference image is provided: match layout, spacing, typography, and color exactly. Swap in placeholder content (images via `https://placehold.co/`, generic copy). Do not improve or add to the design.
- If no reference image: design from scratch with high craft (see guardrails below).
- Screenshot your output, compare against reference, fix mismatches, re-screenshot. Do at least 2 comparison rounds. Stop only when no visible differences remain or user says so.

## Local Server
- **Always serve on localhost** — never screenshot a `file:///` URL.
- Start the dev server: `node serve.mjs` (serves the project root at `http://localhost:3000`)
- `serve.mjs` lives in the project root. Start it in the background before taking any screenshots.
- If the server is already running, do not start a second instance.

## Screenshot Workflow
- Puppeteer is installed at `C:/Users/nateh/AppData/Local/Temp/puppeteer-test/`. Chrome cache is at `C:/Users/nateh/.cache/puppeteer/`.
- **Always screenshot from localhost:** `node screenshot.mjs http://localhost:3000`
- Screenshots are saved automatically to `./temporary screenshots/screenshot-N.png` (auto-incremented, never overwritten).
- Optional label suffix: `node screenshot.mjs http://localhost:3000 label` → saves as `screenshot-N-label.png`
- `screenshot.mjs` lives in the project root. Use it as-is.
- After screenshotting, read the PNG from `temporary screenshots/` with the Read tool — Claude can see and analyze the image directly.
- When comparing, be specific: "heading is 32px but reference shows ~24px", "card gap is 16px but should be 24px"
- Check: spacing/padding, font size/weight/line-height, colors (exact hex), alignment, border-radius, shadows, image sizing

## Output Defaults
- Single `index.html` file, all styles inline, unless user says otherwise
- Tailwind CSS via CDN: `<script src="https://cdn.tailwindcss.com"></script>`
- Placeholder images: `https://placehold.co/WIDTHxHEIGHT`
- Mobile-first responsive

## Brand Assets
- Always check the `brand_assets/` folder before designing. It may contain logos, color guides, style guides, or images.
- If assets exist there, use them. Do not use placeholders where real assets are available.
- If a logo is present, use it. If a color palette is defined, use those exact values — do not invent brand colors.

## Anti-Generic Guardrails
- **Colors:** Never use default Tailwind palette (indigo-500, blue-600, etc.). Pick a custom brand color and derive from it.
- **Shadows:** Never use flat `shadow-md`. Use layered, color-tinted shadows with low opacity.
- **Typography:** Never use the same font for headings and body. Pair a display/serif with a clean sans. Apply tight tracking (`-0.03em`) on large headings, generous line-height (`1.7`) on body.
- **Gradients:** Layer multiple radial gradients. Add grain/texture via SVG noise filter for depth.
- **Animations:** Only animate `transform` and `opacity`. Never `transition-all`. Use spring-style easing.
- **Interactive states:** Every clickable element needs hover, focus-visible, and active states. No exceptions.
- **Images:** Add a gradient overlay (`bg-gradient-to-t from-black/60`) and a color treatment layer with `mix-blend-multiply`.
- **Spacing:** Use intentional, consistent spacing tokens — not random Tailwind steps.
- **Depth:** Surfaces should have a layering system (base → elevated → floating), not all sit at the same z-plane.

## Hard Rules
- Do not add sections, features, or content not in the reference
- Do not "improve" a reference design — match it
- Do not stop after one screenshot pass
- Do not use `transition-all`
- Do not use default Tailwind blue/indigo as primary color

---

## Project: Route Explorer

A driving companion app. User enters origin + destination, gets a normal route, then can enable **Explore Mode** which announces interesting places as they approach while driving — like turn-by-turn navigation but for discovery.

### APIs
- **Google Directions API** — route + polyline
- **Google Places Nearby Search** — POI discovery only, never Claude
- **Browser Geolocation API** (`watchPosition`) — real-time position while driving
- **Web Speech API** (`SpeechSynthesisUtterance`) — hands-free audio announcements
- **Claude API** (`claude-sonnet-4-6`) — "Tell me more" on demand only, never automatic

### Explore Mode sub-modes
| Mode | Google Places types |
|---|---|
| 🏛 History | `museum`, `church`, `cemetery`, `city_hall` |
| 👻 Dark & Weird | `cemetery`, `natural_feature` |
| 🎬 Pop Culture | `movie_theater`, `point_of_interest` |
| 🌿 Nature | `park`, `natural_feature`, `campground` |
| 🍔 Roadside Americana | `tourist_attraction` |

### POI loading (runs once before driving)
Sample route polyline every ~15 miles → `nearbySearch` at each point (radius 3000m, filtered by mode type) → keep places with rating > 4.2 and reviews > 50 → deduplicate by `place_id` → store top 8–10 with `announced: false`.

### Heads-up trigger
```js
// fires inside watchPosition callback
if (distanceTo(poi) < 300 && !poi.announced && timeSinceLastAnnouncement > 120s) {
  poi.announced = true;
  announceAndShowCard(poi);
}
```

### Left/right detection
```js
const bearing = getBearing(userLat, userLng, poi.lat, poi.lng);
const diff = (bearing - userHeading + 360) % 360;
const side = diff < 180 ? 'right' : 'left';
```

### Announcement format
`"In [distance]m on your [side] — [Place Name]. [one-line hook]."`

### "Tell me more" Claude prompt
```
You are a storytelling travel guide. In 3 sentences, tell an interesting story about "[name]" near [vicinity].
Be specific — names, dates, real events. Never say "fascinating" or "interesting".
Tone: [see below]
```
Mode tones — History: "authoritative, like Ken Burns" · Dark & Weird: "eerie campfire story" · Pop Culture: "casual and excited" · Nature: "reverent and calm" · Roadside Americana: "quirky and affectionate"

### Project-specific hard rules
- Never call Claude API for POI lookup — Google Places only
- Never announce the same POI twice
- Never fire two announcements within 2 minutes
- "Tell me more" is always one tap, always optional, never automatic
- Web Speech must work hands-free — no interaction required to hear announcements
