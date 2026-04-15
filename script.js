let currentData = null;
let currentRange = '1D';
let currentView = 'activation';

const ACTIVATION_SHEET_HTML = `
  <div class="sheet-section" data-delay="0">
    <div class="sheet-label">Activation</div>
    <div id="funnel"></div>
  </div>
  <div class="sheet-section" data-delay="1">
    <div class="sheet-label">Cohorts</div>
    <div class="cohort-grid" id="cohorts"></div>
  </div>
  <div class="sheet-section" data-delay="2">
    <div class="sheet-label">Account Health</div>
    <div id="account-health"></div>
  </div>
  <div class="sheet-section" data-delay="3">
    <div class="sheet-label">Per Account</div>
    <div class="per-account-list" id="per-account"></div>
  </div>
  <div class="sheet-section" data-delay="4">
    <div class="sheet-label">Usage</div>
    <div class="signal-grid" id="signals"></div>
  </div>`;

document.addEventListener('DOMContentLoaded', async () => {
  const res = await fetch('./data.json');
  currentData = await res.json();
  renderRange('1D');
  bindTimeSelector();
  bindSheet();
  bindViewSelector();
});

let isTransitioning = false;

function bindViewSelector() {
  const selector = document.getElementById('view-selector');
  const btn = document.getElementById('view-title-btn');
  const dropdown = document.getElementById('view-dropdown');

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = selector.classList.contains('open');
    if (isOpen) {
      closeDropdown();
    } else {
      selector.classList.add('open');
      document.addEventListener('click', closeDropdown, { once: true });
    }
  });

  function closeDropdown() {
    selector.classList.remove('open');
  }

  dropdown.querySelectorAll('.view-option').forEach((opt) => {
    opt.addEventListener('click', () => {
      const view = opt.dataset.view;
      if (view === currentView) { closeDropdown(); return; }
      dropdown.querySelectorAll('.view-option').forEach(o => o.classList.remove('active'));
      opt.classList.add('active');
      document.getElementById('view-label').textContent = opt.textContent;
      closeDropdown();
      switchView(view);
    });
  });
}

function switchView(view) {
  currentView = view;
  const timeSelector = document.querySelector('.time-selector');

  if (view === 'ciwp-testing') {
    timeSelector.style.opacity = '0';
    timeSelector.style.pointerEvents = 'none';
    renderCiwpTestingView();
  } else {
    timeSelector.style.opacity = '';
    timeSelector.style.pointerEvents = '';
    // Restore sparkline SVG and activation sheet
    const sparkWrap = document.querySelector('.sparkline-wrap');
    sparkWrap.classList.remove('testing-summary-mode');
    sparkWrap.innerHTML = '<svg id="sparkline" viewBox="0 0 960 480" preserveAspectRatio="none"></svg>';
    document.querySelector('.sheet-content').innerHTML = ACTIVATION_SHEET_HTML;
    renderRange(currentRange);
  }
}

function bindTimeSelector() {
  document.querySelectorAll('.time-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (currentView !== 'activation') return;
      const range = btn.dataset.range;
      if (range === currentRange || isTransitioning) return;

      isTransitioning = true;

      document.querySelector('.time-btn.active').classList.remove('active');
      btn.classList.add('active');
      currentRange = range;

      const wrap = document.querySelector('.sparkline-wrap');
      const overlay = document.querySelector('.metric-overlay');

      wrap.classList.add('transitioning');
      overlay.classList.add('blur-out');

      setTimeout(() => {
        document.querySelectorAll('.hover-line, .hover-dot, .sparkline-tooltip').forEach(el => el.remove());
        renderRange(range, true);

        setTimeout(() => {
          wrap.classList.remove('transitioning');
          overlay.classList.remove('blur-out');
          isTransitioning = false;
        }, 80);
      }, 450);
    });
  });
}

