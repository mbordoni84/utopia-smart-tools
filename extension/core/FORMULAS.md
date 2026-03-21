# Game Formulas Reference

All formulas implemented in `engine.js`, sourced from `utopia_wiki.md` and verified against live Age 114 data. This document records discoveries, ambiguities resolved, and deviations from the wiki.

## Building Efficiency (BE)

```
Available Workers = Peasants + FLOOR(Prisoners / 2)
Optimal Workers   = FLOOR(Total Jobs * 0.67 * GhostWorkersMod)
% Jobs Filled     = MIN(Available Workers / Optimal Workers, 1)
BE = 0.5 * (1 + %Jobs) * Race * Pers * ToolsSci * Ritual * Dragon * Blizzard * CD
```

- **Ghost Workers spell**: 0.75x jobs required (effectively 0.5025 of total jobs)
- **Blizzard**: 0.90x BE (NOT shown in game's BE display)
- **Construction Delays**: 0.90x BE (NOT shown in game's BE display)
- Practical cap at 1.5 to avoid unrealistic values

**Discovery**: In-construction buildings DO provide jobs. Game's council_internal page shows built + WIP combined. Confirmed: 1,748 buildings x 25 = 43,700 jobs (exact match).

**Discovery**: Game BE adjusts gradually (not instantly) when workers/buildings change. Expect ~3% gap when recently changed.

## Building Effects

### Percentage-based (diminishing returns)
```
effect = base * BE * effective% * (100 - effective%) / 100
effective% = MIN(50, (count/acres * 100) * (1+raceMod) * (1+persMod))
Max effect = 25 * base (at 50% land allocation)
```

### Flat rate
```
production = base * count * (1+raceMod) * (1+persMod) * BE
```
Note: Homes flat birth rate (0.3/tick) is NOT affected by BE.

## Income

```
Raw Income = (3 * Employed) + (1 * Unemployed) + (0.75 * Prisoners)
           + BankFlat + MinersMystique
Modified   = Raw * (1 + BankPct/100) * AlchemySci * Honor * Race * Pers * Dragon * Riots
```

- Employed = MIN(Peasants, TotalJobs - FLOOR(Prisoners/2))
- Human racial bonus: Prisoners generate +2.0gc extra each
- Miner's Mystique: +0.3gc per peasant
- **Soldiers do NOT pay wages** (wiki line 3001 confirmed)
- **Thieves and Wizards do NOT pay wages** (verified against live data)

## Wages

```
Base = (OffSpecs + DefSpecs) * 0.5 + Elites * 0.75
Modified = Base * WageRate * (1 - ArmouriesPct/100) * BookkeepingSci
         * Race * Pers * Ritual * Dragon * SpellMod * GreedMod
```

- Units in training do NOT pay wages
- Inspire Army: 0.85x wages; Hero's Inspiration: 0.70x (mutually exclusive)
- Greed: 1.25x wages and draft costs

## Food

```
Base = FarmFlat + (BarrenLand * 2) + (Race+Pers foodPerAcre * Acres)
Modified = Base * ProdSci * FertileLands * Drought * HonorFood
Consumed = TotalPop * 0.25 * RaceFoodMod * Gluttony
Decay = FoodStock * 0.01/tick
```

- Barren land food (2/acre) is NOT affected by BE
- Prisoners do NOT consume food
- Units in training DO consume food

## Runes

```
Production = TowerFlat * ProdSci * HonorRunes
Decay = RuneStock * 0.012/tick
```

**Discovery**: Rune decay uses the balance at tick start, not after production. Game's "yesterday" decay of 30 matched 2,578 * 0.012 = 30.9, not current balance.

## Population

```
MaxPop = FLOOR((BuiltLand*25 + BarrenLand*15 + Homes*10) * Race * Pers * HousingSci * HonorPop)
BirthRate = (2.05% + L&P) * Race * Hospital * EOWCF * Chastity * Dragon * Ritual
Born = FLOOR(Peasants * BirthRate) + FLOOR(Homes * 0.3 * Chastity)
```

- Birth rate has +/-5% random variation per tick (engine uses midpoint 2.05%)
- EOWCF boost: x10 for first 24 ticks, minimum 500 peasants/tick
- Overpopulation: 10% peasant desertion per tick, no births
- Current Pop = all military + peasants + in-training (excludes prisoners)

## Draft

```
Drafted = FLOOR(Peasants * Rate * HeroismSci * 1.3 * PatriotismMod)
```

- 1.3x is an empirical constant (hidden mechanic, not documented in wiki)
- Draft rates: none(0%), normal(0.5%), aggressive(1.5%), emergency(2%), war(2.5%)

### Draft Cost
```
BaseWage = MAX(WageRate * 0.5, 7.5)
LevelFactor = MAX(1.0154 * R^2 + 1.1759 * R + 0.3633, 1)  where R = mil/maxPop
ArmMod = 1 - MIN(ArmouriesPct/100, 0.5)
Cost/Soldier = BaseWage * LevelFactor * Race * Pers * ArmMod * Greed
```

## Construction

```
Time = MAX(1, ROUND(16 * Race * Pers * BB * DoubleSpeed * Ritual * Artisan * Dragon))
Cost = ROUND(0.05 * (Acres+10000) * Race * Pers * MillsMod * CostDouble * Ritual * Artisan * Dragon)
Raze = ROUND((300 + 0.05*Acres) * Artisan * Race * Pers)
```

- Builder's Boon: 0.75x time, 2x cost
- Double Speed: 0.50x time, 2x cost

## Training

```
Time = MAX(1, ROUND(24 * Race * Pers * InspireMod * ValorSci * Ritual * TGMod))
Cost = ROUND(Count * UnitCost * Race * Pers * ArmMod)
```

- Inspire Army: 0.80x time; Hero's Inspiration: 0.70x (mutually exclusive)
- Training Grounds: pct-based reduction (base 1, max 25%)
- Armouries: reduce training cost (base 1.5, max 37.5%)
- Base unit costs: Specs 75gc, Elites vary by race, Thieves vary by race

## Honor

```
EffectiveMod = 1 + (TitleBonus - 1) * RaceHonorScale * PersHonorScale
```

- War Hero personality: 1.50x honor bonus portion
- Title determined by numeric honor value against threshold table

## Scraper Notes

- **Throne page shows AT-HOME troops only** — troops out on attack don't appear
- **Military council Army Availability** table is authoritative: sums all columns (standing + deployed armies) for true totals
- **Personality detection** from throne page still fails for some provinces (known issue)
- **Active spells** scraped from throne page "Duration:" text, not enchantment page
- **Ritual** scraped from throne page advice-message
