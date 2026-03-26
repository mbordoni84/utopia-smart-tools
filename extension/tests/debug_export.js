// Debug Export Tool JavaScript

function log(msg, type = 'info') {
  const statusEl = document.getElementById('status');
  statusEl.className = 'status ' + (type === 'error' ? 'error' : type === 'success' ? 'success' : '');
  statusEl.innerHTML = msg;
}

function showJSON(report) {
  const outputEl = document.getElementById('output');
  outputEl.innerHTML = '<pre>' + JSON.stringify(report, null, 2) + '</pre>';
}

function downloadJSON(report, filename) {
  const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || Debug.generateFilename(report);
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Export from chrome.storage (requires extension context)
function exportFromStorage() {
  log('Starting export...');
  console.log('Chrome available:', typeof chrome !== 'undefined');
  console.log('Chrome.storage available:', typeof chrome !== 'undefined' && !!chrome.storage);

  try {
    if (typeof chrome === 'undefined' || !chrome.storage) {
      throw new Error('❌ Chrome storage not available.\n\n' +
        'This file must be opened via the extension context.\n' +
        'See instructions above for how to open it correctly.');
    }

    log('Reading from chrome.storage...');

    chrome.storage.local.get('gameData', function(result) {
      try {
        const scraped = result.gameData;
        console.log('Storage result:', result);

        if (!scraped) {
          throw new Error('❌ No gameData found in chrome.storage.\n\n' +
            '1. Visit game pages (throne, buildings, science, military, state)\n' +
            '2. Wait for scraping to complete\n' +
            '3. Try again');
        }

        log('✓ Found scraped data: ' + Object.keys(scraped).length + ' fields');
        console.log('Scraped data:', scraped);

        log('Building engine state...');
        const state = StateBuilder.fromScrapedData(scraped);
        console.log('Engine state:', state);

        log('Generating debug report...');
        const report = Debug.buildReport(scraped, state);
        console.log('Debug report:', report);

        log('✅ Report generated! Downloading...', 'success');
        showJSON(report);
        downloadJSON(report);

        // Show comprehensive comparisons
        const comp = report.comparisons;
        let summary = '<h3>Comparison Summary:</h3>';
        summary += '<style>.error { color: #e74c3c; } .warn { color: #f39c12; } .ok { color: #2ecc71; }</style>';
        summary += '<pre>';

        // Helper to format comparison line with color coding
        const formatLine = (c) => {
          const absDelta = Math.abs(parseFloat(c.pctDiff) || 0);
          const colorClass = absDelta > 10 ? 'error' : absDelta > 2 ? 'warn' : 'ok';
          return `  <span class="${colorClass}">${c.label}: game=${c.game}, engine=${c.engine}, delta=${c.delta} (${c.pctDiff})</span>\n`;
        };

        // Building Efficiency
        if (comp.buildingEfficiency) {
          summary += '<strong>═══ Building Efficiency ═══</strong>\n';
          comp.buildingEfficiency.forEach(c => { summary += formatLine(c); });
          summary += '\n';
        }

        // Construction (costs, time, raze)
        if (comp.construction) {
          summary += '<strong>═══ Construction ═══</strong>\n';
          comp.construction.forEach(c => { summary += formatLine(c); });
          summary += '\n';
        }

        // Economy (income, wages, banks)
        if (comp.economy) {
          summary += '<strong>═══ Economy ═══</strong>\n';
          comp.economy.forEach(c => { summary += formatLine(c); });
          summary += '\n';
        }

        // Food (production, consumption, decay)
        if (comp.food) {
          summary += '<strong>═══ Food ═══</strong>\n';
          comp.food.forEach(c => { summary += formatLine(c); });
          summary += '\n';
        }

        // Runes (production, decay)
        if (comp.runes) {
          summary += '<strong>═══ Runes ═══</strong>\n';
          comp.runes.forEach(c => { summary += formatLine(c); });
          summary += '\n';
        }

        // Population (max pop, birth rate, homes, hospitals)
        if (comp.population) {
          summary += '<strong>═══ Population ═══</strong>\n';
          comp.population.forEach(c => { summary += formatLine(c); });
          summary += '\n';
        }

        // Military (networth, OME, DME, offense/defense)
        if (comp.military) {
          summary += '<strong>═══ Military ═══</strong>\n';
          comp.military.forEach(c => { summary += formatLine(c); });
          summary += '\n';
        }

        summary += '</pre>';
        document.getElementById('output').innerHTML += summary;

      } catch (err) {
        log('ERROR processing data: ' + err.message, 'error');
        console.error('Error processing:', err);
      }
    });

  } catch (err) {
    log('ERROR: ' + err.message, 'error');
    console.error('Error:', err);
  }
}

// Import from previous JSON file and re-export
async function exportFromFile() {
  try {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';

    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      log('Reading ' + file.name + '...');
      const text = await file.text();
      const oldReport = JSON.parse(text);

      log('Rebuilding state with NEW WIP subtraction logic...');
      const scraped = oldReport.scraped;
      const state = StateBuilder.fromScrapedData(scraped);

      log('Generating NEW debug report...');
      const report = Debug.buildReport(scraped, state);

      log('New report generated! Downloading...', 'success');

      // Show comprehensive comparisons (same as exportFromStorage)
      const comp = report.comparisons;
      let summary = '<h3>Comparison Summary (Re-Exported):</h3>';
      summary += '<style>.error { color: #e74c3c; } .warn { color: #f39c12; } .ok { color: #2ecc71; }</style>';
      summary += '<pre>';

      // Helper to format comparison line with color coding
      const formatLine = (c) => {
        const absDelta = Math.abs(parseFloat(c.pctDiff) || 0);
        const colorClass = absDelta > 10 ? 'error' : absDelta > 2 ? 'warn' : 'ok';
        return `  <span class="${colorClass}">${c.label}: game=${c.game}, engine=${c.engine}, delta=${c.delta} (${c.pctDiff})</span>\n`;
      };

      // Building Efficiency
      if (comp.buildingEfficiency) {
        summary += '<strong>═══ Building Efficiency ═══</strong>\n';
        comp.buildingEfficiency.forEach(c => { summary += formatLine(c); });
        summary += '\n';
      }

      // Construction (costs, time, raze)
      if (comp.construction) {
        summary += '<strong>═══ Construction ═══</strong>\n';
        comp.construction.forEach(c => { summary += formatLine(c); });
        summary += '\n';
      }

      // Economy (income, wages, banks)
      if (comp.economy) {
        summary += '<strong>═══ Economy ═══</strong>\n';
        comp.economy.forEach(c => { summary += formatLine(c); });
        summary += '\n';
      }

      // Food (production, consumption, decay)
      if (comp.food) {
        summary += '<strong>═══ Food ═══</strong>\n';
        comp.food.forEach(c => { summary += formatLine(c); });
        summary += '\n';
      }

      // Runes (production, decay)
      if (comp.runes) {
        summary += '<strong>═══ Runes ═══</strong>\n';
        comp.runes.forEach(c => { summary += formatLine(c); });
        summary += '\n';
      }

      // Population (max pop, birth rate, homes, hospitals)
      if (comp.population) {
        summary += '<strong>═══ Population ═══</strong>\n';
        comp.population.forEach(c => { summary += formatLine(c); });
        summary += '\n';
      }

      // Military (networth, OME, DME, offense/defense)
      if (comp.military) {
        summary += '<strong>═══ Military ═══</strong>\n';
        comp.military.forEach(c => { summary += formatLine(c); });
        summary += '\n';
      }

      summary += '</pre>';
      document.getElementById('output').innerHTML = summary;

      const filename = 'debug_' + (report.province.name || 'unknown').replace(/[^a-zA-Z0-9]/g, '_')
        + '_' + (report.province.race || '')
        + '_20260325_2228.json';
      downloadJSON(report, filename);
    };

    input.click();

  } catch (err) {
    log('ERROR: ' + err.message, 'error');
    console.error(err);
  }
}

// Attach event listeners when page loads
document.addEventListener('DOMContentLoaded', function() {
  document.getElementById('btnExportStorage').addEventListener('click', exportFromStorage);
  document.getElementById('btnExportFile').addEventListener('click', exportFromFile);
});