function bindSheet() {
  const pill = document.getElementById('pill');
  const sheet = document.getElementById('sheet');
  const backdrop = document.getElementById('sheet-backdrop');
  const container = document.querySelector('.container');

  function openSheet() {
    container.classList.add('receded');
    sheet.classList.add('open');
    backdrop.classList.add('visible');
    pill.textContent = 'Close';
  }

  function closeSheet() {
    sheet.style.transition = '';
    sheet.style.transform = '';
    sheet.classList.remove('open');
    backdrop.classList.remove('visible');
    container.classList.remove('receded');
    pill.textContent = 'Details';
  }

  pill.addEventListener('click', () => {
    sheet.classList.contains('open') ? closeSheet() : openSheet();
  });

  backdrop.addEventListener('click', closeSheet);

  let touchStartY = 0;
  let touchDeltaY = 0;
  let isDragging = false;

  sheet.addEventListener('touchstart', (e) => {
    if (sheet.scrollTop > 0) return;
    touchStartY = e.touches[0].clientY;
    isDragging = true;
    sheet.style.transition = 'none';
  }, { passive: true });

  sheet.addEventListener('touchmove', (e) => {
    if (!isDragging) return;
    touchDeltaY = e.touches[0].clientY - touchStartY;
    if (touchDeltaY < 0) { touchDeltaY = 0; return; }
    sheet.style.transform = `translateY(${touchDeltaY}px)`;
  }, { passive: true });

  sheet.addEventListener('touchend', () => {
    if (!isDragging) return;
    isDragging = false;
    sheet.style.transition = '';
    if (touchDeltaY > 80) {
      closeSheet();
    } else {
      sheet.style.transform = 'translateY(0)';
      requestAnimationFrame(() => { sheet.style.transform = ''; });
    }
    touchDeltaY = 0;
  });
}

function renderRange(range, skipChartAnimation) {
  const d = currentData.ranges[range];

  const dateEl = document.getElementById('report-date');
  if (dateEl) dateEl.textContent = formatDate(currentData.date);
  document.getElementById('metric-value').textContent = d.primary.value + d.primary.unit;

  const arrow = document.getElementById('delta-arrow');
  const delta = document.getElementById('delta-value');
  arrow.textContent = d.primary.direction === 'up' ? '\u2191' : '\u2193';
  arrow.className = 'arrow ' + d.primary.direction;

  const vsLabel = range === '1D' ? 'vs yesterday' : range === '1W' ? 'vs last week' : 'vs last month';
  delta.textContent = d.primary.delta + '% ' + vsLabel;

  document.getElementById('accounts').textContent = d.accounts.total + ' ' + d.accounts.label;

  renderChart(d.chart, skipChartAnimation);
  renderFunnel(d.funnel);
  renderCohorts(d.cohorts);
  renderHealth(d.health);
  renderSignals(d.signals);
  renderPerAccount(currentData.perAccount);
}

// ── CIWP Testing View ─────────────────────────

function renderCiwpTestingView() {
  const data = currentData.ciwpTesting;

  // Update hero metric
  document.getElementById('metric-value').textContent = data.primary.value + data.primary.unit;
  document.getElementById('delta-arrow').textContent = '';
  document.getElementById('delta-value').textContent = data.primary.label;
  document.getElementById('accounts').textContent = data.primary.sub;

  // Replace sparkline with summary sentence
  const sparkWrap = document.querySelector('.sparkline-wrap');
  sparkWrap.innerHTML = buildTestingSummaryHTML(data.summary);
  sparkWrap.classList.add('testing-summary-mode');

  // Replace sheet content
  document.querySelector('.sheet-content').innerHTML = buildTestingSheetHTML(data);

  // Scroll-driven blur/parallax on sentence
  bindTestingScroll();
}

function bindTestingScroll() {
  const sentence = document.querySelector('.testing-summary-sentence');
  if (!sentence) return;

  function onScroll() {
    if (currentView !== 'ciwp-testing') {
      window.removeEventListener('scroll', onScroll);
      return;
    }
    const rect = sentence.getBoundingClientRect();
    const viewH = window.innerHeight;
    // Progress: 0 when sentence is centered, 1 when scrolled well past
    const center = rect.top + rect.height / 2;
    const progress = Math.max(0, Math.min(1, (viewH * 0.4 - center) / (viewH * 0.5)));

    const blur = progress * 8;
    const yShift = progress * -16;
    const opacity = 1 - progress * 0.6;

    sentence.style.transform = `translateY(${yShift}px)`;
    sentence.style.filter = `blur(${blur}px)`;
    sentence.style.opacity = opacity;
  }

  window.addEventListener('scroll', onScroll, { passive: true });
}

