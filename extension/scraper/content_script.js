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
      || Scrapers.scrapeRitual(doc)
      || Scrapers.scrapeTrainArmy(doc)
      || Scrapers.scrapeEnchantment(doc)
      || Scrapers.scrapeKingdomDetails(doc);

    if (!scraped) return;

    // Current Utopian date is on every page
    const currentDate = Scrapers.scrapeCurrentDate(doc);
    if (currentDate) scraped.utopianDate = currentDate;

    // Avoid re-saving identical data
    if (window._lastScrapedPage === scraped._page &&
        window._lastScrapedAt && (Date.now() - window._lastScrapedAt) < 2000) {
      return;
    }
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
      if (scraped.activeSpells) {
        scraped.activeSpells = Object.assign({}, existing.activeSpells || {}, scraped.activeSpells);
      }
      if (scraped.activeSpellsFromThrone) {
        scraped.activeSpellsFromThrone = Object.assign({}, existing.activeSpellsFromThrone || {}, scraped.activeSpellsFromThrone);
      }
      const merged = Object.assign({}, existing, scraped);
      merged._lastUpdated = Date.now();

      const pageTimestamps = Object.assign({}, existing._pageTimestamps || {});
      if (scraped._page) {
        pageTimestamps[scraped._page] = scraped._scrapedAt || Date.now();
      }
      merged._pageTimestamps = pageTimestamps;

      if (chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ gameData: merged }, () => {
          console.log('[Utopia Smart Tools] Scraped', scraped._page, '—', Object.keys(scraped).length, 'fields');
        });
      } else {
        chrome.runtime.sendMessage({ type: 'setGameData', data: scraped }, () => {
          console.log('[Utopia Smart Tools] Scraped', scraped._page, '—', Object.keys(scraped).length, 'fields (via messaging)');
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
