// =============================================================================
// Engine Formula Coverage Tests — Sensitivity Testing
// =============================================================================
// For each formula, we create a baseline state, change one variable at a time,
// and verify the output changes. This catches forgotten variables & regressions.
// =============================================================================

(function () {
  const results = { passed: 0, failed: 0, gaps: 0, details: [] };

  // -------------------------------------------------------------------------
  // BASELINE STATE
  // -------------------------------------------------------------------------
  function makeBaseState() {
    const race = GAME_DATA.races.orc;
    const personality = GAME_DATA.personalities.warHero;
    const honor = Engine.getHonorMods(2, race, personality); // Lord title

    return {
      race,
      personality,
      acres: 1500,

      peasants: 12000,
      soldiers: 3000,
      offSpecs: 4000,
      defSpecs: 3000,
      elites: 1000,
      thieves: 500,
      wizards: 300,
      prisoners: 200,

      buildings: {
        barrenLand: 100,
        homes: 80,
        farms: 200,
        mills: 50,
        banks: 150,
        trainingGrounds: 80,
        armouries: 100,
        barracks: 50,
        forts: 80,
        castles: 30,
        hospitals: 80,
        guilds: 40,
        towers: 100,
        thievesDens: 30,
        watchTowers: 30,
        universities: 50,
        libraries: 50,
        stables: 40,
        dungeons: 30
      },

      gold: 500000,
      food: 200000,
      runes: 50000,

      sciAlchemy: 15,
      sciTools: 12,
      sciProduction: 10,
      sciHousing: 8,
      sciBookkeeping: 14,
      sciHeroism: 5,
      sciValor: 6,
      sciArtisan: 7,

      wageRate: 100,

      spellChastity: false,
      spellFertileLands: false,
      spellMinersM: false,
      spellBuildBoon: false,
      spellLoveAndPeace: false,
      spellInspireArmy: false,
      spellHerosInspiration: false,
      spellGhostWorkers: false,

      ritual: 'none',
      ritualEffectiveness: 1.0,

      dragon: 'none',

      honor,

      eowcfActive: false,
      eowcfTicksElapsed: 0
    };
  }

  // Deep clone helper
  function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  // -------------------------------------------------------------------------
  // TEST RUNNER
  // -------------------------------------------------------------------------
  function testSensitivity(formulaName, calcFn, outputKey, varName, mutator, opts = {}) {
    const baseState = opts.customBase ? opts.customBase() : makeBaseState();
    const mutatedState = opts.customBase ? opts.customBase() : makeBaseState();
    mutator(mutatedState);

    const baseResult = calcFn.call(Engine, baseState);
    const mutResult = calcFn.call(Engine, mutatedState);

    const baseVal = baseResult[outputKey];
    const mutVal = mutResult[outputKey];
    const changed = Math.abs(baseVal - mutVal) > 0.0001;
    const shouldChange = opts.shouldChange !== false; // default true
    const isGap = opts.gap === true;

    const pass = isGap ? !changed : (shouldChange ? changed : !changed);

    const entry = {
      formula: formulaName,
      variable: varName,
      pass,
      isGap,
      baseVal: Math.round(baseVal * 1000) / 1000,
      mutVal: Math.round(mutVal * 1000) / 1000,
      changed,
      shouldChange
    };

    if (isGap) {
      results.gaps++;
      entry.label = `GAP: ${varName} — expected to affect ${formulaName} but not yet implemented`;
    }

    if (pass) results.passed++;
    else results.failed++;

    results.details.push(entry);
    return entry;
  }

  // -------------------------------------------------------------------------
  // calcBE TESTS
  // -------------------------------------------------------------------------
  function testCalcBE() {
    const fn = Engine.calcBE;
    const f = 'calcBE';
    const k = 'be';

    testSensitivity(f, fn, k, 'peasants', s => { s.peasants = 500; });
    testSensitivity(f, fn, k, 'prisoners', s => { s.prisoners = 2000; });
    testSensitivity(f, fn, k, 'buildings.banks (jobs)', s => { s.buildings.banks = 0; });
    testSensitivity(f, fn, k, 'race→dwarf (BE 1.25)', s => { s.race = GAME_DATA.races.dwarf; });
    testSensitivity(f, fn, k, 'sciTools', s => { s.sciTools = 30; });
    testSensitivity(f, fn, k, 'ritual→expedient', s => { s.ritual = 'expedient'; });
    testSensitivity(f, fn, k, 'ritualEffectiveness', s => {
      s.ritualEffectiveness = 0.5;
    }, {
      customBase: () => { const s = makeBaseState(); s.ritual = 'expedient'; return s; }
    });
    testSensitivity(f, fn, k, 'spellGhostWorkers', s => { s.spellGhostWorkers = true; });
  }

  // -------------------------------------------------------------------------
  // calcIncome TESTS
  // -------------------------------------------------------------------------
  function testCalcIncome() {
    const fn = Engine.calcIncome;
    const f = 'calcIncome';
    const k = 'modifiedIncome';

    testSensitivity(f, fn, k, 'peasants', s => { s.peasants = 5000; });
    testSensitivity(f, fn, k, 'prisoners', s => { s.prisoners = 2000; });
    testSensitivity(f, fn, k, 'buildings.banks', s => { s.buildings.banks = 0; });
    testSensitivity(f, fn, k, 'acres', s => { s.acres = 3000; });
    testSensitivity(f, fn, k, 'race→human (prisoner bonus)', s => {
      s.race = GAME_DATA.races.human;
      s.honor = Engine.getHonorMods(2, s.race, s.personality);
    });
    testSensitivity(f, fn, k, 'race.income', s => {
      s.race = clone(s.race);
      s.race.mods.income = 1.20;
    });
    testSensitivity(f, fn, k, 'pers.income', s => {
      s.personality = clone(s.personality);
      s.personality.mods.income = 1.15;
    });
    testSensitivity(f, fn, k, 'pers→artisan (flatRate)', s => {
      s.personality = GAME_DATA.personalities.artisan;
      s.honor = Engine.getHonorMods(2, s.race, s.personality);
    });
    testSensitivity(f, fn, k, 'sciAlchemy', s => { s.sciAlchemy = 30; });
    testSensitivity(f, fn, k, 'honor.income', s => {
      s.honor = clone(s.honor);
      s.honor.income = 1.20;
    });
    testSensitivity(f, fn, k, 'spellMinersM', s => { s.spellMinersM = true; });

  }

  // -------------------------------------------------------------------------
  // calcWages TESTS
  // -------------------------------------------------------------------------
  function testCalcWages() {
    const fn = Engine.calcWages;
    const f = 'calcWages';
    const k = 'modifiedWages';

    testSensitivity(f, fn, k, 'offSpecs', s => { s.offSpecs = 8000; });
    testSensitivity(f, fn, k, 'defSpecs', s => { s.defSpecs = 8000; });
    testSensitivity(f, fn, k, 'elites', s => { s.elites = 5000; });
    testSensitivity(f, fn, k, 'wageRate', s => { s.wageRate = 150; });
    testSensitivity(f, fn, k, 'buildings.armouries', s => { s.buildings.armouries = 300; });
    testSensitivity(f, fn, k, 'acres', s => { s.acres = 3000; });
    testSensitivity(f, fn, k, 'sciBookkeeping', s => { s.sciBookkeeping = 30; });
    testSensitivity(f, fn, k, 'race→faery (wages 1.15)', s => {
      s.race = GAME_DATA.races.faery;
    });
    testSensitivity(f, fn, k, 'pers.wages', s => {
      s.personality = clone(s.personality);
      s.personality.mods.wages = 1.20;
    });
    testSensitivity(f, fn, k, 'ritual→expedient', s => { s.ritual = 'expedient'; });
    testSensitivity(f, fn, k, 'ritualEffectiveness', s => {
      s.ritualEffectiveness = 0.5;
    }, {
      customBase: () => { const s = makeBaseState(); s.ritual = 'expedient'; return s; }
    });
    testSensitivity(f, fn, k, 'spellInspireArmy', s => { s.spellInspireArmy = true; });
    testSensitivity(f, fn, k, 'spellHerosInspiration', s => { s.spellHerosInspiration = true; });
  }

  // -------------------------------------------------------------------------
  // calcFood TESTS
  // -------------------------------------------------------------------------
  function testCalcFood() {
    const fn = Engine.calcFood;
    const f = 'calcFood';
    const k = 'netFood';

    testSensitivity(f, fn, k, 'buildings.farms', s => { s.buildings.farms = 400; });
    testSensitivity(f, fn, k, 'buildings.barrenLand', s => { s.buildings.barrenLand = 300; });
    // acres affects food via acreFood (needs foodProdPerAcre > 0); use mock race
    testSensitivity(f, fn, k, 'acres', s => { s.acres = 3000; }, {
      customBase: () => {
        const s = makeBaseState();
        s.race = JSON.parse(JSON.stringify(s.race));
        s.race.mods.foodProdPerAcre = 5;
        return s;
      }
    });
    testSensitivity(f, fn, k, 'pers→artisan (flatRate)', s => {
      s.personality = GAME_DATA.personalities.artisan;
      s.honor = Engine.getHonorMods(2, s.race, s.personality);
    });
    testSensitivity(f, fn, k, 'race.foodProdPerAcre', s => {
      s.race = clone(s.race);
      s.race.mods.foodProdPerAcre = 5;
    });
    testSensitivity(f, fn, k, 'sciProduction', s => { s.sciProduction = 30; });
    testSensitivity(f, fn, k, 'spellFertileLands', s => { s.spellFertileLands = true; });
    testSensitivity(f, fn, k, 'honor.food', s => {
      s.honor = clone(s.honor);
      s.honor.food = 1.20;
    });
    // Consumption tests
    testSensitivity(f, fn, k, 'peasants (consumption)', s => { s.peasants = 20000; });
    testSensitivity(f, fn, k, 'soldiers (consumption)', s => { s.soldiers = 10000; });
    testSensitivity(f, fn, k, 'offSpecs (consumption)', s => { s.offSpecs = 10000; });
    testSensitivity(f, fn, k, 'race→undead (foodConsumption 0)', s => {
      s.race = GAME_DATA.races.undead;
    });
    // Decay test
    testSensitivity(f, fn, k, 'food stock (decay)', s => { s.food = 1000000; });
  }

  // -------------------------------------------------------------------------
  // calcRunes TESTS
  // -------------------------------------------------------------------------
  function testCalcRunes() {
    const fn = Engine.calcRunes;
    const f = 'calcRunes';
    const k = 'netRunes';

    testSensitivity(f, fn, k, 'buildings.towers', s => { s.buildings.towers = 300; });
    testSensitivity(f, fn, k, 'pers→artisan (flatRate)', s => {
      s.personality = GAME_DATA.personalities.artisan;
      s.honor = Engine.getHonorMods(2, s.race, s.personality);
    });
    testSensitivity(f, fn, k, 'sciProduction', s => { s.sciProduction = 30; });
    testSensitivity(f, fn, k, 'honor.runes', s => {
      s.honor = clone(s.honor);
      s.honor.runes = 1.20;
    });
    testSensitivity(f, fn, k, 'runes stock (decay)', s => { s.runes = 500000; });
  }

  // -------------------------------------------------------------------------
  // calcPopGrowth TESTS
  // -------------------------------------------------------------------------
  function testCalcPopGrowth() {
    const fn = Engine.calcPopGrowth;
    const f = 'calcPopGrowth';
    const k = 'netPeasantChange';

    // For maxPop-sensitive tests, create a near-max-pop baseline so roomForGrowth
    // is the binding constraint (normal baseline has too much room).
    function makeNearMaxPopState() {
      const s = makeBaseState();
      // Inflate military so currentPop is very close to maxPop (~41492)
      // making roomForGrowth the binding constraint on growth.
      s.peasants = 6000;
      s.soldiers = 18000;
      s.offSpecs = 9000;
      s.defSpecs = 6000;
      s.elites = 2000;
      s.thieves = 300;
      s.wizards = 100;
      return s;
    }

    testSensitivity(f, fn, k, 'acres', s => { s.acres = 3000; s.buildings.barrenLand = 500; });
    testSensitivity(f, fn, k, 'buildings.barrenLand', s => { s.buildings.barrenLand = 500; }, {
      customBase: makeNearMaxPopState
    });
    testSensitivity(f, fn, k, 'buildings.homes', s => { s.buildings.homes = 300; });
    testSensitivity(f, fn, k, 'buildings.hospitals', s => { s.buildings.hospitals = 300; });
    testSensitivity(f, fn, k, 'race→halfling (maxPop 1.10)', s => {
      s.race = GAME_DATA.races.halfling;
    }, { customBase: makeNearMaxPopState });
    testSensitivity(f, fn, k, 'race→darkElf (birthRate 0.75)', s => {
      s.race = GAME_DATA.races.darkElf;
    });
    testSensitivity(f, fn, k, 'pers→paladin (maxPop 1.05)', s => {
      s.personality = GAME_DATA.personalities.paladin;
      s.honor = Engine.getHonorMods(2, s.race, s.personality);
    }, { customBase: makeNearMaxPopState });
    testSensitivity(f, fn, k, 'sciHousing', s => { s.sciHousing = 25; }, {
      customBase: makeNearMaxPopState
    });
    testSensitivity(f, fn, k, 'honor.pop', s => {
      s.honor = clone(s.honor);
      s.honor.pop = 1.15;
    }, { customBase: makeNearMaxPopState });
    testSensitivity(f, fn, k, 'soldiers (currentPop)', s => { s.soldiers = 10000; }, {
      customBase: makeNearMaxPopState
    });
    testSensitivity(f, fn, k, 'spellChastity', s => { s.spellChastity = true; });
    testSensitivity(f, fn, k, 'eowcfActive (boost)', s => {
      s.eowcfActive = true;
      s.eowcfTicksElapsed = 0;
    });
    testSensitivity(f, fn, k, 'eowcfTicksElapsed (0 vs 30)', s => {
      s.eowcfTicksElapsed = 30; // past boost window
    }, {
      customBase: () => { const s = makeBaseState(); s.eowcfActive = true; s.eowcfTicksElapsed = 0; return s; }
    });
    testSensitivity(f, fn, k, 'dragon→celestite (birthRate)', s => { s.dragon = 'celestite'; });
    testSensitivity(f, fn, k, 'ritual→barrier (birthRate)', s => { s.ritual = 'barrier'; });
    testSensitivity(f, fn, k, 'spellLoveAndPeace', s => { s.spellLoveAndPeace = true; });
  }

  // -------------------------------------------------------------------------
  // getHonorMods TESTS
  // -------------------------------------------------------------------------
  function testGetHonorMods() {
    const race = GAME_DATA.races.orc;
    const pers = GAME_DATA.personalities.warHero;
    const persBase = GAME_DATA.personalities.general;

    // Title index 0 vs 4 should differ
    const r0 = Engine.getHonorMods(0, race, pers);
    const r4 = Engine.getHonorMods(4, race, pers);
    const titleChanged = Math.abs(r0.income - r4.income) > 0.0001;
    results.details.push({
      formula: 'getHonorMods', variable: 'titleIndex (0 vs 4)',
      pass: titleChanged, baseVal: r0.income, mutVal: r4.income, changed: titleChanged, shouldChange: true
    });
    if (titleChanged) results.passed++; else results.failed++;

    // War Hero personality (honorEffects 1.50) vs General (no honorEffects)
    const rWH = Engine.getHonorMods(4, race, pers);
    const rGen = Engine.getHonorMods(4, race, persBase);
    const persChanged = Math.abs(rWH.income - rGen.income) > 0.0001;
    results.details.push({
      formula: 'getHonorMods', variable: 'pers→warHero (honorEffects 1.50)',
      pass: persChanged, baseVal: rGen.income, mutVal: rWH.income, changed: persChanged, shouldChange: true
    });
    if (persChanged) results.passed++; else results.failed++;

    // All 7 keys should be present and >= 1
    const keys = ['pop', 'ome', 'income', 'food', 'runes', 'wpa', 'tpa'];
    const allPresent = keys.every(k => typeof r4[k] === 'number' && r4[k] >= 1);
    results.details.push({
      formula: 'getHonorMods', variable: 'all 7 fields present & >= 1',
      pass: allPresent, baseVal: 'N/A', mutVal: keys.map(k => r4[k]).join(', '),
      changed: true, shouldChange: true
    });
    if (allPresent) results.passed++; else results.failed++;

    // titleName should exist
    const hasName = typeof r4.titleName === 'string' && r4.titleName.length > 0;
    results.details.push({
      formula: 'getHonorMods', variable: 'titleName present',
      pass: hasName, baseVal: 'N/A', mutVal: r4.titleName,
      changed: true, shouldChange: true
    });
    if (hasName) results.passed++; else results.failed++;
  }

  // -------------------------------------------------------------------------
  // RACE COVERAGE TESTS
  // -------------------------------------------------------------------------
  // For each race (vs Orc baseline), test every formula where the race has
  // a non-default mod. Also verify races with default mods DON'T change
  // formulas they shouldn't affect.
  //
  // Race mod → formula mapping (non-default only):
  //   Dwarf:    BE 1.25, foodConsumption 1.5  → BE cascades to all formulas
  //   Faery:    BE 0.90, wages 1.15           → BE cascades to all formulas
  //   Dark Elf: birthRate 0.75                → PopGrowth
  //   Halfling: maxPop 1.10                   → PopGrowth (near max pop)
  //   Human:    prisoner bonus (special)      → Income
  //   Undead:   foodConsumption 0             → Food
  //   Avian:    all default                   → no change
  //   Elf:      all default                   → no change
  // -------------------------------------------------------------------------
  function testRaceCoverage() {
    // --- Helper: test one race against one formula ---
    function raceTest(raceName, formulaName, calcFn, outputKey, shouldChange, opts = {}) {
      const raceObj = GAME_DATA.races[raceName];
      testSensitivity(
        `RACE:${formulaName}`, calcFn, outputKey,
        `${raceObj.name} → ${formulaName}${shouldChange ? '' : ' (no change)'}`,
        s => {
          s.race = raceObj;
          s.honor = Engine.getHonorMods(2, s.race, s.personality);
        },
        { ...opts, shouldChange }
      );
    }

    // --- Dwarf: BE 1.25, foodConsumption 1.5 ---
    // BE change cascades to Income, Wages, Food, Runes, PopGrowth
    raceTest('dwarf', 'calcBE',        Engine.calcBE,        'be',              true);
    raceTest('dwarf', 'calcIncome',     Engine.calcIncome,    'modifiedIncome',  true);
    raceTest('dwarf', 'calcWages',      Engine.calcWages,     'modifiedWages',   true);
    raceTest('dwarf', 'calcFood',       Engine.calcFood,      'netFood',         true);
    raceTest('dwarf', 'calcRunes',      Engine.calcRunes,     'netRunes',        true);
    raceTest('dwarf', 'calcPopGrowth',  Engine.calcPopGrowth, 'netPeasantChange',true);

    // --- Faery: BE 0.90, wages 1.15 ---
    // BE change cascades; wages also directly affects calcWages
    raceTest('faery', 'calcBE',        Engine.calcBE,        'be',              true);
    raceTest('faery', 'calcIncome',     Engine.calcIncome,    'modifiedIncome',  true);
    raceTest('faery', 'calcWages',      Engine.calcWages,     'modifiedWages',   true);
    raceTest('faery', 'calcFood',       Engine.calcFood,      'netFood',         true);
    raceTest('faery', 'calcRunes',      Engine.calcRunes,     'netRunes',        true);
    raceTest('faery', 'calcPopGrowth',  Engine.calcPopGrowth, 'netPeasantChange',true);

    // --- Dark Elf: birthRate 0.75 ---
    raceTest('darkElf', 'calcBE',        Engine.calcBE,        'be',              false);
    raceTest('darkElf', 'calcIncome',     Engine.calcIncome,    'modifiedIncome',  false);
    raceTest('darkElf', 'calcWages',      Engine.calcWages,     'modifiedWages',   false);
    raceTest('darkElf', 'calcFood',       Engine.calcFood,      'netFood',         false);
    raceTest('darkElf', 'calcRunes',      Engine.calcRunes,     'netRunes',        false);
    raceTest('darkElf', 'calcPopGrowth',  Engine.calcPopGrowth, 'netPeasantChange',true);

    // --- Halfling: maxPop 1.10 ---
    // Only affects PopGrowth, and only when near max pop
    raceTest('halfling', 'calcBE',        Engine.calcBE,        'be',              false);
    raceTest('halfling', 'calcIncome',     Engine.calcIncome,    'modifiedIncome',  false);
    raceTest('halfling', 'calcWages',      Engine.calcWages,     'modifiedWages',   false);
    raceTest('halfling', 'calcFood',       Engine.calcFood,      'netFood',         false);
    raceTest('halfling', 'calcRunes',      Engine.calcRunes,     'netRunes',        false);
    raceTest('halfling', 'calcPopGrowth',  Engine.calcPopGrowth, 'netPeasantChange',true, {
      customBase: function () {
        const s = makeBaseState();
        s.peasants = 6000; s.soldiers = 18000; s.offSpecs = 9000;
        s.defSpecs = 6000; s.elites = 2000; s.thieves = 300; s.wizards = 100;
        return s;
      }
    });

    // --- Human: prisoner bonus (+2gc/prisoner) ---
    raceTest('human', 'calcBE',        Engine.calcBE,        'be',              false);
    raceTest('human', 'calcIncome',     Engine.calcIncome,    'modifiedIncome',  true);
    raceTest('human', 'calcWages',      Engine.calcWages,     'modifiedWages',   false);
    raceTest('human', 'calcFood',       Engine.calcFood,      'netFood',         false);
    raceTest('human', 'calcRunes',      Engine.calcRunes,     'netRunes',        false);
    raceTest('human', 'calcPopGrowth',  Engine.calcPopGrowth, 'netPeasantChange',false);

    // --- Undead: foodConsumption 0 ---
    raceTest('undead', 'calcBE',        Engine.calcBE,        'be',              false);
    raceTest('undead', 'calcIncome',     Engine.calcIncome,    'modifiedIncome',  false);
    raceTest('undead', 'calcWages',      Engine.calcWages,     'modifiedWages',   false);
    raceTest('undead', 'calcFood',       Engine.calcFood,      'netFood',         true);
    raceTest('undead', 'calcRunes',      Engine.calcRunes,     'netRunes',        false);
    raceTest('undead', 'calcPopGrowth',  Engine.calcPopGrowth, 'netPeasantChange',false);

    // --- Avian: all engine-relevant mods default ---
    raceTest('avian', 'calcBE',        Engine.calcBE,        'be',              false);
    raceTest('avian', 'calcIncome',     Engine.calcIncome,    'modifiedIncome',  false);
    raceTest('avian', 'calcWages',      Engine.calcWages,     'modifiedWages',   false);
    raceTest('avian', 'calcFood',       Engine.calcFood,      'netFood',         false);
    raceTest('avian', 'calcRunes',      Engine.calcRunes,     'netRunes',        false);
    raceTest('avian', 'calcPopGrowth',  Engine.calcPopGrowth, 'netPeasantChange',false);

    // --- Elf: all engine-relevant mods default ---
    raceTest('elf', 'calcBE',        Engine.calcBE,        'be',              false);
    raceTest('elf', 'calcIncome',     Engine.calcIncome,    'modifiedIncome',  false);
    raceTest('elf', 'calcWages',      Engine.calcWages,     'modifiedWages',   false);
    raceTest('elf', 'calcFood',       Engine.calcFood,      'netFood',         false);
    raceTest('elf', 'calcRunes',      Engine.calcRunes,     'netRunes',        false);
    raceTest('elf', 'calcPopGrowth',  Engine.calcPopGrowth, 'netPeasantChange',false);

    // --- Orc: baseline race, all engine-relevant mods default ---
    // Included so that if the baseline changes or Orc mods are updated,
    // the tests will catch it.
    raceTest('orc', 'calcBE',        Engine.calcBE,        'be',              false);
    raceTest('orc', 'calcIncome',     Engine.calcIncome,    'modifiedIncome',  false);
    raceTest('orc', 'calcWages',      Engine.calcWages,     'modifiedWages',   false);
    raceTest('orc', 'calcFood',       Engine.calcFood,      'netFood',         false);
    raceTest('orc', 'calcRunes',      Engine.calcRunes,     'netRunes',        false);
    raceTest('orc', 'calcPopGrowth',  Engine.calcPopGrowth, 'netPeasantChange',false);
  }

  // -------------------------------------------------------------------------
  // PERSONALITY COVERAGE TESTS
  // -------------------------------------------------------------------------
  // For each personality (vs General baseline), test every formula where the
  // personality has a non-default mod. Uses General as baseline because it has
  // all engine-relevant mods at default and no honorEffects, so switching to
  // another neutral personality produces no change.
  //
  // Personality mod → formula mapping (non-default only):
  //   Artisan:  flatRateProduction 1.30  → Income (banks), Food (farms), Runes (towers)
  //   Paladin:  maxPop 1.05              → PopGrowth (near max pop)
  //   War Hero: honorEffects 1.50        → Income, Food, Runes, PopGrowth (via honor)
  //   All others: all engine mods default → no change
  // -------------------------------------------------------------------------
  function testPersCoverage() {
    // Baseline uses General personality (all engine-relevant mods default)
    function makeGeneralBase() {
      const s = makeBaseState();
      s.personality = GAME_DATA.personalities.general;
      s.honor = Engine.getHonorMods(2, s.race, s.personality);
      return s;
    }

    // Near-max-pop baseline with General personality for maxPop tests
    function makeGeneralNearMaxPop() {
      const s = makeGeneralBase();
      s.peasants = 6000; s.soldiers = 18000; s.offSpecs = 9000;
      s.defSpecs = 6000; s.elites = 2000; s.thieves = 300; s.wizards = 100;
      return s;
    }

    function persTest(persName, formulaName, calcFn, outputKey, shouldChange, opts = {}) {
      const persObj = GAME_DATA.personalities[persName];
      testSensitivity(
        `PERS:${formulaName}`, calcFn, outputKey,
        `${persObj.name} → ${formulaName}${shouldChange ? '' : ' (no change)'}`,
        s => {
          s.personality = persObj;
          s.honor = Engine.getHonorMods(2, s.race, s.personality);
        },
        { customBase: makeGeneralBase, ...opts, shouldChange }
      );
    }

    // --- Artisan: flatRateProduction 1.30 ---
    // Affects bank flat income, farm flat food, tower flat runes
    persTest('artisan', 'calcBE',        Engine.calcBE,        'be',              false);
    persTest('artisan', 'calcIncome',     Engine.calcIncome,    'modifiedIncome',  true);
    persTest('artisan', 'calcWages',      Engine.calcWages,     'modifiedWages',   false);
    persTest('artisan', 'calcFood',       Engine.calcFood,      'netFood',         true);
    persTest('artisan', 'calcRunes',      Engine.calcRunes,     'netRunes',        true);
    persTest('artisan', 'calcPopGrowth',  Engine.calcPopGrowth, 'netPeasantChange',false);

    // --- Paladin: maxPop 1.05 ---
    // Only affects PopGrowth when near max pop
    persTest('paladin', 'calcBE',        Engine.calcBE,        'be',              false);
    persTest('paladin', 'calcIncome',     Engine.calcIncome,    'modifiedIncome',  false);
    persTest('paladin', 'calcWages',      Engine.calcWages,     'modifiedWages',   false);
    persTest('paladin', 'calcFood',       Engine.calcFood,      'netFood',         false);
    persTest('paladin', 'calcRunes',      Engine.calcRunes,     'netRunes',        false);
    persTest('paladin', 'calcPopGrowth',  Engine.calcPopGrowth, 'netPeasantChange',true, {
      customBase: makeGeneralNearMaxPop
    });

    // --- War Hero: honorEffects 1.50 ---
    // Amplifies honor bonuses → affects Income, Food, Runes, PopGrowth via honor mods
    persTest('warHero', 'calcBE',        Engine.calcBE,        'be',              false);
    persTest('warHero', 'calcIncome',     Engine.calcIncome,    'modifiedIncome',  true);
    persTest('warHero', 'calcWages',      Engine.calcWages,     'modifiedWages',   false);
    persTest('warHero', 'calcFood',       Engine.calcFood,      'netFood',         true);
    persTest('warHero', 'calcRunes',      Engine.calcRunes,     'netRunes',        true);
    persTest('warHero', 'calcPopGrowth',  Engine.calcPopGrowth, 'netPeasantChange',true, {
      customBase: makeGeneralNearMaxPop
    });

    // --- General: baseline personality, all engine mods default ---
    persTest('general', 'calcBE',        Engine.calcBE,        'be',              false);
    persTest('general', 'calcIncome',     Engine.calcIncome,    'modifiedIncome',  false);
    persTest('general', 'calcWages',      Engine.calcWages,     'modifiedWages',   false);
    persTest('general', 'calcFood',       Engine.calcFood,      'netFood',         false);
    persTest('general', 'calcRunes',      Engine.calcRunes,     'netRunes',        false);
    persTest('general', 'calcPopGrowth',  Engine.calcPopGrowth, 'netPeasantChange',false);

    // --- Heretic: all engine mods default ---
    persTest('heretic', 'calcBE',        Engine.calcBE,        'be',              false);
    persTest('heretic', 'calcIncome',     Engine.calcIncome,    'modifiedIncome',  false);
    persTest('heretic', 'calcWages',      Engine.calcWages,     'modifiedWages',   false);
    persTest('heretic', 'calcFood',       Engine.calcFood,      'netFood',         false);
    persTest('heretic', 'calcRunes',      Engine.calcRunes,     'netRunes',        false);
    persTest('heretic', 'calcPopGrowth',  Engine.calcPopGrowth, 'netPeasantChange',false);

    // --- Mystic: all engine mods default ---
    persTest('mystic', 'calcBE',        Engine.calcBE,        'be',              false);
    persTest('mystic', 'calcIncome',     Engine.calcIncome,    'modifiedIncome',  false);
    persTest('mystic', 'calcWages',      Engine.calcWages,     'modifiedWages',   false);
    persTest('mystic', 'calcFood',       Engine.calcFood,      'netFood',         false);
    persTest('mystic', 'calcRunes',      Engine.calcRunes,     'netRunes',        false);
    persTest('mystic', 'calcPopGrowth',  Engine.calcPopGrowth, 'netPeasantChange',false);

    // --- Necromancer: all engine mods default ---
    persTest('necromancer', 'calcBE',        Engine.calcBE,        'be',              false);
    persTest('necromancer', 'calcIncome',     Engine.calcIncome,    'modifiedIncome',  false);
    persTest('necromancer', 'calcWages',      Engine.calcWages,     'modifiedWages',   false);
    persTest('necromancer', 'calcFood',       Engine.calcFood,      'netFood',         false);
    persTest('necromancer', 'calcRunes',      Engine.calcRunes,     'netRunes',        false);
    persTest('necromancer', 'calcPopGrowth',  Engine.calcPopGrowth, 'netPeasantChange',false);

    // --- Rogue: all engine mods default ---
    persTest('rogue', 'calcBE',        Engine.calcBE,        'be',              false);
    persTest('rogue', 'calcIncome',     Engine.calcIncome,    'modifiedIncome',  false);
    persTest('rogue', 'calcWages',      Engine.calcWages,     'modifiedWages',   false);
    persTest('rogue', 'calcFood',       Engine.calcFood,      'netFood',         false);
    persTest('rogue', 'calcRunes',      Engine.calcRunes,     'netRunes',        false);
    persTest('rogue', 'calcPopGrowth',  Engine.calcPopGrowth, 'netPeasantChange',false);

    // --- Tactician: all engine mods default ---
    persTest('tactician', 'calcBE',        Engine.calcBE,        'be',              false);
    persTest('tactician', 'calcIncome',     Engine.calcIncome,    'modifiedIncome',  false);
    persTest('tactician', 'calcWages',      Engine.calcWages,     'modifiedWages',   false);
    persTest('tactician', 'calcFood',       Engine.calcFood,      'netFood',         false);
    persTest('tactician', 'calcRunes',      Engine.calcRunes,     'netRunes',        false);
    persTest('tactician', 'calcPopGrowth',  Engine.calcPopGrowth, 'netPeasantChange',false);

    // --- Warrior: all engine mods default ---
    persTest('warrior', 'calcBE',        Engine.calcBE,        'be',              false);
    persTest('warrior', 'calcIncome',     Engine.calcIncome,    'modifiedIncome',  false);
    persTest('warrior', 'calcWages',      Engine.calcWages,     'modifiedWages',   false);
    persTest('warrior', 'calcFood',       Engine.calcFood,      'netFood',         false);
    persTest('warrior', 'calcRunes',      Engine.calcRunes,     'netRunes',        false);
    persTest('warrior', 'calcPopGrowth',  Engine.calcPopGrowth, 'netPeasantChange',false);
  }

  // -------------------------------------------------------------------------
  // DRAGON COVERAGE TESTS
  // -------------------------------------------------------------------------
  // For each dragon, test every formula. Only Celestite has an engine-relevant
  // effect (birthRate -0.60 → PopGrowth). Topaz (BE, Income) and Ruby (Wages)
  // have effects NOT yet implemented → tested as GAPs.
  //
  // Dragon effect → formula mapping:
  //   Celestite: birthRate -0.60           → PopGrowth
  //   Topaz:     BE -0.30, income -0.25   → calcBE (GAP), calcIncome (GAP)
  //   Ruby:      wages +0.30              → calcWages (GAP)
  //   Amethyst:  spellSuccess, sabSuccess → no engine formula
  //   Emerald:   casualties, battleGains  → no engine formula
  //   Sapphire:  wpa, tpa                 → no engine formula
  // -------------------------------------------------------------------------
  function testDragonCoverage() {
    function dragonTest(dragonName, formulaName, calcFn, outputKey, shouldChange, opts = {}) {
      const dragonData = GAME_DATA.dragons[dragonName];
      testSensitivity(
        `DRAGON:${formulaName}`, calcFn, outputKey,
        `${dragonData.name} → ${formulaName}${opts.gap ? ' (GAP)' : (shouldChange ? '' : ' (no change)')}`,
        s => { s.dragon = dragonName; },
        { ...opts, shouldChange }
      );
    }

    // --- Celestite: birthRate -0.60 → PopGrowth ---
    dragonTest('celestite', 'calcBE',        Engine.calcBE,        'be',              false);
    dragonTest('celestite', 'calcIncome',     Engine.calcIncome,    'modifiedIncome',  false);
    dragonTest('celestite', 'calcWages',      Engine.calcWages,     'modifiedWages',   false);
    dragonTest('celestite', 'calcFood',       Engine.calcFood,      'netFood',         false);
    dragonTest('celestite', 'calcRunes',      Engine.calcRunes,     'netRunes',        false);
    dragonTest('celestite', 'calcPopGrowth',  Engine.calcPopGrowth, 'netPeasantChange',true);

    // --- Topaz: BE -0.30, income -0.25 ---
    // BE change cascades to Wages, Food, Runes, PopGrowth
    dragonTest('topaz', 'calcBE',        Engine.calcBE,        'be',              true);
    dragonTest('topaz', 'calcIncome',     Engine.calcIncome,    'modifiedIncome',  true);
    dragonTest('topaz', 'calcWages',      Engine.calcWages,     'modifiedWages',   true);
    dragonTest('topaz', 'calcFood',       Engine.calcFood,      'netFood',         true);
    dragonTest('topaz', 'calcRunes',      Engine.calcRunes,     'netRunes',        true);
    dragonTest('topaz', 'calcPopGrowth',  Engine.calcPopGrowth, 'netPeasantChange',true);

    // --- Ruby: wages +0.30 ---
    dragonTest('ruby', 'calcBE',        Engine.calcBE,        'be',              false);
    dragonTest('ruby', 'calcIncome',     Engine.calcIncome,    'modifiedIncome',  false);
    dragonTest('ruby', 'calcWages',      Engine.calcWages,     'modifiedWages',   true);
    dragonTest('ruby', 'calcFood',       Engine.calcFood,      'netFood',         false);
    dragonTest('ruby', 'calcRunes',      Engine.calcRunes,     'netRunes',        false);
    dragonTest('ruby', 'calcPopGrowth',  Engine.calcPopGrowth, 'netPeasantChange',false);

    // --- Amethyst: no engine-relevant effects ---
    dragonTest('amethyst', 'calcBE',        Engine.calcBE,        'be',              false);
    dragonTest('amethyst', 'calcIncome',     Engine.calcIncome,    'modifiedIncome',  false);
    dragonTest('amethyst', 'calcWages',      Engine.calcWages,     'modifiedWages',   false);
    dragonTest('amethyst', 'calcFood',       Engine.calcFood,      'netFood',         false);
    dragonTest('amethyst', 'calcRunes',      Engine.calcRunes,     'netRunes',        false);
    dragonTest('amethyst', 'calcPopGrowth',  Engine.calcPopGrowth, 'netPeasantChange',false);

    // --- Emerald: no engine-relevant effects ---
    dragonTest('emerald', 'calcBE',        Engine.calcBE,        'be',              false);
    dragonTest('emerald', 'calcIncome',     Engine.calcIncome,    'modifiedIncome',  false);
    dragonTest('emerald', 'calcWages',      Engine.calcWages,     'modifiedWages',   false);
    dragonTest('emerald', 'calcFood',       Engine.calcFood,      'netFood',         false);
    dragonTest('emerald', 'calcRunes',      Engine.calcRunes,     'netRunes',        false);
    dragonTest('emerald', 'calcPopGrowth',  Engine.calcPopGrowth, 'netPeasantChange',false);

    // --- Sapphire: no engine-relevant effects ---
    dragonTest('sapphire', 'calcBE',        Engine.calcBE,        'be',              false);
    dragonTest('sapphire', 'calcIncome',     Engine.calcIncome,    'modifiedIncome',  false);
    dragonTest('sapphire', 'calcWages',      Engine.calcWages,     'modifiedWages',   false);
    dragonTest('sapphire', 'calcFood',       Engine.calcFood,      'netFood',         false);
    dragonTest('sapphire', 'calcRunes',      Engine.calcRunes,     'netRunes',        false);
    dragonTest('sapphire', 'calcPopGrowth',  Engine.calcPopGrowth, 'netPeasantChange',false);
  }

  // -------------------------------------------------------------------------
  // RITUAL COVERAGE TESTS
  // -------------------------------------------------------------------------
  // For each ritual, test every formula. Expedient affects BE (+0.20) and
  // Wages (-0.25); BE cascades to Income, Food, Runes, PopGrowth.
  // Barrier affects birthRate (+0.20 → PopGrowth).
  // All other rituals have no engine-relevant effects.
  //
  // Ritual effect → formula mapping:
  //   Expedient:   BE +0.20, wages -0.25 → BE + all via cascade, Wages directly
  //   Barrier:     birthRate +0.20       → PopGrowth
  //   Ascendancy:  wizardProd, wizLosses → no engine formula
  //   Haste:       attackTime, trainTime → no engine formula
  //   Havoc:       offWPA, offTPA, spell → no engine formula
  //   Onslaught:   ome, enemyCasualties  → no engine formula
  //   Stalwart:    dme, ownCasualties    → no engine formula
  // -------------------------------------------------------------------------
  function testRitualCoverage() {
    function ritualTest(ritualName, formulaName, calcFn, outputKey, shouldChange, opts = {}) {
      const ritualData = GAME_DATA.rituals[ritualName];
      testSensitivity(
        `RITUAL:${formulaName}`, calcFn, outputKey,
        `${ritualData.name} → ${formulaName}${shouldChange ? '' : ' (no change)'}`,
        s => { s.ritual = ritualName; },
        { ...opts, shouldChange }
      );
    }

    // --- Expedient: BE +0.20, wages -0.25 ---
    // BE change cascades to Income, Food, Runes, PopGrowth
    ritualTest('expedient', 'calcBE',        Engine.calcBE,        'be',              true);
    ritualTest('expedient', 'calcIncome',     Engine.calcIncome,    'modifiedIncome',  true);
    ritualTest('expedient', 'calcWages',      Engine.calcWages,     'modifiedWages',   true);
    ritualTest('expedient', 'calcFood',       Engine.calcFood,      'netFood',         true);
    ritualTest('expedient', 'calcRunes',      Engine.calcRunes,     'netRunes',        true);
    ritualTest('expedient', 'calcPopGrowth',  Engine.calcPopGrowth, 'netPeasantChange',true);

    // --- Barrier: birthRate +0.20 ---
    ritualTest('barrier', 'calcBE',        Engine.calcBE,        'be',              false);
    ritualTest('barrier', 'calcIncome',     Engine.calcIncome,    'modifiedIncome',  false);
    ritualTest('barrier', 'calcWages',      Engine.calcWages,     'modifiedWages',   false);
    ritualTest('barrier', 'calcFood',       Engine.calcFood,      'netFood',         false);
    ritualTest('barrier', 'calcRunes',      Engine.calcRunes,     'netRunes',        false);
    ritualTest('barrier', 'calcPopGrowth',  Engine.calcPopGrowth, 'netPeasantChange',true);

    // --- Ascendancy: no engine-relevant effects ---
    ritualTest('ascendency', 'calcBE',        Engine.calcBE,        'be',              false);
    ritualTest('ascendency', 'calcIncome',     Engine.calcIncome,    'modifiedIncome',  false);
    ritualTest('ascendency', 'calcWages',      Engine.calcWages,     'modifiedWages',   false);
    ritualTest('ascendency', 'calcFood',       Engine.calcFood,      'netFood',         false);
    ritualTest('ascendency', 'calcRunes',      Engine.calcRunes,     'netRunes',        false);
    ritualTest('ascendency', 'calcPopGrowth',  Engine.calcPopGrowth, 'netPeasantChange',false);

    // --- Haste: no engine-relevant effects ---
    ritualTest('haste', 'calcBE',        Engine.calcBE,        'be',              false);
    ritualTest('haste', 'calcIncome',     Engine.calcIncome,    'modifiedIncome',  false);
    ritualTest('haste', 'calcWages',      Engine.calcWages,     'modifiedWages',   false);
    ritualTest('haste', 'calcFood',       Engine.calcFood,      'netFood',         false);
    ritualTest('haste', 'calcRunes',      Engine.calcRunes,     'netRunes',        false);
    ritualTest('haste', 'calcPopGrowth',  Engine.calcPopGrowth, 'netPeasantChange',false);

    // --- Havoc: no engine-relevant effects ---
    ritualTest('havoc', 'calcBE',        Engine.calcBE,        'be',              false);
    ritualTest('havoc', 'calcIncome',     Engine.calcIncome,    'modifiedIncome',  false);
    ritualTest('havoc', 'calcWages',      Engine.calcWages,     'modifiedWages',   false);
    ritualTest('havoc', 'calcFood',       Engine.calcFood,      'netFood',         false);
    ritualTest('havoc', 'calcRunes',      Engine.calcRunes,     'netRunes',        false);
    ritualTest('havoc', 'calcPopGrowth',  Engine.calcPopGrowth, 'netPeasantChange',false);

    // --- Onslaught: no engine-relevant effects ---
    ritualTest('onslaught', 'calcBE',        Engine.calcBE,        'be',              false);
    ritualTest('onslaught', 'calcIncome',     Engine.calcIncome,    'modifiedIncome',  false);
    ritualTest('onslaught', 'calcWages',      Engine.calcWages,     'modifiedWages',   false);
    ritualTest('onslaught', 'calcFood',       Engine.calcFood,      'netFood',         false);
    ritualTest('onslaught', 'calcRunes',      Engine.calcRunes,     'netRunes',        false);
    ritualTest('onslaught', 'calcPopGrowth',  Engine.calcPopGrowth, 'netPeasantChange',false);

    // --- Stalwart: no engine-relevant effects ---
    ritualTest('stalwart', 'calcBE',        Engine.calcBE,        'be',              false);
    ritualTest('stalwart', 'calcIncome',     Engine.calcIncome,    'modifiedIncome',  false);
    ritualTest('stalwart', 'calcWages',      Engine.calcWages,     'modifiedWages',   false);
    ritualTest('stalwart', 'calcFood',       Engine.calcFood,      'netFood',         false);
    ritualTest('stalwart', 'calcRunes',      Engine.calcRunes,     'netRunes',        false);
    ritualTest('stalwart', 'calcPopGrowth',  Engine.calcPopGrowth, 'netPeasantChange',false);
  }

  // -------------------------------------------------------------------------
  // SPELL COVERAGE TESTS
  // -------------------------------------------------------------------------
  // For each spell with engine effects, test every formula.
  // Ghost Workers → calcBE (cascades to all)
  // Inspire Army / Hero's Inspiration → calcWages
  // Love and Peace → calcPopGrowth
  // Fertile Lands → calcFood (already tested in sensitivity)
  // Miner's Mystique → calcIncome (already tested in sensitivity)
  // Chastity → calcPopGrowth (already tested in sensitivity)
  //
  // Spells without engine effects should NOT change any formula.
  // -------------------------------------------------------------------------
  function testSpellCoverage() {
    function spellTest(spellKey, spellLabel, formulaName, calcFn, outputKey, shouldChange, opts = {}) {
      testSensitivity(
        `SPELL:${formulaName}`, calcFn, outputKey,
        `${spellLabel} → ${formulaName}${shouldChange ? '' : ' (no change)'}`,
        s => { s[spellKey] = true; },
        { ...opts, shouldChange }
      );
    }

    // --- Ghost Workers: -25% jobs for BE → cascades to all ---
    spellTest('spellGhostWorkers', 'Ghost Workers', 'calcBE',        Engine.calcBE,        'be',              true);
    spellTest('spellGhostWorkers', 'Ghost Workers', 'calcIncome',     Engine.calcIncome,    'modifiedIncome',  true);
    spellTest('spellGhostWorkers', 'Ghost Workers', 'calcWages',      Engine.calcWages,     'modifiedWages',   true);
    spellTest('spellGhostWorkers', 'Ghost Workers', 'calcFood',       Engine.calcFood,      'netFood',         true);
    spellTest('spellGhostWorkers', 'Ghost Workers', 'calcRunes',      Engine.calcRunes,     'netRunes',        true);
    spellTest('spellGhostWorkers', 'Ghost Workers', 'calcPopGrowth',  Engine.calcPopGrowth, 'netPeasantChange',true);

    // --- Inspire Army: -15% wages ---
    spellTest('spellInspireArmy', 'Inspire Army', 'calcBE',        Engine.calcBE,        'be',              false);
    spellTest('spellInspireArmy', 'Inspire Army', 'calcIncome',     Engine.calcIncome,    'modifiedIncome',  false);
    spellTest('spellInspireArmy', 'Inspire Army', 'calcWages',      Engine.calcWages,     'modifiedWages',   true);
    spellTest('spellInspireArmy', 'Inspire Army', 'calcFood',       Engine.calcFood,      'netFood',         false);
    spellTest('spellInspireArmy', 'Inspire Army', 'calcRunes',      Engine.calcRunes,     'netRunes',        false);
    spellTest('spellInspireArmy', 'Inspire Army', 'calcPopGrowth',  Engine.calcPopGrowth, 'netPeasantChange',false);

    // --- Hero's Inspiration: -30% wages ---
    spellTest('spellHerosInspiration', "Hero's Inspiration", 'calcBE',        Engine.calcBE,        'be',              false);
    spellTest('spellHerosInspiration', "Hero's Inspiration", 'calcIncome',     Engine.calcIncome,    'modifiedIncome',  false);
    spellTest('spellHerosInspiration', "Hero's Inspiration", 'calcWages',      Engine.calcWages,     'modifiedWages',   true);
    spellTest('spellHerosInspiration', "Hero's Inspiration", 'calcFood',       Engine.calcFood,      'netFood',         false);
    spellTest('spellHerosInspiration', "Hero's Inspiration", 'calcRunes',      Engine.calcRunes,     'netRunes',        false);
    spellTest('spellHerosInspiration', "Hero's Inspiration", 'calcPopGrowth',  Engine.calcPopGrowth, 'netPeasantChange',false);

    // --- Love and Peace: +0.85% birth rate ---
    spellTest('spellLoveAndPeace', 'Love and Peace', 'calcBE',        Engine.calcBE,        'be',              false);
    spellTest('spellLoveAndPeace', 'Love and Peace', 'calcIncome',     Engine.calcIncome,    'modifiedIncome',  false);
    spellTest('spellLoveAndPeace', 'Love and Peace', 'calcWages',      Engine.calcWages,     'modifiedWages',   false);
    spellTest('spellLoveAndPeace', 'Love and Peace', 'calcFood',       Engine.calcFood,      'netFood',         false);
    spellTest('spellLoveAndPeace', 'Love and Peace', 'calcRunes',      Engine.calcRunes,     'netRunes',        false);
    spellTest('spellLoveAndPeace', 'Love and Peace', 'calcPopGrowth',  Engine.calcPopGrowth, 'netPeasantChange',true);

    // --- Fertile Lands: +25% food ---
    spellTest('spellFertileLands', 'Fertile Lands', 'calcBE',        Engine.calcBE,        'be',              false);
    spellTest('spellFertileLands', 'Fertile Lands', 'calcIncome',     Engine.calcIncome,    'modifiedIncome',  false);
    spellTest('spellFertileLands', 'Fertile Lands', 'calcWages',      Engine.calcWages,     'modifiedWages',   false);
    spellTest('spellFertileLands', 'Fertile Lands', 'calcFood',       Engine.calcFood,      'netFood',         true);
    spellTest('spellFertileLands', 'Fertile Lands', 'calcRunes',      Engine.calcRunes,     'netRunes',        false);
    spellTest('spellFertileLands', 'Fertile Lands', 'calcPopGrowth',  Engine.calcPopGrowth, 'netPeasantChange',false);

    // --- Miner's Mystique: +0.3gc per peasant ---
    spellTest('spellMinersM', "Miner's Mystique", 'calcBE',        Engine.calcBE,        'be',              false);
    spellTest('spellMinersM', "Miner's Mystique", 'calcIncome',     Engine.calcIncome,    'modifiedIncome',  true);
    spellTest('spellMinersM', "Miner's Mystique", 'calcWages',      Engine.calcWages,     'modifiedWages',   false);
    spellTest('spellMinersM', "Miner's Mystique", 'calcFood',       Engine.calcFood,      'netFood',         false);
    spellTest('spellMinersM', "Miner's Mystique", 'calcRunes',      Engine.calcRunes,     'netRunes',        false);
    spellTest('spellMinersM', "Miner's Mystique", 'calcPopGrowth',  Engine.calcPopGrowth, 'netPeasantChange',false);

    // --- Chastity: -50% birth rate ---
    spellTest('spellChastity', 'Chastity', 'calcBE',        Engine.calcBE,        'be',              false);
    spellTest('spellChastity', 'Chastity', 'calcIncome',     Engine.calcIncome,    'modifiedIncome',  false);
    spellTest('spellChastity', 'Chastity', 'calcWages',      Engine.calcWages,     'modifiedWages',   false);
    spellTest('spellChastity', 'Chastity', 'calcFood',       Engine.calcFood,      'netFood',         false);
    spellTest('spellChastity', 'Chastity', 'calcRunes',      Engine.calcRunes,     'netRunes',        false);
    spellTest('spellChastity', 'Chastity', 'calcPopGrowth',  Engine.calcPopGrowth, 'netPeasantChange',true);
  }

  // -------------------------------------------------------------------------
  // CROSS-FORMULA CASCADE TESTS
  // -------------------------------------------------------------------------
  function testCascades() {
    // sciTools → BE → Income, Food, Runes all change
    {
      const base = makeBaseState();
      const mut = makeBaseState();
      mut.sciTools = 30;

      const bIncome = Engine.calcIncome(base).modifiedIncome;
      const mIncome = Engine.calcIncome(mut).modifiedIncome;
      const bFood = Engine.calcFood(base).netFood;
      const mFood = Engine.calcFood(mut).netFood;
      const bRunes = Engine.calcRunes(base).netRunes;
      const mRunes = Engine.calcRunes(mut).netRunes;

      const incomeChanged = Math.abs(bIncome - mIncome) > 0.0001;
      const foodChanged = Math.abs(bFood - mFood) > 0.0001;
      const runesChanged = Math.abs(bRunes - mRunes) > 0.0001;
      const allChanged = incomeChanged && foodChanged && runesChanged;

      results.details.push({
        formula: 'CASCADE', variable: 'sciTools → Income+Food+Runes via BE',
        pass: allChanged,
        baseVal: `I:${Math.round(bIncome)} F:${Math.round(bFood)} R:${Math.round(bRunes)}`,
        mutVal: `I:${Math.round(mIncome)} F:${Math.round(mFood)} R:${Math.round(mRunes)}`,
        changed: allChanged, shouldChange: true
      });
      if (allChanged) results.passed++; else results.failed++;
    }

    // peasants → BE, Income, Food, PopGrowth all change
    {
      const base = makeBaseState();
      const mut = makeBaseState();
      mut.peasants = 3000;

      const bBE = Engine.calcBE(base).be;
      const mBE = Engine.calcBE(mut).be;
      const bIncome = Engine.calcIncome(base).modifiedIncome;
      const mIncome = Engine.calcIncome(mut).modifiedIncome;
      const bFood = Engine.calcFood(base).netFood;
      const mFood = Engine.calcFood(mut).netFood;
      const bPop = Engine.calcPopGrowth(base).netPeasantChange;
      const mPop = Engine.calcPopGrowth(mut).netPeasantChange;

      const allChanged = Math.abs(bBE - mBE) > 0.0001
        && Math.abs(bIncome - mIncome) > 0.0001
        && Math.abs(bFood - mFood) > 0.0001
        && Math.abs(bPop - mPop) > 0.0001;

      results.details.push({
        formula: 'CASCADE', variable: 'peasants → BE+Income+Food+PopGrowth',
        pass: allChanged,
        baseVal: `BE:${bBE.toFixed(3)} I:${Math.round(bIncome)} F:${Math.round(bFood)} P:${bPop}`,
        mutVal: `BE:${mBE.toFixed(3)} I:${Math.round(mIncome)} F:${Math.round(mFood)} P:${mPop}`,
        changed: allChanged, shouldChange: true
      });
      if (allChanged) results.passed++; else results.failed++;
    }

    // ritual→expedient → BE and Wages both change
    {
      const base = makeBaseState();
      const mut = makeBaseState();
      mut.ritual = 'expedient';

      const bBE = Engine.calcBE(base).be;
      const mBE = Engine.calcBE(mut).be;
      const bWages = Engine.calcWages(base).modifiedWages;
      const mWages = Engine.calcWages(mut).modifiedWages;

      const allChanged = Math.abs(bBE - mBE) > 0.0001
        && Math.abs(bWages - mWages) > 0.0001;

      results.details.push({
        formula: 'CASCADE', variable: 'ritual→expedient → BE+Wages',
        pass: allChanged,
        baseVal: `BE:${bBE.toFixed(3)} W:${Math.round(bWages)}`,
        mutVal: `BE:${mBE.toFixed(3)} W:${Math.round(mWages)}`,
        changed: allChanged, shouldChange: true
      });
      if (allChanged) results.passed++; else results.failed++;
    }
  }

  // -------------------------------------------------------------------------
  // RUN ALL TESTS & RENDER
  // -------------------------------------------------------------------------
  function runAll() {
    testCalcBE();
    testCalcIncome();
    testCalcWages();
    testCalcFood();
    testCalcRunes();
    testCalcPopGrowth();
    testGetHonorMods();
    testRaceCoverage();
    testPersCoverage();
    testDragonCoverage();
    testRitualCoverage();
    testSpellCoverage();
    testCascades();

    render();
  }

  function render() {
    const total = results.passed + results.failed;
    const summaryEl = document.getElementById('summary');
    const allPass = results.failed === 0;
    summaryEl.className = 'summary ' + (allPass ? 'pass' : 'fail');
    summaryEl.innerHTML = `<strong>${results.passed}/${total} passed</strong>`
      + (results.gaps > 0 ? ` &nbsp;|&nbsp; ${results.gaps} known GAPs` : '')
      + (results.failed > 0 ? ` &nbsp;|&nbsp; <span style="color:#e74c3c">${results.failed} FAILED</span>` : '');

    const container = document.getElementById('results');
    let html = '';
    let currentFormula = '';

    for (const d of results.details) {
      if (d.formula !== currentFormula) {
        currentFormula = d.formula;
        html += `<div class="section">${currentFormula}</div>`;
      }

      const cls = d.isGap ? 'gap' : (d.pass ? 'pass' : 'fail');
      const icon = d.isGap ? 'GAP' : (d.pass ? 'PASS' : 'FAIL');
      const detail = d.isGap
        ? d.label
        : `[${icon}] ${d.variable} — base: ${d.baseVal}, mutated: ${d.mutVal}${!d.pass ? ' (expected ' + (d.shouldChange ? 'change' : 'no change') + ')' : ''}`;

      html += `<div class="test ${cls}">${detail}</div>`;
    }

    container.innerHTML = html;

    // Console summary
    console.log(`\n=== ENGINE COVERAGE: ${results.passed}/${total} passed, ${results.gaps} GAPs ===`);
    for (const d of results.details) {
      if (!d.pass) {
        console.warn(`FAIL: ${d.formula} / ${d.variable} — base: ${d.baseVal}, mut: ${d.mutVal}`);
      }
    }
    if (results.gaps > 0) {
      console.log('\nKnown GAPs (not yet implemented):');
      for (const d of results.details) {
        if (d.isGap) console.log(`  - ${d.label}`);
      }
    }
  }

  runAll();
})();
