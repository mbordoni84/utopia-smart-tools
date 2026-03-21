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
    'knights': 'elites', 'ogres': 'elites', 'ghouls': 'elites',
    // thieves
    'thieves': 'thieves'
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
  // SPELL NAME MAPPING (display name lowercase -> SPELL_DATA key)
  // ---------------------------------------------------------------------------
  // Used by throne page scraper to detect active spells from "Duration:" text.
  // This is self-contained so scrapers.js doesn't depend on spells.js loading.
  // ---------------------------------------------------------------------------
  spellNameMap: {
    'minor protection': 'MINOR_PROTECTION', 'greater protection': 'GREATER_PROTECTION',
    'magic shield': 'MAGIC_SHIELD', 'fertile lands': 'FERTILE_LANDS',
    "nature's blessing": 'NATURES_BLESSING', 'love and peace': 'LOVE_AND_PEACE',
    'divine shield': 'DIVINE_SHIELD', 'quick feet': 'QUICK_FEET',
    "builders boon": 'BUILDERS_BOON', 'inspire army': 'INSPIRE_ARMY',
    "hero's inspiration": 'HEROS_INSPIRATION', 'scientific insights': 'SCIENTIFIC_INSIGHTS',
    'illuminate shadows': 'ILLUMINATE_SHADOWS', 'salvation': 'SALVATION',
    'wrath': 'WRATH', 'invisibility': 'INVISIBILITY', 'clear sight': 'CLEAR_SIGHT',
    "mage's fury": 'MAGES_FURY', 'war spoils': 'WAR_SPOILS', 'mind focus': 'MIND_FOCUS',
    'fanaticism': 'FANATICISM', 'guile': 'GUILE', 'revelation': 'REVELATION',
    'fountain of knowledge': 'FOUNTAIN_OF_KNOWLEDGE', 'town watch': 'TOWN_WATCH',
    'aggression': 'AGGRESSION', "miner's mystique": 'MINERS_MYSTIQUE',
    'ghost workers': 'GHOST_WORKERS', 'mist': 'MIST', 'reflect magic': 'REFLECT_MAGIC',
    'bloodlust': 'BLOODLUST', 'patriotism': 'PATRIOTISM',
    // Offensive spells
    'plague': 'PLAGUE', 'chastity': 'CHASTITY', 'drought': 'DROUGHT', 'gluttony': 'GLUTTONY',
    'greed': 'GREED', 'blizzard': 'BLIZZARD', 'storms': 'STORMS',
    'explosions': 'EXPLOSIONS', 'expose thieves': 'EXPOSE_THIEVES',
    'pitfalls': 'PITFALLS', 'meteor showers': 'METEOR_SHOWERS',
    'magic ward': 'MAGIC_WARD', 'sloth': 'SLOTH', 'propaganda': 'PROPAGANDA',
    'riots': 'RIOTS', 'nightmares': 'NIGHTMARES',
    'construction delays': 'CONSTRUCTION_DELAYS'
  },

  // ---------------------------------------------------------------------------
  // SCIENCE NAME MAPPING (display name -> field key for planner)
  // ---------------------------------------------------------------------------
  scienceNameMap: {
    'alchemy': 'alchemy', 'tools': 'tools', 'housing': 'housing',
    'production': 'production', 'bookkeeping': 'bookkeeping', 'artisan': 'artisan',
    'strategy': 'strategy', 'tactics': 'tactics', 'valor': 'valor', 'heroism': 'heroism', 'siege': 'siege',
    'channeling': 'channeling', 'shielding': 'shielding', 'sorcery': 'sorcery',
    'crime': 'crime', 'cunning': 'cunning', 'finesse': 'finesse'
  },

  // ---------------------------------------------------------------------------
  // STATE PAGE (council_state)
  // ---------------------------------------------------------------------------
  // Detected by: <h2>Affairs of the State</h2>
  //
  // Extracts from resource bar: gold, food, runes, land, NW/Acre
  // Extracts from stats table: peasants, army, thieves, wizards, honor,
  //   daily income, daily wages, unemployed, employment, ranks
  // Extracts honor title from greeting text ("Knight Ulysses, I track...")
  // Extracts historical table: income, wages, food, runes net changes
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
      if (vals.length >= 7) {
        data.networthPerAcre = parseFloat(vals[6].textContent.replace(/,/g, '')) || 0;
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
      data.unemployedPeasants = this.parseNum(pairs.get('unemployed peasants'));
      const empVal = pairs.get('employment');
      if (empVal) data.employment = this.parsePct(empVal);
      const landRank = pairs.get('land rank');
      if (landRank) data.landRank = landRank;
      const nwRank = pairs.get('networth rank');
      if (nwRank) data.networthRank = nwRank;
      const mapVal = pairs.get('multi-attack protection');
      if (mapVal) data.multiAttackProtection = mapVal.trim();
    }

    // --- Historical table (Net Change Yesterday / This Month / Last Month) ---
    // Rows: Our Income, Military Wages, Draft Costs, Net Change (gold),
    //        Peasants, Food Grown, Food Needed, Food Decayed, Net Change (food),
    //        Runes Produced, Runes Decayed, Net Change (runes)
    const gameContent = doc.querySelector('.game-content');
    if (gameContent) {
      const tables = gameContent.querySelectorAll('table');
      for (const table of tables) {
        // Skip resource bar and stats table
        if (table.id === 'resource-bar' || table.classList.contains('three-column-stats')) continue;

        const headerRow = table.querySelector('tr');
        if (!headerRow) continue;
        const headerText = headerRow.textContent.toLowerCase();
        if (!headerText.includes('net change yesterday')) continue;

        // Found the historical table
        data.stateHistory = {};
        const rowMap = {
          'our income': 'income',
          'military wages': 'wages',
          'draft costs': 'draftCosts',
          'peasants': 'peasants',
          'food grown': 'foodGrown',
          'food needed': 'foodNeeded',
          'food decayed': 'foodDecayed',
          'runes produced': 'runesProduced',
          'runes decayed': 'runesDecayed'
        };
        // "Net Change" appears 3 times (gold, food, runes) — track which one
        let netChangeIdx = 0;
        const netChangeKeys = ['netGoldChange', 'netFoodChange', 'netRuneChange'];

        const rows = table.querySelectorAll('tr');
        for (const row of rows) {
          const th = row.querySelector('th');
          const tds = row.querySelectorAll('td');
          if (!th || tds.length < 3) continue;

          const label = th.textContent.trim().toLowerCase();
          let key = rowMap[label];

          if (!key && label === 'net change') {
            key = netChangeKeys[netChangeIdx] || null;
            netChangeIdx++;
          }

          if (key) {
            data.stateHistory[key] = {
              yesterday: this.parseNum(tds[0].textContent),
              thisMonth: this.parseNum(tds[1].textContent),
              lastMonth: this.parseNum(tds[2].textContent)
            };
          }
        }
        break;
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
    let provinceName = '';
    for (const h of headings) {
      if (h.textContent.includes('The Province of')) {
        found = true;
        const match = h.textContent.match(/The Province of\s+(.+?)(?:\s*\(\d+:\d+\).*)?$/i);
        if (match) provinceName = match[1].trim();
        break;
      }
    }
    if (!found) return null;

    const data = { _page: 'throne', _scrapedAt: Date.now() };
    if (provinceName) data.provinceName = provinceName;

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
        if (rulerLower.includes(suffix)) {
          data.personality = persKey;
          break;
        }
      }

      // Building Efficiency — "Building Eff.: 135%"
      const beVal = pairs.get('building eff.');
      if (beVal) data.buildingEfficiencyPct = this.parsePct(beVal);

      // War Horses
      data.warHorses = this.parseNum(pairs.get('war horses'));

      // Trade Balance, Off/Def Points
      data.tradeBalance = this.parseNum(pairs.get('trade balance'));
      data.offPoints = this.parseNum(pairs.get('off. points'));
      data.defPoints = this.parseNum(pairs.get('def. points'));

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

      // Active spell detection from the throne page text.
      // The "Duration:" section lists active spells with remaining days, e.g.:
      //   "Duration: Magic Shield ( 3 days ) Inspire Army ( 4 days )"
      const fullText = doc.body ? doc.body.textContent : text;
      const spellSearchText = fullText.includes('Duration:') ? fullText : text;
      if (spellSearchText.includes('Duration:')) {
        data.activeSpells = {};
        const dIdx = spellSearchText.indexOf('Duration:');
        const durationText = spellSearchText.substring(dIdx).toLowerCase();
        for (const [spellName, spellKey] of Object.entries(this.spellNameMap)) {
          const idx = durationText.indexOf(spellName);
          if (idx !== -1) {
            const after = durationText.substring(idx + spellName.length);
            const daysMatch = after.match(/\(\s*(\d+)\s*days?\s*\)/i);
            const remaining = daysMatch ? parseInt(daysMatch[1]) : 0;
            data.activeSpells[spellKey] = { remaining };
          }
        }
        console.log('[Utopia Smart Tools] Detected active spells:', Object.keys(data.activeSpells).join(', ') || 'none');
      }

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
            // "with 88.3% effectiveness left!"
            const effMatch = msgText.match(/([\d.]+)%\s*effectiveness/i);
            if (effMatch) {
              data.ritualEffectiveness = parseFloat(effMatch[1]);
            }
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

    // Find tables for OME/DME and Army Availability
    const tables = doc.querySelectorAll('table');
    for (const table of tables) {
      // Check for OME/DME table
      const pairs = this.extractThTdPairs(table);
      if (pairs.has('offensive military effectiveness')) {
        data.ome = this.parsePct(pairs.get('offensive military effectiveness'));
        data.dme = this.parsePct(pairs.get('defensive military effectiveness'));
        continue;
      }

      // Army Availability table: table.data with "Standing Army" header
      // Columns: Standing Army, then N army slots (deployed or undeployed)
      // Sum all columns per row to get TRUE totals (including out-on-attack)
      const thead = table.querySelector('thead');
      if (!thead || !thead.textContent.includes('Standing Army')) continue;

      const rows = table.querySelectorAll('tbody tr');
      for (const row of rows) {
        const th = row.querySelector('th');
        if (!th) continue;
        const name = th.textContent.trim().toLowerCase();
        const tds = row.querySelectorAll('td');
        if (tds.length === 0) continue;

        // First td = standing army (at home)
        const standingVal = this.parseNum(tds[0].textContent.trim());
        // Sum all columns for total (standing + all deployed armies)
        let total = standingVal || 0;
        for (let i = 1; i < tds.length; i++) {
          const val = this.parseNum(tds[i].textContent.trim());
          if (val > 0) total += val;
        }

        // Generals
        if (name === 'generals') {
          data.atHome_generals = standingVal;
          data.generals = total;
          continue;
        }

        // Soldiers
        if (name === 'soldiers') {
          data.atHome_soldiers = standingVal;
          data.soldiers = total;
          continue;
        }

        // Prisoners
        if (name === 'prisoners') {
          data.atHome_prisoners = standingVal;
          data.prisoners = total;
          continue;
        }

        // Race-specific unit names → generic types
        const unitType = this.unitNameMap[name];
        if (unitType) {
          data['atHome_' + unitType] = standingVal;
          data[unitType] = total;
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

    // --- Training Schedule ---
    // table.schedule has 24 tick columns per unit type (same format as building schedule).
    // Units in training count toward population and food consumption.
    const scheduleTable = doc.querySelector('table.schedule');
    if (scheduleTable) {
      data.inTraining = {};
      const rows = scheduleTable.querySelectorAll('tbody tr');
      for (const row of rows) {
        const th = row.querySelector('th');
        if (!th) continue;
        const name = th.textContent.trim().toLowerCase();
        // Map race-specific names to generic types
        const unitType = this.unitNameMap[name];
        if (!unitType) continue;

        const tds = row.querySelectorAll('td');
        let total = 0;
        for (const td of tds) {
          const val = parseInt(td.textContent.trim());
          if (val > 0) total += val;
        }
        if (total > 0) {
          data.inTraining[unitType] = total;
        }
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
    // Skip schedule tables (they have 24 tick columns, not building counts)
    //
    // The Build page uses a two-column layout: each <tr> contains TWO buildings
    // side by side, each with their own <th> + <td>. We must iterate ALL <th>
    // elements per row (not just the first) to capture both columns.
    // council_internal page has one building per row — same logic works fine.
    const allRows = doc.querySelectorAll('table:not(.schedule) tr');
    for (const row of allRows) {
      const ths = row.querySelectorAll('th');
      for (const th of ths) {
        const name = th.textContent.trim().toLowerCase();
        const key = this.buildingNameMap[name];
        if (!key) continue;
        // The count is in the first <td> immediately following this <th>
        let next = th.nextElementSibling;
        while (next && next.tagName !== 'TD') next = next.nextElementSibling;
        if (!next) continue;
        if (!data.buildings[key]) {
          data.buildings[key] = this.parseNum(next.textContent);
        }
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

    // --- Statistics table (BE details) ---
    // Table.two-column-stats with: Available Workers, Building Efficiency,
    // Available Jobs, Workers Needed for Max. Efficiency
    const statsTable = doc.querySelector('.two-column-stats');
    if (statsTable) {
      const pairs = this.extractThTdPairs(statsTable);
      const aw = pairs.get('available workers');
      if (aw != null) data.availableWorkers = this.parseNum(aw);
      const be = pairs.get('building efficiency');
      if (be != null) data.buildingEfficiencyPct = this.parsePct(be);
      const aj = pairs.get('available jobs');
      if (aj != null) data.availableJobs = this.parseNum(aj);
      const wn = pairs.get('workers needed for max. efficiency');
      if (wn != null) data.workersNeededForMax = this.parseNum(wn);
      // Build page fields
      const cc = pairs.get('construction cost');
      if (cc != null) data.constructionCost = this.parseNum(cc);
      const ct = pairs.get('construction time');
      if (ct != null) data.constructionTime = this.parseNum(ct);
      const rc = pairs.get('raze cost');
      if (rc != null) data.razeCost = this.parseNum(rc);
      const fbc = pairs.get('free building credits');
      if (fbc != null) data.freeBuildingCredits = this.parseNum(fbc);
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
