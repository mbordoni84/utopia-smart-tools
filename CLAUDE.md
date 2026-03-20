# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Chrome extension (Manifest V3) providing smart tools/calculators for the text-based MMO "Utopia" (utopia-game.com). Currently implements an **EOWCF (End-of-War Ceasefire) Planner** that scrapes in-game data and runs economic simulations.

Source of truth for game rules: `utopia_wiki.md` (~565KB, player-maintained, may have gaps). Current game age: **Age 114**. When wiki data conflicts, prefer the Age 114 section (lines 1-700).

## Development

**No build system, bundler, or package manager.** All code is vanilla JS loaded directly by the browser extension. To develop:

1. Go to `chrome://extensions/`, enable Developer Mode
2. Click "Load unpacked" and select the `extension/` directory
3. After code changes, click the refresh icon on the extension card

**Testing:** Open `extension/tests/engine_coverage.html` in a browser (or load via the extension). Tests are browser-based, not Node.js — they run in an HTML page that loads the engine + game data scripts directly. Results display in the page DOM.

## Architecture

### Data Flow

```
Game Pages (utopia-game.com)
    |
    v
Content Script (scraper/content_script.js) -- runs on every game page
    | uses Scrapers (scraper/scrapers.js) to detect page type & extract data
    | uses MutationObserver to catch AJAX page changes (game doesn't do full reloads)
    v
chrome.storage.local (merged game data) <-- Background worker (background.js) handles messaging
    |
    v
EOWCF Planner UI (eowcf/index.html)
    | ui.js imports data, fills form fields
    | Engine (eowcf/engine.js) runs calculations
    v
Result cards rendered in DOM
```

### Key Design Decisions

- **Page detection by content, not URL:** The game's URLs are unreliable, so scrapers identify pages by headings, table structures, and DOM elements (e.g., `<h2>Affairs of the State</h2>` for the state page).
- **Merge-on-save:** Each scraper returns data for one page. Data is merged into a single `gameData` object in `chrome.storage.local`, preserving fields from other pages. Per-page timestamps track data freshness.
- **Active spells replace, not merge:** `activeSpells` and `activeSpellsFromThrone` are always complete snapshots — they overwrite old data to prevent expired spells from persisting.
- **Building counts include WIP:** The game's council_internal page shows built + in-construction combined. The engine uses these combined counts for building effects (flat rates, percentage bonuses). However, **in-construction buildings do NOT provide jobs** — only completed buildings count toward Available Jobs and Optimal Workers for BE.
- **Barren Land is derived:** Calculated as `acres - sum(all buildings)`, shown as read-only in the UI.

### Core Modules

- **`data/game_data.js`** — All Age 114 static data: 9 races (no Gnome), 10 personalities, buildings, sciences, honor titles, rituals, dragons, EOWCF constants. This is the single source for race/personality modifiers.
- **`data/spells.js`** — Spell definitions with `engineEffects` mapping to engine formula keys. Only fading (duration) spells are tracked.
- **`scraper/scrapers.js`** — `Scrapers` object with per-page extraction methods. Each returns `{ _page, _scrapedAt, ...fields }` or `null` if wrong page. Also contains helper parsers (`parseNum`, `parsePct`, `parseUtopianDate`) and name-mapping tables (race-specific unit names to generic types, building display names to keys).
- **`eowcf/engine.js`** — `Engine` object with pure calculation functions (`calcBE`, `calcIncome`, `calcWages`, `calcFood`, `calcRunes`, `calcPopGrowth`, `getHonorMods`). Each function takes a `state` object and returns a detailed breakdown. `gatherState()` reads all UI inputs into the state object.
- **`eowcf/ui.js`** — IIFE that wires up the DOM: populates dropdowns from `GAME_DATA`, attaches input listeners, calls `Engine` functions on every change, renders result cards. Handles import from `chrome.storage` and EOWCF state persistence.

### Formula Pattern

All engine formulas follow the same pattern:
1. Calculate a base value (e.g., tax income from employed/unemployed peasants)
2. Apply multiplicative modifiers: building % bonuses, science, honor, race, personality, ritual, dragon, spells
3. Return a detailed object with every intermediate value (for debugging and UI display)

Modifier values in `GAME_DATA` use these conventions:
- `1.0` = no modifier (neutral)
- Multipliers (e.g., `buildingEfficiency: 1.25` means +25%)
- Additive values stored as decimals (e.g., `foodProdPerAcre: 0` means no bonus)
- Ritual/dragon effects stored as signed decimals (e.g., `-0.25` = -25%)

### Utopian Calendar

1 Utopian Year = 7 months, 1 month = 24 days, 1 day = 1 tick. Months: January(0) through July(6). Used for EOWCF tick calculations.

## Important Caveats

- Birth rate has a +-5% random variation per tick in the real game (base 2.05%). The engine uses the midpoint, so population predictions will have small deviations from actual game values.
- EOWCF birth boost is x10 for the first 24 ticks only, with a minimum of 500 peasants/tick.
- Prisoners do NOT count toward population for max pop checks but DO occupy jobs (at 0.5 workers per prisoner).
- Homes flat birth rate (0.3 peasants/tick) is NOT affected by Building Efficiency.
- `Utopia_HTML_download/` contains saved game pages used as scraper development references — not part of the extension.
