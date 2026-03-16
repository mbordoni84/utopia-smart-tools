// =============================================================================
// Background Service Worker
// =============================================================================
// Handles chrome.storage operations and relays data between content scripts
// and extension pages via messaging.
//
// Also handles on-demand scraping: when the EOWCF planner requests fresh data,
// the service worker injects scrapers into all open game tabs, collects results,
// merges them, and returns the combined data.
// =============================================================================

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'getGameData') {
    chrome.storage.local.get('gameData', (result) => {
      sendResponse(result.gameData || null);
    });
    return true;
  }

  if (msg.type === 'setGameData') {
    mergeAndSave(msg.data).then(() => sendResponse({ ok: true }));
    return true;
  }

  // Fresh scrape: inject scrapers into all open game tabs, merge results
  if (msg.type === 'freshScrape') {
    freshScrapeAllTabs().then((data) => {
      sendResponse(data);
    });
    return true;
  }
});

// ---------------------------------------------------------------------------
// Merge scraped data into storage
// ---------------------------------------------------------------------------
async function mergeAndSave(scraped) {
  const result = await chrome.storage.local.get('gameData');
  const existing = result.gameData || {};

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

  const merged = Object.assign({}, existing, scraped);
  merged._lastUpdated = Date.now();

  // Track per-page scrape timestamps
  const pageTimestamps = Object.assign({}, existing._pageTimestamps || {});
  if (scraped._page) {
    pageTimestamps[scraped._page] = scraped._scrapedAt || Date.now();
  }
  merged._pageTimestamps = pageTimestamps;

  await chrome.storage.local.set({ gameData: merged });
  return merged;
}

// ---------------------------------------------------------------------------
// Fresh scrape: inject scrapers into all open utopia-game.com tabs
// ---------------------------------------------------------------------------
async function freshScrapeAllTabs() {
  const tabs = await chrome.tabs.query({ url: 'https://utopia-game.com/*' });

  for (const tab of tabs) {
    try {
      // Inject the scrapers.js file then run a scrape function
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['scraper/scrapers.js']
      });

      // Now run the actual scraping in that tab's context
      const scrapeResults = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          const doc = document;
          return Scrapers.scrapeThrone(doc)
            || Scrapers.scrapeState(doc)
            || Scrapers.scrapeMilitary(doc)
            || Scrapers.scrapeBuildings(doc)
            || Scrapers.scrapeScience(doc)
            || Scrapers.scrapeRitual(doc)
            || Scrapers.scrapeTrainArmy(doc)
            || Scrapers.scrapeKingdomDetails(doc);
        }
      });

      const scraped = scrapeResults && scrapeResults[0] && scrapeResults[0].result;
      if (scraped) {
        await mergeAndSave(scraped);
      }
    } catch (e) {
      console.log('[Utopia Smart Tools] Could not scrape tab', tab.id, e.message);
    }
  }

  // Return the final merged data
  const result = await chrome.storage.local.get('gameData');
  return result.gameData || null;
}
