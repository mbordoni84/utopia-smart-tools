// =============================================================================
// Tick Simulator
// =============================================================================
// Simulates province economy tick-by-tick, updating state each tick to capture
// cascading effects: drafting reduces peasants → lower income; more soldiers →
// higher wages; higher mil ratio → more expensive drafts; population grows
// partially offsetting draft losses.
//
// Requires: GAME_DATA, Engine, Utils, StateBuilder, Simulator (core/)
// =============================================================================

(function () {
  // The engine state object — built from imported game data or manual inputs
  let _engineState = null;
  let _simResults = null;
  let _milTargetPct = 0.85;

  // ---------------------------------------------------------------------------
  // IMPORT FROM GAME
  // ---------------------------------------------------------------------------
  document.getElementById('importBtn').addEventListener('click', importGameData);

  function importGameData() {
    function onGameData(d) {
      if (!d) {
        document.getElementById('importStatus').textContent = 'No game data. Visit game pages first.';
        return;
      }

      const state = StateBuilder.fromScrapedData(d);
      _engineState = state;

      const race = state.race;
      const personality = state.personality;

      // Fill manual override inputs with imported values
      const fill = (id, val) => {
        const el = document.getElementById(id);
        if (el && val !== undefined && val !== null) el.value = val;
      };
      fill('m_peasants', state.peasants);
      fill('m_soldiers', state.soldiers);
      fill('m_offSpecs', state.offSpecs);
      fill('m_defSpecs', state.defSpecs);
      fill('m_elites', state.elites);
      fill('m_thieves', state.thieves);
      fill('m_gold', state.gold);
      fill('m_food', state.food);

      // Show import status
      document.getElementById('importStatus').textContent =
        `Imported: ${d.provinceName || 'Unknown'} (${race.name} ${personality.name})`;

      renderInitialState(state);
    }

    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get('gameData', (result) => onGameData(result.gameData));
    } else if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage({ type: 'getGameData' }, (d) => {
        if (chrome.runtime.lastError) {
          document.getElementById('importStatus').textContent = 'Error: ' + chrome.runtime.lastError.message;
          return;
        }
        onGameData(d);
      });
    } else {
      document.getElementById('importStatus').textContent = 'Open via extension popup.';
    }
  }

  // ---------------------------------------------------------------------------
  // INITIAL STATE DISPLAY
  // ---------------------------------------------------------------------------
  function renderInitialState(state) {
    const pop = Engine.calcPopGrowth(state);
    const income = Engine.calcIncome(state);
    const wages = Engine.calcWages(state);

    const grid = document.getElementById('initialState');
    const fmtNum = Utils.fmtNum;
    const rows = [
      ['Peasants', fmtNum(state.peasants)],
      ['Soldiers', fmtNum(state.soldiers)],
      ['Off Specs', fmtNum(state.offSpecs)],
      ['Def Specs', fmtNum(state.defSpecs)],
      ['Elites', fmtNum(state.elites)],
      ['Max Population', fmtNum(pop.maxPop)],
      ['Gold', fmtNum(state.gold)],
      ['Income/tick', fmtNum(income.modifiedIncome)],
      ['Wages/tick', fmtNum(wages.modifiedWages)],
      ['BE', (income.beResult.be * 100).toFixed(1) + '%'],
      ['Food', fmtNum(state.food)],
      ['Runes', fmtNum(state.runes)],
    ];

    grid.innerHTML = rows.map(([label, val]) =>
      `<span class="stat-label">${label}</span><span class="stat-value">${val}</span>`
    ).join('');
  }

  // ---------------------------------------------------------------------------
  // SIMULATION LOOP
  // ---------------------------------------------------------------------------
  document.getElementById('runBtn').addEventListener('click', runSimulation);

  function runSimulation() {
    const startState = buildStartState();
    if (!startState) return;

    const draftRate = document.getElementById('draftRate').value;
    const milTargetPct = (parseFloat(document.getElementById('milTarget').value) || 85) / 100;

    const results = Simulator.run(startState, {
      maxTicks: 300,
      draftRate,
      shouldStop(snapshot) {
        if (snapshot.milPct >= milTargetPct) return true;
        if (draftRate === 'none') return true;
        return false;
      }
    });

    const lastResult = results[results.length - 1];
    const reached = lastResult.milPct >= milTargetPct;
    const summaryEl = document.getElementById('simSummary');
    const fmtPct = p => (p * 100).toFixed(1) + '%';
    if (reached) {
      summaryEl.style.color = '#4ecdc4';
      summaryEl.textContent = `✓ Reaches ${fmtPct(milTargetPct)} in ${lastResult.tick} tick${lastResult.tick !== 1 ? 's' : ''}`;
    } else if (draftRate === 'none') {
      summaryEl.style.color = '#e74c3c';
      summaryEl.textContent = `Draft rate is None — no soldiers will be drafted`;
    } else {
      summaryEl.style.color = '#e74c3c';
      summaryEl.textContent = `⚠ Target not reached within ${MAX_TICKS} ticks (capped at ${fmtPct(lastResult.milPct)})`;
    }

    _simResults = results;
    _milTargetPct = milTargetPct;
    renderResults(results);
  }

  function buildStartState() {
    let state = _engineState ? Utils.deepClone(_engineState) : StateBuilder.fromScrapedData({});

    const getNum = (id) => {
      const el = document.getElementById(id);
      return el ? (parseInt(el.value) || 0) : 0;
    };

    // Apply manual overrides
    state.peasants = getNum('m_peasants');
    state.soldiers = getNum('m_soldiers');
    state.offSpecs = getNum('m_offSpecs');
    state.defSpecs = getNum('m_defSpecs');
    state.elites = getNum('m_elites');
    state.thieves = getNum('m_thieves');
    state.gold = getNum('m_gold');
    state.food = getNum('m_food');

    return state;
  }


  // ---------------------------------------------------------------------------
  // RENDER RESULTS
  // ---------------------------------------------------------------------------
  function renderResults(results) {
    document.getElementById('resultsPlaceholder').style.display = 'none';
    document.getElementById('chartsArea').style.display = 'block';
    document.getElementById('tableArea').style.display = 'block';

    renderTable(results);
    renderCharts(results);
  }

  // ---------------------------------------------------------------------------
  // TABLE
  // ---------------------------------------------------------------------------
  function renderTable(results) {
    const fmtNum = Utils.fmtNum;
    const fmtPct = n => (n * 100).toFixed(1) + '%';

    const tbody = document.getElementById('simTableBody');
    tbody.innerHTML = results.map(r => {
      const netGoldClass = r.netGold >= 0 ? 'net-positive' : 'net-negative';
      const netFoodClass = r.netFood >= 0 ? 'net-positive' : 'net-negative';
      const netRunesClass = r.netRunes >= 0 ? 'net-positive' : 'net-negative';
      return `<tr>
        <td>${r.tick}</td>
        <td>${(r.milPct * 100).toFixed(1)}%</td>
        <td>${fmtNum(r.gold)}</td>
        <td class="${netGoldClass}">${fmtNum(r.netGold)}</td>
        <td>${fmtNum(r.peasants)}</td>
        <td>${fmtNum(r.soldiers)}</td>
        <td>${fmtNum(r.drafted)}</td>
        <td>${fmtNum(r.draftCost)}</td>
        <td>${fmtNum(r.income)}</td>
        <td>${fmtNum(r.wages)}</td>
        <td>${fmtPct(r.be)}</td>
        <td>${fmtNum(r.food)}</td>
        <td class="${netFoodClass}">${fmtNum(r.netFood)}</td>
        <td>${fmtNum(r.runes)}</td>
        <td class="${netRunesClass}">${fmtNum(r.netRunes)}</td>
      </tr>`;
    }).join('');
  }

  // ---------------------------------------------------------------------------
  // CHARTS (Canvas 2D) — interactive with hover tooltips
  // ---------------------------------------------------------------------------

  // Shared tooltip element
  const _tooltip = document.createElement('div');
  _tooltip.id = 'chartTooltip';
  _tooltip.style.cssText = [
    'position:fixed', 'display:none', 'pointer-events:none',
    'background:#16213e', 'border:1px solid #c4a35a44', 'border-radius:6px',
    'padding:10px 14px', 'font-size:12px', 'font-family:system-ui,sans-serif',
    'color:#e0e0e0', 'z-index:9999', 'min-width:160px',
    'box-shadow:0 4px 16px rgba(0,0,0,0.5)'
  ].join(';');
  document.body.appendChild(_tooltip);

  // Stored chart data for re-draw on hover
  const _chartStore = {};

  function renderCharts(results) {
    renderLineChart('chartEconomy', results, [
      { key: 'gold', label: 'Gold', color: '#c4a35a' },
      { key: 'income', label: 'Income/tick', color: '#4ecdc4' },
      { key: 'wages', label: 'Wages/tick', color: '#e74c3c' },
    ]);

    renderLineChart('chartPopulation', results, [
      { key: 'peasants', label: 'Peasants', color: '#6a8caf' },
      { key: 'soldiers', label: 'Soldiers', color: '#e07040' },
      { key: 'drafted', label: 'Drafted/tick', color: '#f8c84a', dashed: true },
    ]);

    renderMilPctChart('chartMilPct', results, _milTargetPct);

    renderLineChart('chartResources', results, [
      { key: 'food', label: 'Food', color: '#5da55d' },
      { key: 'runes', label: 'Runes', color: '#9b59b6' },
    ]);
  }

  function renderLineChart(canvasId, results, series) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const W = canvas.offsetWidth || 700;
    canvas.width = W;

    _chartStore[canvasId] = { results, series, W, H: canvas.height };

    // Attach hover listeners once
    if (!canvas._hoverReady) {
      canvas._hoverReady = true;
      canvas.style.cursor = 'crosshair';
      canvas.addEventListener('mousemove', (e) => {
        const store = _chartStore[canvasId];
        if (!store) return;
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const pad = { top: 20, right: 20, bottom: 40, left: 80 };
        const chartW = store.W - pad.left - pad.right;
        const n = store.results.length;
        // Find nearest tick index by x position
        let bestIdx = 0, bestDist = Infinity;
        for (let i = 0; i < n; i++) {
          const x = pad.left + (i / Math.max(n - 1, 1)) * chartW;
          const dist = Math.abs(mouseX - x);
          if (dist < bestDist) { bestDist = dist; bestIdx = i; }
        }
        drawChart(canvas, store.results, store.series, store.W, store.H, bestIdx);
        positionTooltip(e, store.results[bestIdx], store.series);
      });
      canvas.addEventListener('mouseleave', () => {
        const store = _chartStore[canvasId];
        if (store) drawChart(canvas, store.results, store.series, store.W, store.H, -1);
        _tooltip.style.display = 'none';
      });
    }

    drawChart(canvas, results, series, W, canvas.height, -1);
  }

  function positionTooltip(mouseEvent, row, series) {
    const fmtNum = Utils.fmtNum;
    const fmtPct = n => (n * 100).toFixed(1) + '%';
    let html = `<div style="color:#c4a35a;font-weight:600;margin-bottom:6px">Tick ${row.tick}</div>`;
    for (const s of series) {
      const val = s.key === 'be' ? fmtPct(row[s.key]) : fmtNum(row[s.key]);
      html += `<div style="display:flex;justify-content:space-between;gap:16px;margin:2px 0">
        <span style="color:${s.color}">${s.label}</span>
        <span style="font-variant-numeric:tabular-nums">${val}</span>
      </div>`;
    }
    _tooltip.innerHTML = html;
    _tooltip.style.display = 'block';
    // Keep tooltip within viewport
    const tw = _tooltip.offsetWidth, th = _tooltip.offsetHeight;
    let tx = mouseEvent.clientX + 14, ty = mouseEvent.clientY - 10;
    if (tx + tw > window.innerWidth - 8) tx = mouseEvent.clientX - tw - 14;
    if (ty + th > window.innerHeight - 8) ty = window.innerHeight - th - 8;
    _tooltip.style.left = tx + 'px';
    _tooltip.style.top = ty + 'px';
  }

  function drawChart(canvas, results, series, W, H, hoverIdx) {
    const ctx = canvas.getContext('2d');
    const pad = { top: 20, right: 20, bottom: 40, left: 80 };
    const chartW = W - pad.left - pad.right;
    const chartH = H - pad.top - pad.bottom;

    ctx.clearRect(0, 0, W, H);

    // Global min/max
    let allVals = [];
    for (const s of series) allVals = allVals.concat(results.map(r => r[s.key]));
    const minVal = Math.min(0, ...allVals);
    const maxVal = Math.max(...allVals, 1);
    const range = maxVal - minVal;
    const n = results.length;

    const toX = (i) => pad.left + (i / Math.max(n - 1, 1)) * chartW;
    const toY = (val) => pad.top + chartH - ((val - minVal) / range) * chartH;

    // Gridlines
    ctx.strokeStyle = '#2a2a4a';
    ctx.lineWidth = 1;
    const gridLines = 5;
    for (let i = 0; i <= gridLines; i++) {
      const y = pad.top + (chartH / gridLines) * i;
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(pad.left + chartW, y);
      ctx.stroke();
      const val = maxVal - (range / gridLines) * i;
      ctx.fillStyle = '#666';
      ctx.font = '10px system-ui';
      ctx.textAlign = 'right';
      ctx.fillText(fmtK(val), pad.left - 6, y + 4);
    }

    // Zero line
    if (minVal < 0) {
      const y0 = toY(0);
      ctx.strokeStyle = '#444';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(pad.left, y0);
      ctx.lineTo(pad.left + chartW, y0);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // X axis labels
    ctx.fillStyle = '#666';
    ctx.font = '10px system-ui';
    ctx.textAlign = 'center';
    const tickStep = Math.max(1, Math.floor(n / 12));
    for (let i = 0; i < n; i += tickStep) {
      ctx.fillText('T' + results[i].tick, toX(i), pad.top + chartH + 16);
    }
    ctx.fillText('T' + results[n - 1].tick, toX(n - 1), pad.top + chartH + 16);

    // Series lines
    for (const s of series) {
      ctx.strokeStyle = s.color;
      ctx.lineWidth = 2;
      ctx.setLineDash(s.dashed ? [5, 3] : []);
      ctx.beginPath();
      results.forEach((r, i) => {
        const x = toX(i), y = toY(r[s.key]);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // Hover crosshair + dots
    if (hoverIdx >= 0 && hoverIdx < n) {
      const hx = toX(hoverIdx);
      // Vertical line
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(hx, pad.top);
      ctx.lineTo(hx, pad.top + chartH);
      ctx.stroke();
      // Dot per series
      for (const s of series) {
        const hy = toY(results[hoverIdx][s.key]);
        ctx.fillStyle = s.color;
        ctx.beginPath();
        ctx.arc(hx, hy, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#1a1a2e';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }

    // Legend
    const legendY = pad.top + chartH + 30;
    let legendX = pad.left;
    ctx.font = '11px system-ui';
    ctx.textAlign = 'left';
    for (const s of series) {
      ctx.fillStyle = s.color;
      ctx.fillRect(legendX, legendY - 8, 16, 3);
      ctx.fillStyle = '#aaa';
      ctx.fillText(s.label, legendX + 20, legendY);
      legendX += ctx.measureText(s.label).width + 40;
    }
  }

  // Dedicated military % chart with target line
  function renderMilPctChart(canvasId, results, targetPct) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const W = canvas.offsetWidth || 700;
    const H = canvas.height;
    canvas.width = W;

    _chartStore[canvasId] = { results, series: [{ key: 'milPct', label: 'Army %', color: '#e07040' }, { key: 'be', label: 'BE%', color: '#9b59b6' }], W, H, targetPct };

    if (!canvas._hoverReady) {
      canvas._hoverReady = true;
      canvas.style.cursor = 'crosshair';
      canvas.addEventListener('mousemove', (e) => {
        const store = _chartStore[canvasId];
        if (!store) return;
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const pad = { top: 20, right: 20, bottom: 40, left: 60 };
        const chartW = store.W - pad.left - pad.right;
        const n = store.results.length;
        let bestIdx = 0, bestDist = Infinity;
        for (let i = 0; i < n; i++) {
          const x = pad.left + (i / Math.max(n - 1, 1)) * chartW;
          const dist = Math.abs(mouseX - x);
          if (dist < bestDist) { bestDist = dist; bestIdx = i; }
        }
        drawMilPctChart(canvas, store.results, store.W, store.H, store.targetPct, bestIdx);
        // Show tooltip
        const row = store.results[bestIdx];
        _tooltip.innerHTML = `
          <div style="color:#c4a35a;font-weight:600;margin-bottom:6px">Tick ${row.tick}</div>
          <div style="display:flex;justify-content:space-between;gap:16px;margin:2px 0">
            <span style="color:#e07040">Army % of Max Pop</span>
            <span>${(row.milPct * 100).toFixed(1)}%</span>
          </div>
          <div style="display:flex;justify-content:space-between;gap:16px;margin:2px 0">
            <span style="color:#9b59b6">BE%</span>
            <span>${(row.be * 100).toFixed(1)}%</span>
          </div>
          <div style="display:flex;justify-content:space-between;gap:16px;margin:2px 0">
            <span style="color:#4ecdc4">Target</span>
            <span>${(store.targetPct * 100).toFixed(1)}%</span>
          </div>`;
        _tooltip.style.display = 'block';
        const tw = _tooltip.offsetWidth, th = _tooltip.offsetHeight;
        let tx = e.clientX + 14, ty = e.clientY - 10;
        if (tx + tw > window.innerWidth - 8) tx = e.clientX - tw - 14;
        if (ty + th > window.innerHeight - 8) ty = window.innerHeight - th - 8;
        _tooltip.style.left = tx + 'px';
        _tooltip.style.top = ty + 'px';
      });
      canvas.addEventListener('mouseleave', () => {
        const store = _chartStore[canvasId];
        if (store) drawMilPctChart(canvas, store.results, store.W, store.H, store.targetPct, -1);
        _tooltip.style.display = 'none';
      });
    }

    drawMilPctChart(canvas, results, W, H, targetPct, -1);
  }

  function drawMilPctChart(canvas, results, W, H, targetPct, hoverIdx) {
    const ctx = canvas.getContext('2d');
    const pad = { top: 20, right: 20, bottom: 40, left: 60 };
    const chartW = W - pad.left - pad.right;
    const chartH = H - pad.top - pad.bottom;
    const n = results.length;

    ctx.clearRect(0, 0, W, H);

    const allVals = [...results.map(r => r.milPct), ...results.map(r => r.be), targetPct];
    const minVal = Math.max(0, Math.min(...allVals) * 0.97);
    const maxVal = Math.max(...allVals) * 1.03;
    const range = maxVal - minVal;
    const toX = (i) => pad.left + (i / Math.max(n - 1, 1)) * chartW;
    const toY = (v) => pad.top + chartH - ((v - minVal) / range) * chartH;

    // Gridlines + Y labels (as %)
    ctx.strokeStyle = '#2a2a4a';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 5; i++) {
      const y = pad.top + (chartH / 5) * i;
      ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(pad.left + chartW, y); ctx.stroke();
      const val = maxVal - (range / 5) * i;
      ctx.fillStyle = '#666'; ctx.font = '10px system-ui'; ctx.textAlign = 'right';
      ctx.fillText((val * 100).toFixed(0) + '%', pad.left - 6, y + 4);
    }

    // Target line
    const ty = toY(targetPct);
    ctx.strokeStyle = '#4ecdc4';
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 4]);
    ctx.beginPath(); ctx.moveTo(pad.left, ty); ctx.lineTo(pad.left + chartW, ty); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#4ecdc4'; ctx.font = '10px system-ui'; ctx.textAlign = 'left';
    ctx.fillText('Target ' + (targetPct * 100).toFixed(0) + '%', pad.left + 4, ty - 4);

    // X axis labels
    ctx.fillStyle = '#666'; ctx.font = '10px system-ui'; ctx.textAlign = 'center';
    const tickStep = Math.max(1, Math.floor(n / 12));
    for (let i = 0; i < n; i += tickStep) ctx.fillText('T' + results[i].tick, toX(i), pad.top + chartH + 16);
    ctx.fillText('T' + results[n - 1].tick, toX(n - 1), pad.top + chartH + 16);

    // Mil% line
    ctx.strokeStyle = '#e07040'; ctx.lineWidth = 2;
    ctx.beginPath();
    results.forEach((r, i) => {
      const x = toX(i), y = toY(r.milPct);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // BE% line
    ctx.strokeStyle = '#9b59b6'; ctx.lineWidth = 2;
    ctx.beginPath();
    results.forEach((r, i) => {
      const x = toX(i), y = toY(r.be);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Hover crosshair + dots
    if (hoverIdx >= 0 && hoverIdx < n) {
      const hx = toX(hoverIdx);
      ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(hx, pad.top); ctx.lineTo(hx, pad.top + chartH); ctx.stroke();
      // Mil% dot
      const hy1 = toY(results[hoverIdx].milPct);
      ctx.fillStyle = '#e07040';
      ctx.beginPath(); ctx.arc(hx, hy1, 4, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#1a1a2e'; ctx.lineWidth = 1.5; ctx.stroke();
      // BE% dot
      const hy2 = toY(results[hoverIdx].be);
      ctx.fillStyle = '#9b59b6';
      ctx.beginPath(); ctx.arc(hx, hy2, 4, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#1a1a2e'; ctx.lineWidth = 1.5; ctx.stroke();
    }

    // Legend
    ctx.font = '11px system-ui'; ctx.textAlign = 'left';
    let lx = pad.left;
    ctx.fillStyle = '#e07040'; ctx.fillRect(lx, pad.top + chartH + 22, 16, 3);
    ctx.fillStyle = '#aaa'; ctx.fillText('Army % of Max Pop', lx + 20, pad.top + chartH + 30);
    lx += 20 + ctx.measureText('Army % of Max Pop').width + 20;
    ctx.fillStyle = '#9b59b6'; ctx.fillRect(lx, pad.top + chartH + 22, 16, 3);
    ctx.fillStyle = '#aaa'; ctx.fillText('BE%', lx + 20, pad.top + chartH + 30);
  }

  const fmtK = Utils.fmtK;

  // ---------------------------------------------------------------------------
  // AUTO-IMPORT ON LOAD
  // ---------------------------------------------------------------------------
  importGameData();
})();
