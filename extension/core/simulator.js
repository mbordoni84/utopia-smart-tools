// =============================================================================
// Core Simulator — Reusable Tick Loop
// =============================================================================
// Provides a generic tick-by-tick simulation engine that views can use
// with custom configuration (stop conditions, per-tick hooks, etc.).
// =============================================================================

const Simulator = {

  /**
   * Run a tick-by-tick economic simulation.
   *
   * @param {Object} startState - Engine-compatible state (will be deep-cloned)
   * @param {Object} options
   * @param {number}   [options.maxTicks=300]       - Safety cap
   * @param {string}   [options.draftRate='none']    - Draft rate key
   * @param {Function} [options.shouldStop]          - (tickResult, state, tick) => boolean
   * @param {Function} [options.onTick]              - (state, tick) => void, called before calcs
   * @returns {Object[]} Array of per-tick result snapshots
   */
  run(startState, options = {}) {
    const maxTicks  = options.maxTicks || 300;
    const draftRate = options.draftRate || 'none';
    const shouldStop = options.shouldStop || (() => false);
    const onTick     = options.onTick || null;

    const state = Utils.deepClone(startState);
    state.draftRate = draftRate;
    if (state.eowcfTicksElapsed === undefined) state.eowcfTicksElapsed = 0;

    const results = [];

    for (let tick = 1; tick <= maxTicks; tick++) {
      // Optional per-tick hook (e.g. change wage rate at a certain tick)
      if (onTick) onTick(state, tick);

      // Run all engine calculations for this tick
      const tickResult = this.calcTick(state);

      // Record snapshot
      const totalMilitary = (state.soldiers || 0) + (state.offSpecs || 0)
        + (state.defSpecs || 0) + (state.elites || 0) + (state.thieves || 0);
      const milPct = tickResult.maxPop > 0 ? totalMilitary / tickResult.maxPop : 0;

      const snapshot = {
        tick,
        milPct,
        gold:      Math.round(state.gold + tickResult.netGold),
        netGold:   Math.round(tickResult.netGold),
        peasants:  Math.round(state.peasants),
        soldiers:  Math.round(state.soldiers),
        drafted:   tickResult.drafted,
        draftCost: Math.round(tickResult.draftCost),
        income:    Math.round(tickResult.income),
        wages:     Math.round(tickResult.wages),
        be:        tickResult.be,
        food:      Math.round(Math.max(0, state.food + tickResult.netFood)),
        netFood:   Math.round(tickResult.netFood),
        runes:     Math.round(Math.max(0, state.runes + tickResult.netRunes)),
        netRunes:  Math.round(tickResult.netRunes),
        totalMilitary,
        maxPop:    tickResult.maxPop,
      };

      results.push(snapshot);

      // Advance state
      state.gold     += tickResult.netGold;
      state.peasants  = Math.max(0, state.peasants + tickResult.netPeasantChange - tickResult.drafted);
      state.soldiers += tickResult.drafted;
      state.food      = Math.max(0, state.food + tickResult.netFood);
      state.runes     = Math.max(0, state.runes + tickResult.netRunes);
      if (state.eowcfActive) state.eowcfTicksElapsed++;

      // Check stop condition
      if (shouldStop(snapshot, state, tick)) break;
    }

    return results;
  },

  /**
   * Calculate one tick's worth of changes without mutating state.
   * Returns a flat object with the key deltas and values.
   */
  calcTick(state) {
    const pop    = Engine.calcPopGrowth(state);
    state.maxPop = pop.maxPop;

    const income = Engine.calcIncome(state);
    const wages  = Engine.calcWages(state);
    const food   = Engine.calcFood(state);
    const runes  = Engine.calcRunes(state);
    const draft  = Engine.calcDraft(state);

    return {
      income:           income.modifiedIncome,
      wages:            wages.modifiedWages,
      netGold:          income.modifiedIncome - wages.modifiedWages - draft.draftCost,
      netFood:          food.netFood,
      netRunes:         runes.netRunes,
      netPeasantChange: pop.netPeasantChange,
      drafted:          draft.drafted,
      draftCost:        draft.draftCost,
      be:               income.beResult.be,
      maxPop:           pop.maxPop,
      // Full breakdowns available if needed
      _pop: pop, _income: income, _wages: wages, _food: food, _runes: runes, _draft: draft,
    };
  },
};