function buildTestingSummaryHTML(summary) {
  const dotClass = {
    'review': 'status-review',
    'dev': 'status-dev',
    'complete': 'status-complete'
  };

  const parts = summary.map(s => {
    return `<span class="summary-count ${dotClass[s.dot] || ''}">${s.count}</span>\u00A0${s.label}`;
  });

  // Join with commas and "and" before the last item
  let joined = parts[0];
  for (let i = 1; i < parts.length; i++) {
    joined += i === parts.length - 1 ? ' and\u00A0' : ',\u00A0';
    joined += parts[i];
  }

  return `<div class="testing-summary-sentence"><span class="summary-clause" style="animation-delay: 200ms">Howdy.\u00A0We\u00A0have ${joined}.</span></div>`;
}

function buildTestingSheetHTML(data) {
  const statusDotClass = {
    'under-review': 'status-review',
    'dev-review': 'status-dev',
    'complete': 'status-complete'
  };

  const statusLabel = {
    'under-review': 'Under Review',
    'dev-review': 'Dev Review',
    'complete': 'Complete'
  };

  const jiraBase = data.jiraBase || '';

  return data.categories.map((cat, i) => `
    <div class="sheet-section" data-delay="${i}">
      <div class="testing-category-header">
        <span class="testing-category-label">${cat.label}</span>
        <span class="testing-category-count">${cat.tickets.length}</span>
      </div>
      <div class="testing-ticket-list">
        ${cat.tickets.map(t => {
          const isLinked = jiraBase && t.id !== '--';
          const idHTML = isLinked
            ? `<a class="testing-ticket-id testing-ticket-link" href="${jiraBase}${t.id}" target="_blank" rel="noopener">${t.id}</a>`
            : `<span class="testing-ticket-id">${t.id}</span>`;
          return `
          <div class="testing-ticket-row">
            <span class="testing-status-dot ${statusDotClass[t.status] || ''}"></span>
            ${idHTML}
            <span class="testing-ticket-title">${t.title}</span>
            <span class="testing-ticket-status">${statusLabel[t.status] || t.status}</span>
          </div>`;
        }).join('')}
      </div>
    </div>`).join('');
}

// ── Activation sheet renderers ────────────────

