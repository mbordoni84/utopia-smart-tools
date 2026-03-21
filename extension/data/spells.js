// =============================================================================
// SPELL DATA — Age 114
// =============================================================================
// Comprehensive library of all duration (fading) self-spells and offensive
// duration spells. Effects are sourced from the wiki spell tables
// (utopia_wiki.md lines 5708-5780).
//
// Only fading spells are tracked (not single-use or instant spells).
// The list of available spells varies by race/personality — the scraper
// extracts which ones are available from the enchantment page dropdown
// (optgroup label="Fading Spells").
//
// Each spell's `engineEffects` maps to a modifier key used by engine formulas.
// Spells with no engine-relevant effects have `engineEffects: {}`.
// =============================================================================

var SPELL_DATA = {

  // =========================================================================
  // SELF FADING SPELLS
  // =========================================================================

  MINOR_PROTECTION: {
    name: 'Minor Protection',
    type: 'self',
    avgDuration: 12,
    description: '+5% Defensive Military Efficiency (multiplicative, stacks with Greater Protection)',
    engineEffects: {}  // DME — not in our economic formulas
  },

  GREATER_PROTECTION: {
    name: 'Greater Protection',
    type: 'self',
    avgDuration: 24,
    description: '+5% Defensive Military Efficiency (multiplicative, stacks with Minor Protection)',
    engineEffects: {}
  },

  MAGIC_SHIELD: {
    name: 'Magic Shield',
    type: 'self',
    avgDuration: 14,
    description: '+20% Defensive Magic Effectiveness',
    engineEffects: {}
  },

  FERTILE_LANDS: {
    name: 'Fertile Lands',
    type: 'self',
    avgDuration: 16,
    description: '+25% Food production',
    engineEffects: { foodProduction: 0.25 }  // calcFood
  },

  NATURES_BLESSING: {
    name: "Nature's Blessing",
    type: 'self',
    avgDuration: 16,
    description: 'Immunity to Storms and Droughts. 33% chance to cure Plague.',
    engineEffects: {}  // Protective — no direct economic effect
  },

  LOVE_AND_PEACE: {
    name: 'Love and Peace',
    type: 'self',
    avgDuration: 14,
    description: '+0.85% Birth Rate, +40% War Horse production',
    engineEffects: { birthRateFlat: 0.0085 }  // calcPopGrowth — additive to base birth rate
  },

  DIVINE_SHIELD: {
    name: 'Divine Shield',
    type: 'self',
    avgDuration: 12,
    description: '-20% Instant Spell Damage taken',
    engineEffects: {}
  },

  QUICK_FEET: {
    name: 'Quick Feet',
    type: 'self',
    avgDuration: 2,
    description: '-10% Attack Time',
    engineEffects: {}
  },

  BUILDERS_BOON: {
    name: "Builders Boon",
    type: 'self',
    avgDuration: 12,
    description: '-25% Construction Time',
    engineEffects: {}  // Build planning, not tick-based economic formula
  },

  INSPIRE_ARMY: {
    name: 'Inspire Army',
    type: 'self',
    avgDuration: 12,
    description: '-15% Military Wages, -20% Training Time',
    engineEffects: { wages: -0.15 }  // calcWages
  },

  HEROS_INSPIRATION: {
    name: "Hero's Inspiration",
    type: 'self',
    avgDuration: 14,
    description: '-30% Military Wages, -30% Training Time',
    engineEffects: { wages: -0.30 }  // calcWages
  },

  SCIENTIFIC_INSIGHTS: {
    name: 'Scientific Insights',
    type: 'self',
    avgDuration: 9,
    description: '+10% Science Efficiency',
    engineEffects: {}  // Science — not in our economic formulas
  },

  ILLUMINATE_SHADOWS: {
    name: 'Illuminate Shadows',
    type: 'self',
    avgDuration: 8,
    description: '-20% Thievery Damage taken',
    engineEffects: {}
  },

  SALVATION: {
    name: 'Salvation',
    type: 'self',
    avgDuration: 8,
    description: '-15% All Military Casualties',
    engineEffects: {}
  },

  WRATH: {
    name: 'Wrath',
    type: 'self',
    avgDuration: 8,
    description: '+20% Enemy Military Casualties',
    engineEffects: {}
  },

  INVISIBILITY: {
    name: 'Invisibility',
    type: 'self',
    avgDuration: 12,
    description: '+10% Offensive TPA, -20% Thieves lost',
    engineEffects: {}
  },

  CLEAR_SIGHT: {
    name: 'Clear Sight',
    type: 'self',
    avgDuration: 16,
    description: '25% chance to catch enemy thieves',
    engineEffects: {}
  },

  MAGES_FURY: {
    name: "Mage's Fury",
    type: 'self',
    avgDuration: 6,
    description: '+25% Offensive Magic Effectiveness, -25% Defensive Magic Effectiveness',
    engineEffects: {}
  },

  WAR_SPOILS: {
    name: 'War Spoils',
    type: 'self',
    avgDuration: 4,
    description: 'Immediately take control of Land gained on Attacks',
    engineEffects: {}
  },

  MIND_FOCUS: {
    name: 'Mind Focus',
    type: 'self',
    avgDuration: 12,
    description: '+25% Wizard production',
    engineEffects: {}
  },

  FANATICISM: {
    name: 'Fanaticism',
    type: 'self',
    avgDuration: 6,
    description: '+5% Offensive Military Efficiency, -5% Defensive Military Efficiency',
    engineEffects: {}
  },

  GUILE: {
    name: 'Guile',
    type: 'self',
    avgDuration: 8,
    description: '+10% Instant Spell Damage and Sabotage Damage',
    engineEffects: {}
  },

  REVELATION: {
    name: 'Revelation',
    type: 'self',
    avgDuration: 10,
    description: '+20% Scientist Spawn Rate',
    engineEffects: {}
  },

  FOUNTAIN_OF_KNOWLEDGE: {
    name: 'Fountain of Knowledge',
    type: 'self',
    avgDuration: 10,
    description: '+10% Science Book production',
    engineEffects: {}
  },

  TOWN_WATCH: {
    name: 'Town Watch',
    type: 'self',
    avgDuration: 10,
    description: 'Every 5 Peasants defend with 1 strength (high casualties)',
    engineEffects: {}
  },

  AGGRESSION: {
    name: 'Aggression',
    type: 'self',
    avgDuration: 12,
    description: 'Soldiers +2 Offense / -2 Defense strength',
    engineEffects: {}
  },

  MINERS_MYSTIQUE: {
    name: "Miner's Mystique",
    type: 'self',
    avgDuration: 14,
    description: 'Peasants generate an extra 0.3gc per tick',
    engineEffects: { incomePerPeasant: 0.3 }  // calcIncome
  },

  GHOST_WORKERS: {
    name: 'Ghost Workers',
    type: 'self',
    avgDuration: 14,
    description: '-25% Jobs required for maximum Building Efficiency',
    engineEffects: { jobsRequired: -0.25 }  // calcBE
  },

  MIST: {
    name: 'Mist',
    type: 'self',
    avgDuration: 4,
    description: '-10% Resource losses in battle',
    engineEffects: {}
  },

  REFLECT_MAGIC: {
    name: 'Reflect Magic',
    type: 'self',
    avgDuration: 12,
    description: '20% chance to reflect Offensive Spells',
    engineEffects: {}
  },

  BLOODLUST: {
    name: 'Bloodlust',
    type: 'self',
    avgDuration: 6,
    description: '+10% OME, +15% Enemy Casualties, +15% Own Casualties',
    engineEffects: {}
  },

  PATRIOTISM: {
    name: 'Patriotism',
    type: 'self',
    avgDuration: 12,
    description: '+30% Draft Speed, -30% Propaganda Damage taken',
    engineEffects: {}
  },

  // =========================================================================
  // OFFENSIVE FADING SPELLS (cast ON you by enemies)
  // =========================================================================
  // These affect your province when active. The scraper should detect them
  // from the throne/status page if they show up there.

  PLAGUE: {
    name: 'Plague',
    type: 'offensive',
    avgDuration: 12,
    description: 'No Population Growth, -15% Income (tax collection), -10% OME, -15% DME',
    engineEffects: {
      birthRateFlat: -1.0,  // Eliminates all birth rate (set to negative to cancel base)
      income: -0.15         // calcIncome — applies to tax collection
    }
  },

  CHASTITY: {
    name: 'Chastity',
    type: 'offensive',
    avgDuration: 6,
    description: '-50% Birth Rate',
    engineEffects: { birthRateMult: 0.50 }  // calcPopGrowth — multiplicative
  },

  DROUGHT: {
    name: 'Drought',
    type: 'offensive',
    avgDuration: 12,
    description: '-25% Food production, -15% Draft Speed',
    engineEffects: { foodProduction: -0.25 }  // calcFood
  },

  GLUTTONY: {
    name: 'Gluttony',
    type: 'offensive',
    avgDuration: 12,
    description: '+25% Food consumption',
    engineEffects: { foodConsumption: 0.25 }  // calcFood
  },

  GREED: {
    name: 'Greed',
    type: 'offensive',
    avgDuration: 12,
    description: '+25% Military Wages and Draft Costs',
    engineEffects: { wages: 0.25 }  // calcWages
  },

  BLIZZARD: {
    name: 'Blizzard',
    type: 'offensive',
    avgDuration: 6,
    description: '-10% Building Efficiency',
    engineEffects: { buildingEfficiency: -0.10 }  // calcBE
  },

  STORMS: {
    name: 'Storms',
    type: 'offensive',
    avgDuration: 12,
    description: 'Kills 1.5% of total Population, +15% Tornado damage taken',
    engineEffects: {}  // Instant kill effect, not ongoing economic
  },

  EXPLOSIONS: {
    name: 'Explosions',
    type: 'offensive',
    avgDuration: 12,
    description: '50% chance aid shipments reduced to 55-80%',
    engineEffects: {}
  },

  EXPOSE_THIEVES: {
    name: 'Expose Thieves',
    type: 'offensive',
    avgDuration: 6,
    description: '-5% Stealth per tick',
    engineEffects: {}
  },

  PITFALLS: {
    name: 'Pitfalls',
    type: 'offensive',
    avgDuration: 12,
    description: '+15% Defensive Military Casualties',
    engineEffects: {}
  },

  METEOR_SHOWERS: {
    name: 'Meteor Showers',
    type: 'offensive',
    avgDuration: 8,
    description: 'Kills Peasants and Troops every tick',
    engineEffects: {}  // Ongoing kill, but not formula-based
  },

  MAGIC_WARD: {
    name: 'Magic Ward',
    type: 'offensive',
    avgDuration: 6,
    description: '+100% Rune Costs',
    engineEffects: {}  // Rune cost, not production
  },

  SLOTH: {
    name: 'Sloth',
    type: 'offensive',
    avgDuration: 6,
    description: '-50% Drafting Rate, +100% Draft Cost',
    engineEffects: {}
  },

  PROPAGANDA: {
    name: 'Propaganda',
    type: 'offensive',
    avgDuration: 6,
    description: 'Kills peasants each tick',
    engineEffects: {}
  },

  RIOTS: {
    name: 'Riots',
    type: 'offensive',
    avgDuration: 6,
    description: '-10% Income',
    engineEffects: { income: -0.10 }
  },

  NIGHTMARES: {
    name: 'Nightmares',
    type: 'offensive',
    avgDuration: 6,
    description: 'Reduces WPA and TPA',
    engineEffects: {}
  },

  // Artisan personality unique — passive debuff on target after attack
  CONSTRUCTION_DELAYS: {
    name: 'Construction Delays',
    type: 'offensive',
    avgDuration: 6,
    description: '-10% Building Efficiency for 6 ticks after attack',
    engineEffects: { buildingEfficiency: -0.10 }
  }
};
