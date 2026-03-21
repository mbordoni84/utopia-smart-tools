// =============================================================================
// CF Pumping Planner
// =============================================================================
// Retroplans the optimal sequence of actions (build armouries → draft →
// train specs/elites → raise wages) to peak military strength at CF exit.
//
// Requires: GAME_DATA, Engine, Utils, StateBuilder (core/), Scrapers
// =============================================================================

(function () {

  // ── Spec base training cost (gc each) — standard across all races/ages ──
  const SPEC_COST = 75;

  // ── Draft rates by key ──
  const DRAFT_RATES = { none: 0, normal: 0.005, aggressive: 0.015, emergency: 0.02, war: 0.025 };

  // ── Real minutes per tick (1 tick = 1 UT day = 60 real minutes) ──
  const MINS_PER_TICK = 60;

  // ── Plan state (recalculated on every input change) ──
  let _plan = null;

  // ── Full buildings from last import (for accurate maxPop) ──
  let _importedBuildings = null;
  let _importedInConstruction = {};
  // ── Full engine base state (for accurate per-tick income/wages) ──
  let _engineBaseState = null;

  // ===========================================================================
  // POPULATE DROPDOWNS
  // ===========================================================================
  function populateDropdowns() {
    const raceSelect = document.getElementById('race');
    const persSelect = document.getElementById('personality');

    for (const [key, race] of Object.entries(GAME_DATA.races)) {
      const opt = document.createElement('option');
      opt.value = key;
      opt.textContent = race.name;
      raceSelect.appendChild(opt);
    }

    for (const [key, pers] of Object.entries(GAME_DATA.personalities)) {
      const opt = document.createElement('option');
      opt.value = key;
      opt.textContent = pers.name;
      persSelect.appendChild(opt);
    }
  }

  // ===========================================================================
  // IMPORT FROM GAME
  // ===========================================================================
  document.getElementById('importBtn').addEventListener('click', importGameData);
  document.getElementById('recalcBtn').addEventListener('click', recalc);

  function importGameData() {
    function onGameData(d) {
      if (!d) {
        document.getElementById('importStatus').textContent = 'No game data. Visit game pages first.';
        return;
      }

      const fill = (id, val) => {
        const el = document.getElementById(id);
        if (el && val !== undefined && val !== null) el.value = val;
      };

      // Race & personality
      fill('race', d.race || 'human');
      fill('personality', d.personality || 'generalIn');

      // Dates from scraped data
      if (d.utopianDate) fill('currentDate', d.utopianDate);
      if (d.eowcfEndDate) fill('cfEndDate', d.eowcfEndDate);

      // Economy
      fill('gold', d.gold || 0);
      fill('wageRate', d.wageRate || 100);
      fill('acres', d.acres || 0);
      fill('peasants', d.peasants || 0);

      // Military (use throne totals as authoritative)
      fill('soldiers', d.soldiers || 0);
      fill('offSpecs', d.offSpecs || 0);
      fill('defSpecs', d.defSpecs || 0);
      fill('elites', d.elites || 0);
      fill('thieves', d.thieves || 0);

      // Buildings — use raw scraped Quantity column as-is.
      // Game uses this for everything: jobs, effects, max pop, birth rate.
      const bld = d.buildings || {};
      const bldMap = {
        homes:'bldHomes', farms:'bldFarms', mills:'bldMills', banks:'bldBanks',
        armouries:'bldArmouries', trainingGrounds:'bldTrainingGrounds',
        barracks:'bldBarracks', forts:'bldForts', castles:'bldCastles',
        hospitals:'bldHospitals', guilds:'bldGuilds', towers:'bldTowers',
        thievesDens:'bldThievesDens', watchTowers:'bldWatchTowers',
        universities:'bldUniversities', libraries:'bldLibraries',
        stables:'bldStables', dungeons:'bldDungeons'
      };
      for (const [key, id] of Object.entries(bldMap)) fill(id, bld[key] || 0);

      // Save buildings for accurate maxPop in draft calculation
      _importedBuildings = Object.fromEntries(
        Object.keys(GAME_DATA.buildings).map(k => [k, bld[k] || 0])
      );
      _importedInConstruction = d.inConstruction || {};

      // Sciences
      const sci = d.sciences || {};
      fill('sciArtisan', Math.abs(sci.artisan || 0));
      fill('sciValor', Math.abs(sci.valor || 0));
      fill('sciHeroism', Math.abs(sci.heroism || 0));

      // Ritual
      fill('ritual', d.ritual || 'none');
      fill('ritualEff', d.ritualEffectiveness || 100);

      // Active spells → checkboxes
      const as = d.activeSpells || {};
      document.getElementById('spellBB').checked  = !!as.BUILDERS_BOON;
      document.getElementById('spellPAT').checked = !!as.PATRIOTISM;
      document.getElementById('spellIA').checked  = !!as.INSPIRE_ARMY;
      document.getElementById('spellHI').checked  = !!as.HEROS_INSPIRATION;

      // Compute net income/tick from Engine (income - wages)
      try {
        const engineState = StateBuilder.fromScrapedData(d);
        const incomeResult = Engine.calcIncome(engineState);
        fill('income', Math.round(incomeResult.modifiedIncome));
        _engineBaseState = engineState;
      } catch (e) {
        // If engine calc fails, leave income for manual entry
        console.warn('CF Pumping: income calc failed', e);
      }

      document.getElementById('importStatus').textContent =
        `Imported: ${d.provinceName || 'Unknown'} (${(GAME_DATA.races[d.race] || {}).name || d.race})`;

      recalc();
    }

    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get('gameData', (result) => onGameData(result.gameData));
    } else if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage({ type: 'getGameData' }, (d) => {
        if (chrome.runtime.lastError) {
          document.getElementById('importStatus').textContent = 'Error: ' + chrome.runtime.lastError.message;
          return;
        }
        onGameData(d);
      });
    } else {
      document.getElementById('importStatus').textContent = 'Open via extension popup.';
    }
  }

  // ===========================================================================
  // READ STATE FROM DOM
  // ===========================================================================
  function buildState() {
    const g = (id) => document.getElementById(id);
    const num = (id, def = 0) => parseFloat(g(id).value) || def;
    const chk = (id) => g(id).checked;

    const raceKey = g('race').value || 'human';
    const persKey = g('personality').value || 'generalIn';
    const race = GAME_DATA.races[raceKey] || GAME_DATA.races.human;
    const personality = GAME_DATA.personalities[persKey] || GAME_DATA.personalities.generalIn;

    const ritual = g('ritual').value || 'none';
    const ritualData = GAME_DATA.rituals[ritual] || null;
    const ritualEff = num('ritualEff', 100) / 100;

    const acres = num('acres');

    // All current buildings
    const BLD_KEYS = ['homes','farms','mills','banks','armouries','trainingGrounds',
      'barracks','forts','castles','hospitals','guilds','towers','thievesDens',
      'watchTowers','universities','libraries','stables','dungeons'];
    const BLD_IDS  = ['bldHomes','bldFarms','bldMills','bldBanks','bldArmouries',
      'bldTrainingGrounds','bldBarracks','bldForts','bldCastles','bldHospitals',
      'bldGuilds','bldTowers','bldThievesDens','bldWatchTowers','bldUniversities',
      'bldLibraries','bldStables','bldDungeons'];
    const currentBuildings = {};
    BLD_KEYS.forEach((k, i) => { currentBuildings[k] = num(BLD_IDS[i]); });
    // barrenLand is derived
    const totalBuilt = BLD_KEYS.reduce((s, k) => s + (currentBuildings[k] || 0), 0);
    currentBuildings.barrenLand = Math.max(0, acres - totalBuilt);

    const armouries       = currentBuildings.armouries;
    const trainingGrounds = currentBuildings.trainingGrounds;
    const mills           = currentBuildings.mills;

    // Final building config (optional)
    const enableFinalBld = document.getElementById('enableFinalBld').checked;
    const FBD_IDS = ['fbldHomes','fbldFarms','fbldMills','fbldBanks','fbldArmouries',
      'fbldTrainingGrounds','fbldBarracks','fbldForts','fbldCastles','fbldHospitals',
      'fbldGuilds','fbldTowers','fbldThievesDens','fbldWatchTowers','fbldUniversities',
      'fbldLibraries','fbldStables','fbldDungeons'];
    const finalBuildings = {};
    if (enableFinalBld) {
      BLD_KEYS.forEach((k, i) => { finalBuildings[k] = num(FBD_IDS[i]); });
      const totalFinal = BLD_KEYS.reduce((s, k) => s + (finalBuildings[k] || 0), 0);
      finalBuildings.barrenLand = Math.max(0, acres - totalFinal);
    }

    // Compute target armouries count from target %
    const targetArmPct = num('targetArmPct');
    const targetArmCount = Math.ceil((targetArmPct / 100) * acres);
    document.getElementById('targetArmCount').value = targetArmCount;
    const newArmouries = Math.max(0, targetArmCount - armouries);

    // Spells
    const spellBB  = chk('spellBB');
    const spellPAT = chk('spellPAT');
    const spellIA  = chk('spellIA');
    const spellHI  = chk('spellHI');
    const doubleSpeed = chk('optDoubleSpeed');

    // Haste ritual flags
    const isHaste     = ritual === 'haste';
    const isExpedient = ritual === 'expedient';

    return {
      race,
      personality,
      acres,
      armouries,
      trainingGrounds,
      mills,
      targetArmPct,
      targetArmCount,
      newArmouries,

      currentBuildings,
      finalBuildings: enableFinalBld ? finalBuildings : null,
      enableFinalBld,

      gold: num('gold'),
      income: num('income'),         // gross income/tick (from engine, no wages)
      wageRate: num('wageRate', 100),
      savingsWageRate: num('savingsWageRate', 20),
      peasants: num('peasants'),
      soldiers: num('soldiers'),
      offSpecs: num('offSpecs'),
      defSpecs: num('defSpecs'),
      elites: num('elites'),
      thieves: num('thieves'),

      sciArtisan: num('sciArtisan'),
      sciValor: num('sciValor'),
      sciHeroism: num('sciHeroism'),

      ritual,
      ritualData,
      ritualEff,
      isHaste,
      isExpedient,

      spellBB,
      spellPAT,
      spellIA,
      spellHI,
      doubleSpeed,

      tgtElites: num('tgtElites'),
      tgtOffSpecs: num('tgtOffSpecs'),
      tgtDefSpecs: num('tgtDefSpecs'),
      tgtThieves: num('tgtThieves'),

      draftRate: g('draftRate').value,
      milTargetPct: num('milTarget', 85) / 100,

      cfEndDateStr: g('cfEndDate').value.trim(),
      currentDateStr: g('currentDate').value.trim(),
      realTickTimeStr: g('realTickTime').value.trim(),
    };
  }

  // ===========================================================================
  // DATE / TICK UTILITIES
  // ===========================================================================

  // Map abbreviated month names to full names for parseUtopianDate compatibility
  const MONTH_ABBREV = {
    'jan': 'January', 'feb': 'February', 'mar': 'March', 'apr': 'April',
    'may': 'May',     'jun': 'June',     'jul': 'July'
  };

  /**
   * Parse a date string like "April 6, YR6", "Apr 6, YR6", or "April 6 of YR6".
   * Returns a UT date object { month, day, year } or null.
   */
  function parseDate(str) {
    if (!str) return null;
    // Expand abbreviated month names (e.g. "Mar" → "March")
    const expanded = str.replace(/^([A-Za-z]{3,})\b/, (m) => {
      const key = m.slice(0, 3).toLowerCase();
      return MONTH_ABBREV[key] || m;
    });
    const normalized = expanded.replace(/\s+of\s+/i, ', ');
    return Scrapers.parseUtopianDate(normalized);
  }

  /**
   * Convert a UT date to total ticks from YR1 Jan 1.
   */
  function dateToTicks(date) {
    return Scrapers.utopianDateToTicks(date);
  }

  /**
   * Convert absolute ticks back to a UT date string "Month D, YRN".
   */
  const UT_MONTHS = ['January','February','March','April','May','June','July'];
  function ticksToUTStr(ticks) {
    if (ticks < 0) return '—';
    const totalDays = ticks;              // tick 0 = YR1 Jan 1 (day 1)
    const year  = Math.floor(totalDays / (7 * 24)) + 1;
    const rem   = totalDays % (7 * 24);
    const month = Math.floor(rem / 24);
    const day   = (rem % 24) + 1;
    return `${UT_MONTHS[month]} ${day}, YR${year}`;
  }

  /**
   * Given the current tick (absolute) and the real-time string for that tick,
   * compute the real Date for an arbitrary absolute tick offset.
   *
   * Returns a formatted string "YYYY-MM-DD HH:MM" or "—" if no base time.
   */
  function tickToRealTime(absoluteTick, baseAbsTick, baseRealDate) {
    if (!baseRealDate) return '—';
    const deltaTicks = absoluteTick - baseAbsTick;
    const ms = deltaTicks * MINS_PER_TICK * 60 * 1000;
    const d = new Date(baseRealDate.getTime() + ms);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  /**
   * Parse "HH:MM" into { hours, minutes }.
   */
  function parseTime(str) {
    if (!str) return null;
    const m = str.match(/^(\d{1,2}):(\d{2})$/);
    if (!m) return null;
    return { hours: parseInt(m[1]), minutes: parseInt(m[2]) };
  }

  // ===========================================================================
  // INITIALISE
  // ===========================================================================
  populateDropdowns();

  // Wire all inputs to recalc on change
  document.querySelectorAll('input, select').forEach(el => {
    el.addEventListener('change', recalc);
    if (el.tagName === 'INPUT') el.addEventListener('input', recalc);
  });

  // Initial render
  recalc();

// ===========================================================================
// PART 2 — FORMULAS
// ===========================================================================

  // ── Helpers ──────────────────────────────────────────────────────────────

  // Helpers delegated to Engine
  const pctBuildingEffect = Engine.calcPctBuildingEffect.bind(Engine);

  // ── Construction time (ticks) ─────────────────────────────────────────────

  /**
   * Returns the number of ticks a single building takes to construct.
   * Delegates to Engine.calcConstructionTime.
   */
  function calcConstructionTicks(s) {
    const engineState = {
      race: s.race, personality: s.personality,
      acres: s.acres, buildings: s.currentBuildings,
      spellBuildBoon: s.spellBB, doubleSpeed: s.doubleSpeed,
      ritual: s.ritual, ritualEffectiveness: s.ritualEff,
      sciArtisan: s.sciArtisan, dragon: 'none',
      peasants: s.peasants, prisoners: 0, sciTools: 0,
      spellGhostWorkers: false, spellBlizzard: false, spellConstructionDelays: false,
    };
    return Engine.calcConstructionTime(engineState).constructionTime;
  }

  // ── Construction cost (gc per building) ──────────────────────────────────

  /**
   * Returns the gold cost per building to construct.
   * Delegates to Engine.calcConstructionCost.
   */
  function calcConstructionCostPerBldg(s) {
    const engineState = {
      race: s.race, personality: s.personality,
      acres: s.acres, buildings: s.currentBuildings,
      spellBuildBoon: s.spellBB, doubleSpeed: s.doubleSpeed,
      ritual: s.ritual, ritualEffectiveness: s.ritualEff,
      sciArtisan: s.sciArtisan, dragon: 'none',
      peasants: s.peasants, prisoners: 0, sciTools: 0,
      spellGhostWorkers: false, spellBlizzard: false, spellConstructionDelays: false,
    };
    return Engine.calcConstructionCost(engineState).constructionCost;
  }

  // ── Training time (ticks) ────────────────────────────────────────────────

  /**
   * Returns the number of ticks to train a batch of units.
   * Delegates to Engine.calcTrainingTime.
   */
  function calcTrainingTicks(s) {
    const engineState = {
      race: s.race, personality: s.personality,
      acres: s.acres, buildings: s.currentBuildings,
      spellInspireArmy: s.spellIA, spellHerosInspiration: s.spellHI,
      sciValor: s.sciValor,
      ritual: s.ritual, ritualEffectiveness: s.ritualEff,
      dragon: 'none',
      peasants: s.peasants, prisoners: 0, sciTools: 0,
      spellGhostWorkers: false, spellBlizzard: false, spellConstructionDelays: false,
    };
    return Engine.calcTrainingTime(engineState).trainingTime;
  }

  // ── Training cost (gc total for a unit type) ─────────────────────────────

  /**
   * Returns the total gold cost to train `count` units.
   * Delegates to Engine.calcTrainingCost.
   */
  function calcTrainingCost(count, unitBaseCost, s, armouriesCount) {
    return Engine.calcTrainingCost(count, unitBaseCost, s, armouriesCount);
  }

  // ── Draft calculation ────────────────────────────────────────────────────

  /**
   * Builds a minimal engine state for Engine.calcDraft / Engine.calcPopGrowth,
   * overriding soldiers count and armouries count for midpoint/post-build scenarios.
   */
  function toDraftEngineState(s, soldierOverride, armouriesOverride) {
    const bld = Object.assign(
      {},
      _importedBuildings || s.currentBuildings,
      { armouries: armouriesOverride !== undefined ? armouriesOverride : Math.max(s.armouries, s.targetArmCount) }
    );
    return {
      race: s.race,
      personality: s.personality,
      acres: s.acres,
      peasants: s.peasants,
      soldiers: soldierOverride !== undefined ? soldierOverride : s.soldiers,
      offSpecs: s.offSpecs,
      defSpecs: s.defSpecs,
      elites: s.elites,
      thieves: s.thieves,
      wizards: 0,
      prisoners: 0,
      buildings: bld,
      inConstruction: _importedInConstruction,
      inTraining: {},
      sciHeroism: s.sciHeroism,
      sciTools: 0,
      sciHousing: 0,
      sciBookkeeping: 0,
      spellPatriotism: s.spellPAT,
      spellGreed: false,
      spellGhostWorkers: false,
      spellBlizzard: false,
      spellConstructionDelays: false,
      spellChastity: false,
      spellFertileLands: false,
      spellLoveAndPeace: false,
      honor: { pop: 1, ome: 1, income: 1, food: 1, runes: 1, wpa: 1, tpa: 1 },
      ritual: s.ritual,
      ritualEffectiveness: s.ritualEff,
      dragon: 'none',
      wageRate: s.savingsWageRate,
      draftRate: s.draftRate,
      eowcfActive: true,
      eowcfTicksElapsed: 0,
    };
  }

  /**
   * Returns { soldiersNeeded, draftedPerTick, draftTicks, totalDraftCost, maxPop, targetMilPop, costPerSoldier }.
   * Delegates to Engine.calcDraft for full formula consistency (Patriotism, armouries, race/pers mods).
   * Cost is approximated using midpoint military ratio.
   */
  function calcDraftPlan(s) {
    const engState = toDraftEngineState(s);

    const pop = Engine.calcPopGrowth(engState);
    const maxPop = pop.maxPop;
    engState.maxPop = maxPop;

    const currentMilitary = s.soldiers + s.offSpecs + s.defSpecs + s.elites + s.thieves;
    const targetMilPop = Math.floor(maxPop * s.milTargetPct);
    const soldiersNeeded = Math.max(0, targetMilPop - currentMilitary);

    if (soldiersNeeded === 0 || DRAFT_RATES[s.draftRate] === 0) {
      return { soldiersNeeded: 0, draftedPerTick: 0, draftTicks: 0, totalDraftCost: 0, maxPop, targetMilPop, engState };
    }

    // Draft speed: use Engine.calcDraft at current military
    const draftResult = Engine.calcDraft(engState);
    const draftedPerTick = draftResult.drafted;
    const draftTicks = draftedPerTick > 0 ? Math.ceil(soldiersNeeded / draftedPerTick) : 999;

    // Cost approximation: midpoint military ratio
    const midSoldiers = s.soldiers + Math.floor(soldiersNeeded / 2);
    const midState = Object.assign({}, engState, { soldiers: midSoldiers });
    const midResult = Engine.calcDraft(midState);
    const costPerSoldier = midResult.costPerSoldier;
    const totalDraftCost = Math.round(soldiersNeeded * costPerSoldier);

    return { soldiersNeeded, draftedPerTick, draftTicks, totalDraftCost, maxPop, targetMilPop, costPerSoldier, engState };
  }

  // Toggle final building section visibility
  document.getElementById('enableFinalBld').addEventListener('change', function () {
    document.getElementById('finalBldSection').style.display = this.checked ? '' : 'none';
    recalc();
  });

// ===========================================================================
// PART 2b — FINAL BUILD PHASE CALCULATION
// ===========================================================================

  /**
   * Calculates what needs to be built/razed to reach the final building config.
   * Raze is instant (1 tick, costs gold).
   * Build takes constructionTicks (same formula as armouries).
   * Returns { toBuild, toRaze, buildCount, razeCount, buildCost, razeCost,
   *           constructionTicks, totalCost, summary }
   */
  function calcFinalBuildPhase(s) {
    if (!s.finalBuildings) return null;

    const BLD_KEYS = ['homes','farms','mills','banks','armouries','trainingGrounds',
      'barracks','forts','castles','hospitals','guilds','towers','thievesDens',
      'watchTowers','universities','libraries','stables','dungeons'];

    // Use intermediate buildings as the baseline:
    // after the armouries build phase, we have current buildings + new armouries
    const intermediate = Object.assign({}, s.currentBuildings,
      { armouries: Math.max(s.armouries, s.targetArmCount) });

    const toBuild = {};  // key → count to build
    const toRaze  = {};  // key → count to raze

    for (const key of BLD_KEYS) {
      const cur   = intermediate[key] || 0;
      const final = s.finalBuildings[key] || 0;
      const delta = final - cur;
      if (delta > 0) toBuild[key] = delta;
      if (delta < 0) toRaze[key]  = Math.abs(delta);
    }

    const buildCount = Object.values(toBuild).reduce((a, v) => a + v, 0);
    const razeCount  = Object.values(toRaze).reduce((a, v) => a + v, 0);

    const costPerBldg = calcConstructionCostPerBldg(s);
    const buildCost   = buildCount * costPerBldg;

    // Raze cost per building: Engine.calcRazeCost
    const razeCostPerBldg = Engine.calcRazeCost({
      race: s.race, personality: s.personality, acres: s.acres, sciArtisan: s.sciArtisan
    }).razeCost;
    const razeCost = razeCount * razeCostPerBldg;

    // Construction time for the new buildings (same formula as armouries)
    const ticks = buildCount > 0 ? calcConstructionTicks(s) : 1; // 1 tick for raze-only

    // Summary string for UI
    const parts = [];
    for (const [k, v] of Object.entries(toBuild))
      parts.push(`+${v} ${GAME_DATA.buildings[k]?.name || k}`);
    for (const [k, v] of Object.entries(toRaze))
      parts.push(`−${v} ${GAME_DATA.buildings[k]?.name || k}`);

    return {
      toBuild, toRaze, buildCount, razeCount,
      buildCost, razeCost, razeCostPerBldg, costPerBldg,
      constructionTicks: ticks,
      totalCost: buildCost + razeCost,
      summary: parts.join(', ') || 'No changes'
    };
  }

// ===========================================================================
// PART 3 — calcPlan() — ASSEMBLE TIMELINE
// ===========================================================================

  /**
   * Main planner calculation. Returns a plan object:
   * {
   *   s,                  // state
   *   cfEndTick,          // absolute UT tick of CF exit
   *   nowTick,            // absolute UT tick of current date
   *   ticksTotal,         // cfEndTick - nowTick
   *   phases[],           // [ { id, label, color, startTick, durationTicks, endTick, details } ]
   *   costs,              // { zero, current, target } cost breakdowns
   *   army,               // unit stats
   *   constructionTicks,
   *   trainingTicks,
   *   draftTicks,
   *   draftPlan,
   *   hasEnoughTime,
   *   warnings[],
   *   baseRealDate,       // Date object for nowTick real time (or null)
   *   baseAbsTick,        // = nowTick
   * }
   */
  function calcPlan() {
    const s = buildState();

    // ── Date parsing ──
    const cfEndDate  = parseDate(s.cfEndDateStr);
    const currentDate = parseDate(s.currentDateStr);
    if (!cfEndDate || !currentDate) return null;

    const cfEndTick  = dateToTicks(cfEndDate);
    const nowTick    = dateToTicks(currentDate);
    const ticksTotal = cfEndTick - nowTick;
    if (ticksTotal <= 0) return null;

    // ── Real-time base ──
    let baseRealDate = null;
    const timeObj = parseTime(s.realTickTimeStr);
    if (timeObj) {
      const today = new Date();
      baseRealDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(),
                               timeObj.hours, timeObj.minutes, 0, 0);
    }

    // ── Phase durations ──
    const constructionTicks = s.newArmouries > 0 ? calcConstructionTicks(s) : 0;
    const trainingTicks     = (s.tgtElites > 0 || s.tgtOffSpecs > 0 || s.tgtDefSpecs > 0 || s.tgtThieves > 0)
                                ? calcTrainingTicks(s) : 0;
    const wageTicks         = 48;
    const draftPlan         = calcDraftPlan(s);
    const draftTicks        = draftPlan.draftTicks;

    // ── Final build phase (optional) ──
    const finalBuildPhase   = calcFinalBuildPhase(s);
    const finalBuildTicks   = finalBuildPhase ? finalBuildPhase.constructionTicks : 0;

    // ── Retroplanning from T_exit ──
    // Phase 6: Final build/raze (ends at CF exit)
    const p6End   = cfEndTick;
    const p6Start = cfEndTick - finalBuildTicks;

    // Phase 5: Train (ends when final build starts, or at exit if no final build)
    const p5End   = finalBuildTicks > 0 ? p6Start : cfEndTick;
    const p5Start = p5End - trainingTicks;

    // Phase 4: Wages to 200% (48 ticks before exit)
    const p4End   = cfEndTick;
    const p4Start = cfEndTick - wageTicks;

    // Phase 3: Draft (ends when training starts)
    const p3End   = p5Start;
    const p3Start = p5Start - draftTicks;

    // Phase 2: Build armouries (ends when draft starts)
    const p2End   = p3Start;
    const p2Start = p3Start - constructionTicks;

    // Phase 1: Accumulate gold (from now to build start)
    const p1Start = nowTick;
    const p1End   = p2Start;
    const p1Ticks = Math.max(0, p1End - p1Start);

    const warnings = [];

    // Check overlap: wages window falls inside draft phase
    if (p4Start < p3End && p4End > p3Start) {
      warnings.push('Wage raise (last 48 ticks) overlaps with draft phase — raise wages while drafting.');
    }
    if (p4Start < p2End && p4End > p2Start) {
      warnings.push('Wage raise window overlaps with construction phase.');
    }

    // Check if there's enough time
    const ticksNeeded = constructionTicks + draftTicks + trainingTicks + finalBuildTicks;
    const hasEnoughTime = p2Start >= nowTick;
    if (!hasEnoughTime) {
      warnings.push(`Not enough time! Need ${ticksNeeded} ticks but only ${ticksTotal} remain.`);
    }

    // Gold accumulation during phase 1:
    // Wages at savingsWageRate (default 20%) to maximise savings.
    // Build a minimal state for calcWages using available buildings.
    let wagesAtSavings = 0;
    try {
      const bldForWages = _importedBuildings || Object.fromEntries(
        Object.keys(GAME_DATA.buildings).map(k => [k, 0])
      );
      if (!_importedBuildings) bldForWages.armouries = s.armouries;

      const wageState = {
        race: s.race, personality: s.personality,
        offSpecs: s.offSpecs, defSpecs: s.defSpecs, elites: s.elites,
        buildings: bldForWages, inConstruction: _importedInConstruction,
        acres: s.acres, wageRate: s.savingsWageRate,
        sciBookkeeping: 0,
        spellInspireArmy: s.spellIA, spellHerosInspiration: s.spellHI,
        spellGreed: false, spellBlizzard: false,
        spellGhostWorkers: false, spellConstructionDelays: false,
        ritual: s.ritual, ritualEffectiveness: s.ritualEff,
        dragon: 'none',
      };
      wagesAtSavings = Engine.calcWages(wageState).modifiedWages;
    } catch (e) {
      console.warn('CF Pumping: wages calc failed', e);
      // Fallback: estimate wages at savings rate
      wagesAtSavings = ((s.offSpecs + s.defSpecs) * 0.5 + s.elites * 0.75) * (s.savingsWageRate / 100);
    }

    const netIncomePerTick = s.income - wagesAtSavings;
    const goldAccumulated = s.gold + p1Ticks * netIncomePerTick;

    // ── Costs ──
    // Unit base costs from race data
    const eliteCost = s.race.military.elites.cost || 0;
    const offSpecCost = SPEC_COST;
    const defSpecCost = SPEC_COST;
    const thiefCost = s.race.military.thiefCost || 500;

    function costBreakdown(armCount) {
      const ec = calcTrainingCost(s.tgtElites,   eliteCost,   s, armCount);
      const oc = calcTrainingCost(s.tgtOffSpecs,  offSpecCost, s, armCount);
      const dc = calcTrainingCost(s.tgtDefSpecs,  defSpecCost, s, armCount);
      const tc = calcTrainingCost(s.tgtThieves,   thiefCost,   s, armCount);

      // Construction cost: only applies for target column (building new armouries)
      const bldCost = (armCount > s.armouries)
        ? (armCount - s.armouries) * calcConstructionCostPerBldg(s)
        : 0;

      const draftCost      = draftPlan.totalDraftCost;
      const finalBldCost   = finalBuildPhase ? finalBuildPhase.totalCost : 0;
      const trainTotal     = ec + oc + dc + tc;
      const total          = trainTotal + bldCost + draftCost + finalBldCost;
      const gap            = total - goldAccumulated;

      return { ec, oc, dc, tc, bldCost, draftCost, trainTotal, total, gap };
    }

    const costs = {
      zero:    costBreakdown(0),
      current: costBreakdown(s.armouries),
      target:  costBreakdown(s.targetArmCount),
    };

    // ── Army stats ──
    const finalElites   = s.elites   + s.tgtElites;
    const finalOffSpecs = s.offSpecs + s.tgtOffSpecs;
    const finalDefSpecs = s.defSpecs + s.tgtDefSpecs;
    const finalThieves  = s.thieves  + s.tgtThieves;

    const mil = s.race.military;
    const ome = s.personality.mods.ome || 1;
    const dme = s.personality.mods.dme || 1;
    const raceOme = s.race.mods.ome || 1;
    const raceDme = s.race.mods.dme || 1;

    function offPower(unit, count) { return (unit.off || 0) * count * ome * raceOme; }
    function defPower(unit, count) { return (unit.def || 0) * count * dme * raceDme; }

    const soldierOff = offPower({ off: 3 }, s.soldiers);
    const soldierDef = defPower({ def: 0 }, s.soldiers);

    const army = {
      rows: [
        {
          name: 'Soldiers',
          current: s.soldiers, toTrain: 0, final: s.soldiers,
          off: soldierOff, def: soldierDef
        },
        {
          name: mil.offSpec.name,
          current: s.offSpecs, toTrain: s.tgtOffSpecs, final: finalOffSpecs,
          off: offPower(mil.offSpec, finalOffSpecs), def: defPower(mil.offSpec, finalOffSpecs)
        },
        {
          name: mil.defSpec.name,
          current: s.defSpecs, toTrain: s.tgtDefSpecs, final: finalDefSpecs,
          off: offPower(mil.defSpec, finalDefSpecs), def: defPower(mil.defSpec, finalDefSpecs)
        },
        {
          name: mil.elites.name,
          current: s.elites, toTrain: s.tgtElites, final: finalElites,
          off: offPower(mil.elites, finalElites), def: defPower(mil.elites, finalElites)
        },
      ],
      totalOff: soldierOff + offPower(mil.offSpec, finalOffSpecs) + offPower(mil.defSpec, finalDefSpecs) + offPower(mil.elites, finalElites),
      totalDef: soldierDef + defPower(mil.offSpec, finalOffSpecs) + defPower(mil.defSpec, finalDefSpecs) + defPower(mil.elites, finalElites),
    };

    // ── Build phases array ──
    const phases = [];

    if (p1Ticks > 0) {
      phases.push({
        id: 'gold', label: 'Accumulate Gold', color: '#27ae60',
        startTick: p1Start, durationTicks: p1Ticks, endTick: p1End,
        details: `+${fmtGc(p1Ticks * s.income)} gold accumulated (${p1Ticks} ticks)`
      });
    }

    if (constructionTicks > 0) {
      phases.push({
        id: 'build', label: `Build ${s.newArmouries} Armouries`, color: '#2980b9',
        startTick: p2Start, durationTicks: constructionTicks, endTick: p2End,
        details: `${s.newArmouries} × ${fmtGc(calcConstructionCostPerBldg(s))} = ${fmtGc(costs.target.bldCost)} | ${constructionTicks} ticks`
      });
    }

    if (draftTicks > 0) {
      phases.push({
        id: 'draft', label: 'Draft Soldiers', color: '#e67e22',
        startTick: p3Start, durationTicks: draftTicks, endTick: p3End,
        details: `+${fmtNum(draftPlan.soldiersNeeded)} soldiers @ ~${fmtGc(draftPlan.costPerSoldier)}/ea | ${draftTicks} ticks`
      });
    }

    if (trainingTicks > 0) {
      const unitList = [
        s.tgtElites   > 0 ? `${fmtNum(s.tgtElites)} ${mil.elites.name}`   : '',
        s.tgtOffSpecs > 0 ? `${fmtNum(s.tgtOffSpecs)} ${mil.offSpec.name}` : '',
        s.tgtDefSpecs > 0 ? `${fmtNum(s.tgtDefSpecs)} ${mil.defSpec.name}` : '',
        s.tgtThieves  > 0 ? `${fmtNum(s.tgtThieves)} Thieves`             : '',
      ].filter(Boolean).join(', ');
      phases.push({
        id: 'train', label: 'Train Units', color: '#8e44ad',
        startTick: p5Start, durationTicks: trainingTicks, endTick: p5End,
        details: `${unitList} | ${trainingTicks} ticks`
      });
    }

    // Wages phase (narrow overlay)
    phases.push({
      id: 'wages', label: 'Raise Wages → 200%', color: '#f39c12',
      startTick: p4Start, durationTicks: wageTicks, endTick: p4End,
      details: `Set wages to 200% at tick ${p4Start - nowTick} (${wageTicks} ticks before exit)`
    });

    // Final build phase (raze + build)
    if (finalBuildPhase && finalBuildTicks > 0) {
      phases.push({
        id: 'finalbuild', label: 'Final Build / Raze', color: '#16a085',
        startTick: p6Start, durationTicks: finalBuildTicks, endTick: p6End,
        details: finalBuildPhase.summary + ` | ${finalBuildTicks} ticks | cost: ${fmtGc(finalBuildPhase.totalCost)}`
      });
    }

    // CF Exit marker
    phases.push({
      id: 'exit', label: 'CF Exit', color: '#e74c3c',
      startTick: cfEndTick, durationTicks: 0, endTick: cfEndTick,
      details: 'Ceasefire ends — attack!'
    });

    // Update finalBldInfo display
    if (finalBuildPhase) {
      const infoEl = document.getElementById('finalBldInfo');
      if (infoEl) {
        infoEl.innerHTML =
          `Changes: ${finalBuildPhase.summary}<br>` +
          `Build: ${finalBuildPhase.buildCount} × ${fmtGc(finalBuildPhase.costPerBldg)} = ${fmtGc(finalBuildPhase.buildCost)} | ` +
          `Raze: ${finalBuildPhase.razeCount} × ${fmtGc(finalBuildPhase.razeCostPerBldg)} = ${fmtGc(finalBuildPhase.razeCost)} | ` +
          `Duration: ${finalBuildTicks} ticks`;
      }
    }

    return {
      s, cfEndTick, nowTick, ticksTotal,
      phases,
      constructionTicks, trainingTicks, wageTicks, draftTicks,
      finalBuildTicks, finalBuildPhase,
      draftPlan,
      ticksNeeded,
      hasEnoughTime,
      warnings,
      costs,
      army,
      goldAccumulated,
      wagesAtSavings,
      netIncomePerTick,
      baseRealDate,
      baseAbsTick: nowTick,
      p1Ticks, p2Start, p3Start, p4Start, p5Start, p6Start,
    };
  }

  // ── Formatting helpers (aliases into Utils) ──
  const fmtNum = Utils.fmtNum;
  const fmtGc = Utils.fmtGc;

  function fmtTick(absTick, plan) {
    return ticksToUTStr(absTick);
  }

  function fmtReal(absTick, plan) {
    if (!plan || !plan.baseRealDate) return '—';
    return tickToRealTime(absTick, plan.baseAbsTick, plan.baseRealDate);
  }

