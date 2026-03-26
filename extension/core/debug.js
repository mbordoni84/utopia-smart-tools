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
    const ome       = Engine.calcOME(state);
    const dme       = Engine.calcDME(state);
    const networth  = Engine.calcNetworth(state);

    let trainingTime = null;
    try { trainingTime = Engine.calcTrainingTime(state); } catch (e) { /* optional */ }

    const netIncome = income.modifiedIncome - wages.modifiedWages;

    // Build comparisons by category
    const comparisons = this._buildComparisons(scraped, state, {
      income, wages, food, runes, pop, draft, buildTime, buildCost, razeCost, trainingTime, ome, dme, networth
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
        ome, dme, networth,
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

    // Employment % — game shows "% of workers with jobs" (always 100% when workers < jobs)
    // Engine's pctJobs is "workers / optimalWorkers" (staffing efficiency for BE).
    // These are different metrics — not comparable. Stored for reference only.
    if (scraped.employment != null) {
      add('buildingEfficiency', 'Employment % (game metric)',
        scraped.employment, scraped.employment, 'buildings_page',
        'Game metric only — engine pctJobs (' + (income.beResult.pctJobs * 100).toFixed(1) + '%) measures staffing efficiency, not comparable');
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
        h.netFoodChange.yesterday, food.netFood, 'state_yesterday',
        'Gap normal: yesterday history vs current state; random food prod variation (±2% per tick)');
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

    // Homes birth flat from buildingEffects (value can be decimal, e.g. "72.9")
    const homesBirth = this._parseBuildingEffectPct(scraped, 'homes', /([\d,.]+) additional peasants/);
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

    // Note: "Peasant Change (yesterday)" comparison removed - unreliable because:
    // - Uses current state vs yesterday's data
    // - Birth rate has ±5% random variation in game
    // - Can't account for draft/desertion that happened yesterday
    // - Small maxPop errors cause overpop miscalculation
    // The netPeasantChange calculation is still used by simulators.

    // =====================================================================
    // MILITARY
    // =====================================================================

    // Networth (if available from scraper)
    if (scraped.networth != null && calc.networth) {
      add('military', 'Total Networth',
        scraped.networth, calc.networth.totalNW, 'throne_or_military_page',
        'Small gaps normal due to: unit NW calculation details, prisoner NW (enemy race), training units in-progress');
    }

    // Total army sanity check (game excludes thieves from "army" count)
    if (scraped.army != null) {
      const engineArmy = (state.soldiers || 0) + (state.offSpecs || 0)
        + (state.defSpecs || 0) + (state.elites || 0);
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
          'Game value = Raw Offense × OME. Engine matches this. Excludes: generals (+5% each), horses (+2 off)');
      }
    }
    if (scraped.defPoints != null) {
      const engineDef = this._calcDefensePoints(state);
      if (engineDef != null) {
        add('military', 'Defense Points',
          scraped.defPoints, engineDef, 'military_page',
          'Game value = Raw Defense × DME. Engine matches this. Excludes: generals, war doctrines, peasants defending');
      }
    }
    if (scraped.ome != null && calc.ome) {
      add('military', 'OME',
        scraped.ome, Math.round(calc.ome.ome), 'military_page');
    }
    if (scraped.dme != null && calc.dme) {
      add('military', 'DME',
        scraped.dme, Math.round(calc.dme.dme), 'military_page');
    }

    // Unit training time (if available)
    if (calc.trainingTime) {
      add('military', 'Elite Training Time (ticks)',
        calc.trainingTime.trainingTime, calc.trainingTime.trainingTime, 'calculated',
        'Calculated from base time (24) * race * pers * Inspire * Valor * TG * ritual');
    }

    // Training grounds effect from buildingEffects
    const tgTrainTime = this._parseBuildingEffectPct(scraped, 'trainingGrounds', /([\d.]+)% reduced train time/);
    if (tgTrainTime != null && calc.trainingTime) {
      // TG effect is a pct reduction; engine calculates tgMod = 1 - reduction/100
      const engineTgReduction = (1 - calc.trainingTime.tgMod) * 100;
      add('military', 'Training Grounds Time Reduction %',
        tgTrainTime, engineTgReduction, 'building_effects_text');
    }

    // Training Grounds OME bonus (building effect)
    const tgOME = this._parseBuildingEffectPct(scraped, 'trainingGrounds', /([\d.]+)% higher offensive efficiency/);
    if (tgOME != null && calc.ome) {
      // TG is multiplicative
      add('military', 'Training Grounds OME Bonus %',
        tgOME, calc.ome.tgPct, 'building_effects_text',
        'Multiplicative with Base ME (wiki incorrectly shows additive)');
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

    // Total completed buildings (sanity check for networth)
    if (scraped.buildings && calc.networth) {
      let scrapedTotal = 0;
      for (const [key, count] of Object.entries(scraped.buildings)) {
        if (key !== 'barrenLand' && key !== 'buildingsInProgress') {
          scrapedTotal += count || 0;
        }
      }
      add('construction', 'Total Completed Buildings',
        scrapedTotal, calc.networth.completedBuildings || 0, 'buildings_page',
        'Sum of all building types (excludes barren, excludes WIP)');
    }

    // WIP buildings count
    if (state.buildings && state.buildings.buildingsInProgress != null) {
      add('construction', 'Total WIP Buildings',
        state.buildings.buildingsInProgress, state.buildings.buildingsInProgress, 'buildings_page',
        'Sum of all inConstruction values; affects networth (+50 NW per WIP)');
    }

    // Mills build cost reduction from buildingEffects
    const millsCost = this._parseBuildingEffectPct(scraped, 'mills', /building costs by ([\d.]+)%/);
    if (millsCost != null) {
      add('construction', 'Mills Build Cost Reduction %',
        millsCost, buildCost.millsPct, 'building_effects_text');
    }

    // Free building credits
    if (scraped.freeBuildingCredits != null) {
      add('construction', 'Free Building Credits',
        scraped.freeBuildingCredits, scraped.freeBuildingCredits, 'buildings_page',
        'Not calculated by engine; scraped value only');
    }

    // =====================================================================
    // RESOURCES & STATE
    // =====================================================================

    // Current resources (sanity checks)
    add('economy', 'Gold',
      scraped.gold, state.gold, 'throne_page',
      'Direct state comparison — no calculation');
    add('food', 'Food',
      scraped.food, state.food, 'throne_page',
      'Direct state comparison — no calculation');
    add('runes', 'Runes',
      scraped.runes, state.runes, 'throne_page',
      'Direct state comparison — no calculation');

    // Books (science)
    if (scraped.books != null && state.books != null) {
      add('economy', 'Science Books',
        scraped.books, state.books, 'science_page',
        'Total science books across all sciences');
    }

    // Trade Balance
    if (scraped.tradeBalance != null) {
      add('economy', 'Trade Balance',
        scraped.tradeBalance, scraped.tradeBalance, 'throne_page',
        'Not calculated by engine; scraped value only');
    }

    // =====================================================================
    // SCIENCES (sanity checks)
    // =====================================================================

    if (scraped.sciences) {
      const sci = scraped.sciences;
      // Key sciences that affect formulas
      if (sci.alchemy != null) {
        add('economy', 'Alchemy Science %',
          Math.abs(sci.alchemy), state.sciAlchemy, 'science_page',
          'Affects income multiplier');
      }
      if (sci.production != null) {
        add('food', 'Production Science %',
          Math.abs(sci.production), state.sciProduction, 'science_page',
          'Affects food and rune production');
      }
      if (sci.tools != null) {
        add('buildingEfficiency', 'Tools Science %',
          Math.abs(sci.tools), state.sciTools, 'science_page',
          'Affects Building Efficiency');
      }
      if (sci.tactics != null) {
        add('military', 'Tactics Science %',
          Math.abs(sci.tactics), state.sciTactics, 'science_page',
          'Multiplies OME');
      }
      if (sci.strategy != null) {
        add('military', 'Strategy Science %',
          Math.abs(sci.strategy), state.sciStrategy, 'science_page',
          'Multiplies DME');
      }
    }

    // =====================================================================
    // BASE ME & EFFECTIVE WAGE RATE (future debugging)
    // =====================================================================

    // Multi-Attack Protection bonus
    if (scraped.multiAttackProtection && calc.ome && calc.ome.baseMEResult) {
      const mapBonus = calc.ome.baseMEResult.mapBonus * 100;
      add('military', 'MAP Bonus %',
        mapBonus, mapBonus, 'military_page',
        `MAP level: "${scraped.multiAttackProtection}" → +${mapBonus.toFixed(1)}% Base ME`);
    }

    // Base Military Efficiency comparison
    if (scraped.baseMilitaryEfficiency != null && calc.ome && calc.ome.baseMEResult) {
      add('military', 'Base ME (scraped)',
        scraped.baseMilitaryEfficiency, calc.ome.baseMEResult.scrapedBaseME, 'military_page',
        'Scraped from "military is functioning at X% efficiency" text');
    }

    // Effective Wage Rate (only shown when Base ME is available)
    if (scraped.baseMilitaryEfficiency != null && calc.ome && calc.ome.baseMEResult && calc.ome.baseMEResult.effectiveWageRate != null) {
      // Compare effective vs set wage rate
      const effectiveWR = calc.ome.baseMEResult.effectiveWageRate;
      const setWR = scraped.wageRate || 100;
      add('military', 'Set Wage Rate',
        setWR, setWR, 'military_page',
        'User-configured wage rate (instant change)');
      add('military', 'Effective Wage Rate',
        effectiveWR, effectiveWR, 'calculated',
        'Reverse-engineered from Base ME; converges slowly over ~96 ticks (5% of gap per tick)');
    }

    // War Horses
    if (scraped.warHorses != null && state.horses != null) {
      add('military', 'War Horses',
        scraped.warHorses, state.horses, 'military_page',
        'Used in battle calculations (+2 offense per horse)');
    }

    // =====================================================================
    // EOWCF DEBUG INFO
    // =====================================================================

    if (scraped.eowcfActive) {
      const eowcfElapsed = scraped.eowcfTicksElapsed || 0;
      const eowcfRemaining = 97 - eowcfElapsed;
      add('population', 'EOWCF Ticks Elapsed',
        eowcfElapsed, state.eowcfTicksElapsed || 0, 'calculated',
        'Ticks since EOWCF started (x10 birth boost lasts 24 ticks)');
      add('population', 'EOWCF Ticks Remaining',
        eowcfRemaining, eowcfRemaining, 'calculated',
        'EOWCF fixed duration: 97 ticks total');

      // Birth boost active indicator
      const boostActive = eowcfElapsed < 24;
      add('population', 'EOWCF x10 Boost Active',
        boostActive ? 1 : 0, (pop.eowcfBoostActive ? 1 : 0), 'calculated',
        'x10 birth boost active for first 24 ticks only (minimum 500/tick)');
    }

    // =====================================================================
    // HONOR TITLE & EFFECTS
    // =====================================================================

    if (scraped.honorTitle && state.honor && state.honor.titleName) {
      add('military', 'Honor Title',
        0, 0, 'throne_page',
        `Game: "${scraped.honorTitle}" | Engine: "${state.honor.titleName}"`);
    }

    // Honor multipliers (for War Hero personality debugging)
    if (state.honor) {
      const persName = state.personality.name;
      const honorMult = state.personality.mods.honorEffects || 1;
      if (honorMult !== 1) {
        add('military', 'Personality Honor Multiplier',
          honorMult, honorMult, 'calculated',
          `${persName}: ${honorMult}x honor effects`);
      }
    }

    // =====================================================================
    // ACTIVE SPELLS (info only, no comparison)
    // =====================================================================

    if (scraped.activeSpells && Object.keys(scraped.activeSpells).length > 0) {
      const spellNames = Object.keys(scraped.activeSpells).join(', ');
      add('economy', 'Active Spells Count',
        Object.keys(scraped.activeSpells).length,
        Object.keys(scraped.activeSpells).length,
        'throne_page',
        `Spells: ${spellNames}`);
    }

    // =====================================================================
    // RITUAL & DRAGON
    // =====================================================================

    if (scraped.ritual && scraped.ritual !== 'none') {
      add('economy', 'Ritual Active',
        1, 1, 'throne_page',
        `${scraped.ritual} at ${scraped.ritualEffectiveness || 100}% effectiveness`);
    }

    if (scraped.dragon && scraped.dragon !== 'none') {
      add('military', 'Dragon Active',
        1, 1, 'throne_page',
        `${scraped.dragon} dragon (affects wages, BE, birth, or ME depending on type)`);
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

    // War Hero personality gives +2 bonus to off spec strength
    const offSpecBonus = state.personality.mods.offSpecStrengthBonus || 0;

    // Calculate Raw Offense (base unit strengths, no modifiers)
    let raw = 0;
    // Soldiers: 3 offense each
    raw += (state.soldiers || 0) * 3;
    // Off specs (include War Hero bonus)
    raw += (state.offSpecs || 0) * ((mil.offSpec.off || 0) + offSpecBonus);
    // Def specs (typically 0 offense)
    raw += (state.defSpecs || 0) * (mil.defSpec.off || 0);
    // Elites
    raw += (state.elites || 0) * (mil.elites.off || 0);

    // Game's "Offense Points" = Raw × OME (already includes race, pers, honor, TG, tactics, etc.)
    // We need to calculate OME to match game display
    const omeResult = Engine.calcOME(state);
    const ome = omeResult.ome / 100; // Convert percentage to multiplier

    return Math.round(raw * ome);
  },

  _calcDefensePoints(state) {
    const race = state.race;
    if (!race || !race.military) return null;
    const mil = race.military;

    // Calculate Raw Defense (base unit strengths, no modifiers)
    let raw = 0;
    // Soldiers: defense value varies by race (0 for Orc, 1 for others typically)
    raw += (state.soldiers || 0) * (mil.soldiers.def || 0);
    // Off specs (typically 0 defense)
    raw += (state.offSpecs || 0) * (mil.offSpec.def || 0);
    // Def specs
    raw += (state.defSpecs || 0) * (mil.defSpec.def || 0);
    // Elites
    raw += (state.elites || 0) * (mil.elites.def || 0);

    // Game's "Defense Points" = Raw × DME (already includes race, pers, forts, strategy, etc.)
    // NOTE: DME does NOT include honor (per wiki)
    const dmeResult = Engine.calcDME(state);
    const dme = dmeResult.dme / 100; // Convert percentage to multiplier

    return Math.round(raw * dme);
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