function renderChart(chart, skipAnimation) {
  const svg = document.getElementById('sparkline');
  const wrap = document.querySelector('.sparkline-wrap');
  const w = 960;
  const h = 480;
  const padX = 8;
  const padTop = 40;
  const padBottom = 40;

  const allVals = [...chart.logins, ...chart.visits, ...chart.generated];
  const maxVal = Math.max(...allVals, 1);

  function toCoords(points) {
    return points.map((val, i) => ({
      x: padX + (i / (points.length - 1)) * (w - padX * 2),
      y: padTop + (1 - val / maxVal) * (h - padTop - padBottom),
    }));
  }

  function buildPath(coords) {
    let d = `M ${coords[0].x} ${coords[0].y}`;
    for (let i = 1; i < coords.length; i++) {
      const prev = coords[i - 1];
      const curr = coords[i];
      const cpx = (prev.x + curr.x) / 2;
      d += ` C ${cpx} ${prev.y}, ${cpx} ${curr.y}, ${curr.x} ${curr.y}`;
    }
    return d;
  }

  function buildArea(pathD, coords) {
    return pathD + ` L ${coords[coords.length - 1].x} ${h} L ${coords[0].x} ${h} Z`;
  }

  const loginCoords = toCoords(chart.logins);
  const visitCoords = toCoords(chart.visits);
  const genCoords = toCoords(chart.generated);

  const loginPath = buildPath(loginCoords);
  const visitPath = buildPath(visitCoords);
  const genPath = buildPath(genCoords);

  svg.innerHTML = `
    <defs>
      <linearGradient id="fill-logins" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#666666" stop-opacity="0.12"/>
        <stop offset="100%" stop-color="#666666" stop-opacity="0.01"/>
      </linearGradient>
      <linearGradient id="fill-visits" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#00A6FF" stop-opacity="0.1"/>
        <stop offset="100%" stop-color="#00A6FF" stop-opacity="0.01"/>
      </linearGradient>
      <linearGradient id="fill-generated" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#AC5CCC" stop-opacity="0.18"/>
        <stop offset="100%" stop-color="#AC5CCC" stop-opacity="0.02"/>
      </linearGradient>
    </defs>
    <path d="${buildArea(visitPath, visitCoords)}" fill="url(#fill-visits)" class="chart-area"/>
    <path d="${visitPath}" fill="none" stroke="#00A6FF" stroke-width="2" stroke-linecap="round" class="chart-line"/>
    <path d="${buildArea(loginPath, loginCoords)}" fill="url(#fill-logins)" class="chart-area"/>
    <path d="${loginPath}" fill="none" stroke="#666666" stroke-width="3" stroke-linecap="round" class="chart-line"/>
    <path d="${buildArea(genPath, genCoords)}" fill="url(#fill-generated)" class="chart-area"/>
    <path d="${genPath}" fill="none" stroke="#AC5CCC" stroke-width="2.5" stroke-linecap="round" stroke-dasharray="6 4" class="chart-line"/>
  `;

  if (skipAnimation) {
    svg.querySelectorAll('.chart-line, .chart-area').forEach((el) => { el.style.opacity = '1'; });
  } else {
    svg.querySelectorAll('.chart-line, .chart-area').forEach((el, i) => {
      el.style.opacity = '0';
      el.style.transition = 'none';
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          el.style.transition = `opacity 0.5s ease ${50 + i * 60}ms`;
          el.style.opacity = '1';
        });
      });
    });
  }

  const line = document.createElement('div');
  line.className = 'hover-line';
  wrap.appendChild(line);

  const dot = document.createElement('div');
  dot.className = 'hover-dot';
  wrap.appendChild(dot);

  const tooltip = document.createElement('div');
  tooltip.className = 'sparkline-tooltip';
  tooltip.innerHTML = `
    <div class="tooltip-date"></div>
    <div class="tooltip-row"><span class="t-dot" style="background:#666666"></span><span class="t-label">Logins</span><span class="t-val t-logins"></span></div>
    <div class="tooltip-row"><span class="t-dot" style="background:#00A6FF"></span><span class="t-label">Visits</span><span class="t-val t-visits"></span></div>
    <div class="tooltip-row"><span class="t-dot" style="background:#AC5CCC"></span><span class="t-label">Generated</span><span class="t-val t-gen"></span></div>
  `;
  wrap.appendChild(tooltip);

  function updateHover(clientX) {
    const rect = wrap.getBoundingClientRect();
    const mouseX = ((clientX - rect.left) / rect.width) * w;

    let nearest = 0;
    let nearestDist = Infinity;
    for (let i = 0; i < loginCoords.length; i++) {
      const dist = Math.abs(loginCoords[i].x - mouseX);
      if (dist < nearestDist) { nearestDist = dist; nearest = i; }
    }

    const pt = loginCoords[nearest];
    const pctX = (pt.x / w) * 100;
    const pctY = (pt.y / h) * 100;

    line.style.left = pctX + '%';
    dot.style.left = pctX + '%';
    dot.style.top = pctY + '%';

    tooltip.querySelector('.tooltip-date').textContent = chart.labels[nearest];
    tooltip.querySelector('.t-logins').textContent = chart.logins[nearest];
    tooltip.querySelector('.t-visits').textContent = chart.visits[nearest];
    tooltip.querySelector('.t-gen').textContent = chart.generated[nearest];

    const tooltipX = pctX > 75 ? pctX - 2 : pctX < 25 ? pctX + 2 : pctX;
    const atPeak = pctY < 30;
    tooltip.style.left = tooltipX + '%';
    tooltip.style.top = atPeak ? (pctY + 8) + '%' : Math.max(pctY - 8, 4) + '%';
    tooltip.style.transform = `translate(${pctX > 75 ? '-90%' : pctX < 25 ? '-10%' : '-50%'}, ${atPeak ? '0%' : '-100%'})`;
  }

  wrap.addEventListener('mousemove', (e) => updateHover(e.clientX));
  wrap.addEventListener('touchstart', (e) => { updateHover(e.touches[0].clientX); }, { passive: true });
  wrap.addEventListener('touchmove', (e) => { e.preventDefault(); updateHover(e.touches[0].clientX); }, { passive: false });
  wrap.addEventListener('touchend', () => { setTimeout(() => {
    line.style.opacity = '';
    dot.style.opacity = '';
    tooltip.style.opacity = '';
  }, 1500); });
}

function renderFunnel(funnel) {
  document.getElementById('funnel').innerHTML = funnel
    .map((step, i) => `
    <div class="funnel-row">
      <span class="funnel-label">${step.label}</span>
      <div class="funnel-bar-track">
        <div class="funnel-bar ${i === 0 ? 'bar-login' : 'bar-default'}" style="width: ${step.value}%; opacity: ${0.4 + step.value * 0.006}"></div>
      </div>
      <span class="funnel-pct">${step.value}%</span>
    </div>`).join('');
}

