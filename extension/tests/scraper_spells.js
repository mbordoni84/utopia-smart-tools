// =============================================================================
// Scraper Spell Tests — Real Production HTML
// =============================================================================
// Validates scrapeEnchantment() and scrapeThrone() against actual game HTML
// saved from the production server, then confirms engine formulas apply the
// resulting spell flags correctly.
//
// HTML paths are relative to this file (extension/tests/):
//   ../../Utopia_HTML_download/https-:utopia-game.com:wol:game:enchantment.html
//   ../../Utopia_HTML_download/https-:utopia-game.com:wol:game:enchantment_ex1.html
//   ../../Utopia_HTML_download/https-:utopia-game.com:wol:game:throne.html
//
// Run: open scraper_spells.html via the extension or file:// with
//   --allow-file-access-from-files (needed for fetch() on local files).
// =============================================================================

(async function () {
  const results = { passed: 0, failed: 0, details: [], errors: [] };

  // -------------------------------------------------------------------------
  // HELPERS
  // -------------------------------------------------------------------------

  function assert(group, name, condition, extra = '') {
    const pass = !!condition;
    results.details.push({ group, name, pass, extra });
    if (pass) results.passed++;
    else results.failed++;
  }

  async function loadDoc(path) {
    const resp = await fetch(path);
    if (!resp.ok) throw new Error(`HTTP ${resp.status} for ${path}`);
    const html = await resp.text();
    return new DOMParser().parseFromString(html, 'text/html');
  }

  // Minimal state that satisfies all engine formula dependencies.
  // Mirrors makeBaseState() in engine_coverage.js.
  function makeBaseState() {
    const race = GAME_DATA.races.orc;
    const personality = GAME_DATA.personalities.warHero;
    const honor = Engine.getHonorMods(2, race, personality);
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
        barrenLand: 100, homes: 80, farms: 200, mills: 50, banks: 150,
        trainingGrounds: 80, armouries: 100, barracks: 50, forts: 80,
        castles: 30, hospitals: 80, guilds: 40, towers: 100,
        thievesDens: 30, watchTowers: 30, universities: 50,
        libraries: 50, stables: 40, dungeons: 30
      },
      gold: 500000, food: 200000, runes: 50000,
      sciAlchemy: 15, sciTools: 12, sciProduction: 10, sciHousing: 8,
      sciBookkeeping: 14, sciHeroism: 5, sciValor: 6, sciArtisan: 7,
      wageRate: 100,
      spellChastity: false, spellFertileLands: false, spellMinersM: false,
      spellBuildBoon: false, spellLoveAndPeace: false, spellInspireArmy: false,
      spellHerosInspiration: false, spellGhostWorkers: false,
      ritual: 'none', ritualEffectiveness: 1.0,
      dragon: 'none', honor,
      eowcfActive: false, eowcfTicksElapsed: 0
    };
  }

  // -------------------------------------------------------------------------
  // GROUP A — scrapeEnchantment(enchantment.html) — no active spells
  // -------------------------------------------------------------------------
  try {
    const doc = await loadDoc(
      '../../Utopia_HTML_download/https-:utopia-game.com:wol:game:enchantment.html'
    );
    const r = Scrapers.scrapeEnchantment(doc);
    const keys = (r.fadingSpells || []).map(s => s.key);

    assert('A', 'fadingSpells.length === 11',
      r.fadingSpells && r.fadingSpells.length === 11,
      `got ${r.fadingSpells ? r.fadingSpells.length : 'undefined'}`);

    assert('A', 'fadingSpells includes FERTILE_LANDS, INSPIRE_ARMY, LOVE_AND_PEACE',
      keys.includes('FERTILE_LANDS') && keys.includes('INSPIRE_ARMY') && keys.includes('LOVE_AND_PEACE'),
      `keys: ${keys.join(', ')}`);

    assert('A', 'fadingSpells does NOT include GHOST_WORKERS or MINERS_MYSTIQUE',
      !keys.includes('GHOST_WORKERS') && !keys.includes('MINERS_MYSTIQUE'),
      `keys: ${keys.join(', ')}`);

    assert('A', 'activeSpells is empty (no active spells)',
      r.activeSpells && Object.keys(r.activeSpells).length === 0,
      `got ${JSON.stringify(r.activeSpells)}`);
  } catch (e) {
    results.errors.push('Group A failed to load: ' + e.message);
    results.failed++;
  }

  // -------------------------------------------------------------------------
  // GROUP B — scrapeEnchantment(enchantment_ex1.html) — 3 active spells
  // -------------------------------------------------------------------------
  try {
    const doc = await loadDoc(
      '../../Utopia_HTML_download/https-:utopia-game.com:wol:game:enchantment_ex1.html'
    );
    const r = Scrapers.scrapeEnchantment(doc);

    assert('B', 'fadingSpells.length === 11',
      r.fadingSpells && r.fadingSpells.length === 11,
      `got ${r.fadingSpells ? r.fadingSpells.length : 'undefined'}`);

    assert('B', 'activeSpells.FERTILE_LANDS.remaining === 19',
      r.activeSpells && r.activeSpells.FERTILE_LANDS && r.activeSpells.FERTILE_LANDS.remaining === 19,
      `got ${JSON.stringify(r.activeSpells && r.activeSpells.FERTILE_LANDS)}`);

    assert('B', 'activeSpells.INSPIRE_ARMY.remaining === 16',
      r.activeSpells && r.activeSpells.INSPIRE_ARMY && r.activeSpells.INSPIRE_ARMY.remaining === 16,
      `got ${JSON.stringify(r.activeSpells && r.activeSpells.INSPIRE_ARMY)}`);

    assert('B', 'activeSpells.PATRIOTISM.remaining === 14',
      r.activeSpells && r.activeSpells.PATRIOTISM && r.activeSpells.PATRIOTISM.remaining === 14,
      `got ${JSON.stringify(r.activeSpells && r.activeSpells.PATRIOTISM)}`);

    assert('B', 'MAGIC_SHIELD not in activeSpells (inactive spell)',
      r.activeSpells && !r.activeSpells.MAGIC_SHIELD,
      `got ${JSON.stringify(r.activeSpells && r.activeSpells.MAGIC_SHIELD)}`);
  } catch (e) {
    results.errors.push('Group B failed to load: ' + e.message);
    results.failed++;
  }

  // -------------------------------------------------------------------------
  // GROUP C — scrapeThrone(throne.html) — spell detection + duration
  // -------------------------------------------------------------------------
  try {
    const doc = await loadDoc(
      '../../Utopia_HTML_download/https-:utopia-game.com:wol:game:throne.html'
    );
    const r = Scrapers.scrapeThrone(doc);

    assert('C', 'spellFertileLands === true (legacy field)',
      r && r.spellFertileLands === true,
      `got ${r && r.spellFertileLands}`);

    assert('C', 'activeSpellsFromThrone.FERTILE_LANDS is truthy',
      r && r.activeSpellsFromThrone && !!r.activeSpellsFromThrone.FERTILE_LANDS,
      `got ${JSON.stringify(r && r.activeSpellsFromThrone)}`);

    assert('C', 'activeSpellsFromThrone.FERTILE_LANDS.remaining === 20',
      r && r.activeSpellsFromThrone &&
      r.activeSpellsFromThrone.FERTILE_LANDS &&
      r.activeSpellsFromThrone.FERTILE_LANDS.remaining === 20,
      `got ${JSON.stringify(r && r.activeSpellsFromThrone && r.activeSpellsFromThrone.FERTILE_LANDS)}`);
  } catch (e) {
    results.errors.push('Group C failed to load: ' + e.message);
    results.failed++;
  }

  // -------------------------------------------------------------------------
  // GROUP D — Engine formula application with spell flags
  // -------------------------------------------------------------------------
  {
    const s1 = makeBaseState();
    s1.spellFertileLands = true;
    const food = Engine.calcFood(s1);

    assert('D', 'spellFertileLands=true → calcFood().fertileMod === 1.25',
      food.fertileMod === 1.25,
      `got ${food.fertileMod}`);

    const s2 = makeBaseState();
    s2.spellInspireArmy = true;
    const wages = Engine.calcWages(s2);

    assert('D', 'spellInspireArmy=true → calcWages().spellWageMod === 0.85',
      wages.spellWageMod === 0.85,
      `got ${wages.spellWageMod}`);
  }

  // -------------------------------------------------------------------------
  // RENDER
  // -------------------------------------------------------------------------
  render();

  function render() {
    const total = results.passed + results.failed;
    const summaryEl = document.getElementById('summary');
    const allPass = results.failed === 0;
    summaryEl.className = 'summary ' + (allPass ? 'pass' : 'fail');
    summaryEl.innerHTML = `<strong>${results.passed}/${total} passed</strong>`
      + (results.failed > 0 ? ` &nbsp;|&nbsp; <span style="color:#e74c3c">${results.failed} FAILED</span>` : '');

    const container = document.getElementById('results');
    let html = '';
    let currentGroup = '';

    const groupLabels = {
      A: 'Group A — scrapeEnchantment(enchantment.html) — no active spells',
      B: 'Group B — scrapeEnchantment(enchantment_ex1.html) — 3 active spells',
      C: 'Group C — scrapeThrone(throne.html) — spell detection + duration',
      D: 'Group D — Engine formula application'
    };

    for (const d of results.details) {
      if (d.group !== currentGroup) {
        currentGroup = d.group;
        html += `<div class="section">${groupLabels[currentGroup] || currentGroup}</div>`;
      }
      const cls = d.pass ? 'pass' : 'fail';
      const icon = d.pass ? 'PASS' : 'FAIL';
      const extra = d.extra ? ` — ${d.extra}` : '';
      html += `<div class="test ${cls}">[${icon}] ${d.name}${!d.pass ? extra : ''}</div>`;
    }

    for (const err of results.errors) {
      html += `<div class="error">ERROR: ${err}</div>`;
    }

    container.innerHTML = html;

    console.log(`\n=== SCRAPER SPELL TESTS: ${results.passed}/${total} passed ===`);
    for (const d of results.details) {
      if (!d.pass) {
        console.warn(`FAIL [${d.group}]: ${d.name} — ${d.extra}`);
      }
    }
    for (const err of results.errors) {
      console.error('ERROR:', err);
    }
  }
})();
