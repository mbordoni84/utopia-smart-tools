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

  // Honor Title dropdown — from GAME_DATA.honorTitles
  const honorSelect = document.getElementById('honorTitle');
  GAME_DATA.honorTitles.forEach((title, idx) => {
    const opt = document.createElement('option');
    opt.value = String(idx);
    opt.textContent = `${title.name} (${title.minHonor}+)`;
    honorSelect.appendChild(opt);
  });

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
   * Render spell checkboxes. If fadingSpells were scraped from the enchantment
   * page, only those are shown. Otherwise falls back to all engine-relevant
   * spells from SPELL_DATA plus all offensive spells.
   *
   * @param {Array} fadingSpells - [{key, name}] from scraper (optional)
   * @param {Object} activeSpells - {SPELL_KEY: {remaining}} or {SPELL_KEY: true}
   */
  function renderSpellCheckboxes(fadingSpells, activeSpells) {
    spellsGrid.innerHTML = '';
    activeSpells = activeSpells || {};

    let spellList;
    if (fadingSpells && fadingSpells.length > 0) {
      // Use scraped list — only spells available to this race/personality
      spellList = fadingSpells.map(s => ({
        key: s.key,
        name: s.name,
        type: (typeof SPELL_DATA !== 'undefined' && SPELL_DATA[s.key]) ? SPELL_DATA[s.key].type : 'self'
      }));
      spellsHint.style.display = 'none';
    } else {
      // Fallback: show all engine-relevant spells + all offensive spells
      spellList = [];
      if (typeof SPELL_DATA !== 'undefined') {
        for (const [key, spell] of Object.entries(SPELL_DATA)) {
          const hasEngineEffect = spell.engineEffects && Object.keys(spell.engineEffects).length > 0;
          if (hasEngineEffect || spell.type === 'offensive') {
            spellList.push({ key, name: spell.name, type: spell.type });
          }
        }
      }
      spellsHint.style.display = '';
    }

    // Group: self spells first, then offensive
    const selfSpells = spellList.filter(s => s.type === 'self');
    const offensiveSpells = spellList.filter(s => s.type === 'offensive');

    function addSpellCheckbox(spell) {
      const div = document.createElement('div');
      div.className = 'form-group checkbox-group';
      const isActive = activeSpells[spell.key];
      const remaining = isActive && typeof isActive === 'object' ? isActive.remaining : 0;
      const durationText = remaining > 0 ? ` (${remaining} ticks)` : '';
      const typeLabel = spell.type === 'offensive' ? ' <span class="spell-offensive">[enemy]</span>' : '';
      div.innerHTML = `<label><input type="checkbox" id="spell_${spell.key}"${isActive ? ' checked' : ''}> ${spell.name}${typeLabel}${durationText}</label>`;
      spellsGrid.appendChild(div);
    }

    for (const s of selfSpells) addSpellCheckbox(s);
    if (offensiveSpells.length > 0) {
      for (const s of offensiveSpells) addSpellCheckbox(s);
    }
  }

  // Initial render — fallback mode (no scraped data yet)
  renderSpellCheckboxes(null, null);

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
  // FORMATTING HELPERS
  // ---------------------------------------------------------------------------

  /** Format number with locale-aware thousands separators, rounded to integer */
  function fmt(n) {
    return Math.round(n).toLocaleString();
  }

  /** Format as percentage with 1 decimal place (e.g. "85.3%") */
  function fmtPct(n) {
    return n.toFixed(1) + '%';
  }

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
  // MAIN RECALCULATE FUNCTION
  // ---------------------------------------------------------------------------
  // Called on every input change. Gathers state, runs engine calculations,
  // and renders all result cards.
  // ---------------------------------------------------------------------------
  function recalculate() {
    const state = Engine.gatherState();
    renderHonorSummary(state.honor);
    renderModSummary('raceSummary', state.race);
    renderModSummary('personalitySummary', state.personality);
    renderRitualSummary(state.ritual, state.ritualEffectiveness);
    renderDragonSummary(state.dragon);
    updateBuildingPcts();
    const income = Engine.calcIncome(state);
    const wages = Engine.calcWages(state);
    const netIncome = income.modifiedIncome - wages.modifiedWages;

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
      ['BE', fmtPct(income.beResult.be * 100), 'highlight']
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

    // Store last debug snapshot
    window._debugData = {
      state: {
        race: state.race.name,
        personality: state.personality.name,
        acres: state.acres,
        buildings: state.buildings,
        inConstruction: window._inConstruction || {},
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
        ritual: state.ritual, ritualEffectiveness: state.ritualEffectiveness,
        dragon: state.dragon, wageRate: state.wageRate,
        honor: state.honor,
        raceMods: state.race.mods,
        persMods: state.personality.mods
      },
      income, wages, food, runes, netIncome, pop
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

      // Honor title — match by name to dropdown index
      if (d.honorTitle) {
        const idx = GAME_DATA.honorTitles.findIndex(t => t.name === d.honorTitle);
        if (idx >= 0) {
          document.getElementById('honorTitle').value = String(idx);
        }
      }

      // Military page data (soldiers, offSpecs, defSpecs, elites, wage rate)
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

      // Active spells — merge data from throne + enchantment scrapers
      // Build a combined activeSpells map from all sources
      const activeSpells = {};

      // From enchantment page scraper (has remaining ticks)
      if (d.activeSpells) {
        for (const [key, info] of Object.entries(d.activeSpells)) {
          activeSpells[key] = info;
        }
      }

      // From throne page scraper (boolean detection, no remaining info)
      if (d.activeSpellsFromThrone) {
        for (const [key, val] of Object.entries(d.activeSpellsFromThrone)) {
          if (val && !activeSpells[key]) activeSpells[key] = true;
        }
      }

      // Legacy spell fields from old throne scraper
      const legacyMap = {
        spellChastity: 'CHASTITY', spellFertileLands: 'FERTILE_LANDS',
        spellMinersM: 'MINERS_MYSTIQUE', spellBuildBoon: 'BUILDERS_BOON'
      };
      for (const [oldKey, newKey] of Object.entries(legacyMap)) {
        if (d[oldKey] && !activeSpells[newKey]) activeSpells[newKey] = true;
      }

      // Render spell checkboxes with scraped fading spells list
      renderSpellCheckboxes(d.fadingSpells || null, activeSpells);

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
          fill('eowcfDuration', ticksLeft > 0 ? ticksLeft : 0);
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
        buildings: 'Buildings', science: 'Science', ritual: 'Ritual',
        trainArmy: 'Train', enchantment: 'Enchantment'
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
    // Download as file
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'eowcf_debug.json';
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
