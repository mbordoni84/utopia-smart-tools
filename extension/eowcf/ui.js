// =============================================================================
// EOWCF Planner UI
// =============================================================================
// Handles all DOM interactions: populating dropdowns, rendering results,
// and auto-recalculating when inputs change.
//
// Architecture:
//   - On load: populate dropdowns from GAME_DATA, attach event listeners
//   - On any input change: call Engine functions, render results
//   - Comparison section: lets user paste in-game values to verify formulas
// =============================================================================

(function () {
  window._inConstruction = window._inConstruction || {};
  window._buildingEffects = window._buildingEffects || {};

  const raceSelect = document.getElementById('race');
  const persSelect = document.getElementById('personality');
  const buildingsGrid = document.getElementById('buildingsGrid');
  const outputDiv = document.getElementById('output');

  // ---------------------------------------------------------------------------
  // POPULATE DROPDOWNS
  // ---------------------------------------------------------------------------

  // Race dropdown — from GAME_DATA.races
  for (const [key, race] of Object.entries(GAME_DATA.races)) {
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = race.name;
    raceSelect.appendChild(opt);
  }

  // Personality dropdown — from GAME_DATA.personalities
  for (const [key, pers] of Object.entries(GAME_DATA.personalities)) {
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = pers.name;
    persSelect.appendChild(opt);
  }

  // Dragon dropdown — from GAME_DATA.dragons
  const dragonSelect = document.getElementById('dragon');
  for (const [key, dragon] of Object.entries(GAME_DATA.dragons)) {
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = dragon.name;
    dragonSelect.appendChild(opt);
  }

  // ---------------------------------------------------------------------------
  // POPULATE BUILDING INPUTS
  // ---------------------------------------------------------------------------
  // Dynamically creates number inputs for each building type.
  // Barren Land is excluded (isBuilding=false) since it's calculated as
  // acres minus built land.
  // ---------------------------------------------------------------------------
  // Barren Land — scraped from council_internal, shown as read-only
  const barrenDiv = document.createElement('div');
  barrenDiv.className = 'form-group';
  barrenDiv.innerHTML = `<label>Barren Land <span class="bld-pct" id="bldPct_barrenLand"></span> <span class="bld-wip" id="bldExploration"></span></label>
    <input type="number" id="bld_barrenLand" value="0" readonly tabindex="-1" style="opacity:0.7;cursor:default;">`;
  buildingsGrid.appendChild(barrenDiv);

  const buildingKeys = Object.keys(GAME_DATA.buildings).filter(k => GAME_DATA.buildings[k].isBuilding);
  for (const key of buildingKeys) {
    const b = GAME_DATA.buildings[key];
    const div = document.createElement('div');
    div.className = 'form-group';
    div.innerHTML = `<label for="bld_${key}">${b.name} <span class="bld-pct" id="bldPct_${key}"></span> <span class="bld-wip" id="bldWip_${key}"></span></label>
      <input type="number" id="bld_${key}" value="0" min="0">
      <span class="field-hint" id="bldEffect_${key}"></span>`;
    buildingsGrid.appendChild(div);
  }

  function updateBuildingPcts() {
    const acres = parseInt(document.getElementById('acres').value) || 0;
    let totalBuilt = 0;
    for (const key of buildingKeys) {
      const count = parseInt(document.getElementById('bld_' + key).value) || 0;
      totalBuilt += count;
      const pctEl = document.getElementById('bldPct_' + key);
      if (pctEl) {
        pctEl.textContent = acres > 0 ? `(${(count / acres * 100).toFixed(1)}%)` : '';
      }
    }
    // Update Barren Land percentage display (value comes from scraper import)
    const barrenInput = document.getElementById('bld_barrenLand');
    const barren = barrenInput ? (parseInt(barrenInput.value) || 0) : 0;
    const barrenPct = document.getElementById('bldPct_barrenLand');
    if (barrenPct) barrenPct.textContent = acres > 0 ? `(${(barren / acres * 100).toFixed(1)}%)` : '';
  }

  function updateConstructionLabels() {
    const wip = window._inConstruction || {};
    for (const key of buildingKeys) {
      const wipEl = document.getElementById('bldWip_' + key);
      if (wipEl) {
        const count = wip[key] || 0;
        wipEl.textContent = count > 0 ? `[${count} in construction]` : '';
      }
    }
  }

  function updateBuildingEffectLabels() {
    const effects = window._buildingEffects || {};
    for (const key of buildingKeys) {
      const el = document.getElementById('bldEffect_' + key);
      if (el) {
        el.textContent = effects[key] || '';
      }
    }
  }

  // ---------------------------------------------------------------------------
  // SPELL CHECKBOXES — dynamically rendered from scraped fading spells
  // ---------------------------------------------------------------------------
  const spellsGrid = document.getElementById('spellsGrid');
  const spellsHint = document.getElementById('spellsHint');

  /**
   * Render spell checkboxes for all spells in SPELL_DATA.
   * Shows self (good) spells first, then offensive (bad) spells.
   * Active spells are pre-checked with remaining duration shown.
   *
   * @param {Object} activeSpells - {SPELL_KEY: {remaining}} from throne scraper
   */
  function renderSpellCheckboxes(activeSpells) {
    spellsGrid.innerHTML = '';
    activeSpells = activeSpells || {};

    if (typeof SPELL_DATA === 'undefined') return;

    const selfSpells = [];
    const offensiveSpells = [];
    for (const [key, spell] of Object.entries(SPELL_DATA)) {
      const entry = { key, name: spell.name, type: spell.type };
      if (spell.type === 'offensive') {
        offensiveSpells.push(entry);
      } else {
        selfSpells.push(entry);
      }
    }

    function addSpellCheckbox(spell) {
      const div = document.createElement('div');
      div.className = 'form-group checkbox-group';
      const isActive = activeSpells[spell.key];
      const remaining = isActive && typeof isActive === 'object' ? isActive.remaining : 0;
      const durationText = remaining > 0 ? ` (${remaining} ticks)` : '';
      const typeLabel = spell.type === 'offensive' ? ' <span class="spell-offensive">[enemy]</span>' : '';
      div.innerHTML = `<label><input type="checkbox" id="spell_${spell.key}"${isActive ? ' checked' : ''}> ${spell.name}${typeLabel}${durationText}</label>`;
      div.querySelector('input').addEventListener('change', recalculate);
      spellsGrid.appendChild(div);
    }

    for (const s of selfSpells) addSpellCheckbox(s);
    if (offensiveSpells.length > 0) {
      const divider = document.createElement('div');
      divider.className = 'spell-section-label';
      divider.textContent = 'Enemy Spells (bad)';
      spellsGrid.appendChild(divider);
      for (const s of offensiveSpells) addSpellCheckbox(s);
    }

    spellsHint.style.display = 'none';
  }

  // Initial render
  renderSpellCheckboxes(null);

  // ---------------------------------------------------------------------------
  // RACE-SPECIFIC UNIT LABELS
  // ---------------------------------------------------------------------------
  // When the user changes race, update the Off Specs / Def Specs / Elites
  // labels to show the actual unit names (e.g. "Griffins" for Avian Off Specs).
  // ---------------------------------------------------------------------------
  raceSelect.addEventListener('change', updateRaceLabels);
  updateRaceLabels();

  function updateRaceLabels() {
    const race = GAME_DATA.races[raceSelect.value];
    if (!race) return;
    const offLabel = document.querySelector('label[for="offSpecs"]');
    const defLabel = document.querySelector('label[for="defSpecs"]');
    const eliteLabel = document.querySelector('label[for="elites"]');
    if (offLabel) offLabel.textContent = `Off Specs (${race.military.offSpec.name})`;
    if (defLabel) defLabel.textContent = `Def Specs (${race.military.defSpec.name})`;
    if (eliteLabel) eliteLabel.textContent = `Elites (${race.military.elites.name})`;
  }

  // ---------------------------------------------------------------------------
  // AUTO-RECALCULATE ON INPUT CHANGE
  // ---------------------------------------------------------------------------
  // Listen for both 'input' (typing) and 'change' (dropdown/checkbox) events
  // on the entire input panel. This avoids attaching individual listeners
  // to every field.
  // ---------------------------------------------------------------------------
  const inputPanel = document.querySelector('.input-panel');
  inputPanel.addEventListener('input', recalculate);
  inputPanel.addEventListener('change', recalculate);

  // EOWCF checkbox toggles visibility of CF start date field
  const eowcfCheckbox = document.getElementById('eowcfActive');
  const eowcfFields = document.getElementById('eowcfFields');
  const eowcfStartInput = document.getElementById('eowcfStartDate');

  function toggleEowcfFields() {
    eowcfFields.style.display = eowcfCheckbox.checked ? '' : 'none';
    validateEowcfDate();
  }
  eowcfCheckbox.addEventListener('change', () => {
    toggleEowcfFields();
    saveEowcfState();
  });

  // Validate CF start date — red border + warning if checked but empty/invalid
  function validateEowcfDate() {
    if (!eowcfCheckbox.checked) {
      eowcfStartInput.classList.remove('input-error');
      eowcfStartInput.removeAttribute('title');
      return;
    }
    const val = eowcfStartInput.value.trim();
    const parsed = val ? Scrapers.parseUtopianDate(val.replace(/\s+of\s+/i, ', ')) : null;
    if (!val || !parsed) {
      eowcfStartInput.classList.add('input-error');
      eowcfStartInput.title = 'Required — enter CF start date (e.g. April 5 of YR5)';
    } else {
      eowcfStartInput.classList.remove('input-error');
      eowcfStartInput.removeAttribute('title');
    }
  }

  // Persist EOWCF state to chrome.storage
  function saveEowcfState() {
    const data = {
      eowcfActive: eowcfCheckbox.checked,
      eowcfStartDate: eowcfStartInput.value.trim()
    };
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ eowcfState: data });
    }
  }

  // Restore EOWCF state from chrome.storage
  function restoreEowcfState() {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get('eowcfState', (result) => {
        if (result.eowcfState) {
          eowcfCheckbox.checked = result.eowcfState.eowcfActive ?? true;
          eowcfStartInput.value = result.eowcfState.eowcfStartDate || '';
          toggleEowcfFields();
          recalculate();
        }
      });
    }
  }

  eowcfStartInput.addEventListener('input', () => {
    validateEowcfDate();
    saveEowcfState();
  });

  restoreEowcfState();
  toggleEowcfFields();

  // ---------------------------------------------------------------------------
  // FORMATTING HELPERS (aliases into Utils)
  // ---------------------------------------------------------------------------
  const fmt = Utils.fmtNum;
  const fmtPct = Utils.fmtPct;

  // ---------------------------------------------------------------------------
  // HONOR SUMMARY
  // ---------------------------------------------------------------------------
  // Shows the effective honor multipliers for the selected title below the
  // dropdown. Updates on every recalculation.
  // ---------------------------------------------------------------------------
  function renderHonorSummary(honor) {
    const summaryDiv = document.getElementById('honorSummary');
    if (!honor) { summaryDiv.innerHTML = ''; return; }
    const labels = [
      ['Pop', honor.pop], ['OME', honor.ome], ['Income', honor.income],
      ['Food', honor.food], ['Runes', honor.runes], ['WPA', honor.wpa], ['TPA', honor.tpa]
    ];
    const parts = labels.map(([l, v]) => `<span>${l} <strong>${v.toFixed(2)}</strong></span>`);
    summaryDiv.innerHTML = parts.join(' ');
  }

  const modLabels = {
    buildingEfficiency: 'BE', income: 'Income', wages: 'Wages',
    foodConsumption: 'Food Cons.', birthRate: 'Birth Rate', attackTime: 'Atk Time',
    draftCost: 'Draft Cost', ome: 'OME', dme: 'DME', buildTime: 'Build Time',
    buildCost: 'Build Cost', trainingCost: 'Train Cost', trainingTime: 'Train Time',
    flatRateProduction: 'Flat Rate', flatRateCapacity: 'Flat Cap',
    maxPop: 'Max Pop', foodProdPerAcre: 'Food/Acre', runeCostMod: 'Rune Cost',
    specCredits: 'Spec Credits', buildCredits: 'Build Credits',
    offSpecStrengthBonus: 'Off Spec Str',
    battleGains: 'Battle Gains',
    wpa: 'WPA', tpa: 'TPA'
  };

  function renderModSummary(divId, obj) {
    const div = document.getElementById(divId);
    if (!obj || !obj.mods) { div.innerHTML = ''; return; }
    const items = [];
    for (const [key, val] of Object.entries(obj.mods)) {
      if (val === 1.0 || val === 0 || val === undefined) continue;
      const label = modLabels[key] || key;
      items.push([label, val]);
    }
    if (items.length === 0) { div.innerHTML = '<span>No special modifiers</span>'; return; }
    div.innerHTML = items.map(([l, v]) => `<span>${l} <strong>${typeof v === 'number' ? v.toFixed(2) : v}</strong></span>`).join(' ');
  }

  const ritualEffectLabels = {
    buildingEfficiency: 'BE', wages: 'Wages', constructionCost: 'Build Cost',
    constructionTime: 'Build Time', birthRate: 'Birth Rate',
    enemyTMDamage: 'Enemy TM Dmg', massacreDamage: 'Massacre Dmg',
    battleLosses: 'Battle Losses', attackTime: 'Atk Time',
    trainingTime: 'Train Time', offWPA: 'Off WPA', offTPA: 'Off TPA',
    spellDamage: 'Spell Dmg', sabDamage: 'Sab Dmg',
    wizardProduction: 'Wiz Production', wizardLosses: 'Wiz Losses',
    bookProduction: 'Book Production', ome: 'OME', enemyCasualties: 'Enemy Casualties',
    dme: 'DME', ownCasualties: 'Own Casualties'
  };

  function renderRitualSummary(ritual, effectiveness) {
    const div = document.getElementById('ritualSummary');
    if (!ritual || ritual === 'none') { div.innerHTML = ''; return; }
    const ritualData = GAME_DATA.rituals[ritual];
    if (!ritualData || !ritualData.effects) { div.innerHTML = ''; return; }
    const eff = effectiveness || 1;
    const items = [];
    for (const [key, raw] of Object.entries(ritualData.effects)) {
      const label = ritualEffectLabels[key] || key;
      const sign = raw >= 0 ? '+' : '';
      const rawPct = Math.abs(raw * 100);
      const scaledPct = Math.abs(raw * eff * 100);
      const prefix = raw >= 0 ? '+' : '-';
      items.push([label, `${prefix}${scaledPct.toFixed(1)}% (${rawPct}%)`]);
    }
    if (items.length === 0) { div.innerHTML = ''; return; }
    div.innerHTML = items.map(([l, v]) => `<span>${l} <strong>${v}</strong></span>`).join(' ');
  }

  const dragonEffectLabels = {
    spellSuccess: 'Spell Success', sabSuccess: 'Thievery Success',
    wizThiefLosses: 'Wiz/Thief Losses', ownCasualties: 'Own Casualties',
    battleGains: 'Battle Gains', buildSpecCredits: 'Build/Spec Credits',
    birthRate: 'Birth Rate', hospitalEffect: 'Hospital Effect',
    buildCostTime: 'Build Cost & Time', militaryEffectiveness: 'Military Eff.',
    wages: 'Wages', draftLoss: 'Draft Loss',
    buildingEfficiency: 'BE', income: 'Income',
    buildingDestruction: 'Building Destruction',
    wpa: 'WPA', tpa: 'TPA',
    instantDamageTaken: 'Instant Dmg Taken', instantDamageDealt: 'Instant Dmg Dealt'
  };

  function renderDragonSummary(dragonKey) {
    const div = document.getElementById('dragonSummary');
    if (!dragonKey || dragonKey === 'none') { div.innerHTML = ''; return; }
    const dragon = GAME_DATA.dragons[dragonKey];
    if (!dragon || !dragon.effects) { div.innerHTML = ''; return; }
    const items = [];
    for (const [key, raw] of Object.entries(dragon.effects)) {
      const label = dragonEffectLabels[key] || key;
      const pct = Math.abs(raw * 100);
      const prefix = raw >= 0 ? '+' : '-';
      items.push([label, `${prefix}${pct.toFixed(1)}%`]);
    }
    if (items.length === 0) { div.innerHTML = ''; return; }
    div.innerHTML = items.map(([l, v]) => `<span>${l} <strong>${v}</strong></span>`).join(' ');
  }

  // ---------------------------------------------------------------------------
  // COMPARISON PAIRS GENERATOR
  // ---------------------------------------------------------------------------
  // Builds an array of { label, game, engine, delta, pctDiff } objects by
  // comparing scraped game values against engine calculations.
  // "Yesterday" on the State page = 1 tick, so engine per-tick values compare
  // directly without multiplication.
  // ---------------------------------------------------------------------------
  function buildComparisons(scraped, income, wages, food, runes, pop, buildTime, buildCost, razeCost) {
    const pairs = [];
    if (!scraped) return pairs;

    function add(label, gameVal, engineVal) {
      if (gameVal == null || engineVal == null) return;
      const g = Math.round(gameVal);
      const e = Math.round(engineVal);
      const delta = e - g;
      const pctDiff = g !== 0 ? ((delta / g) * 100).toFixed(2) + '%' : (delta === 0 ? '0%' : 'N/A');
      pairs.push({ label, game: g, engine: e, delta, pctDiff });
    }

    // --- Direct stats comparisons ---
    add('Max Population', scraped.maxPop, pop.maxPop);

    // --- Current projected values (from State page stats table) ---
    // dailyIncome/dailyWages reflect the game's current state more accurately
    // than "yesterday" history, which may have had different unit counts/spells.
    add('Income (projected)', scraped.dailyIncome, income.modifiedIncome);
    add('Wages (projected)', scraped.dailyWages, wages.modifiedWages);
    if (scraped.dailyIncome != null && scraped.dailyWages != null) {
      add('Net Gold (projected)', scraped.dailyIncome - scraped.dailyWages,
        income.modifiedIncome - wages.modifiedWages);
    }

    // --- Historical table comparisons (yesterday = last completed tick) ---
    // Note: "yesterday" values reflect a past game state — unit counts, spells,
    // and gradual modifiers (BE, effective wage rate) may have been different.
    const h = scraped.stateHistory;
    if (h) {
      add('Income (yesterday)', h.income && h.income.yesterday, income.modifiedIncome);
      add('Wages (yesterday)', h.wages && h.wages.yesterday, wages.modifiedWages);
      add('Food Produced per tick', h.foodGrown && h.foodGrown.yesterday,
        food.modifiedFoodProduction);
      add('Food Consumed per tick', h.foodNeeded && h.foodNeeded.yesterday,
        food.foodConsumed);
      add('Food Decayed per tick', h.foodDecayed && h.foodDecayed.yesterday,
        food.foodDecay);
      add('Net Food per tick', h.netFoodChange && h.netFoodChange.yesterday,
        food.netFood);
      add('Runes Produced per tick', h.runesProduced && h.runesProduced.yesterday,
        runes.modifiedRuneProduction);
      add('Runes Decayed per tick', h.runesDecayed && h.runesDecayed.yesterday,
        runes.runeDecay);
      add('Net Runes per tick', h.netRuneChange && h.netRuneChange.yesterday,
        runes.netRunes);
      // Peasant Change not compared: game value is net (births - drafts - deaths),
      // engine calculates births only. Not comparable when drafting occurs.
    }

    // --- Building Efficiency (from buildings page or throne) ---
    // Game's displayed BE does NOT include CD or Blizzard malus, so exclude them for comparison
    if (scraped.buildingEfficiencyPct != null) {
      const beForComparison = income.beResult.be
        / (income.beResult.constructionDelaysMod || 1)
        / (income.beResult.blizzardMod || 1);
      add('Building Efficiency %', scraped.buildingEfficiencyPct,
        beForComparison * 100);
    }
    // --- BE intermediate values (from buildings page) ---
    if (scraped.availableWorkers != null) {
      add('Available Workers', scraped.availableWorkers, income.beResult.availableWorkers);
    }
    if (scraped.availableJobs != null) {
      add('Available Jobs', scraped.availableJobs, income.beResult.totalJobs);
    }
    if (scraped.workersNeededForMax != null) {
      add('Workers Needed for Max BE', scraped.workersNeededForMax, income.beResult.optimalWorkers);
    }

    // --- Construction (from build page) ---
    if (scraped.constructionTime != null && buildTime) {
      add('Construction Time', scraped.constructionTime, buildTime.constructionTime);
    }
    if (scraped.constructionCost != null && buildCost) {
      add('Construction Cost', scraped.constructionCost, buildCost.constructionCost);
    }
    if (scraped.razeCost != null && razeCost) {
      add('Raze Cost', scraped.razeCost, razeCost.razeCost);
    }

    return pairs;
  }

  // ---------------------------------------------------------------------------
  // GATHER STATE FROM DOM
  // ---------------------------------------------------------------------------
  function calcEowcfTicksElapsed() {
    const startStr = document.getElementById('eowcfStartDate')?.value?.trim();
    const currentStr = window._utopianDate;
    if (!startStr || !currentStr) return Infinity;
    const normalized = startStr.replace(/\s+of\s+/i, ', ');
    const start = Scrapers.parseUtopianDate(normalized);
    const current = Scrapers.parseUtopianDate(currentStr);
    if (!start || !current) return Infinity;
    return Math.max(0, Scrapers.utopianDateToTicks(current) - Scrapers.utopianDateToTicks(start));
  }

  function gatherState() {
    const raceKey = document.getElementById('race').value;
    const persKey = document.getElementById('personality').value;
    const race = GAME_DATA.races[raceKey];
    const personality = GAME_DATA.personalities[persKey];

    const buildings = {};
    for (const key of Object.keys(GAME_DATA.buildings)) {
      const el = document.getElementById('bld_' + key);
      buildings[key] = el ? (parseInt(el.value) || 0) : 0;
    }

    const honorVal = parseInt(document.getElementById('honor').value) || 0;

    const state = {
      race, personality,
      acres: parseInt(document.getElementById('acres').value) || 0,
      eowcfActive: document.getElementById('eowcfActive').checked,
      eowcfDuration: parseInt(document.getElementById('eowcfDuration')?.value) || 48,
      eowcfTicksElapsed: calcEowcfTicksElapsed(),
      gold: parseInt(document.getElementById('gold').value) || 0,
      food: parseInt(document.getElementById('food').value) || 0,
      runes: parseInt(document.getElementById('runes').value) || 0,
      peasants: parseInt(document.getElementById('peasants').value) || 0,
      soldiers: parseInt(document.getElementById('soldiers').value) || 0,
      offSpecs: parseInt(document.getElementById('offSpecs').value) || 0,
      defSpecs: parseInt(document.getElementById('defSpecs').value) || 0,
      elites: parseInt(document.getElementById('elites').value) || 0,
      thieves: parseInt(document.getElementById('thieves').value) || 0,
      wizards: parseInt(document.getElementById('wizards').value) || 0,
      prisoners: parseInt(document.getElementById('prisoners').value) || 0,
      buildings,
      sciAlchemy: Math.abs(parseFloat(document.getElementById('sciAlchemy').value) || 0),
      sciTools: Math.abs(parseFloat(document.getElementById('sciTools').value) || 0),
      sciProduction: Math.abs(parseFloat(document.getElementById('sciProduction').value) || 0),
      sciHousing: Math.abs(parseFloat(document.getElementById('sciHousing').value) || 0),
      sciBookkeeping: Math.abs(parseFloat(document.getElementById('sciBookkeeping').value) || 0),
      sciHeroism: Math.abs(parseFloat(document.getElementById('sciHeroism').value) || 0),
      sciValor: Math.abs(parseFloat(document.getElementById('sciValor').value) || 0),
      sciArtisan: Math.abs(parseFloat(document.getElementById('sciArtisan').value) || 0),
      spellChastity: !!document.getElementById('spell_CHASTITY')?.checked,
      spellFertileLands: !!document.getElementById('spell_FERTILE_LANDS')?.checked,
      spellMinersM: !!document.getElementById('spell_MINERS_MYSTIQUE')?.checked,
      spellBuildBoon: !!document.getElementById('spell_BUILDERS_BOON')?.checked,
      spellLoveAndPeace: !!document.getElementById('spell_LOVE_AND_PEACE')?.checked,
      spellInspireArmy: !!document.getElementById('spell_INSPIRE_ARMY')?.checked,
      spellHerosInspiration: !!document.getElementById('spell_HEROS_INSPIRATION')?.checked,
      spellGhostWorkers: !!document.getElementById('spell_GHOST_WORKERS')?.checked,
      spellDrought: !!document.getElementById('spell_DROUGHT')?.checked,
      spellGluttony: !!document.getElementById('spell_GLUTTONY')?.checked,
      spellGreed: !!document.getElementById('spell_GREED')?.checked,
      spellBlizzard: !!document.getElementById('spell_BLIZZARD')?.checked,
      spellRiots: !!document.getElementById('spell_RIOTS')?.checked,
      spellConstructionDelays: !!document.getElementById('spell_CONSTRUCTION_DELAYS')?.checked,
      ritual: document.getElementById('ritual').value,
      ritualEffectiveness: (parseFloat(document.getElementById('ritualEffectiveness')?.value) || 100) / 100,
      dragon: document.getElementById('dragon')?.value || 'none',
      wageRate: parseFloat(document.getElementById('wageRate')?.value) || 100,
      inTraining: window._inTraining || {},
      inConstruction: window._inConstruction || {},
    };

    state.honor = Engine.getHonorMods(honorVal, state.race, state.personality);
    return state;
  }

  // ---------------------------------------------------------------------------
  // MAIN RECALCULATE FUNCTION
  // ---------------------------------------------------------------------------
  function recalculate() {
    const state = gatherState();
    if (!state.race || !state.personality) return;
    renderHonorSummary(state.honor);
    renderModSummary('raceSummary', state.race);
    renderModSummary('personalitySummary', state.personality);
    renderRitualSummary(state.ritual, state.ritualEffectiveness);
    renderDragonSummary(state.dragon);
    updateBuildingPcts();
    const income = Engine.calcIncome(state);
    const wages = Engine.calcWages(state);
    const netIncome = income.modifiedIncome - wages.modifiedWages;
    const buildTime = Engine.calcConstructionTime(state);
    const buildCost = Engine.calcConstructionCost(state);
    const razeCost = Engine.calcRazeCost(state);

    // Clear previous output
    outputDiv.innerHTML = '';
    outputDiv.className = '';

    // --- BE Card ---
    renderCard('Building Efficiency', [
      ['Total Jobs', fmt(income.beResult.totalJobs)],
      ['Available Workers', fmt(income.beResult.availableWorkers)],
      ['Optimal Workers (67% jobs)', fmt(income.beResult.optimalWorkers)],
      ['% Jobs Filled', fmtPct(income.beResult.pctJobs * 100)],
      income.beResult.raceBE !== 1
        ? [`Race (${state.race.name})`, 'x' + income.beResult.raceBE.toFixed(2)]
        : null,
      ['Tools Science', 'x' + income.beResult.toolsSci.toFixed(3)],
      income.beResult.ritualBEMod !== 1
        ? [`${GAME_DATA.rituals[state.ritual]?.name || state.ritual} Ritual`, 'x' + income.beResult.ritualBEMod.toFixed(3)]
        : null,
      income.beResult.ghostWorkersMod !== 1
        ? ['Ghost Workers', 'x' + income.beResult.ghostWorkersMod.toFixed(2) + ' (jobs required)']
        : null,
      income.beResult.dragonBEMod !== 1
        ? ['Dragon', 'x' + income.beResult.dragonBEMod.toFixed(2)]
        : null,
      income.beResult.blizzardMod !== 1
        ? ['Blizzard', 'x' + income.beResult.blizzardMod.toFixed(2)]
        : null,
      income.beResult.constructionDelaysMod !== 1
        ? ['Construction Delays', 'x' + income.beResult.constructionDelaysMod.toFixed(2) + ' *']
        : null,
      ['BE', fmtPct(income.beResult.be * 100), 'highlight'],
      income.beResult.constructionDelaysMod !== 1
        ? ['* Note', 'CD malus is NOT shown in the BE displayed in-game']
        : null
    ].filter(Boolean));

    // --- Income Breakdown Card ---
    renderCard('Income per Tick', [
      ['Tax (employed)', `${fmt(income.employed)} x 3gc = ${fmt(income.employed * 3)}gc`],
      ['Tax (unemployed)', `${fmt(income.unemployed)} x 1gc = ${fmt(income.unemployed)}gc`],
      ['Prisoners', `${fmt(state.prisoners)} x 0.75gc = ${fmt(income.prisonerIncome)}gc`],
      ['Bank flat', `${fmt(state.buildings.banks || 0)} banks (built+WIP) x 25gc x ${fmtPct(income.beResult.be * 100)} BE = ${fmt(income.bankFlatIncome)}gc`],
      // Only show Miner's Mystique line if the spell is active
      income.minersMystique > 0
        ? ["Miner's Mystique", `${fmt(state.peasants)} x 0.3gc = ${fmt(income.minersMystique)}gc`]
        : null,
      ['Raw Income', fmt(income.rawIncome) + 'gc', 'highlight'],
      ['Bank % bonus', '+' + fmtPct(income.bankPctBonus)],
      ['Alchemy Science', 'x' + income.alchemySci.toFixed(3)],
      ['Honor (' + (state.honor ? state.honor.titleName : 'Peasant') + ')', 'x' + income.honorMod.toFixed(3)],
      income.raceMod !== 1
        ? [`Race (${state.race.name})`, 'x' + income.raceMod.toFixed(3)]
        : null,
      income.persMod !== 1
        ? [`Personality (${state.personality.name})`, 'x' + income.persMod.toFixed(3)]
        : null,
      income.dragonIncomeMod !== 1
        ? ['Dragon', 'x' + income.dragonIncomeMod.toFixed(2)]
        : null,
      ['Modified Income', fmt(income.modifiedIncome) + 'gc', 'highlight']
    ].filter(Boolean));

    // --- Wages Breakdown Card ---
    renderCard('Military Wages per Tick', [
      ['Specs', `${fmt(wages.specCount)} x 0.5 = ${fmt(wages.specCount * 0.5)}gc`],
      ['Elites', `${fmt(wages.eliteCount)} x 0.75 = ${fmt(wages.eliteCount * 0.75)}gc`],
      ['Wage Rate', fmtPct(state.wageRate)],
      ['Armouries bonus', '-' + fmtPct(wages.armouriesBonus)],
      ['Bookkeeping Sci', 'x' + wages.bookkeepingSci.toFixed(3)],
      wages.raceWageMod !== 1
        ? [`Race (${state.race.name})`, 'x' + wages.raceWageMod.toFixed(3)]
        : null,
      wages.persWageMod !== 1
        ? [`Personality (${state.personality.name})`, 'x' + wages.persWageMod.toFixed(3)]
        : null,
      wages.ritualMod !== 1
        ? [`${GAME_DATA.rituals[state.ritual]?.name || state.ritual} Ritual`, 'x' + wages.ritualMod.toFixed(3)]
        : null,
      wages.spellWageMod !== 1
        ? [state.spellHerosInspiration ? "Hero's Inspiration" : 'Inspire Army', 'x' + wages.spellWageMod.toFixed(2)]
        : null,
      wages.dragonWageMod !== 1
        ? ['Dragon', 'x' + wages.dragonWageMod.toFixed(2)]
        : null,
      ['Modified Wages', fmt(wages.modifiedWages) + 'gc', 'highlight']
    ].filter(Boolean));

    // --- Net Income Card ---
    // Green if positive, red if negative
    const netClass = netIncome >= 0 ? 'positive' : 'negative';
    renderCard('Net Income per Tick', [
      ['Income', fmt(income.modifiedIncome) + 'gc'],
      ['Wages', '-' + fmt(wages.modifiedWages) + 'gc'],
      ['Net', fmt(netIncome) + 'gc', netClass]
    ]);

    // --- Food Production Card ---
    const food = Engine.calcFood(state);
    const netFoodClass = food.netFood >= 0 ? 'positive' : 'negative';
    renderCard('Food per Tick', [
      ['Farm production', `${fmt(state.buildings.farms || 0)} farms (built+WIP) x 60 x ${fmtPct(food.beResult.be * 100)} BE = ${fmt(food.farmFood)} bushels`],
      food.barrenFood > 0
        ? ['Barren land', `${fmt(state.buildings.barrenLand || 0)} x 2 = ${fmt(food.barrenFood)} bushels`]
        : null,
      food.acreFood > 0
        ? ['Race/Pers per acre', `${fmt(food.acreFood)} bushels`]
        : null,
      ['Base Production', fmt(food.baseFoodProduction) + ' bushels', 'highlight'],
      ['Production Science', 'x' + food.prodSci.toFixed(3)],
      food.fertileMod !== 1
        ? ['Fertile Lands', 'x' + food.fertileMod.toFixed(2)]
        : null,
      food.honorFoodMod !== 1
        ? ['Honor (' + (state.honor ? state.honor.titleName : 'Peasant') + ')', 'x' + food.honorFoodMod.toFixed(3)]
        : null,
      ['Modified Production', fmt(food.modifiedFoodProduction) + ' bushels', 'highlight'],
      ['Consumed', `${fmt(food.totalPop)} pop x 0.25${food.raceFoodMod !== 1 ? ' x ' + food.raceFoodMod.toFixed(2) : ''} = -${fmt(food.foodConsumed)} bushels`],
      state.food > 0
        ? ['Decay (1%)', `-${fmt(food.foodDecay)} bushels`]
        : null,
      ['Net Food', fmt(food.netFood) + ' bushels', netFoodClass]
    ].filter(Boolean));

    // --- Rune Production Card ---
    const runes = Engine.calcRunes(state);
    const netRuneClass = runes.netRunes >= 0 ? 'positive' : 'negative';
    renderCard('Runes per Tick', [
      ['Tower production', `${fmt(state.buildings.towers || 0)} towers (built+WIP) x 12 x ${fmtPct(food.beResult.be * 100)} BE = ${fmt(runes.towerRunes)} runes`],
      ['Production Science', 'x' + runes.prodSci.toFixed(3)],
      runes.honorRuneMod !== 1
        ? ['Honor (' + (state.honor ? state.honor.titleName : 'Peasant') + ')', 'x' + runes.honorRuneMod.toFixed(3)]
        : null,
      ['Modified Production', fmt(runes.modifiedRuneProduction) + ' runes', 'highlight'],
      state.runes > 0
        ? ['Decay (1.2%)', `-${fmt(runes.runeDecay)} runes`]
        : null,
      ['Net Runes', fmt(runes.netRunes) + ' runes', netRuneClass]
    ].filter(Boolean));

    // --- Population Growth Card ---
    const pop = Engine.calcPopGrowth(state);
    const popClass = pop.netPeasantChange >= 0 ? 'positive' : 'negative';
    const popTitle = state.eowcfActive
      ? `Population Growth (CF tick ${pop.ticksElapsed + 1})`
      : 'Population Growth';
    renderCard(popTitle, [
      ['Max Population', fmt(pop.maxPop)],
      ['Current Population', fmt(pop.currentPop)],
      ['Room for Growth', fmt(pop.roomForGrowth)],
      ['Base Birth Rate*', fmtPct(pop.baseBirthRate * 100)],
      pop.raceBirthMod !== 1
        ? [`Race (${state.race.name})`, 'x' + pop.raceBirthMod.toFixed(2)]
        : null,
      pop.hospitalMod !== 1
        ? ['Hospitals', 'x' + pop.hospitalMod.toFixed(3) + ` (+${fmtPct(pop.hospitalBirthBonus)})`]
        : null,
      pop.eowcfBoostActive
        ? ['EOWCF Boost', `x${pop.eowcfMod} (${pop.eowcfBoostTicksLeft} ticks left)`]
        : (state.eowcfActive ? ['EOWCF Boost', 'Expired'] : null),
      pop.chastityMod !== 1
        ? ['Chastity', 'x' + pop.chastityMod.toFixed(2)]
        : null,
      pop.loveAndPeaceBonus > 0
        ? ['Love and Peace', '+' + fmtPct(pop.loveAndPeaceBonus * 100) + ' birth rate']
        : null,
      pop.dragonBirthMod !== 1
        ? ['Dragon', 'x' + pop.dragonBirthMod.toFixed(2)]
        : null,
      pop.ritualBirthMod !== 1
        ? [`${GAME_DATA.rituals[state.ritual]?.name || state.ritual} Ritual`, 'x' + pop.ritualBirthMod.toFixed(3)]
        : null,
      ['Effective Birth Rate*', fmtPct(pop.effectiveBirthRate * 100)],
      ['Peasants Born (birth)*', '+' + fmt(pop.peasantsBorn)],
      pop.homesBorn > 0
        ? ['Peasants Born (homes)', `+${fmt(pop.homesBorn)} (${fmt(state.buildings.homes || 0)} homes x 0.3)`]
        : null,
      pop.eowcfBoostActive && (pop.peasantsBorn + pop.homesBorn) < pop.eowcfMin
        ? ['EOWCF Minimum', fmt(pop.eowcfMin)]
        : null,
      pop.overpop
        ? ['Peasant Desertion (10%)', '-' + fmt(pop.peasantDesertion), 'negative']
        : null,
      ['Net Peasant Change*', (pop.netPeasantChange >= 0 ? '+' : '') + fmt(pop.netPeasantChange) + '/tick', popClass]
    ].filter(Boolean), '* Birth rate varies ±5% per tick (range 1.95%–2.15%). Expect small differences vs game values.');

    // --- Buildings Card ---
    renderCard('Buildings', [
      ['Construction Time', buildTime.constructionTime + ' ticks'],
      buildTime.raceMod !== 1
        ? [`Race (${state.race.name})`, 'x' + buildTime.raceMod.toFixed(2)]
        : null,
      buildTime.persMod !== 1
        ? [`Personality (${state.personality.name})`, 'x' + buildTime.persMod.toFixed(2)]
        : null,
      buildTime.buildersBoon !== 1
        ? ["Builder's Boon", 'x0.75']
        : null,
      buildTime.ritualMod !== 1
        ? ['Ritual', 'x' + buildTime.ritualMod.toFixed(3)]
        : null,
      buildTime.artisanSci !== 1
        ? ['Artisan Science', 'x' + buildTime.artisanSci.toFixed(3)]
        : null,
      buildTime.dragonMod !== 1
        ? ['Dragon', 'x' + buildTime.dragonMod.toFixed(2)]
        : null,
      ['Construction Cost', fmt(buildCost.constructionCost) + ' gc/acre'],
      buildCost.millsPct > 0
        ? ['Mills reduction', '-' + fmtPct(buildCost.millsPct)]
        : null,
      buildCost.ritualMod !== 1
        ? ['Ritual (cost)', 'x' + buildCost.ritualMod.toFixed(3)]
        : null,
      ['Raze Cost', fmt(razeCost.razeCost) + ' gc/acre']
    ].filter(Boolean));

    // Store last debug snapshot
    const scraped = window._scrapedGameData || null;
    window._debugData = {
      scraped: scraped,
      state: {
        race: state.race.name,
        personality: state.personality.name,
        acres: state.acres,
        buildings: state.buildings,
        inConstruction: window._inConstruction || {},
        inTraining: state.inTraining || {},
        peasants: state.peasants, soldiers: state.soldiers,
        offSpecs: state.offSpecs, defSpecs: state.defSpecs,
        elites: state.elites, thieves: state.thieves,
        wizards: state.wizards, prisoners: state.prisoners,
        gold: state.gold, food: state.food, runes: state.runes,
        sciAlchemy: state.sciAlchemy, sciTools: state.sciTools,
        sciProduction: state.sciProduction, sciHousing: state.sciHousing,
        sciBookkeeping: state.sciBookkeeping, sciHeroism: state.sciHeroism,
        sciValor: state.sciValor, sciArtisan: state.sciArtisan,
        spellFertileLands: state.spellFertileLands, spellMinersM: state.spellMinersM,
        spellChastity: state.spellChastity, spellBuildBoon: state.spellBuildBoon,
        spellLoveAndPeace: state.spellLoveAndPeace, spellInspireArmy: state.spellInspireArmy,
        spellHerosInspiration: state.spellHerosInspiration, spellGhostWorkers: state.spellGhostWorkers,
        spellDrought: state.spellDrought, spellGluttony: state.spellGluttony,
        spellGreed: state.spellGreed, spellBlizzard: state.spellBlizzard,
        spellRiots: state.spellRiots, spellConstructionDelays: state.spellConstructionDelays,
        ritual: state.ritual, ritualEffectiveness: state.ritualEffectiveness,
        dragon: state.dragon, wageRate: state.wageRate,
        honor: state.honor,
        raceMods: state.race.mods,
        persMods: state.personality.mods
      },
      calculated: { income, wages, food, runes, netIncome, pop, buildTime, buildCost, razeCost },
      comparisons: buildComparisons(scraped, income, wages, food, runes, pop, buildTime, buildCost, razeCost)
    };

  }

  // ---------------------------------------------------------------------------
  // RENDER HELPERS
  // ---------------------------------------------------------------------------

  /**
   * Render a result card with a title and rows of [label, value, cssClass?]
   * cssClass can be: 'highlight' (bold separator), 'positive' (green),
   * 'negative' (red)
   */
  function renderCard(title, rows, note) {
    const card = document.createElement('div');
    card.className = 'result-card';
    let html = `<h3>${title}</h3><table>`;
    for (const row of rows) {
      const cls = row[2] ? ` class="${row[2]}"` : '';
      html += `<tr${cls}><td>${row[0]}</td><td>${row[1]}</td></tr>`;
    }
    html += '</table>';
    if (note) html += `<div class="card-note">${note}</div>`;
    card.innerHTML = html;
    outputDiv.appendChild(card);
  }


  // ---------------------------------------------------------------------------
  // IMPORT FROM GAME DATA
  // ---------------------------------------------------------------------------
  // Loads scraped data from chrome.storage.local and fills input fields.
  // Each page's scraper contributes different fields; missing fields are
  // left unchanged so partial imports work.
  // ---------------------------------------------------------------------------
  function importGameData() {
    // Try direct storage first, then fall back to messaging the service worker
    function onGameData(d) {
      if (!d) {
        alert('No game data found. Visit your Throne pages in the game first.');
        return;
      }

      // Helper: set value if data exists
      const fill = (id, val) => {
        if (val !== undefined && val !== null) {
          const el = document.getElementById(id);
          if (el) el.value = val;
        }
      };

      // State page data
      fill('acres', d.acres);
      fill('gold', d.gold);
      fill('food', d.food);
      fill('runes', d.runes);
      fill('peasants', d.peasants);
      fill('thieves', d.thieves);
      fill('wizards', d.wizards);

      // Honor value (numeric)
      if (d.honor != null) {
        fill('honor', d.honor);
      }

      // Unit counts from throne page (totals including out-on-attack troops)
      fill('soldiers', d.soldiers);
      fill('offSpecs', d.offSpecs);
      fill('defSpecs', d.defSpecs);
      fill('elites', d.elites);
      fill('prisoners', d.prisoners);
      fill('wageRate', d.wageRate);

      // Buildings page data
      if (d.buildings) {
        for (const [key, count] of Object.entries(d.buildings)) {
          fill('bld_' + key, count);
        }
      }

      // In-construction data — store globally for engine use
      window._inConstruction = d.inConstruction || {};

      // In-training data — store globally for engine use (food & wages)
      window._inTraining = d.inTraining || {};
      updateConstructionLabels();

      // Exploration data — acres in exploration (barren land in schedule)
      const exploEl = document.getElementById('bldExploration');
      if (exploEl) {
        const count = d.inExploration || 0;
        exploEl.textContent = count > 0 ? `[${count} in exploration]` : '';
      }

      // Building effects — store globally and display as hints
      window._buildingEffects = d.buildingEffects || {};
      updateBuildingEffectLabels();

      // Science page data
      if (d.sciences) {
        const sciFieldMap = {
          alchemy: 'sciAlchemy', tools: 'sciTools', housing: 'sciHousing',
          production: 'sciProduction', bookkeeping: 'sciBookkeeping',
          heroism: 'sciHeroism', valor: 'sciValor', artisan: 'sciArtisan'
        };
        for (const [key, pct] of Object.entries(d.sciences)) {
          const fieldId = sciFieldMap[key];
          if (fieldId) fill(fieldId, pct);
        }
      }

      // Race/Personality (from Throne page)
      if (d.race) {
        const raceEl = document.getElementById('race');
        if (raceEl) {
          raceEl.value = d.race;
          updateRaceLabels();
        }
      }
      if (d.personality) {
        const persEl = document.getElementById('personality');
        if (persEl) {
          persEl.value = d.personality;
        }
      }

      // Active spells — scraped from throne page "Duration:" section
      const activeSpells = d.activeSpells || {};

      // Render spell checkboxes showing all spells (self + offensive)
      renderSpellCheckboxes(activeSpells);

      // Active ritual
      if (d.ritual) {
        const ritualEl = document.getElementById('ritual');
        if (ritualEl) ritualEl.value = d.ritual;
      }
      fill('ritualEffectiveness', d.ritualEffectiveness);

      // Store current Utopian date for engine calculations
      if (d.utopianDate) {
        window._utopianDate = d.utopianDate;
      }

      // Auto-calculate EOWCF remaining duration from scraped dates
      if (d.utopianDate && d.eowcfEndDate) {
        const current = Scrapers.parseUtopianDate(d.utopianDate);
        const end = Scrapers.parseUtopianDate(d.eowcfEndDate);
        if (current && end) {
          const ticksLeft = Scrapers.utopianDateToTicks(end) - Scrapers.utopianDateToTicks(current);
          const cfActive = ticksLeft > 0;
          fill('eowcfDuration', cfActive ? ticksLeft : 0);
          eowcfCheckbox.checked = cfActive;
          toggleEowcfFields();
          saveEowcfState();
        }
      }

      // Display current date and CF end date
      const dateInfo = document.getElementById('eowcfDateInfo');
      if (dateInfo && d.utopianDate) {
        const parts = ['Now: ' + d.utopianDate];
        if (d.eowcfEndDate) parts.push('CF ends: ' + d.eowcfEndDate);
        dateInfo.textContent = parts.join(' | ');
      }

      // War Doctrines
      const doctrinesDiv = document.getElementById('warDoctrines');
      if (doctrinesDiv && d.warDoctrines && d.warDoctrines.length > 0) {
        doctrinesDiv.innerHTML = d.warDoctrines
          .map(wd => `<span>${wd.effect} <strong>${wd.bonus}</strong></span>`)
          .join(' ');
      }

      // Store raw scraped data for debug JSON
      window._scrapedGameData = d;

      showDataAge(d);

      recalculate();
    }

    // Try direct storage access first (works in Chrome), then messaging (for Opera)
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get('gameData', (result) => onGameData(result.gameData));
    } else if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage({ type: 'getGameData' }, (d) => {
        if (chrome.runtime.lastError) {
          alert('Failed to read game data: ' + chrome.runtime.lastError.message);
          return;
        }
        onGameData(d);
      });
    } else {
      alert('Extension API not available.\n\nOpen this page through the extension popup.');
    }
  }

  // ---------------------------------------------------------------------------
  // DATA AGE DISPLAY
  // ---------------------------------------------------------------------------
  function showDataAge(d) {
    const importStatus = document.getElementById('importStatus');
    if (!importStatus) return;
    if (d && d._pageTimestamps) {
      const pageLabels = {
        throne: 'Throne', state: 'State', military: 'Military',
        buildings: 'Buildings', science: 'Science',
        trainArmy: 'Train', kingdomDetails: 'Kingdom'
      };
      const now = Date.now();
      const parts = [];
      for (const [page, ts] of Object.entries(d._pageTimestamps)) {
        const mins = Math.round((now - ts) / 60000);
        const label = pageLabels[page] || page;
        let ageText;
        if (mins < 1) ageText = 'now';
        else if (mins < 60) ageText = mins + 'm';
        else if (mins < 1440) ageText = Math.round(mins / 60) + 'h';
        else ageText = Math.round(mins / 1440) + 'd';
        parts.push(`${label}: ${ageText}`);
      }
      importStatus.innerHTML = parts.map(p => `<span class="page-age">${p}</span>`).join('');
    } else {
      importStatus.textContent = d ? 'No page timestamps' : 'No data yet';
    }
  }

  // Add import button to the top of the input panel
  const importBar = document.createElement('div');
  importBar.className = 'import-bar';
  importBar.innerHTML = `
    <button id="importBtn" type="button">Import from Game</button>
    <button id="debugBtn" type="button" style="font-size:10px;padding:2px 6px;opacity:0.6;">Debug JSON</button>
    <span id="importStatus"></span>
  `;
  inputPanel.insertBefore(importBar, inputPanel.firstChild);
  document.getElementById('importBtn').addEventListener('click', importGameData);
  document.getElementById('debugBtn').addEventListener('click', () => {
    const json = JSON.stringify(window._debugData || {}, null, 2);
    // Build filename: province_race_YYYYMMDD_HHMM.json
    const d = window._debugData || {};
    const name = (d.scraped && d.scraped.provinceName) || 'unknown';
    const race = (d.state && d.state.race) || '';
    const now = new Date();
    const ts = now.getFullYear()
      + String(now.getMonth() + 1).padStart(2, '0')
      + String(now.getDate()).padStart(2, '0')
      + '_' + String(now.getHours()).padStart(2, '0')
      + String(now.getMinutes()).padStart(2, '0');
    const safeName = name.replace(/[^a-zA-Z0-9]/g, '_');
    const filename = `debug_${safeName}_${race}_${ts}.json`;
    // Download as file
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    // Also copy to clipboard
    navigator.clipboard.writeText(json).catch(() => {});
  });

  // Auto-import game data on load
  importGameData();

  // ---------------------------------------------------------------------------
  // INITIAL CALCULATION
  // ---------------------------------------------------------------------------
  // Run once on page load so the output panel isn't empty
  // ---------------------------------------------------------------------------
  recalculate();
})();
