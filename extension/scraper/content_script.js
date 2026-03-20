// =============================================================================
// Content Script — runs on utopia-game.com pages
// =============================================================================
// Detects which game page we're on, scrapes relevant data, and saves it.
// Uses a MutationObserver to detect AJAX page changes (the game loads pages
// without full reloads) and re-runs scrapers when content changes.
// =============================================================================

(function () {
  function runScrapers() {
    const doc = document;

    const scraped = Scrapers.scrapeThrone(doc)
      || Scrapers.scrapeState(doc)
      || Scrapers.scrapeMilitary(doc)
      || Scrapers.scrapeBuildings(doc)
      || Scrapers.scrapeScience(doc)
      || Scrapers.scrapeTrainArmy(doc)
      || Scrapers.scrapeKingdomDetails(doc);

    if (!scraped) return;

    // Current Utopian date is on every page
    const currentDate = Scrapers.scrapeCurrentDate(doc);
    if (currentDate) scraped.utopianDate = currentDate;

    // Avoid re-saving identical data
    // Throttle re-scrapes of the same page, but allow if new data has spells
    // (the Duration section may load after initial page render via AJAX)
    if (window._lastScrapedPage === scraped._page &&
        window._lastScrapedAt && (Date.now() - window._lastScrapedAt) < 2000) {
      if (!scraped.activeSpells || window._lastHadSpells) return;
    }
    window._lastHadSpells = !!scraped.activeSpells;
    window._lastScrapedPage = scraped._page;
    window._lastScrapedAt = Date.now();

    function mergeAndSave(existing) {
      if (scraped.buildings) {
        scraped.buildings = Object.assign({}, existing.buildings || {}, scraped.buildings);
      }
      if (scraped.sciences) {
        scraped.sciences = Object.assign({}, existing.sciences || {}, scraped.sciences);
      }
      if (scraped.inConstruction) {
        scraped.inConstruction = Object.assign({}, existing.inConstruction || {}, scraped.inConstruction);
      }
      if (scraped.buildingEffects) {
        scraped.buildingEffects = Object.assign({}, existing.buildingEffects || {}, scraped.buildingEffects);
      }
      // NOTE: activeSpells is NOT merged with old data — it's a complete snapshot
      // from the throne page. Replace to prevent expired spells from persisting.
      // Clean up legacy fields no longer produced by scrapers.
      const merged = Object.assign({}, existing, scraped);
      delete merged.activeSpellsFromThrone;
      delete merged.fadingSpells;
      delete merged.spellFertileLands;
      delete merged.spellChastity;
      delete merged.spellMinersM;
      delete merged.spellBuildBoon;
      merged._lastUpdated = Date.now();

      // Clean up timestamps from removed scrapers
      const pageTimestamps = Object.assign({}, existing._pageTimestamps || {});
      delete pageTimestamps.enchantment;
      delete pageTimestamps.ritual;
      if (scraped._page) {
        pageTimestamps[scraped._page] = scraped._scrapedAt || Date.now();
      }
      merged._pageTimestamps = pageTimestamps;

      function showToast(page) {
        const el = document.createElement('div');
        el.textContent = 'Utopia Smart Tools: ' + page + ' scraped!';
        el.style.cssText = 'position:fixed;top:12px;right:12px;background:#c0392b;color:#fff;padding:8px 16px;border-radius:6px;font:13px sans-serif;z-index:99999;opacity:0.95;pointer-events:none;transition:opacity 0.5s';
        document.body.appendChild(el);
        setTimeout(() => { el.style.opacity = '0'; }, 2500);
        setTimeout(() => { el.remove(); }, 3000);
      }

      if (chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ gameData: merged }, () => {
          console.log('[Utopia Smart Tools] Scraped', scraped._page, '—', Object.keys(scraped).length, 'fields');
          showToast(scraped._page);
        });
      } else {
        chrome.runtime.sendMessage({ type: 'setGameData', data: scraped }, () => {
          console.log('[Utopia Smart Tools] Scraped', scraped._page, '—', Object.keys(scraped).length, 'fields (via messaging)');
          showToast(scraped._page);
        });
      }
    }

    if (chrome.storage && chrome.storage.local) {
      chrome.storage.local.get('gameData', (result) => mergeAndSave(result.gameData || {}));
    } else {
      chrome.runtime.sendMessage({ type: 'getGameData' }, (existing) => {
        mergeAndSave(existing || {});
      });
    }
  }

  // Run immediately on page load
  runScrapers();

  // Watch for AJAX page changes — the game swaps .game-content without full reloads
  const gameContent = document.querySelector('.game-content');
  if (gameContent) {
    const observer = new MutationObserver(() => {
      // Debounce: wait for DOM to settle after AJAX load
      clearTimeout(window._scrapeTimer);
      window._scrapeTimer = setTimeout(runScrapers, 500);
    });
    observer.observe(gameContent, { childList: true, subtree: true });
  }
})();
