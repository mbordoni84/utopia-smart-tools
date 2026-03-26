const GAME_DATA = {
  races: {
    avian: {
      name: 'Avian',
      military: {
        soldiers: { off: 3, def: 0 },
        offSpec: { name: 'Griffins', off: 13, def: 0 },
        defSpec: { name: 'Harpies', off: 0, def: 9 },
        elites: { name: 'Drakes', off: 16, def: 6, cost: 900, nw: 8.0 },
        warHorses: { off: 0 },
        thiefCost: 500
      },
      mods: {
        attackTime: -0.20,
        trainingTime: -0.40,
        birthRate: 1.0,
        foodConsumption: 1.0,
        income: 1.0,
        buildingEfficiency: 1.0,
        draftCost: 1.0,
        ome: 1.0,
        dme: 1.0,
        buildTime: 1.0,
        buildCost: 1.0,
        wages: 1.0,
        maxPop: 1.0,
        foodProdPerAcre: 0,
        runeCostMod: 1.0,
        wpa: 1.0,
        tpa: 1.0
      },
      noStables: true,
      canAmbush: false
    },
    darkElf: {
      name: 'Dark Elf',
      military: {
        soldiers: { off: 3, def: 0 },
        offSpec: { name: 'Night Rangers', off: 15, def: 0 },
        defSpec: { name: 'Druids', off: 0, def: 8 },
        elites: { name: 'Drows', off: 4, def: 12, cost: 750, nw: 7.0 },
        warHorses: { off: 2 },
        thiefCost: 500
      },
      mods: {
        attackTime: 1.0,
        trainingTime: 1.0,
        birthRate: 0.75,
        foodConsumption: 1.0,
        income: 1.0,
        buildingEfficiency: 1.0,
        draftCost: 1.0,
        ome: 1.0,
        dme: 1.0,
        buildTime: 1.0,
        buildCost: 1.0,
        wages: 1.0,
        maxPop: 1.0,
        foodProdPerAcre: 0,
        runeCostMod: 0.50,
        wpa: 1.0,
        tpa: 1.0,
        instantSpellDamage: 1.25
      }
    },
    dwarf: {
      name: 'Dwarf',
      military: {
        soldiers: { off: 3, def: 0 },
        offSpec: { name: 'Warriors', off: 10, def: 0 },
        defSpec: { name: 'Axemen', off: 0, def: 11 },
        elites: { name: 'Berserkers', off: 15, def: 9, cost: 900, nw: 8.0 },
        warHorses: { off: 2 },
        thiefCost: 500
      },
      mods: {
        attackTime: 1.10,
        trainingTime: 1.0,
        birthRate: 1.0,
        foodConsumption: 1.5,
        income: 1.0,
        buildingEfficiency: 1.25,
        draftCost: 1.0,
        ome: 1.0,
        dme: 1.0,
        buildTime: 0.50,
        buildCost: 1.0,
        buildCredits: 1.20,
        wages: 1.0,
        maxPop: 1.0,
        foodProdPerAcre: 0,
        runeCostMod: 1.0,
        wpa: 1.0,
        tpa: 1.0
      },
      cantAccelerate: true
    },
    elf: {
      name: 'Elf',
      military: {
        soldiers: { off: 3, def: 0 },
        offSpec: { name: 'Rangers', off: 10, def: 0 },
        defSpec: { name: 'Archers', off: 0, def: 13 },
        elites: { name: 'Elf Lords', off: 14, def: 6, cost: 800, nw: 7.0 },
        warHorses: { off: 2 },
        thiefCost: 500
      },
      mods: {
        attackTime: 1.0,
        trainingTime: 1.0,
        birthRate: 1.0,
        foodConsumption: 1.0,
        income: 1.0,
        buildingEfficiency: 1.0,
        draftCost: 1.0,
        ome: 1.0,
        dme: 1.0,
        buildTime: 1.0,
        buildCost: 1.0,
        wages: 1.0,
        maxPop: 1.0,
        foodProdPerAcre: 0,
        runeCostMod: 1.0,
        wpa: 1.30,
        tpa: 0.80
      }
    },
    faery: {
      name: 'Faery',
      military: {
        soldiers: { off: 3, def: 0 },
        offSpec: { name: 'Magicians', off: 10, def: 0 },
        defSpec: { name: 'Druids', off: 0, def: 10 },
        elites: { name: 'Beastmasters', off: 8, def: 15, cost: 900, nw: 9.0 },
        warHorses: { off: 2 },
        thiefCost: 500
      },
      mods: {
        attackTime: 1.0,
        trainingTime: 1.0,
        birthRate: 1.0,
        foodConsumption: 1.0,
        income: 1.0,
        buildingEfficiency: 0.90,
        draftCost: 1.0,
        ome: 1.0,
        dme: 1.0,
        buildTime: 1.0,
        buildCost: 1.0,
        wages: 1.15,
        maxPop: 1.0,
        foodProdPerAcre: 0,
        runeCostMod: 1.0,
        wpa: 1.25,
        tpa: 1.0,
        spellDuration: 1.25
      }
    },
    halfling: {
      name: 'Halfling',
      military: {
        soldiers: { off: 3, def: 0 },
        offSpec: { name: 'Strongarms', off: 10, def: 0 },
        defSpec: { name: 'Slingers', off: 0, def: 11 },
        elites: { name: 'Brutes', off: 10, def: 13, cost: 900, nw: 8.0 },
        warHorses: { off: 2 },
        thiefCost: 500
      },
      mods: {
        attackTime: 1.0,
        trainingTime: 1.0,
        birthRate: 1.0,
        foodConsumption: 1.0,
        income: 1.0,
        buildingEfficiency: 1.0,
        draftCost: 1.0,
        ome: 1.0,
        dme: 1.0,
        buildTime: 1.0,
        buildCost: 1.0,
        wages: 1.0,
        maxPop: 1.10,
        foodProdPerAcre: 0,
        runeCostMod: 1.0,
        wpa: 1.0,
        tpa: 1.20,
        ownCasualties: 1.15
      }
    },
    human: {
      name: 'Human',
      military: {
        soldiers: { off: 3, def: 0 },
        offSpec: { name: 'Swordsmen', off: 12, def: 0 },
        defSpec: { name: 'Archers', off: 0, def: 10 },
        elites: { name: 'Knights', off: 14, def: 9, cost: 1000, nw: 8.0 },
        warHorses: { off: 3 },
        thiefCost: 500
      },
      mods: {
        attackTime: 1.0,
        trainingTime: 1.0,
        birthRate: 1.0,
        foodConsumption: 1.0,
        income: 1.0,
        buildingEfficiency: 1.0,
        draftCost: 1.0,
        ome: 1.0,
        dme: 1.0,
        buildTime: 1.0,
        buildCost: 1.0,
        wages: 1.0,
        maxPop: 1.0,
        foodProdPerAcre: 0,
        runeCostMod: 1.50,
        wpa: 1.0,
        tpa: 1.0,
        scienceEffectiveness: 1.15,
        prisonerCapPerAcre: 2,
        libraryEffectiveness: 0.50
      }
    },
    orc: {
      name: 'Orc',
      military: {
        soldiers: { off: 3, def: 0 },
        offSpec: { name: 'Goblins', off: 13, def: 0 },
        defSpec: { name: 'Trolls', off: 0, def: 10 },
        elites: { name: 'Ogres', off: 20, def: 1, cost: 850, nw: 7.0 },
        warHorses: { off: 2 },
        thiefCost: 500
      },
      mods: {
        attackTime: 1.0,
        trainingTime: 1.0,
        birthRate: 1.0,
        foodConsumption: 1.0,
        income: 1.0,
        buildingEfficiency: 1.0,
        draftCost: 0.50,
        ome: 1.0,
        dme: 0.85,
        buildTime: 1.0,
        buildCost: 1.0,
        wages: 1.0,
        maxPop: 1.0,
        foodProdPerAcre: 0,
        runeCostMod: 1.0,
        wpa: 1.0,
        tpa: 1.0,
        battleGains: 1.15
      }
    },
    undead: {
      name: 'Undead',
      military: {
        soldiers: { off: 3, def: 0 },
        offSpec: { name: 'Skeletons', off: 11, def: 0 },
        defSpec: { name: 'Zombies', off: 0, def: 10 },
        elites: { name: 'Ghouls', off: 16, def: 7, cost: 900, nw: 8.0 },
        warHorses: { off: 2 },
        thiefCost: 500
      },
      mods: {
        attackTime: 1.0,
        trainingTime: 1.0,
        birthRate: 1.0,
        foodConsumption: 0,
        income: 1.0,
        buildingEfficiency: 1.0,
        draftCost: 1.0,
        ome: 0.95,
        dme: 1.0,
        buildTime: 1.0,
        buildCost: 1.0,
        wages: 1.0,
        maxPop: 1.0,
        foodProdPerAcre: 0,
        runeCostMod: 1.0,
        wpa: 1.0,
        tpa: 1.0,
        ownCasualties: 0.60
      },
      plagueImmune: true
    }
  },

  personalities: {
    artisan: {
      name: 'Artisan',
      mods: {
        flatRateCapacity: 1.30,
        flatRateProduction: 1.30,
        income: 1.0,
        buildingEfficiency: 1.0,
        draftCost: 1.0,
        trainingCost: 1.0,
        trainingTime: 1.0,
        buildTime: 1.0,
        buildCost: 1.0,
        wages: 1.0,
        maxPop: 1.0,
        ome: 1.0,
        dme: 1.0,
        birthRate: 1.0,
        foodProdPerAcre: 0,
        attackTime: 1.0,
        specCredits: 1.0,
        buildCredits: 1.0
      },
      scienceBonus: ['alchemy', 'artisan', 'bookkeeping', 'production', 'housing', 'tools'],
      startingBonus: { buildCredits: 200, soldiers: 600, specCredits: 600 }
    },
    general: {
      name: 'General',
      mods: {
        flatRateCapacity: 1.0,
        flatRateProduction: 1.0,
        income: 1.0,
        buildingEfficiency: 1.0,
        draftCost: 1.0,
        trainingCost: 0.75,
        trainingTime: 1.0,
        buildTime: 1.0,
        buildCost: 1.0,
        wages: 1.0,
        maxPop: 1.0,
        ome: 1.0,
        dme: 1.0,
        birthRate: 1.0,
        foodProdPerAcre: 0,
        attackTime: 1.0,
        specCredits: 1.20,
        buildCredits: 1.0
      },
      scienceBonus: ['bookkeeping'],
      startingBonus: { soldiers: 800, specCredits: 800 },
      extraGenerals: 1
    },
    heretic: {
      name: 'Heretic',
      mods: {
        flatRateCapacity: 1.0,
        flatRateProduction: 1.0,
        income: 1.0,
        buildingEfficiency: 1.0,
        draftCost: 1.0,
        trainingCost: 1.0,
        trainingTime: 1.0,
        buildTime: 1.0,
        buildCost: 1.0,
        wages: 1.0,
        maxPop: 1.0,
        ome: 1.0,
        dme: 1.0,
        birthRate: 1.0,
        foodProdPerAcre: 0,
        attackTime: 1.0,
        specCredits: 1.0,
        buildCredits: 1.0,
        guildLandEffect: 1.50,
        tpa: 1.25,
        thiefCost: 0.60,
        sabDamage: 1.20
      },
      scienceBonus: ['cunning', 'finesse', 'channeling', 'shielding', 'sorcery', 'crime'],
      startingBonus: { thieves: 400, wizards: 400 }
    },
    mystic: {
      name: 'Mystic',
      mods: {
        flatRateCapacity: 1.0,
        flatRateProduction: 1.0,
        income: 1.0,
        buildingEfficiency: 1.0,
        draftCost: 1.0,
        trainingCost: 1.0,
        trainingTime: 1.0,
        buildTime: 1.0,
        buildCost: 1.0,
        wages: 1.0,
        maxPop: 1.0,
        ome: 1.0,
        dme: 1.0,
        birthRate: 1.0,
        foodProdPerAcre: 0,
        attackTime: 1.0,
        specCredits: 1.0,
        buildCredits: 1.0,
        guildLandEffect: 2.25
      },
      scienceBonus: ['channeling'],
      startingBonus: { wizards: 800 }
    },
    necromancer: {
      name: 'Necromancer',
      mods: {
        flatRateCapacity: 1.0,
        flatRateProduction: 1.0,
        income: 1.0,
        buildingEfficiency: 1.0,
        draftCost: 1.0,
        trainingCost: 1.0,
        trainingTime: 1.0,
        buildTime: 1.0,
        buildCost: 1.0,
        wages: 1.0,
        maxPop: 1.0,
        ome: 1.0,
        dme: 1.0,
        birthRate: 1.0,
        foodProdPerAcre: 0,
        attackTime: 1.0,
        specCredits: 1.0,
        buildCredits: 1.0,
        wpa: 1.30
      },
      scienceBonus: ['channeling'],
      startingBonus: { soldiers: 400, specCredits: 400, wizards: 400 }
    },
    paladin: {
      name: 'Paladin',
      mods: {
        flatRateCapacity: 1.0,
        flatRateProduction: 1.0,
        income: 1.0,
        buildingEfficiency: 1.0,
        draftCost: 1.0,
        trainingCost: 1.0,
        trainingTime: 1.0,
        buildTime: 1.0,
        buildCost: 1.0,
        wages: 1.0,
        maxPop: 1.05,
        ome: 1.0,
        dme: 1.0,
        birthRate: 1.0,
        foodProdPerAcre: 0,
        attackTime: 1.0,
        specCredits: 1.0,
        buildCredits: 1.0,
        stableCapacity: 1.50,
        stableProduction: 1.50,
        enemyCasualties: 1.15,
        ownOffCasualties: 1.10
      },
      scienceBonus: ['valor'],
      startingBonus: { soldiers: 800, specCredits: 800 },
      plagueImmune: true
    },
    rogue: {
      name: 'Rogue',
      mods: {
        flatRateCapacity: 1.0,
        flatRateProduction: 1.0,
        income: 1.0,
        buildingEfficiency: 1.0,
        draftCost: 1.0,
        trainingCost: 1.0,
        trainingTime: 1.0,
        buildTime: 1.0,
        buildCost: 1.0,
        wages: 1.0,
        maxPop: 1.0,
        ome: 1.0,
        dme: 1.0,
        birthRate: 1.0,
        foodProdPerAcre: 0,
        attackTime: 1.0,
        specCredits: 1.0,
        buildCredits: 1.0,
        tpa: 1.15,
        tdEffectiveness: 2.0
      },
      scienceBonus: ['crime'],
      startingBonus: { thieves: 800 }
    },
    tactician: {
      name: 'Tactician',
      mods: {
        flatRateCapacity: 1.0,
        flatRateProduction: 1.0,
        income: 1.0,
        buildingEfficiency: 1.0,
        draftCost: 1.0,
        trainingCost: 1.0,
        trainingTime: 1.0,
        buildTime: 1.0,
        buildCost: 1.0,
        wages: 1.0,
        maxPop: 1.0,
        ome: 1.0,
        dme: 1.0,
        birthRate: 1.0,
        foodProdPerAcre: 0,
        attackTime: 0.85,
        specCredits: 1.40,
        buildCredits: 1.0
      },
      scienceBonus: ['siege'],
      startingBonus: { soldiers: 800, specCredits: 800 }
    },
    warHero: {
      name: 'War Hero',
      mods: {
        flatRateCapacity: 1.0,
        flatRateProduction: 1.0,
        income: 1.0,
        buildingEfficiency: 1.0,
        draftCost: 1.0,
        trainingCost: 1.0,
        trainingTime: 1.0,
        buildTime: 1.0,
        buildCost: 1.0,
        wages: 1.0,
        maxPop: 1.0,
        ome: 1.0,
        dme: 1.0,
        birthRate: 1.0,
        foodProdPerAcre: 0,
        attackTime: 1.0,
        specCredits: 1.0,
        buildCredits: 1.0,
        honorEffects: 1.5,
        offSpecStrengthBonus: 2,
        honorLoss: 0.70,
        honorEffects: 1.50
      },
      scienceBonus: [],
      startingBonus: { soldiers: 800, specCredits: 800 }
    },
    warrior: {
      name: 'Warrior',
      mods: {
        flatRateCapacity: 1.0,
        flatRateProduction: 1.0,
        income: 1.0,
        buildingEfficiency: 1.0,
        draftCost: 1.0,
        trainingCost: 1.0,
        trainingTime: 1.0,
        buildTime: 1.0,
        buildCost: 1.0,
        wages: 1.0,
        maxPop: 1.0,
        ome: 1.10,
        dme: 1.0,
        birthRate: 1.0,
        foodProdPerAcre: 0,
        attackTime: 1.0,
        specCredits: 1.0,
        buildCredits: 1.0,
        mercCost: 0.50,
        prisonerOffStrength: 4,
        mercOffStrength: 4
      },
      scienceBonus: ['tactics'],
      startingBonus: { soldiers: 800, specCredits: 800 }
    }
  },

  buildings: {
    barrenLand: { name: 'Barren Land', capacity: 15, jobs: 0, livingSpace: 15, flatRate: { bushels: 2 }, isBuilding: false },
    homes:      { name: 'Homes', capacity: 10, jobs: 0, livingSpace: 35, flatRate: { peasants: 0.3 }, isBuilding: true },
    farms:      { name: 'Farms', jobs: 25, livingSpace: 25, flatRate: { bushels: 60 }, isBuilding: true },
    mills:      { name: 'Mills', jobs: 25, livingSpace: 25, pctEffect: [{ type: 'buildCost', base: 4, max: 100 }, { type: 'exploreCostGold', base: 3, max: 75 }, { type: 'exploreCostSoldiers', base: 2, max: 50 }], isBuilding: true },
    banks:      { name: 'Banks', jobs: 25, livingSpace: 25, flatRate: { gold: 25 }, pctEffect: [{ type: 'income', base: 1.5, max: 37.5 }], isBuilding: true },
    trainingGrounds: { name: 'Training Grounds', jobs: 25, livingSpace: 25, pctEffect: [{ type: 'ome', base: 1.5, max: 37.5 }, { type: 'trainingTime', base: 1, max: 25 }], isBuilding: true },
    armouries:  { name: 'Armouries', jobs: 25, livingSpace: 25, pctEffect: [{ type: 'draftCost', base: 2, max: 50 }, { type: 'wages', base: 2, max: 50 }, { type: 'trainingCost', base: 1.5, max: 37.5 }], isBuilding: true },
    barracks:   { name: 'Military Barracks', jobs: 25, livingSpace: 25, pctEffect: [{ type: 'attackTime', base: 1.5, max: 37.5 }, { type: 'mercCost', base: 2, max: 50 }], isBuilding: true },
    forts:      { name: 'Forts', jobs: 25, livingSpace: 25, pctEffect: [{ type: 'dme', base: 1.5, max: 37.5 }], isBuilding: true },
    castles:    { name: 'Castles', jobs: 25, livingSpace: 25, pctEffect: [{ type: 'resourceLoss', base: 2.25, max: 50 }, { type: 'honorLoss', base: 2, max: 50 }], isBuilding: true },
    hospitals:  { name: 'Hospitals', jobs: 25, livingSpace: 25, pctEffect: [{ type: 'militaryCasualties', base: 3, max: 75 }, { type: 'plagueCure', base: 3, max: 75 }, { type: 'birthRate', base: 2, max: 50 }], isBuilding: true },
    guilds:     { name: 'Guilds', jobs: 25, livingSpace: 25, flatRate: { wizards: 0.02 }, isBuilding: true, unaffectedByBE: true },
    towers:     { name: 'Towers', jobs: 25, livingSpace: 25, flatRate: { runes: 12 }, isBuilding: true },
    thievesDens: { name: "Thieves' Dens", jobs: 25, livingSpace: 25, pctEffect: [{ type: 'thiefLosses', base: 3.6, max: 90 }, { type: 'tpa', base: 3, max: 75 }], isBuilding: true },
    watchTowers: { name: 'Watch Towers', jobs: 25, livingSpace: 25, pctEffect: [{ type: 'catchThieves', base: 2.0, max: 50 }, { type: 'thiefDamageReduction', base: 2.5, max: 62.5 }], isBuilding: true },
    universities: { name: 'Universities', jobs: 25, livingSpace: 25, pctEffect: [{ type: 'scientistSpawn', base: 1.5, max: 37.5 }, { type: 'bookGeneration', base: 1, max: 25 }], isBuilding: true, unaffectedByBE: true },
    libraries:  { name: 'Libraries', jobs: 25, livingSpace: 25, pctEffect: [{ type: 'scienceEfficiency', base: 1, max: 25 }], isBuilding: true, unaffectedByBE: true },
    stables:    { name: 'Stables', capacity: 80, jobs: 25, livingSpace: 25, flatRate: { horses: 2 }, isBuilding: true },
    dungeons:   { name: 'Dungeons', capacity: 30, jobs: 25, livingSpace: 25, isBuilding: true }
  },

  draftLevels: {
    reservist:  { name: 'Reservist',  rate: 0.005, cost: 30 },
    normal:     { name: 'Normal',     rate: 0.01,  cost: 50 },
    aggressive: { name: 'Aggressive', rate: 0.015, cost: 75 },
    emergency:  { name: 'Emergency',  rate: 0.02,  cost: 110 }
  },

  sciences: {
    alchemy:    { name: 'Alchemy',    multiplier: 5.0 },
    tools:      { name: 'Tools',      multiplier: 3.5 },
    housing:    { name: 'Housing',    multiplier: 3.0 },
    production: { name: 'Production', multiplier: 3.5 },
    bookkeeping:{ name: 'Bookkeeping',multiplier: 4.5 },
    artisan:    { name: 'Artisan',    multiplier: 5.0 },
    tactics:    { name: 'Tactics',    multiplier: 3.5 },
    valor:      { name: 'Valor',      multiplier: 3.0 },
    heroism:    { name: 'Heroism',    multiplier: 4.0 },
    siege:      { name: 'Siege',      multiplier: 4.5 },
    channeling: { name: 'Channeling', multiplier: 4.0 },
    shielding:  { name: 'Shielding',  multiplier: 4.0 },
    sorcery:    { name: 'Sorcery',    multiplier: 4.0 },
    crime:      { name: 'Crime',      multiplier: 3.0 },
    cunning:    { name: 'Cunning',    multiplier: 3.0 },
    finesse:    { name: 'Finesse',    multiplier: 3.5 }
  },

  honorTitles: [
    { name: 'Peasant',  minHonor: 0,    pop: 1.00, ome: 1.00, income: 1.00, food: 1.00, runes: 1.00, wpa: 1.00, tpa: 1.00 },
    { name: 'Knight',   minHonor: 751,  pop: 1.01, ome: 1.01, income: 1.02, food: 1.02, runes: 1.02, wpa: 1.03, tpa: 1.03 },
    { name: 'Lord',     minHonor: 1501, pop: 1.02, ome: 1.02, income: 1.04, food: 1.04, runes: 1.04, wpa: 1.06, tpa: 1.06 },
    { name: 'Baron',    minHonor: 2251, pop: 1.03, ome: 1.03, income: 1.06, food: 1.06, runes: 1.06, wpa: 1.09, tpa: 1.09 },
    { name: 'Viscount', minHonor: 3001, pop: 1.04, ome: 1.04, income: 1.08, food: 1.08, runes: 1.08, wpa: 1.12, tpa: 1.12 },
    { name: 'Count',    minHonor: 3751, pop: 1.06, ome: 1.06, income: 1.12, food: 1.12, runes: 1.12, wpa: 1.18, tpa: 1.18 },
    { name: 'Marquis',  minHonor: 4501, pop: 1.08, ome: 1.08, income: 1.16, food: 1.16, runes: 1.16, wpa: 1.24, tpa: 1.24 },
    { name: 'Duke',     minHonor: 5251, pop: 1.10, ome: 1.10, income: 1.20, food: 1.20, runes: 1.20, wpa: 1.30, tpa: 1.30 },
    { name: 'Prince',   minHonor: 6001, pop: 1.12, ome: 1.12, income: 1.24, food: 1.24, runes: 1.24, wpa: 1.36, tpa: 1.36 }
  ],

  eowcf: {
    totalDuration: 97,           // EOWCF always lasts exactly 97 ticks
    birthRateMultiplier: 10,     // x10 birth rate for first 24 ticks
    birthRateBoostedTicks: 24,   // Birth boost duration (first 24 ticks)
    minPeasantsBorn: 500,
    popBoostThreshold: 0.50,
    popBoostAmount: 0.20,
    explorePenalty: 3.0,
    exploreTimeMod: 0.50,
    thiefCostReduction: 0.50
  },

  // =========================================================================
  // RITUALS — Age 114
  // =========================================================================
  // Each ritual's bonuses are at 100% effectiveness.
  // Actual effect = bonus * (ritualEffectiveness / 100).
  // Update these values each age as needed.
  // =========================================================================
  rituals: {
    barrier: {
      name: 'Barrier',
      effects: {
        birthRate: 0.20,             // +20% Birth Rates
        enemyTMDamage: -0.25,        // -25% Damage from Enemy Instant Magic & Thievery
        massacreDamage: -0.20,       // -20% Massacre Damage
        battleLosses: -0.10          // -10% Battle (Resource) Losses
      }
    },
    expedient: {
      name: 'Expedient',
      effects: {
        buildingEfficiency: 0.20,    // +20% Building Efficiency
        constructionCost: -0.25,     // -25% Construction Cost
        constructionTime: -0.25,     // -25% Construction Time
        wages: -0.25                 // -25% Military Wages
      }
    },
    ascendency: {
      name: 'Ascendancy',
      effects: {
        wizardProduction: 0.50,      // +50% Wizard Production
        wizardLosses: -0.50,         // -50% Wizard Losses on Failed Spells
        bookProduction: -0.25        // -25% Science Book Production
      }
    },
    haste: {
      name: 'Haste',
      effects: {
        attackTime: -0.10,           // -10% Attack Time
        trainingTime: -0.25,         // -25% Training Time
        constructionTime: -0.25      // -25% Construction Time
      }
    },
    havoc: {
      name: 'Havoc',
      effects: {
        offWPA: 0.20,               // +20% Offensive WPA
        offTPA: 0.20,               // +20% Offensive TPA
        spellDamage: 0.20,          // +20% Spell Damage
        sabDamage: 0.20             // +20% Sabotage Damage
      }
    },
    onslaught: {
      name: 'Onslaught',
      effects: {
        ome: 0.10,                  // +10% Offensive Military Efficiency
        enemyCasualties: 0.15       // +15% Enemy Military Casualties
      }
    },
    stalwart: {
      name: 'Stalwart',
      effects: {
        dme: 0.05,                  // +5% Defensive Military Efficiency
        ownCasualties: -0.20        // -20% Military Casualties
      }
    }
  },

  // =========================================================================
  // DRAGONS — Age 114
  // =========================================================================
  // Dragons are sent by enemy kingdoms. Effects are penalties on the target.
  // Update these values each age as needed.
  // =========================================================================
  dragons: {
    amethyst: {
      name: 'Amethyst Dragon',
      costMod: 2.4,
      effects: {
        spellSuccess: -0.40,         // -40% Spell Success Chance
        sabSuccess: -0.40,           // -40% Thievery Success on sabotage
        wizThiefLosses: 0.25         // +25% wizard/thief losses on failed ops
      }
    },
    emerald: {
      name: 'Emerald Dragon',
      costMod: 2.4,
      effects: {
        ownCasualties: 0.25,         // +25% military casualties
        battleGains: -0.20,          // -20% combat gains
        buildSpecCredits: -0.40      // -40% Building & Specialist Credits from combat
      }
    },
    celestite: {
      name: 'Celestite Dragon',
      costMod: 2.4,
      effects: {
        birthRate: -0.60,            // -60% Birth Rates
        hospitalEffect: -0.40,       // -40% Hospital Effectiveness
        buildCostTime: 0.50          // +50% Build Cost and Time
      }
    },
    ruby: {
      name: 'Ruby Dragon',
      costMod: 2.4,
      effects: {
        militaryEffectiveness: -0.15,// -15% Military Effectiveness
        wages: 0.30,                 // +30% Military Wages
        draftLoss: 0.30              // Lose 30% of new draftees
      }
    },
    topaz: {
      name: 'Topaz Dragon',
      costMod: 2.0,
      effects: {
        buildingEfficiency: -0.30,   // -30% Building Efficiency
        income: -0.25,               // -25% Income
        buildingDestruction: 0.04    // Destroys 4% buildings instantly + every 6 days
      }
    },
    sapphire: {
      name: 'Sapphire Dragon',
      costMod: 2.0,
      effects: {
        wpa: -0.30,                  // -30% WPA
        tpa: -0.30,                  // -30% TPA
        instantDamageTaken: 0.125,   // +12.5% Instant Spell & Sab Damage taken
        instantDamageDealt: -0.125   // -12.5% Instant Spell & Sab Damage dealt
      }
    }
  }
};
