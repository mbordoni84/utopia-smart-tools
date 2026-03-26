// =============================================================================
// Core State Builder
// =============================================================================
// Builds Engine-compatible state objects from scraped game data or DOM inputs.
// Eliminates duplicated state construction across views.
// =============================================================================

const StateBuilder = {

  /**
   * Build a full Engine state from scraped gameData (chrome.storage).
   * Missing fields get safe defaults. Caller can override specific fields.
   *
   * @param {Object} d - Scraped gameData object from chrome.storage
   * @param {Object} [overrides] - Optional field overrides
   * @returns {Object} Engine-compatible state
   */
  fromScrapedData(d, overrides = {}) {
    if (!d) d = {};

    const raceKey = d.race || 'human';
    const persKey = d.personality || 'generalIn';
    const race = GAME_DATA.races[raceKey] || GAME_DATA.races.human;
    const personality = GAME_DATA.personalities[persKey] || GAME_DATA.personalities.generalIn;

    // Build buildings object from scraped data.
    // Scraped Quantity from council_internal is already the completed count (excludes WIP).
    const bld = d.buildings || {};
    const buildings = {};
    for (const key of Object.keys(GAME_DATA.buildings)) {
      buildings[key] = bld[key] || 0;
    }

    // Calculate buildings in progress: sum all values in inConstruction
    const inConstr = d.inConstruction || {};
    let wipCount = 0;
    for (const count of Object.values(inConstr)) {
      wipCount += count || 0;
    }
    buildings.buildingsInProgress = wipCount;

    const sci = d.sciences || {};
    const as = d.activeSpells || {};

    const state = {
      race,
      personality,
      acres:       d.acres || 0,
      peasants:    d.peasants || 0,
      soldiers:    d.soldiers || 0,
      offSpecs:    d.offSpecs || 0,
      defSpecs:    d.defSpecs || 0,
      elites:      d.elites || 0,
      thieves:     d.thieves || 0,
      wizards:     d.wizards || 0,
      prisoners:   d.prisoners || 0,
      horses:      d.warHorses || 0,

      gold:  d.gold || 0,
      food:  d.food || 0,
      runes: d.runes || 0,
      books: d.books || 0,

      buildings,
      inConstruction: d.inConstruction || {},
      inTraining:     d.inTraining || {},

      // Sciences (normalize to positive values)
      sciAlchemy:     Math.abs(sci.alchemy || 0),
      sciTools:       Math.abs(sci.tools || 0),
      sciProduction:  Math.abs(sci.production || 0),
      sciHousing:     Math.abs(sci.housing || 0),
      sciBookkeeping: Math.abs(sci.bookkeeping || 0),
      sciStrategy:    Math.abs(sci.strategy || 0),
      sciTactics:     Math.abs(sci.tactics || 0),
      sciHeroism:     Math.abs(sci.heroism || 0),
      sciValor:       Math.abs(sci.valor || 0),
      sciArtisan:     Math.abs(sci.artisan || 0),

      // Spells (self)
      spellBuildBoon:           !!as.BUILDERS_BOON,
      spellInspireArmy:         !!as.INSPIRE_ARMY,
      spellHerosInspiration:    !!as.HEROS_INSPIRATION,
      spellMinersM:             !!as.MINERS_MYSTIQUE,
      spellGhostWorkers:        !!as.GHOST_WORKERS,
      spellChastity:            !!as.CHASTITY,
      spellFertileLands:        !!as.FERTILE_LANDS,
      spellLoveAndPeace:        !!as.LOVE_AND_PEACE,
      spellPatriotism:          !!as.PATRIOTISM,
      spellFanaticism:          !!as.FANATICISM,
      spellBloodlust:           !!as.BLOODLUST,
      spellMinorProtection:     !!as.MINOR_PROTECTION,
      spellGreaterProtection:   !!as.GREATER_PROTECTION,
      // Spells (offensive/bad)
      spellBlizzard:            !!as.BLIZZARD,
      spellConstructionDelays:  !!as.CONSTRUCTION_DELAYS,
      spellGreed:               !!as.GREED,
      spellRiots:               !!as.RIOTS,
      spellDrought:             !!as.DROUGHT,
      spellGluttony:            !!as.GLUTTONY,
      spellPlague:              !!as.PLAGUE,

      ritual:              d.ritual || 'none',
      ritualEffectiveness: (d.ritualEffectiveness || 100) / 100,
      dragon:              d.dragon || 'none',
      wageRate:            d.wageRate || 100,
      baseMilitaryEfficiency: d.baseMilitaryEfficiency || null,
      multiAttackProtection: d.multiAttackProtection || 'not hit',

      eowcfActive:       d.eowcfActive || false,
      eowcfTicksElapsed: d.eowcfTicksElapsed || 0,
      doubleSpeed:       false,
    };

    // Derive honor from numeric value
    state.honor = Engine.getHonorMods(
      d.honor || 0, state.race, state.personality
    );

    // Apply overrides
    Object.assign(state, overrides);

    return state;
  },

  /**
   * Build a state object from DOM form inputs.
   * Used by views that have their own input forms (e.g. EOWCF planner).
   *
   * @param {Object} fieldMap - Maps state keys to DOM element IDs
   *   e.g. { acres: 'acres', gold: 'gold', ... }
   * @param {Object} [base] - Optional base state to extend
   * @returns {Object} Engine-compatible state
   */
  fromDOM(fieldMap, base = {}) {
    const state = Object.assign({}, base);

    for (const [stateKey, elementId] of Object.entries(fieldMap)) {
      const el = document.getElementById(elementId);
      if (!el) continue;

      if (el.type === 'checkbox') {
        state[stateKey] = el.checked;
      } else if (el.type === 'number' || el.type === 'range') {
        state[stateKey] = parseFloat(el.value) || 0;
      } else if (el.tagName === 'SELECT') {
        state[stateKey] = el.value;
      } else {
        state[stateKey] = el.value;
      }
    }

    return state;
  },
};
