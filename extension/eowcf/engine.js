// =============================================================================
// EOWCF Simulation Engine
// =============================================================================
// Contains all game formulas for the EOWCF planner.
// Formulas are sourced from the Utopia wiki (utopia_wiki.md) and verified
// against real in-game data. Each formula includes a wiki reference and notes.
//
// Key wiki sections:
//   - Economy/Income: wiki lines 3325-3345
//   - Building Efficiency: wiki lines 2579-2615
//   - Building Effects: wiki lines 2605-2615
//   - Population: wiki lines 3349-3384
//   - Food: wiki lines 2627-2658
//
// EOWCF-specific rules (from Relations wiki section):
//   - No plague, no riots, no dragon => those multipliers are 1.0
//   - BE restored to 100% at EOWCF start
//   - War relations still active => some mana/stealth costs differ
// =============================================================================

const Engine = {

  // ---------------------------------------------------------------------------
  // BUILDING EFFECTS
  // ---------------------------------------------------------------------------
  // Wiki: "Building Effects" section (lines 2605-2615)
  //
  // Percentage-based buildings use a diminishing-returns formula.
  // The "% of building" is what fraction of your land is that building.
  // The formula caps the effective percentage at 50%, meaning building more
  // than 50% of your land as one type gives no additional benefit.
  //
  // Formula:
  //   effect = baseEffect * BE * effective% * (100 - effective%) / 100
  //   where effective% = MIN(50, (numBuildings/acres)*100 * (1+race)*(1+pers))
  //
  // Returns the bonus as a percentage number (e.g. 24.0 means +24% bonus)
  // ---------------------------------------------------------------------------
  calcPctBuildingEffect(baseEffect, numBuildings, totalAcres, be, raceMod = 0, persMod = 0) {
    if (numBuildings <= 0 || totalAcres <= 0) return 0;

    // What fraction of land is this building (in percent, 0-100)
    const pctBuilding = (numBuildings / totalAcres) * 100;

    // Some races/personalities get bonus effectiveness for specific buildings
    // (e.g. Heretic/Mystic get guild land effect bonuses).
    // raceMod/persMod are additive bonuses to the building's land percentage.
    const effective = Math.min(50, pctBuilding * (1 + raceMod) * (1 + persMod));

    // Diminishing returns: effect = base * BE * x * (100-x) / 100
    // At x=50 (max), gives base * BE * 50 * 50 / 100 = base * BE * 25
    // Which matches the wiki's "max effect = 25 * base effect" rule.
    return baseEffect * be * effective * (100 - effective) / 100;
  },

  // ---------------------------------------------------------------------------
  // FLAT RATE BUILDING EFFECT
  // ---------------------------------------------------------------------------
  // Wiki: "Building Effects" section (lines 2605-2615)
  //
  // Formula:
  //   Flat Rate = Base Effect * Num Buildings * (1+Race) * (1+Pers) * BE
  //
  // Examples: Banks produce 25gc/tick, Farms produce 60 bushels/tick,
  //           Towers produce 12 runes/tick.
  //
  // Note: Some flat-rate buildings are NOT affected by BE (e.g. Guilds, Homes).
  //       Caller must handle this by passing be=1 for those buildings.
  //
  // raceMod/persMod: additional multiplier for the building type.
  //   - Artisan personality: +30% flat rate production (persMod = 0.30)
  // ---------------------------------------------------------------------------
  calcFlatBuildingEffect(baseEffect, numBuildings, be, raceMod = 0, persMod = 0) {
    return baseEffect * numBuildings * (1 + raceMod) * (1 + persMod) * be;
  },

  // ---------------------------------------------------------------------------
  // BUILDING EFFICIENCY (BE)
  // ---------------------------------------------------------------------------
  // Wiki: "Building Efficiency" section (lines 2579-2604)
  //
  // Available Workers = Peasants + ROUNDDOWN(Prisoners / 2)
  // Optimal Workers   = ROUNDDOWN(Total Jobs * 0.67)
  // % Jobs Performed  = MIN(Available Workers / Optimal Workers, 1)
  // BE = (0.5 * (1 + %Jobs)) * Race * Tools Science * Dragon * Blizzard
  //
  // In EOWCF: no dragon, no blizzard => those multipliers are 1.0
  // BE is restored to 100% at EOWCF start.
  //
  // Race modifiers:
  //   - Dwarf: 1.25 (stored as race.mods.buildingEfficiency)
  //   - Faery: 0.90
  //   - All others: 1.0
  //
  // Ritual modifiers: read from GAME_DATA.rituals (e.g. Expedient: +20% BE)
  //
  // Note: In the real game, BE changes gradually (not instantly).
  //       For EOWCF planning, we assume instant BE since it resets to 100%.
  // ---------------------------------------------------------------------------
  calcBE(state) {
    const totalJobs = this.calcTotalJobs(state);

    // Prisoners count as half a worker for job purposes
    const availableWorkers = state.peasants + Math.floor(state.prisoners / 2);

    // You only need 67% of total jobs filled for max efficiency
    // Ghost Workers spell: -25% jobs required (0.67 * 0.75 = 0.5025)
    const ghostWorkersMod = state.spellGhostWorkers ? 0.75 : 1;
    const optimalWorkers = Math.floor(totalJobs * 0.67 * ghostWorkersMod);

    // If no jobs exist, consider all jobs filled (prevents division by zero)
    const pctJobs = optimalWorkers > 0 ? Math.min(availableWorkers / optimalWorkers, 1) : 1;

    // Base BE formula: ranges from 50% (no workers) to 100% (fully staffed)
    const raceBE = state.race.mods.buildingEfficiency;
    const persBE = state.personality.mods.buildingEfficiency || 1;
    const toolsSci = 1 + (state.sciTools / 100); // Tools science increases BE

    let be = (0.5 * (1 + pctJobs)) * raceBE * persBE * toolsSci;

    // Ritual BE bonus (e.g. Expedient: +20% BE), scaled by effectiveness
    let ritualBEMod = 1;
    const ritualData = GAME_DATA.rituals[state.ritual];
    if (ritualData && ritualData.effects.buildingEfficiency) {
      ritualBEMod = 1 + ritualData.effects.buildingEfficiency * (state.ritualEffectiveness || 1);
      be *= ritualBEMod;
    }

    // Dragon BE modifier (e.g. Topaz: -30% BE)
    let dragonBEMod = 1;
    const dragonData = GAME_DATA.dragons[state.dragon];
    if (dragonData && dragonData.effects && dragonData.effects.buildingEfficiency) {
      dragonBEMod = 1 + dragonData.effects.buildingEfficiency;
      be *= dragonBEMod;
    }

    // Blizzard: -10% BE. Construction Delays: -10% BE.
    const blizzardMod = state.spellBlizzard ? 0.90 : 1;
    const constructionDelaysMod = state.spellConstructionDelays ? 0.90 : 1;
    be *= blizzardMod * constructionDelaysMod;

    return {
      be: Math.min(be, 1.5), // Practical cap to avoid unrealistic values
      availableWorkers,
      optimalWorkers,
      pctJobs,
      totalJobs,
      raceBE,
      toolsSci,
      ritualBEMod,
      dragonBEMod,
      ghostWorkersMod
    };
  },

  // ---------------------------------------------------------------------------
  // TOTAL JOBS
  // ---------------------------------------------------------------------------
  // Each building type has a fixed number of jobs (usually 25, Homes have 0).
  // Total jobs = sum of (building count * jobs per building) for all types.
  // ---------------------------------------------------------------------------
  calcTotalJobs(state) {
    let jobs = 0;
    for (const [key, count] of Object.entries(state.buildings)) {
      const bldData = GAME_DATA.buildings[key];
      if (bldData && bldData.jobs) {
        jobs += bldData.jobs * count;
      }
    }
    return jobs;
  },

  // ---------------------------------------------------------------------------
  // CONSTRUCTION TIME
  // ---------------------------------------------------------------------------
  // Wiki: lines 2713-2724
  //
  // Construction Time = 16 * Race * Personality * Builders Boon * Ritual *
  //                     Artisan Science * Dragon
  //
  // Rounding: .5 rounds up, below .5 rounds down (standard Math.round)
  // ---------------------------------------------------------------------------
  calcConstructionTime(state) {
    const base = 16;
    const raceMod = state.race.mods.buildTime || 1;
    const persMod = state.personality.mods.buildTime || 1;
    const buildersBoon = state.spellBuildBoon ? 0.75 : 1;

    // Ritual: Expedient -25% time, Haste -25% time (scaled by effectiveness)
    let ritualMod = 1;
    const ritualData = GAME_DATA.rituals[state.ritual];
    if (ritualData && ritualData.effects.constructionTime) {
      ritualMod = 1 + ritualData.effects.constructionTime * (state.ritualEffectiveness || 1);
    }

    // Artisan science reduces construction time
    const artisanSci = 1 - (state.sciArtisan / 100);

    // Celestite Dragon: +50% build cost and time
    let dragonMod = 1;
    const dragonData = GAME_DATA.dragons[state.dragon];
    if (dragonData && dragonData.effects && dragonData.effects.buildCostTime) {
      dragonMod = 1 + dragonData.effects.buildCostTime;
    }

    const rawTime = base * raceMod * persMod * buildersBoon * ritualMod * artisanSci * dragonMod;
    const constructionTime = Math.round(rawTime);

    return {
      base,
      raceMod,
      persMod,
      buildersBoon,
      ritualMod,
      artisanSci,
      dragonMod,
      rawTime,
      constructionTime
    };
  },

  // ---------------------------------------------------------------------------
  // CONSTRUCTION COST
  // ---------------------------------------------------------------------------
  // Wiki: lines 2726-2733
  //
  // Construction Cost = 0.05 * (land + 10000) * Race * Personality * Mills *
  //                     Ritual * Artisan Science * Dragon
  // ---------------------------------------------------------------------------
  calcConstructionCost(state) {
    const acres = state.acres;
    const baseCost = 0.05 * (acres + 10000);
    const raceMod = state.race.mods.buildCost || 1;
    const persMod = state.personality.mods.buildCost || 1;

    // Mills percentage-based reduction (uses same diminishing returns formula)
    const beResult = this.calcBE(state);
    const mills = state.buildings.mills || 0;
    const millsPct = this.calcPctBuildingEffect(
      GAME_DATA.buildings.mills.pctEffect[0].base, // base: 4
      mills, acres, beResult.be
    );
    const millsMod = 1 - (millsPct / 100);

    // Ritual: Expedient -25% cost (scaled by effectiveness)
    let ritualMod = 1;
    const ritualData = GAME_DATA.rituals[state.ritual];
    if (ritualData && ritualData.effects.constructionCost) {
      ritualMod = 1 + ritualData.effects.constructionCost * (state.ritualEffectiveness || 1);
    }

    // Artisan science reduces construction cost
    const artisanSci = 1 - (state.sciArtisan / 100);

    // Celestite Dragon: +50% build cost and time
    let dragonMod = 1;
    const dragonData = GAME_DATA.dragons[state.dragon];
    if (dragonData && dragonData.effects && dragonData.effects.buildCostTime) {
      dragonMod = 1 + dragonData.effects.buildCostTime;
    }

    const constructionCost = Math.round(baseCost * raceMod * persMod * millsMod * ritualMod * artisanSci * dragonMod);

    return {
      acres,
      baseCost,
      raceMod,
      persMod,
      millsPct,
      millsMod,
      ritualMod,
      artisanSci,
      dragonMod,
      constructionCost
    };
  },

  // ---------------------------------------------------------------------------
  // RAZE COST
  // ---------------------------------------------------------------------------
  // Wiki: line 2736
  //
  // Raze Cost = (300 + 0.05 * land) * Artisan Science * Race * Personality
  // ---------------------------------------------------------------------------
  calcRazeCost(state) {
    const acres = state.acres;
    const baseCost = 300 + (0.05 * acres);
    const raceMod = state.race.mods.buildCost || 1;
    const persMod = state.personality.mods.buildCost || 1;
    const artisanSci = 1 - (state.sciArtisan / 100);
    const razeCost = Math.round(baseCost * artisanSci * raceMod * persMod);

    return {
      acres,
      baseCost,
      raceMod,
      persMod,
      artisanSci,
      razeCost
    };
  },

  // ---------------------------------------------------------------------------
  // INCOME PER TICK
  // ---------------------------------------------------------------------------
  // Wiki: Economy section (lines 3330-3337)
  //
  // Raw Income = (3 * Employed Peasants)
  //            + (1 * Unemployed Peasants)
  //            + (0.75 * Prisoners)
  //            + Racial Gold Generation       (currently no race has this)
  //            + (Banks * 25 * BE)             (flat rate bank income)
  //            + Miner's Mystique             (+0.3gc per peasant if active)
  //
  // Modified Income = Raw Income
  //                 * Bank % Bonus            (pct-based building effect)
  //                 * Alchemy Science          (income science)
  //                 * Honor Income Mod
  //                 * Race Mod                 (currently all 1.0)
  //                 * Personality Mod          (currently all 1.0)
  //                 * Plague                   (1.0 in EOWCF - no plague)
  //                 * Riots                    (1.0 in EOWCF - no riots)
  //                 * Dragon                   (1.0 in EOWCF - no dragon)
  //                 * Ritual                   (no ritual directly boosts income)
  //
  // Employment logic:
  //   Employed Peasants = MIN(Peasants, Total Jobs from buildings)
  //   Unemployed Peasants = Peasants - Employed Peasants
  //   Employed earn 3gc/tick, Unemployed earn 1gc/tick.
  //   Prisoners are separate at 0.75gc each (not competing for jobs).
  //
  // Human racial bonus: Prisoners generate +2.0gc extra per tick each.
  //
  // Miner's Mystique spell: Each peasant generates +0.3gc per tick.
  //   (Wiki spell table, line 5674)
  // ---------------------------------------------------------------------------
  calcIncome(state) {
    const beResult = this.calcBE(state);
    const be = beResult.be;
    const totalJobs = beResult.totalJobs;

    // --- Employed vs Unemployed peasants ---
    // Wiki line 3404: Employed Peasants = MIN(Peasants, Available Jobs - ROUNDDOWN(Prisoners / 2))
    // Prisoners occupy jobs but don't count as peasants for income purposes.
    // So available jobs for peasants = totalJobs minus prisoner-filled jobs.
    const prisonerJobs = Math.floor(state.prisoners / 2);
    const jobsForPeasants = Math.max(0, totalJobs - prisonerJobs);
    const employed = Math.min(state.peasants, jobsForPeasants);
    const unemployed = state.peasants - employed;

    // Tax income: employed earn 3gc, unemployed earn 1gc
    const taxIncome = (3 * employed) + (1 * unemployed);

    // --- Prisoner income ---
    // Base: 0.75gc per prisoner per tick
    // Human racial bonus: +2.0gc per prisoner (wiki line 352)
    let prisonerRate = 0.75;
    if (state.race === GAME_DATA.races.human) {
      prisonerRate += 2.0;
    }
    const prisonerIncome = prisonerRate * state.prisoners;

    // --- Bank flat rate income ---
    // Each bank produces 25gc/tick, affected by BE.
    // Artisan personality: +30% flat rate production (persMod = 0.30)
    const persFlatMod = state.personality.mods.flatRateProduction
      ? (state.personality.mods.flatRateProduction - 1) : 0;
    const bankFlatIncome = this.calcFlatBuildingEffect(
      25, state.buildings.banks || 0, be, 0, persFlatMod
    );

    // --- Miner's Mystique ---
    // Spell adds +0.3gc per peasant per tick (wiki spell table line 5674)
    const minersMystique = state.spellMinersM ? (0.3 * state.peasants) : 0;

    // --- Sum raw income ---
    // Note: "Racial Gold Generation" exists in the wiki formula but no current
    // Age 114 race has this bonus. If a future age adds it, add here.
    const rawIncome = taxIncome + prisonerIncome + bankFlatIncome + minersMystique;

    // --- Bank percentage bonus ---
    // Banks have a pct-based effect: +1.5% income per % of land, max 37.5%
    // (wiki building table: base 1.5, max 37.5)
    const bankPctBonus = this.calcPctBuildingEffect(
      1.5, state.buildings.banks || 0, state.acres, be
    );

    // --- Alchemy science ---
    // Increases income by the science percentage
    const alchemySci = 1 + (state.sciAlchemy / 100);

    // --- Honor income modifier ---
    // From honor title lookup (already includes War Hero bonus if applicable)
    const honorMod = (state.honor && state.honor.income) || 1;

    // --- Race & Personality income mods ---
    const raceMod = state.race.mods.income || 1;
    const persMod = state.personality.mods.income || 1;

    // --- Dragon income modifier (e.g. Topaz: -25% income) ---
    let dragonIncomeMod = 1;
    const dragonData = GAME_DATA.dragons[state.dragon];
    if (dragonData && dragonData.effects && dragonData.effects.income) {
      dragonIncomeMod = 1 + dragonData.effects.income;
    }

    // Riots spell: -10% Income
    const riotsMod = state.spellRiots ? 0.90 : 1;

    // --- Modified (final) income ---
    const modifiedIncome = rawIncome
      * (1 + bankPctBonus / 100)  // Bank % is an additive bonus (e.g. 24% => 1.24x)
      * alchemySci
      * honorMod
      * raceMod
      * persMod
      * dragonIncomeMod
      * riotsMod;

    return {
      beResult,
      employed,
      unemployed,
      taxIncome,
      prisonerIncome,
      bankFlatIncome,
      minersMystique,
      rawIncome,
      bankPctBonus,
      alchemySci,
      honorMod,
      raceMod,
      persMod,
      dragonIncomeMod,
      modifiedIncome
    };
  },

  // ---------------------------------------------------------------------------
  // MILITARY WAGES PER TICK
  // ---------------------------------------------------------------------------
  // Wiki: Economy section (line 3341)
  //
  // Military Expenses = ((DefSpecs + OffSpecs) * 0.5 + Elites * 0.75)
  //                   * Wage Rate
  //                   * Armouries Bonus
  //                   * Race Mod
  //                   * Personality Mod
  //                   * max(Inspire Army, Hero's Inspiration)  (1.0 in EOWCF)
  //                   * Greed                                  (1.0 in EOWCF)
  //                   * Ritual
  //                   * Dragon                                 (1.0 in EOWCF)
  //                   * Bookkeeping Science
  //
  // Notes:
  //   - Basic soldiers do NOT cost wages (wiki line 3345)
  //   - Thieves and Wizards do NOT cost wages
  //   - Wage Rate is player-set: 0% to 200% (default 100%)
  //   - Armouries reduce wages (pct-based, base 2%, max 50%)
  //   - Bookkeeping science reduces wages (applied as cost reduction)
  //   - Expedient ritual: -25% military wages
  //   - Faery race: +15% military wages (race.mods.wages = 1.15)
  // ---------------------------------------------------------------------------
  calcWages(state) {
    const beResult = this.calcBE(state);
    const be = beResult.be;

    // Specialists and elites cost wages
    const specCount = (state.offSpecs || 0) + (state.defSpecs || 0);
    const eliteCount = state.elites || 0;
    // Note: units in training do NOT pay wages (verified against game data)

    // Base wages before modifiers
    const baseWages = (specCount * 0.5) + (eliteCount * 0.75);

    // Player-set wage rate (0-200%, default 100%)
    const wageRate = (state.wageRate || 100) / 100;

    // Armouries wage reduction (pct-based building effect)
    // Base 2% per % of land, max 50% reduction (wiki building table)
    const armouriesBonus = this.calcPctBuildingEffect(
      2, state.buildings.armouries || 0, state.acres, be
    );

    // Bookkeeping science: reduces wages
    // Applied as a cost reduction (1 - bonus/100)
    const bookkeepingSci = 1 - (state.sciBookkeeping / 100);

    // Race/Personality wage modifiers
    // Faery: 1.15 (wages = 1.15), all others: 1.0
    const raceWageMod = state.race.mods.wages || 1;
    const persWageMod = state.personality.mods.wages || 1;

    // Ritual wage modifier (e.g. Expedient: -25% wages), scaled by effectiveness
    let ritualMod = 1;
    const ritualData = GAME_DATA.rituals[state.ritual];
    if (ritualData && ritualData.effects.wages) {
      ritualMod = 1 + ritualData.effects.wages * (state.ritualEffectiveness || 1);
    }

    // Dragon wage modifier (e.g. Ruby: +30% wages)
    let dragonWageMod = 1;
    const dragonData = GAME_DATA.dragons[state.dragon];
    if (dragonData && dragonData.effects && dragonData.effects.wages) {
      dragonWageMod = 1 + dragonData.effects.wages;
    }

    // Spell wage modifier: Inspire Army (-15%) or Hero's Inspiration (-30%)
    // These are mutually exclusive — use the stronger if both somehow active
    let spellWageMod = 1;
    if (state.spellHerosInspiration) {
      spellWageMod = 0.70;
    } else if (state.spellInspireArmy) {
      spellWageMod = 0.85;
    }

    // Greed spell: +25% Military Wages and Draft Costs
    const greedMod = state.spellGreed ? 1.25 : 1;

    // Final wages calculation
    const modifiedWages = baseWages
      * wageRate
      * (1 - armouriesBonus / 100)  // Armouries reduce wages
      * bookkeepingSci
      * raceWageMod
      * persWageMod
      * ritualMod
      * dragonWageMod
      * spellWageMod
      * greedMod;

    return {
      specCount,
      eliteCount,
      baseWages,
      armouriesBonus,
      bookkeepingSci,
      raceWageMod,
      persWageMod,
      ritualMod,
      dragonWageMod,
      spellWageMod,
      modifiedWages
    };
  },

  // ---------------------------------------------------------------------------
  // FOOD PRODUCTION PER TICK
  // ---------------------------------------------------------------------------
  // Wiki: Bushels section (lines 3130-3161)
  //
  // Base Food = (Farms * 60 * BE) + (Barren Land * 2) + (Race * Acres) + (Pers * Acres)
  // Modified  = Base * Production Science * Fertile Lands * Honor Food
  // Consumed  = Total Pop * 0.25 * Race foodConsumption
  // Decay     = Food Stock * 0.01 per tick
  //
  // In EOWCF: no drought, no gluttony
  // Barren Land food is NOT affected by BE (wiki line 2827)
  // ---------------------------------------------------------------------------
  calcFood(state) {
    const beResult = this.calcBE(state);
    const be = beResult.be;

    const farms = state.buildings.farms || 0;
    const barrenLand = state.buildings.barrenLand || 0;

    // Artisan personality: flatRateProduction affects flat-rate buildings
    const persFlatMod = state.personality.mods.flatRateProduction
      ? (state.personality.mods.flatRateProduction - 1) : 0;

    // Farm production: 60 bushels/tick * BE * personality flat rate mod
    const farmFood = this.calcFlatBuildingEffect(60, farms, be, 0, persFlatMod);

    // Barren land: 2 bushels/tick per barren acre (NOT affected by BE)
    const barrenFood = barrenLand * 2;

    // Race/Personality per-acre food bonus (e.g. some races produce food per acre)
    const raceFoodPerAcre = state.race.mods.foodProdPerAcre || 0;
    const persFoodPerAcre = state.personality.mods.foodProdPerAcre || 0;
    const acreFood = (raceFoodPerAcre + persFoodPerAcre) * state.acres;

    const baseFoodProduction = farmFood + barrenFood + acreFood;

    // Production science: increases food & rune production
    const prodSci = 1 + (state.sciProduction / 100);

    // Fertile Lands spell: +25% food production
    const fertileMod = state.spellFertileLands ? 1.25 : 1;

    // Drought spell: -25% food production
    const droughtMod = state.spellDrought ? 0.75 : 1;

    // Honor food modifier
    const honorFoodMod = (state.honor && state.honor.food) || 1;

    const modifiedFoodProduction = baseFoodProduction * prodSci * fertileMod * droughtMod * honorFoodMod;

    // --- Food Consumed ---
    // Current Population = all military + peasants + in-training units
    // Prisoners do NOT count toward population (wiki: "Prisoners do not add to the population")
    const inT = state.inTraining || {};
    const totalPop = state.peasants + state.soldiers + state.offSpecs
      + state.defSpecs + state.elites + state.thieves + state.wizards
      + (inT.offSpecs || 0) + (inT.defSpecs || 0) + (inT.elites || 0)
      + (inT.thieves || 0);
    const raceFoodMod = state.race.mods.foodConsumption;
    const gluttonyMod = state.spellGluttony ? 1.25 : 1;
    const foodConsumed = totalPop * 0.25 * raceFoodMod * gluttonyMod;

    // --- Food Decay ---
    // 1% of stored food decays each tick
    const foodDecay = state.food * 0.01;

    // --- Net food per tick ---
    const netFood = modifiedFoodProduction - foodConsumed - foodDecay;

    return {
      beResult,
      farmFood,
      barrenFood,
      acreFood,
      baseFoodProduction,
      prodSci,
      fertileMod,
      honorFoodMod,
      modifiedFoodProduction,
      totalPop,
      raceFoodMod,
      foodConsumed,
      foodDecay,
      netFood
    };
  },

  // ---------------------------------------------------------------------------
  // RUNE PRODUCTION PER TICK
  // ---------------------------------------------------------------------------
  // Wiki: Rune Generation (line 3896)
  //
  // Runes = ((Towers * 12 * BE) + (Land * Land Rune Gen)) * Prod Science * Honor Runes
  // Decay = Rune Stock * 0.012 per tick
  //
  // In EOWCF: no ritual rune mod (none of the current rituals affect runes)
  // ---------------------------------------------------------------------------
  calcRunes(state) {
    const beResult = this.calcBE(state);
    const be = beResult.be;

    const towers = state.buildings.towers || 0;

    // Artisan personality: flatRateProduction affects flat-rate buildings
    const persFlatMod = state.personality.mods.flatRateProduction
      ? (state.personality.mods.flatRateProduction - 1) : 0;

    // Tower production: 12 runes/tick * BE * personality flat rate mod
    const towerRunes = this.calcFlatBuildingEffect(12, towers, be, 0, persFlatMod);

    // Production science
    const prodSci = 1 + (state.sciProduction / 100);

    // Honor rune modifier
    const honorRuneMod = (state.honor && state.honor.runes) || 1;

    const modifiedRuneProduction = towerRunes * prodSci * honorRuneMod;

    // --- Rune Decay ---
    // 1.2% of stored runes decay each tick
    const runeDecay = state.runes * 0.012;

    // --- Net runes per tick ---
    const netRunes = modifiedRuneProduction - runeDecay;

    return {
      towerRunes,
      prodSci,
      honorRuneMod,
      modifiedRuneProduction,
      runeDecay,
      netRunes
    };
  },

  // ---------------------------------------------------------------------------
  // POPULATION GROWTH PER TICK
  // ---------------------------------------------------------------------------
  // Wiki: Population section (lines 3349-3390)
  //
  // Max Population:
  //   Raw Living Space = ((Built Land + In Progress) * 25) + (Barren * 15) + (Homes * 10)
  //   Note: Built Land + In Progress = Acres - Barren Land (all buildings incl. WIP)
  //   The 25 per built acre already includes homes, so homes add EXTRA 10 on top.
  //   Mod Living Space = Raw * Race maxPop * Personality maxPop * Housing Sci * Honor Pop
  //
  // Peasant Hourly Change:
  //   = (Peasants * ((BirthRate + L&P) * Race * Hospitals * EOWCF * Chastity))
  //     + (Homes * 0.3 * Chastity)
  //     - Drafted - Wizards Trained
  //   Base birth rate: 2.05% (we use midpoint; real game varies ±5%)
  //   EOWCF first 24 ticks: x10 (1000%), minimum 500 peasants born
  //   Chastity: x0.5
  //   Hospitals: pct-based +2% birth rate per % of land, max 50%
  //   Dragon: Celestite -60% birth rate
  //   Ritual: Barrier +20% birth rate (scaled by effectiveness)
  //   No growth if pop >= max pop (peasant desertion at 10%/tick if over)
  // ---------------------------------------------------------------------------
  calcPopGrowth(state) {
    const beResult = this.calcBE(state);
    const be = beResult.be;

    // --- Max Population ---
    const totalAcres = state.acres;
    const barren = state.buildings.barrenLand || 0;
    const builtLand = totalAcres - barren; // all buildings (incl. WIP)
    const homes = state.buildings.homes || 0;

    // Raw: every acre gives 25 capacity (built) or 15 (barren), homes add extra 10
    const rawLivingSpace = (builtLand * 25) + (barren * 15) + (homes * 10);

    // Modifiers
    const raceMaxPop = state.race.mods.maxPop || 1;
    const persMaxPop = state.personality.mods.maxPop || 1;
    const housingSci = 1 + (state.sciHousing / 100);
    const honorPop = (state.honor && state.honor.pop) || 1;

    const maxPop = Math.floor(rawLivingSpace * raceMaxPop * persMaxPop * housingSci * honorPop);

    // --- Current Population ---
    // Includes units in training (wiki line 3019). Prisoners do NOT count (wiki line 3024).
    const inT = state.inTraining || {};
    const currentPop = state.peasants + state.soldiers + state.offSpecs
      + state.defSpecs + state.elites + state.thieves + state.wizards
      + (inT.offSpecs || 0) + (inT.defSpecs || 0) + (inT.elites || 0)
      + (inT.thieves || 0);

    // --- Birth Rate ---
    // Love and Peace spell: +0.85% additive birth rate bonus
    const loveAndPeaceBonus = state.spellLoveAndPeace ? 0.0085 : 0;
    const baseBirthRate = 0.0205 + loveAndPeaceBonus; // 2.05% + L&P bonus

    // Hospital bonus to birth rate (pct-based building effect)
    const hospitalBirthBonus = this.calcPctBuildingEffect(
      2, state.buildings.hospitals || 0, totalAcres, be
    );
    // Hospital gives a percentage bonus to birth rate (e.g. +20% means x1.20)
    const hospitalMod = 1 + hospitalBirthBonus / 100;

    // Race birth rate modifier (e.g. Dwarf: 0.75)
    const raceBirthMod = state.race.mods.birthRate || 1;

    // EOWCF birth rate boost: x10 for first 24 ticks of CF
    const eowcfTicks = GAME_DATA.eowcf.birthRateBoostedTicks || 24;
    const ticksElapsed = state.eowcfTicksElapsed || 0;
    const eowcfBoostActive = state.eowcfActive && (ticksElapsed < eowcfTicks);
    const eowcfMod = eowcfBoostActive ? GAME_DATA.eowcf.birthRateMultiplier : 1;
    const eowcfBoostTicksLeft = eowcfBoostActive ? (eowcfTicks - ticksElapsed) : 0;

    // Chastity: halves birth rate
    const chastityMod = state.spellChastity ? 0.5 : 1;

    // Dragon birth rate modifier (e.g. Celestite: -60%)
    let dragonBirthMod = 1;
    const dragonData = GAME_DATA.dragons[state.dragon];
    if (dragonData && dragonData.effects && dragonData.effects.birthRate) {
      dragonBirthMod = 1 + dragonData.effects.birthRate;
    }

    // Ritual birth rate modifier (e.g. Barrier: +20%)
    let ritualBirthMod = 1;
    const ritualData = GAME_DATA.rituals[state.ritual];
    if (ritualData && ritualData.effects && ritualData.effects.birthRate) {
      ritualBirthMod = 1 + ritualData.effects.birthRate * (state.ritualEffectiveness || 1);
    }

    // Effective birth rate per tick
    const effectiveBirthRate = baseBirthRate * raceBirthMod * hospitalMod
      * eowcfMod * chastityMod * dragonBirthMod * ritualBirthMod;

    // Peasants born from birth rate
    let peasantsBorn = Math.floor(state.peasants * effectiveBirthRate);

    // Homes flat bonus: 0.3 peasants/tick per home, affected by chastity
    // Homes flat rate is NOT affected by BE (wiki line 2892)
    const homesBorn = Math.floor((homes * 0.3) * chastityMod);

    // EOWCF minimum: at least 500 peasants born during boosted period
    const eowcfMin = eowcfBoostActive ? (GAME_DATA.eowcf.minPeasantsBorn || 500) : 0;

    let totalBorn = Math.max(peasantsBorn + homesBorn, eowcfMin);

    // Cap growth by max population
    const roomForGrowth = Math.max(0, maxPop - currentPop);
    const overpop = currentPop > maxPop;

    // If overpopulated, peasants leave at 10%/tick (wiki line 3390)
    let peasantDesertion = 0;
    if (overpop) {
      peasantDesertion = Math.floor(state.peasants * 0.10);
      totalBorn = 0; // no births when overpopulated
    } else {
      // Don't grow beyond max pop
      totalBorn = Math.min(totalBorn, roomForGrowth);
    }

    const netPeasantChange = totalBorn - peasantDesertion;

    return {
      maxPop,
      currentPop,
      rawLivingSpace,
      raceMaxPop,
      persMaxPop,
      housingSci,
      honorPop,
      baseBirthRate,
      loveAndPeaceBonus,
      raceBirthMod,
      hospitalMod,
      hospitalBirthBonus,
      eowcfMod,
      chastityMod,
      dragonBirthMod,
      ritualBirthMod,
      effectiveBirthRate,
      peasantsBorn,
      homesBorn,
      eowcfMin,
      totalBorn,
      overpop,
      peasantDesertion,
      roomForGrowth,
      netPeasantChange,
      eowcfBoostActive,
      eowcfBoostTicksLeft,
      ticksElapsed
    };
  },

  // ---------------------------------------------------------------------------
  // HONOR TITLE MODIFIERS
  // ---------------------------------------------------------------------------
  // Wiki: Honor section (lines 5327-5370)
  //
  // Each honor title provides multipliers for various categories.
  // Wiki line 5342: Effects of Honor = Table Value * Race Modifier * Personality Modifier
  //   - War Hero personality: honorEffects = 1.50 (bonus portion x1.5)
  //   - No current race modifies honor effects, but supported for future ages.
  //
  // Returns: { pop, ome, income, food, runes, wpa, tpa, titleName }
  // ---------------------------------------------------------------------------
  getHonorMods(titleIndex, race, personality) {
    const defaultTitle = { name: 'Peasant', pop: 1, ome: 1, income: 1, food: 1, runes: 1, wpa: 1, tpa: 1 };
    const titles = GAME_DATA.honorTitles;
    const title = (titles && titles[titleIndex]) || (titles && titles[0]) || defaultTitle;

    // Race and personality honor multipliers (applied to the bonus portion)
    const raceHonorMod = (race && race.mods && race.mods.honorEffects) || 1;
    const persHonorMod = (personality && personality.mods && personality.mods.honorEffects) || 1;
    const honorScale = raceHonorMod * persHonorMod;

    const keys = ['pop', 'ome', 'income', 'food', 'runes', 'wpa', 'tpa'];
    const result = {};
    for (const k of keys) {
      const raw = title[k] || 1;
      // Scale the bonus portion: e.g. 1.02 with 1.5x => 1 + (0.02 * 1.5) = 1.03
      result[k] = 1 + (raw - 1) * honorScale;
    }
    result.titleName = title.name || 'Peasant';
    return result;
  },

  // ---------------------------------------------------------------------------
  // EOWCF TICKS ELAPSED
  // ---------------------------------------------------------------------------
  // Calculates how many ticks have passed since the CF start date.
  // Uses the scraped current Utopian date and the user-entered CF start date.
  // Returns 0 if data is missing or invalid.
  // ---------------------------------------------------------------------------
  calcEowcfTicksElapsed() {
    const startStr = document.getElementById('eowcfStartDate')?.value?.trim();
    const currentStr = window._utopianDate;
    // If start date is missing or invalid, return Infinity so boost is never active
    if (!startStr || !currentStr) return Infinity;
    const normalized = startStr.replace(/\s+of\s+/i, ', ');
    const start = Scrapers.parseUtopianDate(normalized);
    const current = Scrapers.parseUtopianDate(currentStr);
    if (!start || !current) return Infinity;
    return Math.max(0, Scrapers.utopianDateToTicks(current) - Scrapers.utopianDateToTicks(start));
  },

  // ---------------------------------------------------------------------------
  // GATHER STATE FROM UI
  // ---------------------------------------------------------------------------
  // Reads all input fields and returns a state object used by all calculations.
  // This is the single source of truth for current province configuration.
  // ---------------------------------------------------------------------------
  gatherState() {
    const raceKey = document.getElementById('race').value;
    const persKey = document.getElementById('personality').value;
    const race = GAME_DATA.races[raceKey];
    const personality = GAME_DATA.personalities[persKey];

    // Read all building counts from dynamically-generated inputs
    // The input field value is the TOTAL count (built + in construction) as shown
    // on the game page. The game counts all buildings (including in construction)
    // for all calculations (jobs, flat rate, pct bonuses), confirmed by testing.
    const buildings = {};
    for (const key of Object.keys(GAME_DATA.buildings)) {
      const el = document.getElementById('bld_' + key);
      buildings[key] = el ? (parseInt(el.value) || 0) : 0;
    }

    // Honor title modifiers (calculated from title selection + personality)
    const honorEl = document.getElementById('honorTitle');
    const honorTitleIndex = honorEl ? (parseInt(honorEl.value) || 0) : 0;

    const state = {
      race,
      personality,
      acres: parseInt(document.getElementById('acres').value) || 0,
      eowcfActive: document.getElementById('eowcfActive').checked,
      eowcfDuration: parseInt(document.getElementById('eowcfDuration')?.value) || 48,
      eowcfTicksElapsed: this.calcEowcfTicksElapsed(),

      // Starting resources
      gold: parseInt(document.getElementById('gold').value) || 0,
      food: parseInt(document.getElementById('food').value) || 0,
      runes: parseInt(document.getElementById('runes').value) || 0,

      // Population
      peasants: parseInt(document.getElementById('peasants').value) || 0,
      soldiers: parseInt(document.getElementById('soldiers').value) || 0,
      offSpecs: parseInt(document.getElementById('offSpecs').value) || 0,
      defSpecs: parseInt(document.getElementById('defSpecs').value) || 0,
      elites: parseInt(document.getElementById('elites').value) || 0,
      thieves: parseInt(document.getElementById('thieves').value) || 0,
      wizards: parseInt(document.getElementById('wizards').value) || 0,
      prisoners: parseInt(document.getElementById('prisoners').value) || 0,

      // Buildings (completed only, excludes in-construction)
      buildings,

      // Science bonuses (stored as positive percentages, e.g. 15 = 15%)
      // Some sciences are reductions (Bookkeeping, Valor, Artisan, Heroism) and
      // may be scraped with a negative sign — we normalize to positive here.
      sciAlchemy: Math.abs(parseFloat(document.getElementById('sciAlchemy').value) || 0),
      sciTools: Math.abs(parseFloat(document.getElementById('sciTools').value) || 0),
      sciProduction: Math.abs(parseFloat(document.getElementById('sciProduction').value) || 0),
      sciHousing: Math.abs(parseFloat(document.getElementById('sciHousing').value) || 0),
      sciBookkeeping: Math.abs(parseFloat(document.getElementById('sciBookkeeping').value) || 0),
      sciHeroism: Math.abs(parseFloat(document.getElementById('sciHeroism').value) || 0),
      sciValor: Math.abs(parseFloat(document.getElementById('sciValor').value) || 0),
      sciArtisan: Math.abs(parseFloat(document.getElementById('sciArtisan').value) || 0),

      // Active spells/effects (boolean toggles)
      // Reads from dynamically-generated checkboxes (spell_SPELL_KEY)
      // Self spells
      spellChastity: !!document.getElementById('spell_CHASTITY')?.checked,
      spellFertileLands: !!document.getElementById('spell_FERTILE_LANDS')?.checked,
      spellMinersM: !!document.getElementById('spell_MINERS_MYSTIQUE')?.checked,
      spellBuildBoon: !!document.getElementById('spell_BUILDERS_BOON')?.checked,
      spellLoveAndPeace: !!document.getElementById('spell_LOVE_AND_PEACE')?.checked,
      spellInspireArmy: !!document.getElementById('spell_INSPIRE_ARMY')?.checked,
      spellHerosInspiration: !!document.getElementById('spell_HEROS_INSPIRATION')?.checked,
      spellGhostWorkers: !!document.getElementById('spell_GHOST_WORKERS')?.checked,
      // Offensive (bad) spells
      spellDrought: !!document.getElementById('spell_DROUGHT')?.checked,
      spellGluttony: !!document.getElementById('spell_GLUTTONY')?.checked,
      spellGreed: !!document.getElementById('spell_GREED')?.checked,
      spellBlizzard: !!document.getElementById('spell_BLIZZARD')?.checked,
      spellRiots: !!document.getElementById('spell_RIOTS')?.checked,
      spellConstructionDelays: !!document.getElementById('spell_CONSTRUCTION_DELAYS')?.checked,

      // Ritual selection (string key or 'none')
      ritual: document.getElementById('ritual').value,
      ritualEffectiveness: (parseFloat(document.getElementById('ritualEffectiveness')?.value) || 100) / 100,

      // Dragon (string key or 'none')
      dragon: document.getElementById('dragon')?.value || 'none',

      // Military wage rate (0-200%, default 100%)
      wageRate: parseFloat(document.getElementById('wageRate')?.value) || 100,

      // Units in training (from military page scraper)
      inTraining: window._inTraining || {}
    };

    state.honor = this.getHonorMods(honorTitleIndex, state.race, state.personality);

    return state;
  }
};
