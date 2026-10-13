# Meal Rewards — Build Plan

A single-page, game-style web app that helps a 5-year-old stay focused during meals.
Parents tap to record bites; treasures fly into piles; celebrations play when targets are hit;
a gentle "rain" scene plays if the timer runs out, with an option to extend.

---

## 1. Hosting & Architecture

- **No server needed.** All logic runs in the browser, so the app is just static files
  (HTML + CSS + JavaScript).
- **Host free on GitHub Pages** at `https://<your-username>.github.io/meal-rewards/`.
  - Works on Mac/PC, iPhone, iPad. Each parent opens the same URL.
  - On iPhone/iPad: Safari → Share → **Add to Home Screen** for a full-screen, app-like icon.
- **Each device runs its own game.** Targets and timer length are saved on that device
  (`localStorage`), so they're remembered next meal.
- **No build tools or frameworks.** Plain HTML/CSS/JS so it's easy to edit and deploy.

```
meal-rewards/
├── index.html      # the single page
├── style.css       # layout, colors, CSS animations
├── app.js          # game state, timer, tap handling
├── effects.js      # fireworks, rain, big reward (canvas)
├── sounds.js       # chimes, ringtone, fanfare (generated with Web Audio, no files needed)
├── manifest.json   # "Add to Home Screen" icon/name
└── icons/          # app icon
```

## 2. Screen Layout (one page)

```
┌─────────────────────────────────────────┐
│            ⏰  12:34 left               │  ← big countdown + progress bar
├────────────────────┬────────────────────┤
│   🍚 CARBS         │   🍗 PROTEIN       │
│   (orange)         │   (red)            │
│   treasure pile    │   treasure pile    │
│   3 / 5            │   1 / 4            │
├────────────────────┼────────────────────┤
│   🥛 MILK          │   🥦 VEGGIES       │
│   (blue)           │   (green)          │
│   treasure pile    │   treasure pile    │
│   2 / 3            │   0 / 3            │
├─────────────────────────────────────────┤
│  [ ▶ START ]   [ ⚙ Settings ]  [ ↺ ]   │
└─────────────────────────────────────────┘
```

- 2×2 grid of big tappable tiles, each with its own emoji, color, and pile.
- Pile grows visually (stacked coins/gems 💎🪙) as count increases.
- Layout adapts: 2×2 on iPad/computer, 2×2 or stacked on phone (portrait/landscape).

## 3. Game Flow (states)

1. **Setup** — Parent opens ⚙ Settings: target bites per category (stepper +/−, 0 = skip
   that category), timer length (e.g. 15/20/25/30 min or custom). Saved automatically.
2. **Ready** — Piles empty, tiles disabled, big **START** button.
3. **Playing** — Timer counts down. Tap a tile → +1 bite with a "treasure flies into
   pile" animation + chime.
   - Category reaches target → **fireworks** over that tile, tile gets a ⭐ "done" badge.
   - All categories reach target → **huge reward** (full-screen confetti/fireworks, trophy,
     fanfare, "You did it!"). Timer stops.
4. **Time's up** (meal not finished) → ringtone plays, screen turns **gray with gentle rain**
   and a sad cloud. Two buttons: **+2 min / +5 min** (extend → back to Playing with
   progress intact) or **End meal**.
5. **Reset** — ↺ clears counts for the next meal (asks to confirm).

Extras for parents:
- **Undo** for accidental taps (small "−" on each tile, or long-press).
- **Pause** (e.g. bathroom break).
- Optional halfway warning ("5 minutes left!") with a soft sound.

## 4. Animations & Sound

| Event | Visual | Sound |
|---|---|---|
| Bite tapped | Treasure 💎 pops at tap point and arcs into the pile; pile bounces | Coin chime |
| Category done | Fireworks burst over that tile | Pop/sparkle |
| All done | Full-screen fireworks + confetti + trophy 🏆 + kid-friendly message | Fanfare |
| Timer fires | Screen desaturates to gray, rain drops, cloud ☁️ | Ringtone (loops until tapped) |
| Last minute | Timer pulses | Optional tick |

- Tap animations: CSS transforms (smooth on iPhone).
- Fireworks/rain/confetti: lightweight `<canvas>` particle effects, no libraries.
- Sounds generated with the Web Audio API (no audio files, no copyright issues).
  Option to swap in real sound files later.

## 5. iPhone/iPad Gotchas to Handle

- **Sound unlock:** iOS only allows sound after a user tap — the START button unlocks audio.
- **Silent switch:** iPhone ring/silent switch can mute web sound; show a hint in Settings.
- **Screen sleep:** use the Screen Wake Lock API (supported in iOS 16.4+) so the screen
  stays on during the meal; fallback hint if unsupported.
- **Accurate timer:** compute remaining time from the end timestamp (not by counting
  ticks), so it stays correct if the tab is backgrounded or the phone locks.
- **No accidental zoom:** disable double-tap zoom (`touch-action: manipulation`) and text
  selection on tiles.

## 6. Build Milestones

1. **Skeleton** — Page layout, 4 tiles, tap to count, settings for targets (saved).
2. **Timer** — Start/pause/extend, countdown display, time's-up state.
3. **Animations** — Treasure flight, pile growth, fireworks, big reward, rain.
4. **Sound** — Chimes, fanfare, ringtone, iOS audio unlock.
5. **Polish** — Wake lock, undo, responsive layout for phone/iPad/computer, app icon,
   Add-to-Home-Screen manifest.
6. **Deploy** — Create GitHub repo, push, enable GitHub Pages; test on all devices.

Test locally anytime by opening `index.html` in a browser (or a simple local server to test
on the iPad over Wi-Fi).

## 7. Open Questions

1. **Sync between devices?** Default plan: each device is independent (simplest, fully free,
   no accounts). If you want Dad's phone taps to show live on the iPad she's watching, that
   needs a free backend (e.g. Firebase) — more setup, can be added later.
2. **Tone of time's-up:** keep the rain gentle and encouraging ("Let's try a little more!")
   rather than punishing? (Recommended for a 5-year-old.)
3. **Personalization:** her name on the screen? A theme (pirate treasure, princess gems,
   space)?
4. **Food emojis:** suggested 🍚 carbs, 🍗 protein, 🥛 milk, 🥦 veggies — want different ones?
5. **History/streaks:** e.g. a star chart of meals finished this week? (Out of scope for v1.)
