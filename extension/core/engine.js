// =============================================================================
// Core Game Engine — Pure Formulas
// =============================================================================
// All reusable game formulas. No DOM access. Each method takes a state object.
// Sourced from utopia_wiki.md and verified against live game data.
// =============================================================================

const Engine = {

  // --- Building Effects (Percentage-based, diminishing returns) ---
  // effect = base * BE * MIN(50, pctLand*(1+race)*(1+pers)) * (100 - that) / 100
  calcPctBuildingEffect(baseEffect, numBuildings, totalAcres, be, raceMod = 0, persMod = 0) {
    if (numBuildings <= 0 || totalAcres <= 0) return 0;
    const pctBuilding = (numBuildings / totalAcres) * 100;
    const effective = Math.min(50, pctBuilding * (1 + raceMod) * (1 + persMod));
    return baseEffect * be * effective * (100 - effective) / 100;
  },

  // --- Building Effects (Flat rate) ---
  // Flat Rate = Base * Count * (1+Race) * (1+Pers) * BE
  calcFlatBuildingEffect(baseEffect, numBuildings, be, raceMod = 0, persMod = 0) {
    return baseEffect * numBuildings * (1 + raceMod) * (1 + persMod) * be;
  },

  // --- Total Jobs ---
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

  // --- Building Efficiency (BE) ---
  // BE = 0.5*(1+%Jobs) * Race * Pers * Tools * Ritual * Dragon * Blizzard * ConstructionDelays
  calcBE(state) {
    const totalJobs = this.calcTotalJobs(state);
    const availableWorkers = state.peasants + Math.floor(state.prisoners / 2);
    const ghostWorkersMod = state.spellGhostWorkers ? 0.75 : 1;
    const optimalWorkers = Math.floor(totalJobs * 0.67 * ghostWorkersMod);
    const pctJobs = optimalWorkers > 0 ? Math.min(availableWorkers / optimalWorkers, 1) : 1;

    const raceBE = state.race.mods.buildingEfficiency;
    const persBE = state.personality.mods.buildingEfficiency || 1;
    const toolsSci = 1 + (state.sciTools / 100);

    let be = (0.5 * (1 + pctJobs)) * raceBE * persBE * toolsSci;

    let ritualBEMod = 1;
    const ritualData = GAME_DATA.rituals[state.ritual];
    if (ritualData && ritualData.effects.buildingEfficiency) {
      ritualBEMod = 1 + ritualData.effects.buildingEfficiency * (state.ritualEffectiveness || 1);
      be *= ritualBEMod;
    }

    let dragonBEMod = 1;
    const dragonData = GAME_DATA.dragons[state.dragon];
    if (dragonData && dragonData.effects && dragonData.effects.buildingEfficiency) {
      dragonBEMod = 1 + dragonData.effects.buildingEfficiency;
      be *= dragonBEMod;
    }

    const blizzardMod = state.spellBlizzard ? 0.90 : 1;
    const constructionDelaysMod = state.spellConstructionDelays ? 0.90 : 1;
    be *= blizzardMod * constructionDelaysMod;

    return {
      be: Math.min(be, 1.5), availableWorkers, optimalWorkers, pctJobs, totalJobs,
      raceBE, persBE, toolsSci, ritualBEMod, dragonBEMod, ghostWorkersMod,
      blizzardMod, constructionDelaysMod
    };
  },

  // --- Construction Time ---
  // 16 * Race * Pers * BuildersBoon * DoubleSpeed * Ritual * Artisan * Dragon
  calcConstructionTime(state) {
    const base = 16;
    const raceMod = state.race.mods.buildTime || 1;
    const persMod = state.personality.mods.buildTime || 1;
    const buildersBoon = state.spellBuildBoon ? 0.75 : 1;
    const doubleSpeed = state.doubleSpeed ? 0.50 : 1;

    let ritualMod = 1;
    const ritualData = GAME_DATA.rituals[state.ritual];
    if (ritualData && ritualData.effects.constructionTime) {
      ritualMod = 1 + ritualData.effects.constructionTime * (state.ritualEffectiveness || 1);
    }

    const artisanSci = 1 - (state.sciArtisan / 100);

    let dragonMod = 1;
    const dragonData = GAME_DATA.dragons[state.dragon];
    if (dragonData && dragonData.effects && dragonData.effects.buildCostTime) {
      dragonMod = 1 + dragonData.effects.buildCostTime;
    }

    const rawTime = base * raceMod * persMod * buildersBoon * doubleSpeed * ritualMod * artisanSci * dragonMod;
    const constructionTime = Math.max(1, Math.round(rawTime));

    return { base, raceMod, persMod, buildersBoon, doubleSpeed, ritualMod, artisanSci, dragonMod, rawTime, constructionTime };
  },

  // --- Construction Cost ---
  // 0.05*(land+10000) * Race * Pers * Mills * BB/DS cost * Ritual * Artisan * Dragon
  calcConstructionCost(state) {
    const acres = state.acres;
    const baseCost = 0.05 * (acres + 10000);
    const raceMod = state.race.mods.buildCost || 1;
    const persMod = state.personality.mods.buildCost || 1;

    const beResult = this.calcBE(state);
    const mills = state.buildings.mills || 0;
    const millsPct = this.calcPctBuildingEffect(
      GAME_DATA.buildings.mills.pctEffect[0].base, mills, acres, beResult.be
    );
    const millsMod = 1 - (millsPct / 100);

    // BB and Double Speed both x2 cost
    const costDoubleMod = (state.spellBuildBoon || state.doubleSpeed) ? 2.0 : 1;

    let ritualMod = 1;
    const ritualData = GAME_DATA.rituals[state.ritual];
    if (ritualData && ritualData.effects.constructionCost) {
      ritualMod = 1 + ritualData.effects.constructionCost * (state.ritualEffectiveness || 1);
    }

    const artisanSci = 1 - (state.sciArtisan / 100);

    let dragonMod = 1;
    const dragonData = GAME_DATA.dragons[state.dragon];
    if (dragonData && dragonData.effects && dragonData.effects.buildCostTime) {
      dragonMod = 1 + dragonData.effects.buildCostTime;
    }

    const constructionCost = Math.round(baseCost * raceMod * persMod * millsMod * costDoubleMod * ritualMod * artisanSci * dragonMod);

    return { acres, baseCost, raceMod, persMod, millsPct, millsMod, costDoubleMod, ritualMod, artisanSci, dragonMod, constructionCost };
  },

  // --- Raze Cost ---
  // (300 + 0.05*land) * Artisan * Race * Pers
  calcRazeCost(state) {
    const acres = state.acres;
    const baseCost = 300 + (0.05 * acres);
    const raceMod = state.race.mods.buildCost || 1;
    const persMod = state.personality.mods.buildCost || 1;
    const artisanSci = 1 - (state.sciArtisan / 100);
    const razeCost = Math.round(baseCost * artisanSci * raceMod * persMod);
    return { acres, baseCost, raceMod, persMod, artisanSci, razeCost };
  },

  // --- Income Per Tick ---
  calcIncome(state) {
    const beResult = this.calcBE(state);
    const be = beResult.be;
    const totalJobs = beResult.totalJobs;

    const prisonerJobs = Math.floor(state.prisoners / 2);
    const jobsForPeasants = Math.max(0, totalJobs - prisonerJobs);
    const employed = Math.min(state.peasants, jobsForPeasants);
    const unemployed = state.peasants - employed;
    const taxIncome = (3 * employed) + (1 * unemployed);

    let prisonerRate = 0.75;
    if (state.race === GAME_DATA.races.human) prisonerRate += 2.0;
    const prisonerIncome = prisonerRate * state.prisoners;

    const persFlatMod = state.personality.mods.flatRateProduction
      ? (state.personality.mods.flatRateProduction - 1) : 0;
    const bankFlatIncome = this.calcFlatBuildingEffect(25, state.buildings.banks || 0, be, 0, persFlatMod);

    const minersMystique = state.spellMinersM ? (0.3 * state.peasants) : 0;
    const rawIncome = taxIncome + prisonerIncome + bankFlatIncome + minersMystique;

    const bankPctBonus = this.calcPctBuildingEffect(1.5, state.buildings.banks || 0, state.acres, be);
    const alchemySci = 1 + (state.sciAlchemy / 100);
    const honorMod = (state.honor && state.honor.income) || 1;
    const raceMod = state.race.mods.income || 1;
    const persMod = state.personality.mods.income || 1;

    let dragonIncomeMod = 1;
    const dragonData = GAME_DATA.dragons[state.dragon];
    if (dragonData && dragonData.effects && dragonData.effects.income) {
      dragonIncomeMod = 1 + dragonData.effects.income;
    }

    const riotsMod = state.spellRiots ? 0.90 : 1;

    const modifiedIncome = rawIncome
      * (1 + bankPctBonus / 100) * alchemySci * honorMod
      * raceMod * persMod * dragonIncomeMod * riotsMod;

    return {
      beResult, employed, unemployed, taxIncome, prisonerIncome,
      bankFlatIncome, minersMystique, rawIncome, bankPctBonus,
      alchemySci, honorMod, raceMod, persMod, dragonIncomeMod, modifiedIncome
    };
  },

  // --- Military Wages Per Tick ---
  calcWages(state) {
    const beResult = this.calcBE(state);
    const be = beResult.be;

    const specCount = (state.offSpecs || 0) + (state.defSpecs || 0);
    const eliteCount = state.elites || 0;
    const baseWages = (specCount * 0.5) + (eliteCount * 0.75);
    const wageRate = (state.wageRate || 100) / 100;

    const armouriesBonus = this.calcPctBuildingEffect(2, state.buildings.armouries || 0, state.acres, be);
    const bookkeepingSci = 1 - (state.sciBookkeeping / 100);
    const raceWageMod = state.race.mods.wages || 1;
    const persWageMod = state.personality.mods.wages || 1;

    let ritualMod = 1;
    const ritualData = GAME_DATA.rituals[state.ritual];
    if (ritualData && ritualData.effects.wages) {
      ritualMod = 1 + ritualData.effects.wages * (state.ritualEffectiveness || 1);
    }

    let dragonWageMod = 1;
    const dragonData = GAME_DATA.dragons[state.dragon];
    if (dragonData && dragonData.effects && dragonData.effects.wages) {
      dragonWageMod = 1 + dragonData.effects.wages;
    }

    let spellWageMod = 1;
    if (state.spellHerosInspiration) spellWageMod = 0.70;
    else if (state.spellInspireArmy) spellWageMod = 0.85;

    const greedMod = state.spellGreed ? 1.25 : 1;

    const modifiedWages = baseWages * wageRate
      * (1 - armouriesBonus / 100) * bookkeepingSci
      * raceWageMod * persWageMod * ritualMod * dragonWageMod * spellWageMod * greedMod;

    return {
      specCount, eliteCount, baseWages, armouriesBonus, bookkeepingSci,
      raceWageMod, persWageMod, ritualMod, dragonWageMod, spellWageMod, modifiedWages
    };
  },

  // --- Food Production Per Tick ---
  calcFood(state) {
    const beResult = this.calcBE(state);
    const be = beResult.be;

    const farms = state.buildings.farms || 0;
    const barrenLand = state.buildings.barrenLand || 0;

    const persFlatMod = state.personality.mods.flatRateProduction
      ? (state.personality.mods.flatRateProduction - 1) : 0;
    const farmFood = this.calcFlatBuildingEffect(60, farms, be, 0, persFlatMod);
    const barrenFood = barrenLand * 2;

    const raceFoodPerAcre = state.race.mods.foodProdPerAcre || 0;
    const persFoodPerAcre = state.personality.mods.foodProdPerAcre || 0;
    const acreFood = (raceFoodPerAcre + persFoodPerAcre) * state.acres;

    const baseFoodProduction = farmFood + barrenFood + acreFood;
    const prodSci = 1 + (state.sciProduction / 100);
    const fertileMod = state.spellFertileLands ? 1.25 : 1;
    const droughtMod = state.spellDrought ? 0.75 : 1;
    const honorFoodMod = (state.honor && state.honor.food) || 1;
    const modifiedFoodProduction = baseFoodProduction * prodSci * fertileMod * droughtMod * honorFoodMod;

    const inT = state.inTraining || {};
    const totalPop = state.peasants + state.soldiers + state.offSpecs
      + state.defSpecs + state.elites + state.thieves + state.wizards
      + (inT.offSpecs || 0) + (inT.defSpecs || 0) + (inT.elites || 0)
      + (inT.thieves || 0);
    const raceFoodMod = state.race.mods.foodConsumption;
    const gluttonyMod = state.spellGluttony ? 1.25 : 1;
    const foodConsumed = totalPop * 0.25 * raceFoodMod * gluttonyMod;

    const foodDecay = state.food * 0.01;
    const netFood = modifiedFoodProduction - foodConsumed - foodDecay;

    return {
      beResult, farmFood, barrenFood, acreFood, baseFoodProduction,
      prodSci, fertileMod, honorFoodMod, modifiedFoodProduction,
      totalPop, raceFoodMod, foodConsumed, foodDecay, netFood
    };
  },

  // --- Rune Production Per Tick ---
  calcRunes(state) {
    const beResult = this.calcBE(state);
    const be = beResult.be;
    const towers = state.buildings.towers || 0;

    const persFlatMod = state.personality.mods.flatRateProduction
      ? (state.personality.mods.flatRateProduction - 1) : 0;
    const towerRunes = this.calcFlatBuildingEffect(12, towers, be, 0, persFlatMod);

    const prodSci = 1 + (state.sciProduction / 100);
    const honorRuneMod = (state.honor && state.honor.runes) || 1;
    const modifiedRuneProduction = towerRunes * prodSci * honorRuneMod;

    const runeDecay = state.runes * 0.012;
    const netRunes = modifiedRuneProduction - runeDecay;

    return { towerRunes, prodSci, honorRuneMod, modifiedRuneProduction, runeDecay, netRunes };
  },

  // --- Population Growth Per Tick ---
  calcPopGrowth(state) {
    const beResult = this.calcBE(state);
    const be = beResult.be;

    const totalAcres = state.acres;
    const barren = state.buildings.barrenLand || 0;
    const builtLand = totalAcres - barren;
    const homes = state.buildings.homes || 0;

    const rawLivingSpace = (builtLand * 25) + (barren * 15) + (homes * 10);
    const raceMaxPop = state.race.mods.maxPop || 1;
    const persMaxPop = state.personality.mods.maxPop || 1;
    const housingSci = 1 + (state.sciHousing / 100);
    const honorPop = (state.honor && state.honor.pop) || 1;
    const maxPop = Math.floor(rawLivingSpace * raceMaxPop * persMaxPop * housingSci * honorPop);

    const inT = state.inTraining || {};
    const currentPop = state.peasants + state.soldiers + state.offSpecs
      + state.defSpecs + state.elites + state.thieves + state.wizards
      + (inT.offSpecs || 0) + (inT.defSpecs || 0) + (inT.elites || 0)
      + (inT.thieves || 0);

    const loveAndPeaceBonus = state.spellLoveAndPeace ? 0.0085 : 0;
    const baseBirthRate = 0.0205 + loveAndPeaceBonus;

    const hospitalBirthBonus = this.calcPctBuildingEffect(2, state.buildings.hospitals || 0, totalAcres, be);
    const hospitalMod = 1 + hospitalBirthBonus / 100;
    const raceBirthMod = state.race.mods.birthRate || 1;

    const eowcfTicks = GAME_DATA.eowcf.birthRateBoostedTicks || 24;
    const ticksElapsed = state.eowcfTicksElapsed || 0;
    const eowcfBoostActive = state.eowcfActive && (ticksElapsed < eowcfTicks);
    const eowcfMod = eowcfBoostActive ? GAME_DATA.eowcf.birthRateMultiplier : 1;
    const eowcfBoostTicksLeft = eowcfBoostActive ? (eowcfTicks - ticksElapsed) : 0;

    const chastityMod = state.spellChastity ? 0.5 : 1;

    let dragonBirthMod = 1;
    const dragonData = GAME_DATA.dragons[state.dragon];
    if (dragonData && dragonData.effects && dragonData.effects.birthRate) {
      dragonBirthMod = 1 + dragonData.effects.birthRate;
    }

    let ritualBirthMod = 1;
    const ritualData = GAME_DATA.rituals[state.ritual];
    if (ritualData && ritualData.effects && ritualData.effects.birthRate) {
      ritualBirthMod = 1 + ritualData.effects.birthRate * (state.ritualEffectiveness || 1);
    }

    const effectiveBirthRate = baseBirthRate * raceBirthMod * hospitalMod
      * eowcfMod * chastityMod * dragonBirthMod * ritualBirthMod;

    let peasantsBorn = Math.floor(state.peasants * effectiveBirthRate);
    const homesBorn = Math.floor((homes * 0.3) * chastityMod);
    const eowcfMin = eowcfBoostActive ? (GAME_DATA.eowcf.minPeasantsBorn || 500) : 0;
    let totalBorn = Math.max(peasantsBorn + homesBorn, eowcfMin);

    const roomForGrowth = Math.max(0, maxPop - currentPop);
    const overpop = currentPop > maxPop;

    let peasantDesertion = 0;
    if (overpop) {
      peasantDesertion = Math.floor(state.peasants * 0.10);
      totalBorn = 0;
    } else {
      totalBorn = Math.min(totalBorn, roomForGrowth);
    }

    const netPeasantChange = totalBorn - peasantDesertion;

    return {
      maxPop, currentPop, rawLivingSpace, raceMaxPop, persMaxPop, housingSci, honorPop,
      baseBirthRate, loveAndPeaceBonus, raceBirthMod, hospitalMod, hospitalBirthBonus,
      eowcfMod, chastityMod, dragonBirthMod, ritualBirthMod, effectiveBirthRate,
      peasantsBorn, homesBorn, eowcfMin, totalBorn, overpop, peasantDesertion,
      roomForGrowth, netPeasantChange, eowcfBoostActive, eowcfBoostTicksLeft, ticksElapsed
    };
  },

  // --- Draft Per Tick ---
  calcDraft(state) {
    const draftRates = { none: 0, normal: 0.005, aggressive: 0.015, emergency: 0.02, war: 0.025 };
    const rate = draftRates[state.draftRate] || 0;
    if (rate === 0) return { drafted: 0, draftCost: 0, costPerSoldier: 0, levelFactor: 1, rate: 0 };

    const heroismMod = 1 + (state.sciHeroism || 0) / 100;
    const patriotismMod = state.spellPatriotism ? 1.3 : 1;
    const drafted = Math.floor(state.peasants * rate * heroismMod * 1.3 * patriotismMod);

    const maxPop = state.maxPop || 1;
    const totalMilitary = (state.soldiers || 0) + (state.offSpecs || 0) + (state.defSpecs || 0)
      + (state.elites || 0) + (state.thieves || 0);
    const milRatio = totalMilitary / maxPop;
    const levelFactor = Math.max(1.0154 * milRatio * milRatio + 1.1759 * milRatio + 0.3633, 1);
    const baseWage = Math.max((state.wageRate || 100) * 0.5, 7.5);

    const beResult = this.calcBE(state);
    const armouriesBonus = this.calcPctBuildingEffect(
      2, (state.buildings && state.buildings.armouries) || 0, state.acres || 1, beResult.be
    );
    const armMod = 1 - Math.min(armouriesBonus / 100, 0.5);

    const raceDraftMod = (state.race && state.race.mods && state.race.mods.draftCost) || 1;
    const persDraftMod = (state.personality && state.personality.mods && state.personality.mods.draftCost) || 1;
    const greedMod = state.spellGreed ? 1.25 : 1;

    const costPerSoldier = baseWage * levelFactor * raceDraftMod * persDraftMod * armMod * greedMod;
    const draftCost = Math.round(drafted * costPerSoldier);

    return { drafted, draftCost, costPerSoldier, levelFactor, milRatio, rate, armMod, raceDraftMod, persDraftMod };
  },

  // --- Honor Title Modifiers ---
  getHonorMods(honorValue, race, personality) {
    const defaultTitle = { name: 'Peasant', pop: 1, ome: 1, income: 1, food: 1, runes: 1, wpa: 1, tpa: 1 };
    const titles = GAME_DATA.honorTitles;
    if (!titles || titles.length === 0) return defaultTitle;
    let title = titles[0];
    for (let i = titles.length - 1; i >= 0; i--) {
      if (honorValue >= titles[i].minHonor) { title = titles[i]; break; }
    }

    const raceHonorMod = (race && race.mods && race.mods.honorEffects) || 1;
    const persHonorMod = (personality && personality.mods && personality.mods.honorEffects) || 1;
    const honorScale = raceHonorMod * persHonorMod;

    const keys = ['pop', 'ome', 'income', 'food', 'runes', 'wpa', 'tpa'];
    const result = {};
    for (const k of keys) {
      const raw = title[k] || 1;
      result[k] = 1 + (raw - 1) * honorScale;
    }
    result.titleName = title.name || 'Peasant';
    return result;
  },

  // --- Training Time (ticks) ---
  // 24 * Race * Pers * InspireArmy/HerosInspiration * Valor * Ritual * TrainingGrounds
  calcTrainingTime(state) {
    const base = 24;
    const raceMod = state.race.mods.trainingTime || 1;
    const persMod = state.personality.mods.trainingTime || 1;

    // IA and HI are mutually exclusive — use the stronger one
    const inspireMod = state.spellHerosInspiration ? 0.70
      : (state.spellInspireArmy ? 0.80 : 1);

    const valorSci = 1 - Math.min((state.sciValor || 0) / 100, 0.25);

    let ritualMod = 1;
    const ritualData = GAME_DATA.rituals[state.ritual];
    if (ritualData && ritualData.effects.trainingTime) {
      ritualMod = 1 + ritualData.effects.trainingTime * (state.ritualEffectiveness || 1);
    }

    // Training grounds pct-based reduction (base 1, max 25%)
    const beResult = this.calcBE(state);
    const tgReduction = this.calcPctBuildingEffect(
      1, state.buildings.trainingGrounds || 0, state.acres, beResult.be
    );
    const tgMod = 1 - Math.min(tgReduction / 100, 0.25);

    const rawTime = base * raceMod * persMod * inspireMod * valorSci * ritualMod * tgMod;
    const trainingTime = Math.max(1, Math.round(rawTime));

    return { base, raceMod, persMod, inspireMod, valorSci, ritualMod, tgMod, rawTime, trainingTime };
  },

  // --- Training Cost (gc for count units) ---
  // count * unitBaseCost * Race * Pers * ArmouriesMod
  // Armouries reduce training cost (pct-based, base 1.5, max 37.5%)
  calcTrainingCost(count, unitBaseCost, state, armouriesCount) {
    if (count <= 0) return 0;
    const raceMod = state.race.mods.trainingCost || 1;
    const persMod = state.personality.mods.trainingCost || 1;

    const armReduction = this.calcPctBuildingEffect(1.5, armouriesCount, state.acres, 1);
    const armMod = 1 - Math.min(armReduction / 100, 0.375);

    return Math.round(count * unitBaseCost * raceMod * persMod * armMod);
  },
};