// ===========================================================================
// PART 4 — GANTT CHART
// ===========================================================================

  const ganttCanvas  = document.getElementById('ganttCanvas');
  const ganttTooltip = document.getElementById('ganttTooltip');
  const ganttCtx     = ganttCanvas.getContext('2d');

  // Track bar hit-areas for hover
  let _ganttBars = [];

  function renderGantt(plan) {
    const canvas = ganttCanvas;
    const ctx    = ganttCtx;
    const W      = canvas.parentElement.clientWidth - 2;  // fit panel width
    canvas.width  = Math.max(W, 400);
    canvas.height = 160;

    const cW = canvas.width;
    const cH = canvas.height;

    const PAD_LEFT  = 10;
    const PAD_RIGHT = 10;
    const PAD_TOP   = 30;   // space for axis labels
    const PAD_BOT   = 20;
    const BAR_AREA  = cH - PAD_TOP - PAD_BOT;
    const chartW    = cW - PAD_LEFT - PAD_RIGHT;

    ctx.clearRect(0, 0, cW, cH);

    const { nowTick, cfEndTick, ticksTotal, phases } = plan;
    if (ticksTotal <= 0) return;

    // X mapping: absolute tick → pixel x
    const tickX = (absTick) =>
      PAD_LEFT + ((absTick - nowTick) / ticksTotal) * chartW;

    // Background
    ctx.fillStyle = '#0f3460';
    ctx.fillRect(0, 0, cW, cH);

    // Axis line
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(PAD_LEFT, PAD_TOP - 4);
    ctx.lineTo(PAD_LEFT + chartW, PAD_TOP - 4);
    ctx.stroke();

    // Tick labels (every ~24 ticks or every 48 if crowded)
    const labelEvery = ticksTotal > 120 ? 48 : ticksTotal > 48 ? 24 : 12;
    ctx.fillStyle = '#888';
    ctx.font = '10px system-ui';
    ctx.textAlign = 'center';
    for (let t = 0; t <= ticksTotal; t += labelEvery) {
      const x = tickX(nowTick + t);
      ctx.fillStyle = '#555';
      ctx.beginPath();
      ctx.moveTo(x, PAD_TOP - 8);
      ctx.lineTo(x, PAD_TOP - 4);
      ctx.stroke();
      ctx.fillStyle = '#888';
      ctx.fillText(`+${t}`, x, PAD_TOP - 12);
    }

    // ── Draw phase bars ──
    _ganttBars = [];

    // Separate wages (drawn as thin overlay) from main phases
    const wagesPhase = phases.find(p => p.id === 'wages');
    const exitPhase  = phases.find(p => p.id === 'exit');
    const mainPhases = phases.filter(p => p.id !== 'wages' && p.id !== 'exit');

    const numBars    = mainPhases.length;
    const barH       = Math.min(36, Math.floor((BAR_AREA - numBars * 4) / Math.max(numBars, 1)));
    const barSpacing = 4;

    mainPhases.forEach((phase, i) => {
      const x1 = tickX(phase.startTick);
      const x2 = phase.durationTicks > 0 ? tickX(phase.endTick) : x1 + 2;
      const barW = Math.max(2, x2 - x1);
      const y = PAD_TOP + i * (barH + barSpacing);

      // Bar fill
      ctx.fillStyle = phase.color;
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      ctx.roundRect(x1, y, barW, barH, 3);
      ctx.fill();
      ctx.globalAlpha = 1;

      // Bar label (if wide enough)
      if (barW > 40) {
        ctx.fillStyle = '#fff';
        ctx.font = `bold 11px system-ui`;
        ctx.textAlign = 'left';
        const labelX = x1 + 6;
        const maxLabelW = barW - 12;
        let label = phase.label;
        // Truncate label to fit
        while (ctx.measureText(label).width > maxLabelW && label.length > 4) {
          label = label.slice(0, -4) + '…';
        }
        ctx.fillText(label, labelX, y + barH / 2 + 4);
      }

      // Store hit area
      _ganttBars.push({ phase, x: x1, y, w: barW, h: barH });
    });

    // ── Wages band (thin yellow overlay at 75% height) ──
    if (wagesPhase && wagesPhase.durationTicks > 0) {
      const x1 = tickX(wagesPhase.startTick);
      const x2 = tickX(wagesPhase.endTick);
      const barW = Math.max(2, x2 - x1);
      const y = PAD_TOP;
      const h = BAR_AREA;

      ctx.fillStyle = wagesPhase.color;
      ctx.globalAlpha = 0.18;
      ctx.fillRect(x1, y, barW, h);
      ctx.globalAlpha = 1;

      // Dashed border
      ctx.strokeStyle = wagesPhase.color;
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 3]);
      ctx.strokeRect(x1, y, barW, h);
      ctx.setLineDash([]);

      // Label at top
      ctx.fillStyle = wagesPhase.color;
      ctx.font = '10px system-ui';
      ctx.textAlign = 'left';
      ctx.fillText('↑ Wages', x1 + 3, PAD_TOP + 11);

      _ganttBars.push({ phase: wagesPhase, x: x1, y, w: barW, h });
    }

    // ── CF Exit marker ──
    if (exitPhase) {
      const x = tickX(cfEndTick);
      ctx.strokeStyle = '#e74c3c';
      ctx.lineWidth = 2;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(x, PAD_TOP - 8);
      ctx.lineTo(x, cH - PAD_BOT);
      ctx.stroke();

      ctx.fillStyle = '#e74c3c';
      ctx.font = 'bold 10px system-ui';
      ctx.textAlign = x > cW - 60 ? 'right' : 'left';
      ctx.fillText('CF EXIT', x + (x > cW - 60 ? -4 : 4), PAD_TOP - 12);
    }

    // ── Time deficit zone (when phases would need to start before "now") ──
    if (!plan.hasEnoughTime) {
      const tickDeficit = plan.ticksNeeded - plan.ticksTotal;
      // Draw a red hatched zone on the right side (overflow beyond CF exit)
      const xExit = tickX(cfEndTick);
      const xOver = tickX(cfEndTick + tickDeficit);
      // Extend canvas view to show overflow? Not easy — instead show a red banner
      ctx.fillStyle = 'rgba(231,76,60,0.15)';
      ctx.fillRect(PAD_LEFT, PAD_TOP, chartW, BAR_AREA);
      ctx.strokeStyle = '#e74c3c';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 3]);
      ctx.strokeRect(PAD_LEFT, PAD_TOP, chartW, BAR_AREA);
      ctx.setLineDash([]);

      // Label the deficit
      ctx.fillStyle = '#e74c3c';
      ctx.font = 'bold 12px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(`⛔ TIME DEFICIT: need ${fmtNum(tickDeficit)} more ticks`, PAD_LEFT + chartW / 2, PAD_TOP + BAR_AREA / 2);
    }

    // ── "Now" marker ──
    {
      const x = tickX(nowTick);
      ctx.strokeStyle = '#4ecdc4';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(x, PAD_TOP - 4);
      ctx.lineTo(x, cH - PAD_BOT);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  // ── Hover tooltip ──
  ganttCanvas.addEventListener('mousemove', (e) => {
    const rect = ganttCanvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const hit = _ganttBars.find(b => mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h);
    if (hit && _plan) {
      const p = hit.phase;
      const plan = _plan;
      const utStart  = p.durationTicks > 0 ? fmtTick(p.startTick, plan) : fmtTick(p.startTick, plan);
      const utEnd    = p.durationTicks > 0 ? fmtTick(p.endTick, plan)   : '';
      const rtStart  = fmtReal(p.startTick, plan);
      const rtEnd    = p.durationTicks > 0 ? fmtReal(p.endTick, plan) : '';
      const relStart = p.startTick - plan.nowTick;

      let html = `<div class="tt-title">${p.label}</div>`;
      html += `Tick offset: +${relStart}`;
      if (p.durationTicks > 0) html += ` → +${p.startTick - plan.nowTick + p.durationTicks} (${p.durationTicks} ticks)`;
      html += `<br>UT: ${utStart}`;
      if (utEnd && utEnd !== utStart) html += ` → ${utEnd}`;
      if (rtStart !== '—') {
        html += `<br>Real: ${rtStart}`;
        if (rtEnd && rtEnd !== rtStart && rtEnd !== '—') html += ` → ${rtEnd}`;
      }
      if (p.details) html += `<br><span style="color:#ccc">${p.details}</span>`;

      ganttTooltip.innerHTML = html;
      ganttTooltip.style.display = 'block';
      ganttTooltip.style.left = (e.clientX + 14) + 'px';
      ganttTooltip.style.top  = (e.clientY - 10) + 'px';
    } else {
      ganttTooltip.style.display = 'none';
    }
  });

  ganttCanvas.addEventListener('mouseleave', () => {
    ganttTooltip.style.display = 'none';
  });

// ===========================================================================
// PART 5 — RENDER TABLES, SUMMARY, EVENT WIRING
// ===========================================================================

  // ── Summary bar ──────────────────────────────────────────────────────────

  function renderSummary(plan) {
    const { ticksTotal, ticksNeeded, hasEnoughTime, goldAccumulated,
            costs, constructionTicks, draftTicks, trainingTicks,
            netIncomePerTick, s, draftPlan } = plan;
    const slack    = ticksTotal - ticksNeeded;
    const goldGap  = costs.target.gap;          // positive = deficit, negative = surplus
    const goldOk   = goldGap <= 0;

    // Extra ticks needed to accumulate enough gold (if deficit)
    const extraTicksForGold = goldGap > 0 && netIncomePerTick > 0
      ? Math.ceil(goldGap / netIncomePerTick) : 0;

    const stats = [
      { label: 'CF ticks remaining', value: fmtNum(ticksTotal),
        cls: ticksTotal > 0 ? 'ok' : 'bad' },
      { label: 'Ticks needed', value: fmtNum(ticksNeeded),
        cls: hasEnoughTime ? 'ok' : 'bad' },
      { label: 'Tick slack', value: (slack >= 0 ? '+' : '') + fmtNum(slack) + ' ticks',
        cls: slack >= 0 ? 'ok' : 'bad' },
      { label: 'Build / Draft / Train',
        value: `${constructionTicks} / ${draftTicks} / ${trainingTicks} ticks`, cls: '' },
      { label: 'Gold at train start', value: fmtGc(goldAccumulated),
        cls: goldAccumulated >= costs.target.trainTotal ? 'ok' : 'bad' },
      { label: 'Total cost (target %)', value: fmtGc(costs.target.total), cls: '' },
      { label: 'Gold gap', value: (goldGap > 0 ? '−' : '+') + fmtGc(Math.abs(goldGap)),
        cls: goldOk ? 'ok' : 'bad' },
      { label: 'Extra ticks for gold',
        value: extraTicksForGold > 0 ? fmtNum(extraTicksForGold) + ' more ticks' : '—',
        cls: extraTicksForGold > 0 ? 'bad' : 'ok' },
    ];

    document.getElementById('summaryBar').innerHTML = stats.map(s =>
      `<div class="summary-stat">
        <span class="label">${s.label}</span>
        <span class="value ${s.cls}">${s.value}</span>
      </div>`
    ).join('');
  }

  // ── Warning / feasibility box ─────────────────────────────────────────────

  function renderWarnings(plan) {
    const box = document.getElementById('warningBox');
    const { ticksTotal, ticksNeeded, hasEnoughTime, goldAccumulated,
            costs, s, draftPlan } = plan;

    const lines = [...plan.warnings];
    const critical = [];

    // ── Time feasibility ──
    const tickDeficit = ticksNeeded - ticksTotal;
    if (tickDeficit > 0) {
      critical.push(
        `<strong>TIME DEFICIT: −${fmtNum(tickDeficit)} ticks</strong> — ` +
        `need ${fmtNum(ticksNeeded)} ticks but only ${fmtNum(ticksTotal)} remain. ` +
        `Start CF earlier or reduce training targets.`
      );
    }

    // ── Gold feasibility at each phase ──
    const goldAtBuildStart  = s.gold + plan.p1Ticks * plan.netIncomePerTick;
    const goldAfterBuild    = goldAtBuildStart - costs.target.bldCost;
    const goldAfterDraft    = goldAfterBuild + plan.draftTicks * plan.netIncomePerTick - draftPlan.totalDraftCost;
    const goldAtTrainStart  = plan.goldAccumulated;   // already accounts for all phases before train
    const goldAfterTrain    = goldAtTrainStart - costs.target.trainTotal;

    if (costs.target.bldCost > 0 && goldAtBuildStart < costs.target.bldCost) {
      const def = Math.ceil(costs.target.bldCost - goldAtBuildStart);
      critical.push(
        `<strong>GOLD DEFICIT (build): −${fmtGc(def)}</strong> — ` +
        `not enough gold to build armouries when construction phase starts.`
      );
    }

    if (goldAfterDraft < 0 && draftPlan.totalDraftCost > 0) {
      critical.push(
        `<strong>GOLD DEFICIT (draft): ${fmtGc(goldAfterDraft)}</strong> — ` +
        `draft costs exceed gold available during draft phase.`
      );
    }

    if (goldAfterTrain < 0) {
      const def = Math.abs(goldAfterTrain);
      critical.push(
        `<strong>GOLD DEFICIT (training): −${fmtGc(def)}</strong> — ` +
        `not enough gold to pay for training. Need ${fmtGc(costs.target.trainTotal)} ` +
        `but will have ${fmtGc(goldAtTrainStart)}.`
      );
    }

    // ── Training over-allocation ──
    const soldierPool = s.soldiers + draftPlan.soldiersNeeded;
    const totalTrain  = s.tgtElites + s.tgtOffSpecs + s.tgtDefSpecs + s.tgtThieves;
    if (totalTrain > soldierPool) {
      critical.push(
        `<strong>SOLDIER DEFICIT: −${fmtNum(totalTrain - soldierPool)}</strong> — ` +
        `training ${fmtNum(totalTrain)} units but only ${fmtNum(soldierPool)} soldiers available.`
      );
    }

    if (critical.length === 0 && lines.length === 0) {
      box.style.display = 'none';
      return;
    }

    let html = '';
    if (critical.length > 0) {
      html += `<div style="color:#ff8080;margin-bottom:6px;font-size:13px">`;
      html += critical.map(c => `⛔ ${c}`).join('<br><br>');
      html += `</div>`;
    }
    if (lines.length > 0) {
      html += lines.map(w => `⚠ ${w}`).join('<br>');
    }

    box.innerHTML = html;
    box.style.display = '';
  }

  // ── Workflow table ────────────────────────────────────────────────────────

  function renderWorkflowTable(plan) {
    const { s, nowTick, phases, costs, draftPlan } = plan;
    const tbody = document.getElementById('workflowBody');

    // Build rows from phases (exclude exit marker for inline rows)
    const netPerTick = s.income - plan.wagesAtSavings;
    const steps = [
      {
        num: 1, task: 'Set Wages → ' + s.savingsWageRate + '%',
        action: `Reduce wages to minimum to maximise gold savings`,
        startTick: nowTick,
        cost: 0
      },
      {
        num: 2, task: 'Accumulate Gold',
        action: plan.p1Ticks > 0
          ? `${fmtGc(netPerTick)}/tick net × ${plan.p1Ticks} ticks → +${fmtGc(plan.goldAccumulated - s.gold)}`
          : 'No accumulation time before build',
        startTick: nowTick,
        cost: 0
      },
    ];

    if (plan.constructionTicks > 0) {
      steps.push({
        num: steps.length + 1, task: 'Build Armouries',
        action: `${s.newArmouries} armouries × ${fmtGc(calcConstructionCostPerBldg(s))} each`,
        startTick: plan.p2Start,
        cost: costs.target.bldCost
      });
    }

    if (plan.draftTicks > 0) {
      const draftLabel = { none:'None', normal:'Normal', aggressive:'Aggressive', emergency:'Emergency', war:'War' };
      steps.push({
        num: steps.length + 1, task: 'Draft Soldiers',
        action: `${draftLabel[s.draftRate]} rate → +${fmtNum(draftPlan.soldiersNeeded)} soldiers`,
        startTick: plan.p3Start,
        cost: draftPlan.totalDraftCost
      });
    }

    steps.push({
      num: steps.length + 1, task: 'Raise Wages → 200%',
      action: `Set wage rate to 200% (48 ticks before exit)`,
      startTick: plan.p4Start,
      cost: 0
    });

    if (plan.trainingTicks > 0) {
      const mil = s.race.military;
      const unitParts = [
        s.tgtElites   > 0 ? `${fmtNum(s.tgtElites)} ${mil.elites.name}`   : '',
        s.tgtOffSpecs > 0 ? `${fmtNum(s.tgtOffSpecs)} ${mil.offSpec.name}` : '',
        s.tgtDefSpecs > 0 ? `${fmtNum(s.tgtDefSpecs)} ${mil.defSpec.name}` : '',
        s.tgtThieves  > 0 ? `${fmtNum(s.tgtThieves)} Thieves`             : '',
      ].filter(Boolean).join(' + ');
      steps.push({
        num: steps.length + 1, task: 'Train Units',
        action: unitParts,
        startTick: plan.p5Start,
        cost: costs.target.trainTotal
      });
    }

    if (plan.finalBuildTicks > 0 && plan.finalBuildPhase) {
      steps.push({
        num: steps.length + 1, task: 'Final Build / Raze',
        action: plan.finalBuildPhase.summary,
        startTick: plan.p6Start,
        cost: plan.finalBuildPhase.totalCost
      });
    }

    steps.push({
      num: steps.length + 1, task: 'CF Exit — Attack!',
      action: `Ceasefire ends`,
      startTick: plan.cfEndTick,
      cost: 0
    });

    tbody.innerHTML = steps.map((row, i) => {
      const relTick = row.startTick - nowTick;
      const isExit  = i === steps.length - 1;
      return `<tr${isExit ? ' class="total-row"' : ''}>
        <td>${row.num}</td>
        <td>${row.task}</td>
        <td>${row.action}</td>
        <td class="right">${relTick >= 0 ? '+' + relTick : relTick}</td>
        <td>${fmtTick(row.startTick, plan)}</td>
        <td>${fmtReal(row.startTick, plan)}</td>
        <td class="right">${row.cost > 0 ? fmtGc(row.cost) : '—'}</td>
      </tr>`;
    }).join('');
  }

  // ── Cost analysis table ───────────────────────────────────────────────────

  function renderCostAnalysis(plan) {
    const { costs, s, goldAccumulated } = plan;
    const mil = s.race.military;
    const tbody = document.getElementById('costBody');

    const fbCost = plan.finalBuildPhase ? plan.finalBuildPhase.totalCost : 0;
    const rows = [
      { label: mil.elites.name,      z: costs.zero.ec,    c: costs.current.ec,    t: costs.target.ec },
      { label: mil.offSpec.name,     z: costs.zero.oc,    c: costs.current.oc,    t: costs.target.oc },
      { label: mil.defSpec.name,     z: costs.zero.dc,    c: costs.current.dc,    t: costs.target.dc },
      { label: 'Thieves',            z: costs.zero.tc,    c: costs.current.tc,    t: costs.target.tc },
      { label: 'Build Armouries',    z: 0,                c: 0,                   t: costs.target.bldCost },
      { label: 'Draft Cost',         z: costs.zero.draftCost, c: costs.current.draftCost, t: costs.target.draftCost },
      { label: 'Final Build/Raze',   z: fbCost,           c: fbCost,              t: fbCost },
    ];

    const zTotal = rows.reduce((a, r) => a + r.z, 0);
    const cTotal = rows.reduce((a, r) => a + r.c, 0);
    const tTotal = rows.reduce((a, r) => a + r.t, 0);

    const fmt = (n) => n > 0 ? fmtGc(n) : '—';

    let html = rows.map(r => `<tr>
      <td>${r.label}</td>
      <td class="right">${fmt(r.z)}</td>
      <td class="right">${fmt(r.c)}</td>
      <td class="right">${fmt(r.t)}</td>
    </tr>`).join('');

    // Total row
    html += `<tr class="total-row">
      <td><strong>TOTAL</strong></td>
      <td class="right"><strong>${fmtGc(zTotal)}</strong></td>
      <td class="right"><strong>${fmtGc(cTotal)}</strong></td>
      <td class="right"><strong>${fmtGc(tTotal)}</strong></td>
    </tr>`;

    // Gold available row
    html += `<tr>
      <td>Gold available (at train start)</td>
      <td class="right">${fmtGc(goldAccumulated)}</td>
      <td class="right">${fmtGc(goldAccumulated)}</td>
      <td class="right">${fmtGc(goldAccumulated)}</td>
    </tr>`;

    // Gap row
    const gapCls = (g) => g > 0 ? 'cost-row-gap' : 'cost-row-gap positive';
    const gapFmt = (g) => (g > 0 ? '+' : '') + fmtGc(g);
    html += `<tr class="${gapCls(costs.target.gap)}">
      <td><strong>GC Gap</strong></td>
      <td class="right"><strong>${gapFmt(costs.zero.gap)}</strong></td>
      <td class="right"><strong>${gapFmt(costs.current.gap)}</strong></td>
      <td class="right"><strong>${gapFmt(costs.target.gap)}</strong></td>
    </tr>`;

    tbody.innerHTML = html;
  }

  // ── Army stats table ──────────────────────────────────────────────────────

  function renderArmyStats(plan) {
    const { army, s } = plan;
    const tbody = document.getElementById('armyBody');
    const maxOff = Math.max(army.totalOff, 1);
    const maxDef = Math.max(army.totalDef, 1);

    let html = army.rows.map(r => `<tr>
      <td>${r.name}</td>
      <td class="right">${fmtNum(r.current)}</td>
      <td class="right">${r.toTrain > 0 ? '+' + fmtNum(r.toTrain) : '—'}</td>
      <td class="right">${fmtNum(r.final)}</td>
      <td class="right opa">${fmtNum(r.off)}</td>
      <td class="right dpa">${fmtNum(r.def)}</td>
    </tr>`).join('');

    html += `<tr class="total-row">
      <td><strong>Totals</strong></td>
      <td class="right"></td>
      <td class="right"></td>
      <td class="right"></td>
      <td class="right opa"><strong>${fmtNum(army.totalOff)}</strong></td>
      <td class="right dpa"><strong>${fmtNum(army.totalDef)}</strong></td>
    </tr>`;

    // OPA / DPA per acre
    if (s.acres > 0) {
      const opa = army.totalOff / s.acres;
      const dpa = army.totalDef / s.acres;
      html += `<tr>
        <td colspan="4" style="color:#888;font-size:11px">Per acre</td>
        <td class="right opa">${opa.toFixed(2)} OPA</td>
        <td class="right dpa">${dpa.toFixed(2)} DPA</td>
      </tr>`;
    }

    tbody.innerHTML = html;
  }

  // ===========================================================================
  // TICK-BY-TICK SIMULATION
  // ===========================================================================

  function runTickSimulation(plan) {
    const { s, nowTick, ticksTotal, constructionTicks, draftTicks, trainingTicks,
            p2Start, p3Start, p4Start, p5Start, draftPlan, costs } = plan;

    // Use full imported engine state if available, otherwise build minimal one
    const base = _engineBaseState || {
      race: s.race, personality: s.personality,
      acres: s.acres,
      soldiers: s.soldiers, offSpecs: s.offSpecs, defSpecs: s.defSpecs,
      elites: s.elites, thieves: s.thieves, wizards: 0, prisoners: 0,
      buildings: _importedBuildings || Object.fromEntries(
        Object.keys(GAME_DATA.buildings).map(k => [k, k === 'armouries' ? s.armouries : 0])
      ),
      inConstruction: _importedInConstruction,
      sciAlchemy: 0, sciTools: 0, sciBookkeeping: 0, sciProduction: 0,
      sciHousing: 0, sciHeroism: s.sciHeroism, sciValor: s.sciValor,
      sciArtisan: s.sciArtisan,
      spellMinersM: false, spellGhostWorkers: false, spellBlizzard: false,
      spellConstructionDelays: false, spellRiots: false, spellGreed: false,
      spellPatriotism: s.spellPAT,
      spellInspireArmy: s.spellIA, spellHerosInspiration: s.spellHI,
      spellChastity: false, spellFertileLands: false, spellLoveAndPeace: false,
      spellDrought: false, spellGluttony: false,
      ritual: s.ritual, ritualEffectiveness: s.ritualEff,
      dragon: 'none',
      honor: { pop: 1, ome: 1, income: 1, food: 1, runes: 1, wpa: 1, tpa: 1 },
      eowcfActive: false, eowcfTicksElapsed: 0,
    };

    const results = [];
    let gold          = s.gold;
    let peasants      = s.peasants;
    let soldiers      = s.soldiers;
    let totalMilitary = s.soldiers + s.offSpecs + s.defSpecs + s.elites + s.thieves;
    let soldiersLeft  = draftPlan.soldiersNeeded;
    let constructionPaid = false;
    let trainingPaid     = false;

    // Phase boundaries (relative ticks from now)
    const tBuildStart = p2Start - nowTick;
    const tDraftStart = p3Start - nowTick;
    const tTrainStart = p5Start - nowTick;
    const tWagesUp    = ticksTotal - 48;

    for (let t = 0; t <= ticksTotal; t++) {
      // Determine phase
      let phase = 'gold';
      if (constructionTicks > 0 && t >= tBuildStart && t < tDraftStart) phase = 'build';
      if (draftTicks > 0        && t >= tDraftStart  && t < tTrainStart) phase = 'draft';
      if (trainingTicks > 0     && t >= tTrainStart)                      phase = 'train';

      const wageRateThisTick = t >= tWagesUp ? 200 : s.savingsWageRate;

      // Record state BEFORE this tick's effects
      results.push({ t, gold: Math.round(gold), soldiers, totalMilitary, phase });

      // ── One-time costs ──
      if (phase === 'build' && !constructionPaid) {
        gold -= costs.target.bldCost;
        constructionPaid = true;
      }
      if (phase === 'train' && !trainingPaid) {
        gold -= costs.target.trainTotal;
        trainingPaid = true;
      }

      // ── Income this tick via Engine (accurate: employed/unemployed split, banks, bonuses) ──
      const tickState = Object.assign({}, base, { peasants, wageRate: wageRateThisTick });
      const incomeResult  = Engine.calcIncome(tickState);
      const wagesResult   = Engine.calcWages(tickState);
      const incomeThisTick = incomeResult.modifiedIncome;
      const wagesThisTick  = wagesResult.modifiedWages;

      gold += incomeThisTick - wagesThisTick;

      // ── Draft this tick via Engine.calcDraft ──
      if (phase === 'draft' && soldiersLeft > 0) {
        // Build tick-accurate engine state: armouries already built, current peasants/military
        const draftTickState = Object.assign({}, draftPlan.engState, {
          peasants,
          soldiers,
          maxPop: draftPlan.maxPop,
          wageRate: s.savingsWageRate,
        });
        const draftResult = Engine.calcDraft(draftTickState);
        const drafted = Math.min(draftResult.drafted, soldiersLeft, peasants);
        if (drafted > 0) {
          // Scale cost to actual drafted count (Engine computed at full draftedPerTick)
          const costThisTick = draftResult.drafted > 0
            ? (drafted / draftResult.drafted) * draftResult.draftCost
            : drafted * draftResult.costPerSoldier;
          gold          -= costThisTick;
          peasants      -= drafted;
          soldiers      += drafted;
          totalMilitary += drafted;
          soldiersLeft  -= drafted;
        }
      }
    }
    return results;
  }

  // ===========================================================================
  // EVOLUTION CHART
  // ===========================================================================

  const evoCanvas  = document.getElementById('evolutionCanvas');
  const evoCtx     = evoCanvas.getContext('2d');
  const evoTooltip = document.getElementById('evoTooltip');
  let _evoData = [];

  // Phase colors (match Gantt)
  const PHASE_COLORS = {
    gold:       '#27ae60',
    build:      '#2980b9',
    draft:      '#e67e22',
    train:      '#8e44ad',
    finalbuild: '#16a085',
  };

  function renderEvolutionChart(plan, simData) {
    const canvas = evoCanvas;
    const ctx    = evoCtx;
    // Make plan accessible for threshold lines (used in gold threshold section below)
    // plan is captured via closure from the parameter
    const W = canvas.parentElement.clientWidth - 2;
    canvas.width  = Math.max(W, 400);
    canvas.height = 200;
    const cW = canvas.width;
    const cH = canvas.height;

    const PAD_L = 72, PAD_R = 72, PAD_T = 20, PAD_B = 28;
    const chartW = cW - PAD_L - PAD_R;
    const chartH = cH - PAD_T - PAD_B;

    ctx.clearRect(0, 0, cW, cH);
    ctx.fillStyle = '#0f3460';
    ctx.fillRect(0, 0, cW, cH);

    if (!simData || simData.length < 2) return;

    const N      = simData.length;
    const xScale = chartW / (N - 1);

    const goldVals  = simData.map(d => d.gold);
    const solVals   = simData.map(d => d.soldiers);
    const goldMin   = Math.min(...goldVals);
    const goldMax   = Math.max(...goldVals);
    const milMin    = 0;
    const milMax    = Math.max(...solVals) * 1.05 || 1;

    // Y scales
    const goldRange = goldMax - goldMin || 1;
    const yGold = (v) => PAD_T + chartH - ((v - goldMin) / goldRange) * chartH;
    const yMil  = (v) => PAD_T + chartH - ((v - milMin)  / milMax)    * chartH;
    const xPos  = (i) => PAD_L + i * xScale;

    // ── Phase background bands ──
    let prevPhase = simData[0].phase;
    let bandStart = 0;
    for (let i = 1; i <= N; i++) {
      const curPhase = i < N ? simData[i].phase : null;
      if (curPhase !== prevPhase || i === N) {
        const x1 = xPos(bandStart);
        const x2 = xPos(i - 1);
        ctx.fillStyle = PHASE_COLORS[prevPhase] || '#444';
        ctx.globalAlpha = 0.08;
        ctx.fillRect(x1, PAD_T, x2 - x1, chartH);
        ctx.globalAlpha = 1;
        bandStart = i;
        prevPhase = curPhase;
      }
    }

    // ── Grid lines ──
    ctx.strokeStyle = '#1e3a6e';
    ctx.lineWidth = 1;
    for (let g = 0; g <= 4; g++) {
      const y = PAD_T + (g / 4) * chartH;
      ctx.beginPath();
      ctx.moveTo(PAD_L, y);
      ctx.lineTo(PAD_L + chartW, y);
      ctx.stroke();
    }

    // ── Soldiers line (right axis, orange) ──
    ctx.beginPath();
    ctx.strokeStyle = '#e67e22';
    ctx.lineWidth = 2;
    simData.forEach((d, i) => {
      const x = xPos(i), y = yMil(d.soldiers);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();

    // ── Red fill where gold < 0 ──
    const zeroY = yGold(0);
    if (goldMin < 0) {
      ctx.save();
      ctx.beginPath();
      // Build path along gold line
      simData.forEach((d, i) => {
        const x = xPos(i), y = yGold(d.gold);
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      });
      // Close path along zero line (bottom)
      ctx.lineTo(xPos(N - 1), zeroY);
      ctx.lineTo(xPos(0), zeroY);
      ctx.closePath();
      ctx.fillStyle = 'rgba(231,76,60,0.25)';
      ctx.fill();
      // Horizontal zero line
      ctx.strokeStyle = 'rgba(231,76,60,0.7)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(PAD_L, zeroY);
      ctx.lineTo(PAD_L + chartW, zeroY);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    // ── Gold threshold lines (cost checkpoints) ──
    // Show dashed lines at key spending moments
    const thresholds = [];
    if (plan && plan.costs) {
      const bldCost   = plan.costs.target.bldCost;
      const trainCost = plan.costs.target.trainTotal;
      if (bldCost > 0)   thresholds.push({ value: bldCost,   label: 'Build cost',  color: '#2980b9' });
      if (trainCost > 0) thresholds.push({ value: trainCost, label: 'Train cost',  color: '#8e44ad' });
    }
    thresholds.forEach(thr => {
      if (thr.value < goldMin || thr.value > goldMax) return;
      const y = yGold(thr.value);
      ctx.strokeStyle = thr.color;
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.5;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(PAD_L, y);
      ctx.lineTo(PAD_L + chartW, y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
      ctx.fillStyle = thr.color;
      ctx.textAlign = 'right';
      ctx.font = '10px system-ui';
      ctx.fillText(thr.label, PAD_L - 4, y + 3);
    });

    // ── Gold line (left axis, gold) ──
    ctx.beginPath();
    ctx.strokeStyle = '#c4a35a';
    ctx.lineWidth = 2;
    simData.forEach((d, i) => {
      const x = xPos(i), y = yGold(d.gold);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();

    // ── Axes labels ──
    ctx.font = '10px system-ui';
    ctx.textAlign = 'right';

    // Left axis (gold)
    ctx.fillStyle = '#c4a35a';
    for (let g = 0; g <= 4; g++) {
      const v = goldMin + (goldRange * (4 - g) / 4);
      ctx.fillText(fmtK(v), PAD_L - 4, PAD_T + (g / 4) * chartH + 3);
    }

    // Right axis (soldiers)
    ctx.fillStyle = '#e67e22';
    ctx.textAlign = 'left';
    for (let g = 0; g <= 4; g++) {
      const v = milMax * (4 - g) / 4;
      ctx.fillText(fmtK(v), PAD_L + chartW + 4, PAD_T + (g / 4) * chartH + 3);
    }

    // X axis tick labels (every ~24 ticks)
    ctx.fillStyle = '#888';
    ctx.textAlign = 'center';
    const labelEvery = N > 120 ? 48 : N > 48 ? 24 : 12;
    for (let t = 0; t < N; t += labelEvery) {
      ctx.fillText('+' + t, xPos(t), PAD_T + chartH + 14);
    }

    // Axis titles
    ctx.fillStyle = '#c4a35a';
    ctx.textAlign = 'center';
    ctx.save();
    ctx.translate(11, PAD_T + chartH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('Gold', 0, 0);
    ctx.restore();

    ctx.fillStyle = '#e67e22';
    ctx.save();
    ctx.translate(cW - 10, PAD_T + chartH / 2);
    ctx.rotate(Math.PI / 2);
    ctx.fillText('Soldiers', 0, 0);
    ctx.restore();

    // Legend
    const legendItems = [
      { color: '#c4a35a', label: 'Gold', dash: false },
      { color: '#e67e22', label: 'Soldiers', dash: false },
    ];
    let lx = PAD_L + 8;
    legendItems.forEach(item => {
      ctx.strokeStyle = item.color;
      ctx.lineWidth = 2;
      if (item.dash) ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(lx, PAD_T + 7);
      ctx.lineTo(lx + 16, PAD_T + 7);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#ccc';
      ctx.textAlign = 'left';
      ctx.font = '10px system-ui';
      ctx.fillText(item.label, lx + 20, PAD_T + 10);
      lx += 100;
    });

    _evoData = simData;
  }

  const fmtK = Utils.fmtK;

  // Hover on evolution chart
  evoCanvas.addEventListener('mousemove', (e) => {
    if (!_evoData || _evoData.length < 2 || !_plan) return;
    const rect = evoCanvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const PAD_L = 72, PAD_R = 72;
    const chartW = evoCanvas.width - PAD_L - PAD_R;
    const xScale = chartW / (_evoData.length - 1);
    const ti = Math.round(Math.max(0, Math.min((mx - PAD_L) / xScale, _evoData.length - 1)));
    const d  = _evoData[ti];
    if (!d) { evoTooltip.style.display = 'none'; return; }

    const absTick = _plan.nowTick + d.t;
    const phaseLabel = { gold: 'Accumulate Gold', build: 'Build Armouries', draft: 'Draft', train: 'Train' };
    let html = `<strong>Tick +${d.t}</strong> — ${phaseLabel[d.phase] || d.phase}<br>`;
    html += `UT: ${fmtTick(absTick, _plan)}<br>`;
    html += `<span style="color:#c4a35a">Gold: ${fmtGc(d.gold)}</span><br>`;
    html += `<span style="color:#e67e22">Soldiers: ${fmtNum(d.soldiers)}</span>`;

    evoTooltip.innerHTML = html;
    evoTooltip.style.display = 'block';
    evoTooltip.style.left = (e.clientX + 14) + 'px';
    evoTooltip.style.top  = (e.clientY - 10) + 'px';
  });

  evoCanvas.addEventListener('mouseleave', () => { evoTooltip.style.display = 'none'; });

  // ===========================================================================
  // DRAFT INFO — updates soldiers-available display and training input maxima
  // ===========================================================================

  function updateDraftInfo(s, draftPlan) {
    const box         = document.getElementById('draftInfoBox');
    const elDrafted   = document.getElementById('draftInfoDrafted');
    const elTotal     = document.getElementById('draftInfoTotal');
    const elAvail     = document.getElementById('draftInfoAvail');
    const elAlloc     = document.getElementById('draftInfoAlloc');
    const elWarn      = document.getElementById('trainOverWarning');

    const soldiersDrafted = draftPlan.soldiersNeeded;          // soldiers gained from draft
    const soldiersAfter   = s.soldiers + soldiersDrafted;       // total soldiers at train time
    const availForTrain   = soldiersAfter;                      // all soldiers can be trained

    box.style.display = '';
    elDrafted.textContent = '+' + fmtNum(soldiersDrafted);
    elTotal.textContent   = fmtNum(soldiersAfter);
    elAvail.textContent   = fmtNum(availForTrain);

    // Update maxima on training inputs
    ['tgtElites', 'tgtOffSpecs', 'tgtDefSpecs', 'tgtThieves'].forEach(id => {
      document.getElementById(id).max = availForTrain;
    });

    // Compute allocated and check over-limit
    const allocated = s.tgtElites + s.tgtOffSpecs + s.tgtDefSpecs + s.tgtThieves;
    const over = allocated - availForTrain;

    elAlloc.textContent = `Allocated: ${fmtNum(allocated)} / ${fmtNum(availForTrain)}`;
    elAlloc.style.color = over > 0 ? '#e74c3c' : '#4ecdc4';

    if (over > 0) {
      elWarn.textContent = `⚠ Training targets exceed available soldiers by ${fmtNum(over)}. Reduce your targets.`;
      elWarn.style.display = '';
    } else {
      elWarn.style.display = 'none';
    }
  }

  // ===========================================================================
  // MAIN RECALC — wires everything together
  // ===========================================================================

  function recalc() {
    buildState(); // always run to update derived read-only fields

    const plan = calcPlan();

    if (!plan) {
      document.getElementById('resultsPlaceholder').style.display = '';
      document.getElementById('resultsArea').style.display = 'none';
      return;
    }

    document.getElementById('resultsPlaceholder').style.display = 'none';
    document.getElementById('resultsArea').style.display = '';
    _plan = plan;

    updateDraftInfo(plan.s, plan.draftPlan);
    renderSummary(plan);
    renderWarnings(plan);
    renderGantt(plan);
    const simData = runTickSimulation(plan);
    renderEvolutionChart(plan, simData);
    renderWorkflowTable(plan);
    renderCostAnalysis(plan);
    renderArmyStats(plan);
  }

  // Redraw charts on window resize (canvas width is dynamic)
  window.addEventListener('resize', () => {
    if (_plan) {
      renderGantt(_plan);
      renderEvolutionChart(_plan, _evoData);
    }
  });

})();