function renderCohorts(cohorts) {
  document.getElementById('cohorts').innerHTML = cohorts
    .map((c) => `
    <div class="cohort-card">
      <div class="cohort-name">${c.label}</div>
      <div class="cohort-rate">${c.rate}%</div>
      <div class="cohort-meta">
        <span>${c.accounts} accounts</span>
        <span>${c.ciwps} CIWPs</span>
      </div>
    </div>`).join('');
}

function renderHealth(health) {
  const el = document.getElementById('account-health');
  const groups = [
    { key: 'active',  label: 'Active',   dot: 'active',   items: health.active },
    { key: 'atRisk',  label: 'At Risk',  dot: 'at-risk',  items: health.atRisk },
    { key: 'dormant', label: 'Dormant',  dot: 'dormant',  items: health.dormant }
  ];

  el.innerHTML = groups.map(g => `
    <div class="health-group">
      <button class="health-group-header" data-accordion>
        <span class="health-dot ${g.dot}"></span>
        <span class="health-group-label">${g.label}</span>
        <span class="health-group-count">${g.items.length}</span>
        <span class="health-chevron"></span>
      </button>
      <div class="health-body">
        <div class="health-body-inner">
          <div class="health-accounts">
            ${g.items.map(name => `<span class="health-tag">${name}</span>`).join('')}
          </div>
        </div>
      </div>
    </div>`).join('');

  el.querySelectorAll('[data-accordion]').forEach(btn => {
    btn.addEventListener('click', () => {
      const group = btn.parentElement;
      const body = group.querySelector('.health-body');
      const inner = group.querySelector('.health-body-inner');
      const isOpen = group.classList.contains('expanded');

      if (isOpen) {
        body.style.height = body.scrollHeight + 'px';
        requestAnimationFrame(() => { body.style.height = '0'; });
        group.classList.remove('expanded');
      } else {
        body.style.height = inner.scrollHeight + 'px';
        group.classList.add('expanded');
        body.addEventListener('transitionend', () => {
          if (group.classList.contains('expanded')) body.style.height = 'auto';
        }, { once: true });
      }
    });
  });
}

function renderSignals(signals) {
  document.getElementById('signals').innerHTML = signals
    .map((s) => `
    <div class="signal-card">
      <div class="signal-value">${s.value}${s.unit ? (s.unit === '%' ? '' : ' ') + s.unit : ''}</div>
      <div class="signal-label">${s.label}</div>
    </div>`).join('');
}

function renderPerAccount(accounts) {
  const el = document.getElementById('per-account');
  if (!el || !accounts) return;

  const rows = accounts.map((a) => `
    <div class="per-account-row">
      <span class="per-account-name">${a.account}</span>
      <span class="per-account-tier">${a.tier}</span>
      <span class="per-account-count${a.ciwpsCreated > 0 ? ' has-ciwp' : ''}">${a.ciwpsCreated} plan${a.ciwpsCreated !== 1 ? 's' : ''}</span>
    </div>`).join('');

  el.innerHTML = `
    <div class="per-account-accordion">
      <button class="per-account-header">
        <span class="per-account-summary-label">All accounts</span>
        <span class="per-account-summary-count">${accounts.length}</span>
        <span class="health-chevron"></span>
      </button>
      <div class="per-account-body">
        <div class="per-account-body-inner">
          <div class="per-account-list">${rows}</div>
        </div>
      </div>
    </div>`;

  const btn = el.querySelector('.per-account-header');
  const accordion = el.querySelector('.per-account-accordion');
  const body = el.querySelector('.per-account-body');
  const inner = el.querySelector('.per-account-body-inner');

  btn.addEventListener('click', () => {
    const isOpen = accordion.classList.contains('expanded');
    if (isOpen) {
      body.style.height = body.scrollHeight + 'px';
      requestAnimationFrame(() => { body.style.height = '0'; });
      accordion.classList.remove('expanded');
    } else {
      body.style.height = inner.scrollHeight + 'px';
      accordion.classList.add('expanded');
      body.addEventListener('transitionend', () => {
        if (accordion.classList.contains('expanded')) body.style.height = 'auto';
      }, { once: true });
    }
  });
}

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}
