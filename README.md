# 🏆 Meal Treasure

A one-page, game-style meal timer for a slow eater. Parents tap a food tile each time the kid takes a
big bite; a treasure flies into that pile. Fireworks when a food is finished, a big celebration when
everything is done, and a gentle rain if the timer runs out (with +2 / +5 minute extensions).

Plain HTML/CSS/JS, no build step. Hosted with GitHub Pages.

- **Play:** set targets and timer in ⚙️, press **Start**, tap a tile per bite. Use **−** to undo a mistaken tap.
- **Treasures:** in ⚙️ pick an emoji treasure for each food (or type any emoji), or *Use my own picture* (with zoom/crop) (resized and kept on
  that device only, never uploaded). Export backup includes treasure choices and pictures.
- **Streak chests:** a *great meal* = all foods done before the timer with no extra time. 3 great meals in a row
  opens a treasure chest; every full week (7, 14, …) opens the big one (also at 10, 17, …). Preview them in ⚙️.
- **History:** 📜 shows each meal (time, eating time, bites per food, result), a weekly summary with a
  minutes chart, and the finished-meal streak 🔥. Saved on each device; use *Export backup* / *Import* to back up or copy.
- **iPhone/iPad:** open in Safari → Share → *Add to Home Screen* for a full-screen app.
- **Run locally:** `python3 -m http.server 8000` and open http://localhost:8000
