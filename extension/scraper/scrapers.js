// =============================================================================
// Page Scrapers
// =============================================================================
// Each scraper extracts data from a specific game page.
// They receive the document and return a data object (or null if wrong page).
//
// Page detection is based on content (headings, table structure) since URLs
// change and can't be relied on.
// =============================================================================

const Scrapers = {

  // ---------------------------------------------------------------------------
  // HELPERS
  // ---------------------------------------------------------------------------

  /** Parse a number string like "1,966,712" or "206,854 gold coins" into a number.
   *  Extracts only the FIRST number (with optional commas as thousands separators). */
  parseNum(str) {
    if (!str) return 0;
    const match = str.match(/-?[\d,]+(\.\d+)?/);
    if (!match) return 0;
    return parseFloat(match[0].replace(/,/g, '')) || 0;
  },

  /** Parse a percentage string like "+18.5% Income" into 18.5 */
  parsePct(str) {
    if (!str) return 0;
    const match = str.match(/([+-]?\d+\.?\d*)%/);
    return match ? parseFloat(match[1]) : 0;
  },

  /** Utopian month name to index (0-based) */
  utopianMonths: {
    'january': 0, 'february': 1, 'march': 2, 'april': 3,
    'may': 4, 'june': 5, 'july': 6
  },

  /**
   * Parse a Utopian date string like "May 3, YR5" into { month, day, year }.
   * Returns null if parsing fails.
   */
  parseUtopianDate(str) {
    if (!str) return null;
    const match = str.match(/(\w+)\s+(\d+),?\s*(?:of\s+)?YR(\d+)/i);
    if (!match) return null;
    const monthIdx = this.utopianMonths[match[1].toLowerCase()];
    if (monthIdx === undefined) return null;
    return { month: monthIdx, day: parseInt(match[2]), year: parseInt(match[3]) };
  },

  /**
   * Convert a Utopian date to total ticks from YR1 Jan 1.
   * 1 Utopian Year = 7 months, 1 month = 24 days, 1 day = 1 tick.
   */
  utopianDateToTicks(date) {
    if (!date) return 0;
    return ((date.year - 1) * 7 * 24) + (date.month * 24) + (date.day - 1);
  },

  /**
   * Scrape the current Utopian date from any page.
   * Found in: <div class="current-date">May 3, YR5</div>
   */
  scrapeCurrentDate(doc) {
    const dateEl = doc.querySelector('.current-date');
    if (!dateEl) return null;
    return dateEl.textContent.trim();
  },

  /**
   * Extract label->value pairs from a table with <th>Label</th><td>Value</td> pattern.
   * Returns a Map of lowercase-trimmed label -> raw td text.
   */
  extractThTdPairs(table) {
    const pairs = new Map();
    if (!table) return pairs;
    const cells = table.querySelectorAll('th, td');
    for (let i = 0; i < cells.length - 1; i++) {
      if (cells[i].tagName === 'TH' && cells[i + 1].tagName === 'TD') {
        const label = cells[i].textContent.trim().toLowerCase();
        const value = cells[i + 1].textContent.trim();
        if (label) pairs.set(label, value);
      }
    }
    return pairs;
  },

  // ---------------------------------------------------------------------------
  // RACE-SPECIFIC UNIT NAME MAPPING
  // ---------------------------------------------------------------------------
  // The game displays race-specific unit names (e.g. "Goblins" for Orc off specs).
  // We need to map these back to generic types for the planner.
  // ---------------------------------------------------------------------------
  unitNameMap: {
    // offSpecs
    'griffins': 'offSpecs', 'night rangers': 'offSpecs', 'warriors': 'offSpecs',
    'rangers': 'offSpecs', 'magicians': 'offSpecs', 'strongarms': 'offSpecs',
    'swordsmen': 'offSpecs', 'goblins': 'offSpecs', 'skeletons': 'offSpecs',
    // defSpecs
    'harpies': 'defSpecs', 'druids': 'defSpecs', 'axemen': 'defSpecs',
    'archers': 'defSpecs', 'slingers': 'defSpecs', 'trolls': 'defSpecs',
    'zombies': 'defSpecs',
    // elites
    'drakes': 'elites', 'drows': 'elites', 'berserkers': 'elites',
    'elf lords': 'elites', 'beastmasters': 'elites', 'brutes': 'elites',
    'knights': 'elites', 'ogres': 'elites', 'ghouls': 'elites'
  },

  // ---------------------------------------------------------------------------
  // PERSONALITY SUFFIX MAPPING
  // ---------------------------------------------------------------------------
  // Throne page shows "Knight Ulysses the Hero" — "the Hero" = War Hero
  // ---------------------------------------------------------------------------
  personalitySuffixMap: {
    'the artisan': 'artisan',
    'the general': 'general',
    'the heretic': 'heretic',
    'the mystic': 'mystic',
    'the necromancer': 'necromancer',
    'the paladin': 'paladin',
    'the rogue': 'rogue',
    'the tactician': 'tactician',
    'the hero': 'warHero',
    'the warrior': 'warrior'
  },

  // ---------------------------------------------------------------------------
  // RACE NAME MAPPING (display name -> GAME_DATA key)
  // ---------------------------------------------------------------------------
  raceNameMap: {
    'avian': 'avian', 'dark elf': 'darkElf', 'dwarf': 'dwarf', 'elf': 'elf',
    'faery': 'faery', 'halfling': 'halfling', 'human': 'human', 'orc': 'orc',
    'undead': 'undead'
  },

  // ---------------------------------------------------------------------------
  // BUILDING NAME MAPPING (display name -> GAME_DATA key)
  // ---------------------------------------------------------------------------
  buildingNameMap: {
    'barren land': 'barrenLand',
    'homes': 'homes', 'farms': 'farms', 'mills': 'mills', 'banks': 'banks',
    'training grounds': 'trainingGrounds', 'armouries': 'armouries',
    'military barracks': 'barracks', 'forts': 'forts', 'castles': 'castles',
    'hospitals': 'hospitals', 'guilds': 'guilds', 'towers': 'towers',
    "thieves' dens": 'thievesDens', 'watch towers': 'watchTowers',
    'universities': 'universities', 'libraries': 'libraries',
    'stables': 'stables', 'dungeons': 'dungeons'
  },

  // ---------------------------------------------------------------------------
  // SCIENCE NAME MAPPING (display name -> field key for planner)
  // ---------------------------------------------------------------------------
  scienceNameMap: {
    'alchemy': 'alchemy', 'tools': 'tools', 'housing': 'housing',
    'production': 'production', 'bookkeeping': 'bookkeeping', 'artisan': 'artisan',
    'tactics': 'tactics', 'valor': 'valor', 'heroism': 'heroism', 'siege': 'siege',
    'channeling': 'channeling', 'shielding': 'shielding', 'sorcery': 'sorcery',
    'crime': 'crime', 'cunning': 'cunning', 'finesse': 'finesse'
  },

  // ---------------------------------------------------------------------------
  // STATE PAGE (council_state)
  // ---------------------------------------------------------------------------
  // Detected by: <h2>Affairs of the State</h2>
  //
  // Extracts from resource bar: gold, food, runes, land
  // Extracts from stats table: peasants, army, thieves, wizards, honor,
  //   daily income, daily wages
  // Extracts honor title from greeting text ("Knight Ulysses, I track...")
  // ---------------------------------------------------------------------------
  scrapeState(doc) {
    const heading = doc.querySelector('h2');
    if (!heading || !heading.textContent.includes('Affairs of the State')) return null;

    const data = { _page: 'state', _scrapedAt: Date.now() };

    // --- Resource bar ---
    const resBar = doc.querySelector('#resource-bar');
    if (resBar) {
      const vals = resBar.querySelectorAll('tbody th');
      if (vals.length >= 6) {
        data.gold = this.parseNum(vals[0].textContent);
        data.peasants = this.parseNum(vals[1].textContent);
        data.food = this.parseNum(vals[2].textContent);
        data.runes = this.parseNum(vals[3].textContent);
        data.networth = this.parseNum(vals[4].textContent);
        data.acres = this.parseNum(vals[5].textContent);
      }
    }

    // --- Three-column stats table ---
    const statsTable = doc.querySelector('.three-column-stats');
    if (statsTable) {
      const pairs = this.extractThTdPairs(statsTable);
      data.peasants = this.parseNum(pairs.get('peasants')) || data.peasants;
      data.army = this.parseNum(pairs.get('army'));
      data.thieves = this.parseNum(pairs.get('thieves'));
      data.wizards = this.parseNum(pairs.get('wizards'));
      data.totalPop = this.parseNum(pairs.get('total'));
      data.maxPop = this.parseNum(pairs.get('max population'));
      data.dailyIncome = this.parseNum(pairs.get('daily income'));
      data.dailyWages = this.parseNum(pairs.get('daily wages'));
      data.honor = this.parseNum(pairs.get('current honor'));
      data.unfilledJobs = this.parseNum(pairs.get('unfilled jobs'));
    }

    // --- Honor title from greeting ---
    // Text like: "Knight Ulysses, I track some important..."
    const greetingP = doc.querySelector('.game-content p');
    if (greetingP) {
      const text = greetingP.textContent.trim();
      const titles = ['Prince', 'Duke', 'Marquis', 'Count', 'Viscount', 'Baron', 'Lord', 'Knight', 'Peasant'];
      for (const title of titles) {
        if (text.startsWith(title + ' ')) {
          data.honorTitle = title;
          break;
        }
      }
    }

    return data;
  },

  // ---------------------------------------------------------------------------
  // THRONE PAGE (throne)
  // ---------------------------------------------------------------------------
  // Detected by: <h2> containing "The Province of"
  //
  // Structure: table.two-column-stats with th/td pairs:
  //   Race | {race}          | Soldiers | {count}
  //   Ruler | {title name the personality} | {offSpec} | {count}
  //   Land | {count}         | {defSpec} | {count}
  //   ...                    | {elite}   | {count}
  //   ...                    | War Horses | {count}
  //   ...                    | Prisoners | {count}
  //
  // Also extracts active spells from "Info" section (Duration: Fertile Lands etc.)
  // Also extracts active ritual from advice-message paragraphs.
  // ---------------------------------------------------------------------------
  scrapeThrone(doc) {
    const headings = doc.querySelectorAll('h2');
    let found = false;
    for (const h of headings) {
      if (h.textContent.includes('The Province of')) { found = true; break; }
    }
    if (!found) return null;

    const data = { _page: 'throne', _scrapedAt: Date.now() };

    // --- Two-column stats table ---
    const statsTable = doc.querySelector('.two-column-stats');
    if (statsTable) {
      const pairs = this.extractThTdPairs(statsTable);

      // Race
      const raceVal = (pairs.get('race') || '').toLowerCase();
      if (this.raceNameMap[raceVal]) {
        data.race = this.raceNameMap[raceVal];
      }

      // Ruler line: "Knight Ulysses the Hero"
      const ruler = pairs.get('ruler') || '';
      // Extract personality from suffix
      const rulerLower = ruler.toLowerCase();
      for (const [suffix, persKey] of Object.entries(this.personalitySuffixMap)) {
        if (rulerLower.endsWith(suffix)) {
          data.personality = persKey;
          break;
        }
      }

      // Military units — map race-specific names to generic types
      data.soldiers = this.parseNum(pairs.get('soldiers'));
      data.prisoners = this.parseNum(pairs.get('prisoners'));

      for (const [label, value] of pairs) {
        const unitType = this.unitNameMap[label];
        if (unitType) {
          data[unitType] = this.parseNum(value);
        }
      }
    }

    // --- Active spells from "Info" / "Duration:" section ---
    // Looks for spans with spell names inside the game-content
    const gameContent = doc.querySelector('.game-content');
    if (gameContent) {
      const text = gameContent.textContent;

      // Detect active spells from "Duration:" section using SPELL_DATA
      // Detects all known fading spells dynamically
      data.activeSpellsFromThrone = {};
      if (typeof SPELL_DATA !== 'undefined') {
        for (const [key, spell] of Object.entries(SPELL_DATA)) {
          const escapedName = spell.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          if (new RegExp(escapedName, 'i').test(text)) {
            data.activeSpellsFromThrone[key] = true;
          }
        }
      }
      // Legacy fields for backward compat
      data.spellFertileLands = /Fertile Lands/i.test(text);
      data.spellChastity = /Chastity/i.test(text);
      data.spellMinersM = /Miner.s Mystique/i.test(text);
      data.spellBuildBoon = /Builder.s Boon/i.test(text);

      // Active ritual from advice-message paragraphs
      // "We are covered by the Expedient ritual..."
      const adviceMsgs = gameContent.querySelectorAll('.advice-message');
      const ritualNames = ['ascendency', 'barrier', 'expedient', 'haste', 'havoc', 'onslaught', 'stalwart'];
      for (const msg of adviceMsgs) {
        const msgText = msg.textContent;
        const msgLower = msgText.toLowerCase();
        for (const r of ritualNames) {
          if (msgLower.includes(r + ' ritual')) {
            data.ritual = r;
            break;
          }
        }
        // EOWCF end date: "ceasefire state will expire on January 6 of YR6!"
        const cfMatch = msgText.match(/expire on (\w+ \d+) of (YR\d+)/i);
        if (cfMatch) {
          data.eowcfEndDate = `${cfMatch[1]}, ${cfMatch[2]}`;
        }
      }
    }

    return data;
  },

  // ---------------------------------------------------------------------------
  // MILITARY ADVISOR PAGE (council_military)
  // ---------------------------------------------------------------------------
  // Detected by: heading containing "Military Advisor" or OME/DME table
  //
  // Structure: table with rows of <th>UnitName</th><td>Count</td>
  // Row order: Generals, Soldiers, {OffSpec}, {DefSpec}, {Elites}, War Horses
  // Uses race-specific names (e.g. "Goblins" for Orc off specs).
  // ---------------------------------------------------------------------------
  scrapeMilitary(doc) {
    const headings = doc.querySelectorAll('h2');
    let found = false;
    for (const h of headings) {
      if (h.textContent.includes('Military Strength')) { found = true; break; }
    }
    if (!found) return null;

    const data = { _page: 'military', _scrapedAt: Date.now() };

    // Find the army table — has rows with Soldiers, race-specific unit names
    const tables = doc.querySelectorAll('table');
    for (const table of tables) {
      const pairs = this.extractThTdPairs(table);

      // Check for OME/DME
      if (pairs.has('offensive military effectiveness')) {
        data.ome = this.parsePct(pairs.get('offensive military effectiveness'));
        data.dme = this.parsePct(pairs.get('defensive military effectiveness'));
        continue;
      }

      // Check for army units
      if (pairs.has('soldiers')) {
        data.soldiers = this.parseNum(pairs.get('soldiers'));
        data.prisoners = this.parseNum(pairs.get('prisoners'));
        // Map race-specific names
        for (const [label, value] of pairs) {
          const unitType = this.unitNameMap[label];
          if (unitType) {
            data[unitType] = this.parseNum(value);
          }
        }
      }
    }

    // Wage rate: "Our wage rate is 20.0% of normal levels"
    const gameContent = doc.querySelector('.game-content');
    if (gameContent) {
      const text = gameContent.textContent;
      const wageMatch = text.match(/wage rate is ([\d.]+)%/i);
      if (wageMatch) {
        data.wageRate = parseFloat(wageMatch[1]);
      }
    }

    return data;
  },

  // ---------------------------------------------------------------------------
  // BUILDINGS ADVISOR PAGE (council_internal)
  // ---------------------------------------------------------------------------
  // Detected by: heading containing "Internal Affairs"
  //
  // Structure: table rows with <th>BuildingName</th><td>Count</td><td>Pct%</td>
  // Building names match display names (e.g. "Military Barracks", "Thieves' Dens").
  // ---------------------------------------------------------------------------
  scrapeBuildings(doc) {
    // Match council_internal ("Building Effectiveness" h2) or build page ("Build" h1)
    const h2s = doc.querySelectorAll('h2');
    const h1s = doc.querySelectorAll('h1');
    let found = false;
    for (const h of h2s) {
      if (h.textContent.includes('Building Effectiveness')) { found = true; break; }
    }
    if (!found) {
      for (const h of h1s) {
        if (h.textContent.trim() === 'Build' && !h.parentElement.matches('a')) { found = true; break; }
      }
    }
    if (!found) return null;

    const data = { _page: 'buildings', _scrapedAt: Date.now(), buildings: {}, buildingEffects: {} };

    // Search all tables for rows containing building names
    const allRows = doc.querySelectorAll('table tr');
    for (const row of allRows) {
      const th = row.querySelector('th');
      const tds = row.querySelectorAll('td');
      if (!th || tds.length < 1) continue;

      const name = th.textContent.trim().toLowerCase();
      const key = this.buildingNameMap[name];
      if (key && !data.buildings[key]) {
        data.buildings[key] = this.parseNum(tds[0].textContent);
      }
    }

    // --- Building Effects ---
    // Table #council-internal-build-effects has columns:
    //   th: Building Name | td[0]: Quantity | td[1]: % of Total | td[2]: Current Effects
    // The effects td contains multiple lines separated by <br>, e.g.:
    //   "Produce 8,610 gold coins per day\n31.66% higher income (1.21%)"
    // We extract the full text, clean up whitespace, and join lines with " | ".
    const effectsTable = doc.querySelector('#council-internal-build-effects');
    if (effectsTable) {
      const rows = effectsTable.querySelectorAll('tbody tr');
      for (const row of rows) {
        const th = row.querySelector('th');
        const tds = row.querySelectorAll('td');
        if (!th || tds.length < 3) continue;

        const name = th.textContent.trim().toLowerCase();
        const key = this.buildingNameMap[name];
        if (!key) continue;

        // tds[2] contains the effects with <br> separators
        const effectTd = tds[2];
        // Get individual text lines from the innerHTML (split on <br>)
        const lines = effectTd.innerHTML
          .split(/<br\s*\/?>/i)
          .map(s => s.replace(/<[^>]*>/g, '').trim())
          .filter(s => s.length > 0);

        if (lines.length > 0) {
          data.buildingEffects[key] = lines.join(' | ');
        }
      }
    }

    // --- Construction Schedule ---
    // Table with class "schedule" has 24 tick columns per building type.
    // Each cell may contain a number = buildings completing at that tick.
    // Sum all values per row = total buildings currently in construction.
    const scheduleTable = doc.querySelector('table.schedule');
    if (scheduleTable) {
      data.inConstruction = {};
      const rows = scheduleTable.querySelectorAll('tbody tr');
      for (const row of rows) {
        const th = row.querySelector('th');
        if (!th) continue;
        const name = th.textContent.trim().toLowerCase();
        const key = this.buildingNameMap[name];
        if (!key) continue;

        const tds = row.querySelectorAll('td');
        let total = 0;
        for (const td of tds) {
          const val = parseInt(td.textContent.trim());
          if (val > 0) total += val;
        }
        if (total > 0) {
          if (key === 'barrenLand') {
            data.inExploration = total;
          } else {
            data.inConstruction[key] = total;
          }
        }
      }
    }

    return Object.keys(data.buildings).length > 0 ? data : null;
  },

  // ---------------------------------------------------------------------------
  // SCIENCE PAGE (science)
  // ---------------------------------------------------------------------------
  // Detected by: heading containing "Economy" with "scientists" and "books"
  //
  // Structure: table rows with:
  //   <td>Alchemy</td><td>130,834</td><td>+18.5% Income</td>
  // We extract the percentage from the third <td>.
  // ---------------------------------------------------------------------------
  scrapeScience(doc) {
    const headings = doc.querySelectorAll('h2');
    let found = false;
    for (const h of headings) {
      if (h.textContent.includes('scientists') && h.textContent.includes('books')) {
        found = true; break;
      }
    }
    if (!found) return null;

    const data = { _page: 'science', _scrapedAt: Date.now(), sciences: {} };

    // Science rows: <td>Name</td><td>BookCount</td><td>+X.X% Effect</td>
    const tables = doc.querySelectorAll('table');
    for (const table of tables) {
      const rows = table.querySelectorAll('tr');
      for (const row of rows) {
        const tds = row.querySelectorAll('td');
        if (tds.length < 3) continue;

        const name = tds[0].textContent.trim().toLowerCase();
        const sciKey = this.scienceNameMap[name];
        if (sciKey) {
          data.sciences[sciKey] = this.parsePct(tds[2].textContent);
        }
      }
    }

    return Object.keys(data.sciences).length > 0 ? data : null;
  },

  // ---------------------------------------------------------------------------
  // RITUAL STATUS PAGE (status_ritual)
  // ---------------------------------------------------------------------------
  // Detected by: <h1> containing "Ritual status"
  //
  // The active ritual is in a .page-summary paragraph:
  //   "Our kingdom is covered by the Expedient ritual."
  // ---------------------------------------------------------------------------
  scrapeRitual(doc) {
    const headings = doc.querySelectorAll('h1');
    let found = false;
    for (const h of headings) {
      if (h.textContent.includes('Ritual')) { found = true; break; }
    }
    if (!found) return null;

    const data = { _page: 'ritual', _scrapedAt: Date.now() };

    const summaries = doc.querySelectorAll('.page-summary');
    const ritualNames = ['ascendency', 'barrier', 'expedient', 'haste', 'havoc', 'onslaught', 'stalwart'];
    for (const el of summaries) {
      const text = el.textContent.toLowerCase();
      for (const r of ritualNames) {
        if (text.includes(r + ' ritual')) {
          data.ritual = r;
          break;
        }
      }
      // "88.3% effectiveness is left."
      const effMatch = text.match(/([\d.]+)%\s*effectiveness/i);
      if (effMatch) {
        data.ritualEffectiveness = parseFloat(effMatch[1]);
      }
    }

    return data;
  },

  // ---------------------------------------------------------------------------
  // TRAIN ARMY PAGE (train_army)
  // ---------------------------------------------------------------------------
  // Detected by: <h1>Train</h1> (not a link)
  //
  // Extracts wage rate from: <input id="id_wage_rate" value="20">
  // ---------------------------------------------------------------------------
  scrapeTrainArmy(doc) {
    const wageInput = doc.querySelector('#id_wage_rate');
    if (!wageInput) return null;

    const data = { _page: 'trainArmy', _scrapedAt: Date.now() };
    data.wageRate = parseFloat(wageInput.value) || 100;

    return data;
  },

  // ---------------------------------------------------------------------------
  // KINGDOM DETAILS PAGE (kingdom_details)
  // ---------------------------------------------------------------------------
  // Detected by: <h2> containing "War Doctrines"
  //
  // War Doctrines table structure:
  //   <th>Race</th> <th>Provinces</th> <th>Doctrine Effect</th> <th>Current Bonus</th>
  //   <td>Dark Elf</td> <td>4</td> <td>Instant Spell Damage</td> <td>+4.5%</td>
  //
  // We extract: { effect: "Instant Spell Damage", bonus: "+4.5%" } per race.
  // ---------------------------------------------------------------------------
  scrapeKingdomDetails(doc) {
    const headings = doc.querySelectorAll('h2');
    let found = false;
    for (const h of headings) {
      if (h.textContent.includes('War Doctrines')) { found = true; break; }
    }
    if (!found) return null;

    const data = { _page: 'kingdomDetails', _scrapedAt: Date.now(), warDoctrines: [] };

    // Find the War Doctrines table — it follows the h2
    const tables = doc.querySelectorAll('table');
    for (const table of tables) {
      const headerRow = table.querySelector('thead tr');
      if (!headerRow) continue;
      const ths = headerRow.querySelectorAll('th');
      const headers = Array.from(ths).map(th => th.textContent.trim().toLowerCase());
      if (!headers.includes('doctrine effect') || !headers.includes('current bonus')) continue;

      const effectIdx = headers.indexOf('doctrine effect');
      const bonusIdx = headers.indexOf('current bonus');

      const rows = table.querySelectorAll('tbody tr');
      for (const row of rows) {
        const tds = row.querySelectorAll('td');
        if (tds.length < Math.max(effectIdx, bonusIdx) + 1) continue;

        const effect = tds[effectIdx].textContent.trim();
        const bonus = tds[bonusIdx].textContent.trim();
        if (effect && bonus && bonus !== '0%' && bonus !== '+0%' && bonus !== '-0%') {
          data.warDoctrines.push({ effect, bonus });
        }
      }
      break;
    }

    return data;
  },

  // ---------------------------------------------------------------------------
  // ENCHANTMENT PAGE (enchantment)
  // ---------------------------------------------------------------------------
  // Detected by: select with id="id_self_spell" or table with id="spellslist"
  //
  // Extracts:
  //   - fadingSpells: list of available fading spells (from optgroup "Fading Spells")
  //   - activeSpells: object mapping spell key to remaining ticks
  //     Active spells appear in #spellslist with <font color="#90ee90">Name</font>
  //     and "(X days)" after the name.
  // ---------------------------------------------------------------------------
  scrapeEnchantment(doc) {
    const spellSelect = doc.getElementById('id_self_spell');
    const spellsList = doc.getElementById('spellslist');
    if (!spellSelect && !spellsList) return null;

    const data = { _page: 'enchantment', _scrapedAt: Date.now() };

    // --- Fading spells from dropdown optgroup ---
    data.fadingSpells = [];
    if (spellSelect) {
      const fadingGroup = spellSelect.querySelector('optgroup[label="Fading Spells"]');
      if (fadingGroup) {
        const options = fadingGroup.querySelectorAll('option');
        for (const opt of options) {
          const key = opt.value;
          const text = opt.textContent.trim();
          // Extract name: "Minor Protection (585 runes)" → "Minor Protection"
          const nameMatch = text.match(/^(.+?)\s*\(/);
          const name = nameMatch ? nameMatch[1].trim() : text;
          if (key) {
            data.fadingSpells.push({ key, name });
          }
        }
      }
    }

    // --- Active spells from #spellslist table ---
    // Active spells have <font color="#90ee90">SpellName</font> and "(X days)"
    data.activeSpells = {};
    if (spellsList) {
      const tds = spellsList.querySelectorAll('td');
      for (const td of tds) {
        const greenFont = td.querySelector('font[color="#90ee90"]');
        if (!greenFont) continue;

        // Get the spell key from the castspell span
        const castSpan = td.querySelector('.castspell');
        const key = castSpan ? castSpan.getAttribute('value') : null;
        if (!key) continue;

        // Extract remaining ticks: "(11 days)" from td text
        const tdText = td.textContent;
        const daysMatch = tdText.match(/\((\d+)\s*days?\)/i);
        const remaining = daysMatch ? parseInt(daysMatch[1]) : 0;

        data.activeSpells[key] = { remaining };
      }
    }

    return data;
  }
};
