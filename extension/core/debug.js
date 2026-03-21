// =============================================================================
// Debug Report Builder
// =============================================================================
// Produces a comprehensive debug JSON for validating all engine formulas
// against live game data. No DOM dependency — takes scraped data and
// engine state, returns a structured report.
//
// Usage:
//   const report = Debug.buildReport(scrapedGameData, engineState);
//   // report.comparisons.economy, .buildingEfficiency, .food, etc.
// =============================================================================

const Debug = {

  VERSION: 2,

  /**
   * Build a full debug report.
   *
   * @param {Object} scraped - Raw scraped gameData from chrome.storage
   * @param {Object} state   - Engine-compatible state (output of gatherState or StateBuilder)
   * @returns {Object} Complete debug report
   */
  buildReport(scraped, state) {
    if (!state || !state.race || !state.personality) {
      return { version: this.VERSION, error: 'Invalid engine state' };
    }

    // Run all engine calculations
    const income    = Engine.calcIncome(state);
    const wages     = Engine.calcWages(state);
    const food      = Engine.calcFood(state);
    const runes     = Engine.calcRunes(state);
    const pop       = Engine.calcPopGrowth(state);
    const draft     = Engine.calcDraft(state);
    const buildTime = Engine.calcConstructionTime(state);
    const buildCost = Engine.calcConstructionCost(state);
    const razeCost  = Engine.calcRazeCost(state);

    let trainingTime = null;
    try { trainingTime = Engine.calcTrainingTime(state); } catch (e) { /* optional */ }

    const netIncome = income.modifiedIncome - wages.modifiedWages;

    // Build comparisons by category
    const comparisons = this._buildComparisons(scraped, state, {
      income, wages, food, runes, pop, draft, buildTime, buildCost, razeCost, trainingTime
    });

    // Warnings
    const warnings = this._buildWarnings(scraped, state, { income, pop });

    return {
      version: this.VERSION,
      exportedAt: new Date().toISOString(),

      province: {
        name: (scraped && scraped.provinceName) || 'Unknown',
        race: state.race.name,
        personality: state.personality.name,
        acres: state.acres,
        utopianDate: (scraped && scraped.utopianDate) || null,
      },

      scraped: scraped || null,

      engineState: this._serializeState(state),

      comparisons,

      calculatedBreakdowns: {
        income, wages, food, runes, pop, draft,
        netIncome,
        buildTime, buildCost, razeCost, trainingTime,
      },

      warnings,
    };
  },

  // ---------------------------------------------------------------------------
  // COMPARISONS — categorized, with source tracking
  // ---------------------------------------------------------------------------

  _buildComparisons(scraped, state, calc) {
    const result = {
      buildingEfficiency: [],
      economy: [],
      food: [],
      runes: [],
      population: [],
      military: [],
      construction: [],
    };

    if (!scraped) return result;

    const add = (category, label, gameVal, engineVal, source, note) => {
      if (gameVal == null || engineVal == null) return;
      const g = typeof gameVal === 'number' ? gameVal : parseFloat(gameVal);
      const e = typeof engineVal === 'number' ? engineVal : parseFloat(engineVal);
      if (isNaN(g) || isNaN(e)) return;
      const gR = Math.round(g);
      const eR = Math.round(e);
      const delta = eR - gR;
      const pctDiff = gR !== 0 ? ((delta / gR) * 100).toFixed(2) + '%' : (delta === 0 ? '0%' : 'N/A');
      const entry = { label, game: gR, engine: eR, delta, pctDiff, source };
      if (note) entry.note = note;
      result[category].push(entry);
    };

    const { income, wages, food, runes, pop, draft, buildTime, buildCost, razeCost } = calc;
    const h = scraped.stateHistory || {};

    // =====================================================================
    // BUILDING EFFICIENCY
    // =====================================================================

    if (scraped.buildingEfficiencyPct != null) {
      // Game's displayed BE does NOT include CD or Blizzard malus
      const beForComparison = income.beResult.be
        / (income.beResult.constructionDelaysMod || 1)
        / (income.beResult.blizzardMod || 1);
      add('buildingEfficiency', 'BE %', scraped.buildingEfficiencyPct,
        beForComparison * 100, 'buildings_page',
        'Game BE excludes CD/Blizzard malus; engine value adjusted to match');
    }
    add('buildingEfficiency', 'Available Workers',
      scraped.availableWorkers, income.beResult.availableWorkers, 'buildings_page');
    add('buildingEfficiency', 'Total Jobs',
      scraped.availableJobs, income.beResult.totalJobs, 'buildings_page');
    add('buildingEfficiency', 'Optimal Workers (67%)',
      scraped.workersNeededForMax, income.beResult.optimalWorkers, 'buildings_page');

    // Derived: unfilled jobs
    if (scraped.unfilledJobs != null) {
      const engineUnfilled = Math.max(0, income.beResult.totalJobs - income.beResult.availableWorkers);
      add('buildingEfficiency', 'Unfilled Jobs',
        scraped.unfilledJobs, engineUnfilled, 'buildings_page', 'Derived: totalJobs - availableWorkers');
    }

    // Employment %
    if (scraped.employment != null) {
      add('buildingEfficiency', 'Employment %',
        scraped.employment, income.beResult.pctJobs * 100, 'buildings_page');
    }

    // =====================================================================
    // ECONOMY
    // =====================================================================

    // Projected (current-state, most reliable)
    add('economy', 'Income (projected)',
      scraped.dailyIncome, income.modifiedIncome, 'state_projected');
    add('economy', 'Wages (projected)',
      scraped.dailyWages, wages.modifiedWages, 'state_projected');
    if (scraped.dailyIncome != null && scraped.dailyWages != null) {
      add('economy', 'Net Gold (projected)',
        scraped.dailyIncome - scraped.dailyWages,
        income.modifiedIncome - wages.modifiedWages, 'state_projected');
    }

    // Unemployed peasants
    add('economy', 'Unemployed Peasants',
      scraped.unemployedPeasants, income.unemployed, 'state_page');

    // Yesterday history
    if (h.income) {
      add('economy', 'Income (yesterday)',
        h.income.yesterday, income.modifiedIncome, 'state_yesterday',
        'Yesterday may differ if state changed between ticks');
    }
    if (h.wages) {
      add('economy', 'Wages (yesterday)',
        h.wages.yesterday, wages.modifiedWages, 'state_yesterday');
    }
    if (h.netGoldChange) {
      // Net gold = income - wages - draftCosts
      const engineNet = income.modifiedIncome - wages.modifiedWages - draft.draftCost;
      add('economy', 'Net Gold Change (yesterday)',
        h.netGoldChange.yesterday, engineNet, 'state_yesterday',
        'Includes draft costs; yesterday state may differ');
    }
    if (h.draftCosts) {
      add('economy', 'Draft Cost (yesterday)',
        h.draftCosts.yesterday, draft.draftCost, 'state_yesterday',
        'Draft cost depends on mil ratio at time of draft');
    }

    // Bank flat production from buildingEffects text
    const bankFlat = this._parseBuildingEffectNumber(scraped, 'banks', /Produce ([\d,]+) gold/);
    if (bankFlat != null) {
      add('economy', 'Bank Flat Income',
        bankFlat, income.bankFlatIncome, 'building_effects_text');
    }

    // Bank pct bonus from buildingEffects text
    const bankPct = this._parseBuildingEffectPct(scraped, 'banks', /([\d.]+)% higher income/);
    if (bankPct != null) {
      add('economy', 'Bank % Bonus',
        bankPct, income.bankPctBonus, 'building_effects_text');
    }

    // =====================================================================
    // FOOD
    // =====================================================================

    if (h.foodGrown) {
      add('food', 'Food Produced (yesterday)',
        h.foodGrown.yesterday, food.modifiedFoodProduction, 'state_yesterday');
    }
    if (h.foodNeeded) {
      add('food', 'Food Consumed (yesterday)',
        h.foodNeeded.yesterday, food.foodConsumed, 'state_yesterday');
    }
    if (h.foodDecayed) {
      add('food', 'Food Decayed (yesterday)',
        h.foodDecayed.yesterday, food.foodDecay, 'state_yesterday');
    }
    if (h.netFoodChange) {
      add('food', 'Net Food (yesterday)',
        h.netFoodChange.yesterday, food.netFood, 'state_yesterday');
    }

    // Farm production from buildingEffects text
    const farmProd = this._parseBuildingEffectNumber(scraped, 'farms', /Produce ([\d,]+) bushels/);
    if (farmProd != null) {
      add('food', 'Farm Production (building effect)',
        farmProd, food.farmFood, 'building_effects_text',
        'Game text rounds to integer');
    }

    // =====================================================================
    // RUNES
    // =====================================================================

    if (h.runesProduced) {
      add('runes', 'Runes Produced (yesterday)',
        h.runesProduced.yesterday, runes.modifiedRuneProduction, 'state_yesterday');
    }
    if (h.runesDecayed) {
      add('runes', 'Runes Decayed (yesterday)',
        h.runesDecayed.yesterday, runes.runeDecay, 'state_yesterday',
        'Decay uses balance at tick start, not after production');
    }
    if (h.netRuneChange) {
      add('runes', 'Net Runes (yesterday)',
        h.netRuneChange.yesterday, runes.netRunes, 'state_yesterday');
    }

    // Tower production from buildingEffects text
    const towerProd = this._parseBuildingEffectNumber(scraped, 'towers', /Produce ([\d,]+) runes/);
    if (towerProd != null) {
      add('runes', 'Tower Production (building effect)',
        towerProd, runes.towerRunes, 'building_effects_text');
    }

    // =====================================================================
    // POPULATION
    // =====================================================================

    add('population', 'Max Population',
      scraped.maxPop, pop.maxPop, 'state_page');
    add('population', 'Current Population',
      scraped.totalPop, pop.currentPop, 'state_page');

    // Homes max pop bonus from buildingEffects
    const homesMaxPop = this._parseBuildingEffectNumber(scraped, 'homes', /max population by ([\d,]+)/);
    if (homesMaxPop != null) {
      // Engine: homes * 10 (extra capacity on top of 25/acre)
      const engineHomesExtra = (state.buildings.homes || 0) * 10;
      add('population', 'Homes Max Pop Bonus',
        homesMaxPop, engineHomesExtra, 'building_effects_text');
    }

    // Homes birth flat from buildingEffects
    const homesBirth = this._parseBuildingEffectNumber(scraped, 'homes', /([\d,]+) additional peasants/);
    if (homesBirth != null) {
      add('population', 'Homes Birth Rate (flat)',
        homesBirth, pop.homesBorn, 'building_effects_text');
    }

    // Hospital birth rate bonus from buildingEffects
    const hospBirth = this._parseBuildingEffectPct(scraped, 'hospitals', /birth rates by ([\d.]+)%/);
    if (hospBirth != null) {
      add('population', 'Hospital Birth Rate Bonus %',
        hospBirth, pop.hospitalBirthBonus, 'building_effects_text');
    }

    // Yesterday peasant change (net = births - drafts - deaths)
    if (h.peasants) {
      add('population', 'Peasant Change (yesterday)',
        h.peasants.yesterday, pop.netPeasantChange - draft.drafted, 'state_yesterday',
        'Net change = births - drafted; engine birth rate varies +/-5%');
    }

    // =====================================================================
    // MILITARY
    // =====================================================================

    // Total army sanity check
    if (scraped.army != null) {
      const engineArmy = (state.soldiers || 0) + (state.offSpecs || 0)
        + (state.defSpecs || 0) + (state.elites || 0) + (state.thieves || 0);
      add('military', 'Total Army',
        scraped.army, engineArmy, 'military_page');
    }

    // OME / DME — these require offense/defense calculation
    // For now compare raw points if scraped
    if (scraped.offPoints != null) {
      const engineOff = this._calcOffensePoints(state);
      if (engineOff != null) {
        add('military', 'Offense Points',
          scraped.offPoints, engineOff, 'military_page',
          'Excludes generals, horses, honor, war doctrines');
      }
    }
    if (scraped.defPoints != null) {
      const engineDef = this._calcDefensePoints(state);
      if (engineDef != null) {
        add('military', 'Defense Points',
          scraped.defPoints, engineDef, 'military_page',
          'Excludes generals, horses, honor, war doctrines');
      }
    }
    if (scraped.ome != null && state.acres > 0) {
      const engineOff = this._calcOffensePoints(state);
      if (engineOff != null) {
        add('military', 'OME',
          scraped.ome, engineOff / state.acres, 'military_page');
      }
    }
    if (scraped.dme != null && state.acres > 0) {
      const engineDef = this._calcDefensePoints(state);
      if (engineDef != null) {
        add('military', 'DME',
          scraped.dme, engineDef / state.acres, 'military_page');
      }
    }

    // Training grounds effect from buildingEffects
    const tgTrainTime = this._parseBuildingEffectPct(scraped, 'trainingGrounds', /([\d.]+)% reduced train time/);
    if (tgTrainTime != null && calc.trainingTime) {
      // TG effect is a pct reduction; engine calculates tgMod = 1 - reduction/100
      const engineTgReduction = (1 - calc.trainingTime.tgMod) * 100;
      add('military', 'Training Grounds Time Reduction %',
        tgTrainTime, engineTgReduction, 'building_effects_text');
    }

    // Armouries wage reduction from buildingEffects
    const armWages = this._parseBuildingEffectPct(scraped, 'armouries', /([\d.]+)% lower military wages/);
    if (armWages != null) {
      add('military', 'Armouries Wage Reduction %',
        armWages, wages.armouriesBonus, 'building_effects_text');
    }

    // Armouries training cost reduction from buildingEffects
    const armTrainCost = this._parseBuildingEffectPct(scraped, 'armouries', /([\d.]+)% lower military training/);
    if (armTrainCost != null) {
      // Engine doesn't directly expose this as a standalone pct; it's in calcTrainingCost
      // Use calcPctBuildingEffect directly
      const be = income.beResult.be;
      const armTrainReduction = Engine.calcPctBuildingEffect(
        1.5, state.buildings.armouries || 0, state.acres, be
      );
      add('military', 'Armouries Training Cost Reduction %',
        armTrainCost, armTrainReduction, 'building_effects_text');
    }

    // Dungeons prisoner capacity
    const dungeonCap = this._parseBuildingEffectNumber(scraped, 'dungeons', /House ([\d,]+) prisoners/);
    if (dungeonCap != null) {
      const engineCap = (state.buildings.dungeons || 0) * 30;
      add('military', 'Dungeon Capacity',
        dungeonCap, engineCap, 'building_effects_text');
    }

    // =====================================================================
    // CONSTRUCTION
    // =====================================================================

    add('construction', 'Construction Time',
      scraped.constructionTime, buildTime.constructionTime, 'buildings_page');
    add('construction', 'Construction Cost',
      scraped.constructionCost, buildCost.constructionCost, 'buildings_page');
    add('construction', 'Raze Cost',
      scraped.razeCost, razeCost.razeCost, 'buildings_page');

    // Mills build cost reduction from buildingEffects
    const millsCost = this._parseBuildingEffectPct(scraped, 'mills', /building costs by ([\d.]+)%/);
    if (millsCost != null) {
      add('construction', 'Mills Build Cost Reduction %',
        millsCost, buildCost.millsPct, 'building_effects_text');
    }

    return result;
  },

  // ---------------------------------------------------------------------------
  // WARNINGS
  // ---------------------------------------------------------------------------

  _buildWarnings(scraped, state, calc) {
    const warnings = [];

    if (!scraped) {
      warnings.push('No scraped data available — comparisons will be empty');
      return warnings;
    }

    // Personality mismatch
    if (scraped.personality && state.personality) {
      const scrapedPersKey = scraped.personality;
      const statePersName = state.personality.name;
      const expectedPers = GAME_DATA.personalities[scrapedPersKey];
      if (expectedPers && expectedPers.name !== statePersName) {
        warnings.push(`Personality mismatch: scraped "${scrapedPersKey}" but state has "${statePersName}"`);
      }
    }
    if (!scraped.personality) {
      warnings.push('Personality not detected by scraper — may be using default. Verify manually.');
    }

    // Stale data
    if (scraped._pageTimestamps) {
      const now = Date.now();
      const staleThreshold = 60 * 60 * 1000; // 1 hour
      for (const [page, ts] of Object.entries(scraped._pageTimestamps)) {
        const age = now - ts;
        if (age > staleThreshold) {
          const mins = Math.round(age / 60000);
          warnings.push(`Stale data: ${page} page is ${mins} minutes old`);
        }
      }
    }

    // Missing pages
    const expectedPages = ['throne', 'state', 'military', 'buildings', 'science'];
    if (scraped._pageTimestamps) {
      for (const page of expectedPages) {
        if (!scraped._pageTimestamps[page]) {
          warnings.push(`Missing page data: ${page} — visit this page in-game for accurate comparisons`);
        }
      }
    }

    // Available Jobs mismatch (WIP buildings issue indicator)
    if (scraped.availableJobs != null && calc.income) {
      const jobsDelta = Math.abs(scraped.availableJobs - calc.income.beResult.totalJobs);
      if (jobsDelta > 0) {
        warnings.push(`Jobs mismatch (${jobsDelta}): may indicate WIP building count discrepancy`);
      }
    }

    // BE gradual adjustment warning
    if (scraped.buildingEfficiencyPct != null && calc.income) {
      const beAdjusted = calc.income.beResult.be
        / (calc.income.beResult.constructionDelaysMod || 1)
        / (calc.income.beResult.blizzardMod || 1);
      const beDelta = Math.abs(scraped.buildingEfficiencyPct - beAdjusted * 100);
      if (beDelta > 2) {
        warnings.push(`BE gap of ${beDelta.toFixed(1)}%: game BE adjusts gradually, not instantly`);
      }
    }

    return warnings;
  },

  // ---------------------------------------------------------------------------
  // STATE SERIALIZATION — full dump, no cherry-picking
  // ---------------------------------------------------------------------------

  _serializeState(state) {
    const s = {};
    // Copy all primitive and plain-object fields
    for (const [key, val] of Object.entries(state)) {
      if (key === 'race' || key === 'personality') {
        // Store name + mods for readability
        s[key] = { name: val.name, mods: val.mods };
        if (val.military) s[key].military = val.military;
      } else if (typeof val === 'function') {
        // skip
      } else {
        s[key] = val;
      }
    }
    return s;
  },

  // ---------------------------------------------------------------------------
  // BUILDING EFFECTS TEXT PARSERS
  // ---------------------------------------------------------------------------

  /**
   * Extract a number from a buildingEffects text string.
   * e.g. "Produce 1,131 bushels per day" → 1131
   */
  _parseBuildingEffectNumber(scraped, buildingKey, regex) {
    if (!scraped || !scraped.buildingEffects) return null;
    const text = scraped.buildingEffects[buildingKey];
    if (!text) return null;
    const match = text.match(regex);
    if (!match) return null;
    return parseInt(match[1].replace(/,/g, ''));
  },

  /**
   * Extract a percentage from a buildingEffects text string.
   * e.g. "20.97% higher birth rates" → 20.97
   */
  _parseBuildingEffectPct(scraped, buildingKey, regex) {
    if (!scraped || !scraped.buildingEffects) return null;
    const text = scraped.buildingEffects[buildingKey];
    if (!text) return null;
    const match = text.match(regex);
    if (!match) return null;
    return parseFloat(match[1]);
  },

  // ---------------------------------------------------------------------------
  // MILITARY POWER CALCULATIONS (simplified, for comparison only)
  // ---------------------------------------------------------------------------

  _calcOffensePoints(state) {
    const race = state.race;
    if (!race || !race.military) return null;
    const mil = race.military;
    const raceMod = race.mods.ome || 1;
    const persMod = state.personality.mods.ome || 1;

    let total = 0;
    // Soldiers: 3 offense each (no specs)
    total += (state.soldiers || 0) * 3;
    // Off specs
    total += (state.offSpecs || 0) * (mil.offSpec.off || 0);
    // Def specs
    total += (state.defSpecs || 0) * (mil.defSpec.off || 0);
    // Elites
    total += (state.elites || 0) * (mil.elites.off || 0);

    total *= raceMod * persMod;

    // Honor OME
    if (state.honor && state.honor.ome) total *= state.honor.ome;

    return Math.round(total);
  },

  _calcDefensePoints(state) {
    const race = state.race;
    if (!race || !race.military) return null;
    const mil = race.military;
    const raceMod = race.mods.dme || 1;
    const persMod = state.personality.mods.dme || 1;

    let total = 0;
    // Soldiers: 0 defense
    // Off specs
    total += (state.offSpecs || 0) * (mil.offSpec.def || 0);
    // Def specs
    total += (state.defSpecs || 0) * (mil.defSpec.def || 0);
    // Elites
    total += (state.elites || 0) * (mil.elites.def || 0);

    total *= raceMod * persMod;

    if (state.honor && state.honor.ome) total *= state.honor.ome;

    return Math.round(total);
  },

  // ---------------------------------------------------------------------------
  // FILENAME GENERATOR
  // ---------------------------------------------------------------------------

  generateFilename(report) {
    const name = (report.province && report.province.name) || 'unknown';
    const race = (report.province && report.province.race) || '';
    const now = new Date();
    const ts = now.getFullYear()
      + String(now.getMonth() + 1).padStart(2, '0')
      + String(now.getDate()).padStart(2, '0')
      + '_' + String(now.getHours()).padStart(2, '0')
      + String(now.getMinutes()).padStart(2, '0');
    const safeName = name.replace(/[^a-zA-Z0-9]/g, '_');
    return `debug_${safeName}_${race}_${ts}.json`;
  },
};
