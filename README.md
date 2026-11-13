# Budget Buddy

A colorful static savings tracker. You set a goal, log what you have and what you spend, and a pet grows (and gains energy) as you keep money toward your goal.

**Live site:** https://aaronlee-now.github.io/budget-buddy/

**Stack:** plain HTML, CSS, and JavaScript. No build step, no frameworks.

## Open locally

From this folder:

```bash
# Option A — open the file
open index.html   # macOS
# xdg-open index.html  # Linux

# Option B — tiny local server (recommended)
python3 -m http.server 8080 --bind 127.0.0.1
# then visit http://127.0.0.1:8080/
```

Data is stored in the browser’s `localStorage` under the key `budget-buddy-v1`.

## GitHub Pages

This repo is set up for Pages from the `main` branch root (`/`).

If Pages is not live yet:

1. Repo → **Settings** → **Pages**
2. Source: **Deploy from a branch**
3. Branch: `main` / **Root** (`/`)
4. Save

Site URL: https://aaronlee-now.github.io/budget-buddy/

## How progress works

- **Kept** = You have − You spend (never below $0)
- **Savings progress** = Kept ÷ Goal (capped at 100%)
- **Energy** rises with progress and softens when spending eats most of what you have
- Pet **stages** (size, aura, sparks, smile): Seedling → Sprout → Buddy → Champion → Legend
