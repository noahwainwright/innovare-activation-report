let DATA = null;
let currentRange = '1D';
let currentView = 'adoption';
let currentTier = 'all';

// ── Boot ──────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
  const res = await fetch('./data.json', { cache: 'no-store' });
  DATA = await res.json();
  renderFreshness();
  renderView('adoption');
  bindTabs();
});

// ── Tabs ──────────────────────────────────────

function closeQuickLinks() {
  document.getElementById('quick-links-modal')?.classList.remove('open');
  document.getElementById('quick-links-backdrop')?.classList.remove('visible');
}

function bindTabs() {
  document.querySelectorAll('.toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      closeQuickLinks();
      if (btn.dataset.view === currentView) return;
      document.querySelector('.toggle-btn.active').classList.remove('active');
      btn.classList.add('active');
      currentView = btn.dataset.view;
      renderView(currentView);
    });
  });
  bindQuickLinks();
}

// ── Quick Links Modal ─────────────────────────

function bindQuickLinks() {
  const trigger = document.getElementById('quick-links-trigger');
  const modal = document.getElementById('quick-links-modal');
  const backdrop = document.getElementById('quick-links-backdrop');
  if (!trigger || !modal || !backdrop) return;

  function openModal() {
    modal.classList.add('open');
    backdrop.classList.add('visible');
  }

  function closeModal() {
    modal.classList.remove('open');
    backdrop.classList.remove('visible');
  }

  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    modal.classList.contains('open') ? closeModal() : openModal();
  });

  backdrop.addEventListener('click', closeModal);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('open')) closeModal();
  });
}

// ── View Router ───────────────────────────────

function renderView(view) {
  const content = document.getElementById('view-content');
  content.style.opacity = '0';
  content.style.filter = 'blur(6px)';
  content.style.transition = 'opacity 0.2s ease, filter 0.2s ease';

  setTimeout(() => {
    if (view === 'adoption') {
      content.innerHTML = buildAdoptionHTML();
      bindAdoption();
    } else if (view === 'action') {
      content.innerHTML = buildActionHTML();
      renderActionData();
    } else {
      content.innerHTML = buildQualityHTML();
      bindQuality();
    }
    renderFreshness();
    observeSections();
    requestAnimationFrame(() => {
      content.style.opacity = '1';
      content.style.filter = 'blur(0px)';
    });
  }, 200);
}

function renderFreshness() {
  const el = document.getElementById('freshness');
  if (!el || !DATA.date) return;
  const d = new Date(DATA.date + 'T00:00:00');
  const opts = { month: 'short', day: 'numeric' };
  const dateStr = d.toLocaleDateString('en-US', opts) + (DATA.time ? ', ' + DATA.time : '');
  const viewLabel = currentView === 'adoption' ? 'Activation' : currentView === 'action' ? 'Action Lists' : 'CIWP Testing';
  el.innerHTML = `<span class="breadcrumb-line"><span class="breadcrumb-prefix">CIWP Activation Dashboard</span> / ${viewLabel}</span><span class="breadcrumb-date">Updated ${dateStr}</span>`;
}

// ── IntersectionObserver ──────────────────────

function observeSections() {
  const sections = document.querySelectorAll('.section:not(.section-placeholder)');
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('visible');
        io.unobserve(e.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });
  sections.forEach(s => io.observe(s));
}

// ── Data Helpers ──────────────────────────────

function getFilteredAccounts() {
  if (currentTier === 'all') return DATA.perAccount;
  return DATA.perAccount.filter(a => a.tier === currentTier);
}

function computeStages(accounts) {
  const stages = [0, 0, 0, 0];
  accounts.forEach(a => { stages[a.activationStage || 0]++; });
  return stages;
}

function computeRescue(accounts) {
  return accounts
    .filter(a => a.healthStatus === 'dormant' || a.healthStatus === 'at-risk')
    .sort((a, b) => {
      const order = { dormant: 0, 'at-risk': 1, active: 2 };
      return (order[a.healthStatus] || 2) - (order[b.healthStatus] || 2);
    });
}


// ── North Star KPI Cards ──────────────────────

function renderKpiCards() {
  const kpis = DATA.northStarKpis;
  if (!kpis) return '';

  function kpiCard(kpi) {
    if (kpi.blocked) {
      return `
        <div class="kpi-card kpi-blocked">
          <div class="kpi-label">${kpi.label}</div>
          <div class="kpi-value">--</div>
          <div class="kpi-sub">${kpi.sub}</div>
          <div class="kpi-pending-badge">Pending instrumentation</div>
        </div>`;
    }
    return `
      <div class="kpi-card">
        <div class="kpi-label">${kpi.label}</div>
        <div class="kpi-value">${kpi.value}<span class="kpi-unit">${kpi.unit}</span></div>
        <div class="kpi-sub">${kpi.sub}</div>
        ${kpi.caveat ? `<div class="kpi-note">${kpi.caveat}</div>` : ''}
      </div>`;
  }

  return `
    <div class="kpi-hero-section">
      ${kpiCard(kpis.adoptionRate)}
      ${kpiCard(kpis.conversionRate)}
      ${kpiCard(kpis.timeToValue)}
    </div>`;
}

// ── Adoption View ─────────────────────────────

function buildAdoptionHTML() {
  return `
    <div class="tier-filter" id="tier-filter">
      <button class="tier-btn active" data-tier="all">All</button>
      <button class="tier-btn" data-tier="Free">Free</button>
      <button class="tier-btn" data-tier="Paid">Paid</button>
    </div>

    <div class="section" id="kpi-section">
      ${renderKpiCards()}
      <div id="kpi-tier-badge" class="kpi-tier-badge" style="display:none">KPIs not filtered by tier</div>
    </div>

    <div class="section" id="chart-section">
      <div class="sparkline-wrap">
        <svg id="sparkline" viewBox="0 0 960 480" preserveAspectRatio="none"></svg>
        <div class="chart-time-overlay">
          <div class="time-selector">
            <button class="time-btn active" data-range="1D">1D</button>
            <button class="time-btn" data-range="1W">1W</button>
            <button class="time-btn" data-range="1M">1M</button>
          </div>
        </div>
        <div class="metric-overlay">
          <div class="metric-row">
            <span class="metric-value" id="metric-value">--</span>
            <span class="metric-delta">
              <span class="arrow" id="delta-arrow"></span>
              <span id="delta-value"></span>
            </span>
          </div>
          <div class="metric-sub" id="metric-sub"></div>
        </div>
      </div>
    </div>

    <div class="section" id="rescue-section">
      <div id="rescue-list"></div>
    </div>

    <div class="section" id="funnel-section">
      <div class="section-label-row">
        <span class="section-label">Activation Pipeline</span>
        <a class="mixpanel-link" id="link-funnel" href="${DATA.mixpanelLinks?.funnel || '#'}" target="_blank" rel="noopener">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M4.5 1.5H2.25C1.836 1.5 1.5 1.836 1.5 2.25v7.5c0 .414.336.75.75.75h7.5c.414 0 .75-.336.75-.75V7.5M7.5 1.5h3m0 0v3m0-3L5.25 6.75" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
          Mixpanel
        </a>
      </div>
      <div id="activation-pipeline"></div>
    </div>

    <div style="height: 100px; flex-shrink: 0;"></div>
`;
}

function bindAdoption() {
  bindTierFilter();
  bindTimeSelector();
  renderAdoptionData();
}

function renderAdoptionData() {
  const accounts = getFilteredAccounts();
  renderRescueList(accounts);
  renderActivationPipeline(accounts);
  renderChartSection();
  const badge = document.getElementById('kpi-tier-badge');
  if (badge) badge.style.display = currentTier !== 'all' ? 'block' : 'none';
}

function renderSentryHealthCard() {
  const el = document.getElementById('sentry-health-section');
  if (!el) return;

  const issues = DATA.sentry?.issues || [];
  const sevOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  const openUnlinked = issues.filter(i => !i.resolved && !i.linkedTicket);
  const openTotal = issues.filter(i => !i.resolved).length;

  let dotClass = 'muted';
  if (openUnlinked.length > 0) {
    const worst = [...openUnlinked].sort((a, b) => (sevOrder[a.severity] ?? 4) - (sevOrder[b.severity] ?? 4))[0];
    dotClass = worst.severity === 'critical' ? 'critical' : worst.severity === 'high' ? 'high' : 'muted';
  }

  const subText = openTotal === 0
    ? 'All clear'
    : `${openTotal} open · ${openUnlinked.length} unlinked`;

  el.innerHTML = `
    <button class="sentry-pill" id="sentry-health-trigger">
      <span class="sentry-sev-dot ${dotClass}"></span>
      <div class="sentry-pill-text">
        <span class="sentry-pill-label">Sentry Monitoring</span>
        <span class="sentry-pill-sub">${subText}</span>
      </div>
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style="flex-shrink:0;color:var(--text-muted)">
        <path d="M4.5 1.5H2.25C1.836 1.5 1.5 1.836 1.5 2.25v7.5c0 .414.336.75.75.75h7.5c.414 0 .75-.336.75-.75V7.5M7.5 1.5h3m0 0v3m0-3L5.25 6.75" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </button>`;

  document.getElementById('sentry-health-trigger')?.addEventListener('click', () => {
    document.querySelector('.toggle-btn[data-view="quality"]')?.click();
  });
}

function renderCenturyCard() {
  const el = document.getElementById('century-card-container');
  if (!el) return;
  const c = DATA.centuryIntegration;
  if (!c) return;

  const fieldChips = (c.fields || []).map(f =>
    `<span class="century-field-chip">${f}</span>`
  ).join('');

  el.innerHTML = `
    <div class="century-card">
      <div class="century-pill-row">
        <div class="century-pill-text">
          <span class="century-pill-label">Century Learning Data</span>
          <span class="century-pill-sub">Pending integration</span>
        </div>
        <span class="kpi-pending-badge">Pending</span>
      </div>
      <div class="century-blocked-body">
        <p class="century-blocked-reason">${c.blockedReason}</p>
        ${fieldChips ? `<div class="century-fields-row">${fieldChips}</div>` : ''}
      </div>
    </div>`;
}

// ── Tier Filter ───────────────────────────────

function bindTierFilter() {
  const filter = document.getElementById('tier-filter');
  if (!filter) return;
  filter.querySelectorAll('.tier-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.dataset.tier === currentTier) return;
      filter.querySelector('.tier-btn.active').classList.remove('active');
      btn.classList.add('active');
      currentTier = btn.dataset.tier;
      renderAdoptionData();
    });
  });
}

// ── Time Selector ─────────────────────────────

let isTransitioning = false;

function bindTimeSelector() {
  document.querySelectorAll('.time-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const range = btn.dataset.range;
      if (range === currentRange || isTransitioning) return;
      isTransitioning = true;

      document.querySelector('.time-btn.active').classList.remove('active');
      btn.classList.add('active');
      currentRange = range;

      const wrap = document.querySelector('.sparkline-wrap');
      wrap.classList.add('transitioning');

      setTimeout(() => {
        document.querySelectorAll('.hover-line, .hover-dot, .sparkline-tooltip').forEach(el => el.remove());
        renderChartSection(true);
        setTimeout(() => {
          wrap.classList.remove('transitioning');
          isTransitioning = false;
        }, 80);
      }, 450);
    });
  });
}

// ── Rescue List ───────────────────────────────

function renderRescueList(accounts) {
  const el = document.getElementById('rescue-list');
  if (!el) return;

  const rescue = computeRescue(accounts);
  const paid = rescue.filter(a => a.tier === 'Paid').length;
  const free = rescue.filter(a => a.tier === 'Free').length;

  const breakdown = [
    paid > 0 ? `${paid} Paid` : '',
    free > 0 ? `${free} Free` : '',
  ].filter(Boolean).join(' · ');

  // Dot color: red if any dormant, amber if at-risk only
  const hasDormant = rescue.some(a => a.healthStatus === 'dormant');
  const dotClass = hasDormant ? 'dormant' : 'at-risk';

  el.innerHTML = `
    <div class="rescue-card" id="rescue-card">
      <button class="rescue-pill" id="rescue-trigger">
        <span class="rescue-pill-count">${rescue.length}</span>
        <div class="rescue-pill-text">
          <span class="rescue-pill-label">Needs Outreach</span>
          <span class="rescue-pill-sub">${breakdown}</span>
        </div>
        <svg class="rescue-chevron" width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M6 4l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
      <div class="rescue-body" id="rescue-body">
        <div class="rescue-body-inner" id="rescue-body-inner">
          ${rescue.map(a => rescueRow(a)).join('')}
        </div>
      </div>
    </div>`;

  const card = document.getElementById('rescue-card');
  const trigger = document.getElementById('rescue-trigger');
  const body = document.getElementById('rescue-body');
  const inner = document.getElementById('rescue-body-inner');

  trigger.addEventListener('click', () => {
    const isOpen = body.classList.contains('expanded');
    if (isOpen) {
      const currentHeight = body.getBoundingClientRect().height;
      body.style.height = currentHeight + 'px';
      requestAnimationFrame(() => { body.style.height = '0'; });
      body.classList.remove('expanded');
      card.classList.remove('expanded');
    } else {
      const innerMaxHeight = 280;
      const innerPadding = 24; // 16px top + 8px bottom from .rescue-body-inner
      const targetHeight = Math.min(inner.scrollHeight, innerMaxHeight) + innerPadding;
      body.style.height = targetHeight + 'px';
      body.classList.add('expanded');
      card.classList.add('expanded');
    }
  });
}

function rescueRow(a) {
  const days = a.daysSinceEnabled != null ? a.daysSinceEnabled + 'd' : '--';
  return `
    <div class="rescue-row" data-health="${a.healthStatus}" data-days="${a.daysSinceEnabled || 0}">
      <span class="health-dot ${a.healthStatus}"></span>
      <span class="rescue-name">${a.account}</span>
      <span class="rescue-days">${days}</span>
      <span class="tier-pill">${a.tier}</span>
    </div>`;
}

// ── Activation Pipeline (unified stage + funnel) ─────────

function renderActivationPipeline(accounts) {
  const el = document.getElementById('activation-pipeline');
  if (!el) return;

  const d = DATA.ranges[currentRange];
  const funnel = d?.funnel || [];
  const total = accounts.length || 1;
  const stages = computeStages(accounts);
  const stageLabels = ['Not Started', 'Onboarding', 'Adopted', 'Activated'];

  // Build pipeline steps: pair funnel events with stage counts
  const steps = funnel.map((f, i) => {
    const stageCount = stages[i] !== undefined ? stages[i] : null;
    const dropOff = i > 0 ? Math.round(((funnel[i - 1].value - f.value) / (funnel[i - 1].value || 1)) * 100) : null;
    return { label: f.label, pct: f.value, stageCount, stageLabel: stageLabels[i], dropOff };
  });

  const convertedCount = stages[3] || 0;
  const convertedPct = total > 0 ? Math.round((convertedCount / total) * 100) : 0;

  el.innerHTML = steps.map((step, i) => `
    <div class="pipeline-step">
      ${step.dropOff !== null ? `
        <div class="pipeline-connector">
          <span class="pipeline-dropoff">${step.dropOff}% drop-off</span>
        </div>` : ''}
      <div class="pipeline-row">
        <div class="pipeline-left">
          <span class="pipeline-event">${step.label}</span>
          ${step.stageLabel ? `<span class="pipeline-stage-label">${step.stageLabel}</span>` : ''}
        </div>
        <div class="pipeline-right">
          <span class="pipeline-pct">${step.pct}%</span>
          ${step.stageCount !== null ? `<span class="pipeline-count">${step.stageCount} accounts</span>` : ''}
        </div>
        <div class="pipeline-bar-track">
          <div class="pipeline-bar ${i === 0 ? 'bar-login' : 'bar-default'}" style="width: ${step.pct}%"></div>
        </div>
      </div>
    </div>`).join('') + (convertedCount > 0 ? `
    <div class="pipeline-step">
      <div class="pipeline-connector">
        <span class="pipeline-dropoff"></span>
      </div>
      <div class="pipeline-row">
        <div class="pipeline-left">
          <span class="pipeline-event">CIWP Published</span>
          <span class="pipeline-stage-label">Activated</span>
        </div>
        <div class="pipeline-right">
          <span class="pipeline-pct pipeline-pct-converted">${convertedPct}%</span>
          <span class="pipeline-count">${convertedCount} account${convertedCount !== 1 ? 's' : ''}</span>
        </div>
        <div class="pipeline-bar-track">
          <div class="pipeline-bar bar-converted" style="width: ${convertedPct}%"></div>
        </div>
      </div>
    </div>` : '');
}

// ── Chart + Metric ────────────────────────────

function renderChartSection(skipAnimation) {
  const d = DATA.ranges[currentRange];
  if (!d) return;

  document.getElementById('metric-value').textContent = d.primary.value + d.primary.unit;

  const arrow = document.getElementById('delta-arrow');
  const delta = document.getElementById('delta-value');
  arrow.textContent = d.primary.direction === 'up' ? '\u2191' : '\u2193';
  arrow.className = 'arrow ' + d.primary.direction;

  const vsLabel = currentRange === '1D' ? 'vs yesterday' : currentRange === '1W' ? 'vs last week' : 'vs last month';
  delta.textContent = d.primary.delta + '% ' + vsLabel;
  document.getElementById('metric-sub').textContent = d.accounts.total + ' ' + d.accounts.label;

  renderChart(d.chart, skipAnimation);
}

function renderChart(chart, skipAnimation) {
  const svg = document.getElementById('sparkline');
  const wrap = document.querySelector('.sparkline-wrap');
  if (!svg || !wrap) return;

  const w = 960, h = 480, padX = 8, padTop = 40, padBottom = 70;

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
      const prev = coords[i - 1], curr = coords[i];
      const cpx = (prev.x + curr.x) / 2;
      d += ` C ${cpx} ${prev.y}, ${cpx} ${curr.y}, ${curr.x} ${curr.y}`;
    }
    return d;
  }

  function buildArea(pathD, coords) {
    const base = h - padBottom;
    return pathD + ` L ${coords[coords.length - 1].x} ${base} L ${coords[0].x} ${base} Z`;
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
    <line x1="${padX}" y1="${h - padBottom}" x2="${w - padX}" y2="${h - padBottom}" stroke="rgba(0,0,0,0.07)" stroke-width="1"/>
    <path d="${buildArea(visitPath, visitCoords)}" fill="url(#fill-visits)" class="chart-area"/>
    <path d="${visitPath}" fill="none" stroke="#00A6FF" stroke-width="2" stroke-linecap="round" class="chart-line"/>
    <path d="${buildArea(loginPath, loginCoords)}" fill="url(#fill-logins)" class="chart-area"/>
    <path d="${loginPath}" fill="none" stroke="#666666" stroke-width="3" stroke-linecap="round" class="chart-line"/>
    <path d="${buildArea(genPath, genCoords)}" fill="url(#fill-generated)" class="chart-area"/>
    <path d="${genPath}" fill="none" stroke="#AC5CCC" stroke-width="2.5" stroke-linecap="round" stroke-dasharray="6 4" class="chart-line"/>`;

  if (skipAnimation) {
    svg.querySelectorAll('.chart-line, .chart-area').forEach(el => { el.style.opacity = '1'; });
  } else {
    svg.querySelectorAll('.chart-line, .chart-area').forEach((el, i) => {
      el.style.opacity = '0';
      el.style.transition = 'none';
      requestAnimationFrame(() => requestAnimationFrame(() => {
        el.style.transition = `opacity 0.5s ease ${50 + i * 60}ms`;
        el.style.opacity = '1';
      }));
    });
  }

  // Hover
  wrap.querySelectorAll('.hover-line, .hover-dot, .sparkline-tooltip').forEach(el => el.remove());

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
    <div class="tooltip-row"><span class="t-dot" style="background:#AC5CCC"></span><span class="t-label">Generated</span><span class="t-val t-gen"></span></div>`;
  wrap.appendChild(tooltip);

  function updateHover(clientX) {
    const rect = wrap.getBoundingClientRect();
    const mouseX = ((clientX - rect.left) / rect.width) * w;
    let nearest = 0, nearestDist = Infinity;
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

  wrap.addEventListener('mousemove', e => updateHover(e.clientX));
  wrap.addEventListener('touchstart', e => updateHover(e.touches[0].clientX), { passive: true });
  wrap.addEventListener('touchmove', e => { e.preventDefault(); updateHover(e.touches[0].clientX); }, { passive: false });
}



// ── Quality View ──────────────────────────────

function buildQualityHTML() {
  return `
    <div class="section" id="summary-section">
      <div class="testing-summary-wrap">
        <div class="testing-summary-sentence" id="testing-summary"></div>
      </div>
    </div>

    <div class="section" id="bug-velocity-section"></div>

    <div class="section" id="tickets-section">
      <div id="ticket-categories"></div>
    </div>

    <div class="section" id="sentry-section"></div>
    <div class="section" id="cs-closed-loop-section"></div>
    <div style="height: 100px; flex-shrink: 0;"></div>`;
}

function bindQuality() {
  renderSummary();
  renderTickets();
  renderSentryCard();
  renderBugVelocityChart();
  renderCSClosedLoopCard();
}

function getAllTickets() {
  const cats = DATA.ciwpTesting?.categories || [];
  return cats.flatMap(c => c.tickets || []);
}

// ── Summary Sentence (with scorecard data merged) ──

function renderSummary() {
  const el = document.getElementById('testing-summary');
  if (!el) return;

  const allTickets = getAllTickets();
  const bugs = allTickets.filter(t => t.type === 'Bug');
  const stories = allTickets.filter(t => t.type !== 'Bug');
  const override = DATA.ciwpTesting?.openCountOverride;
  const bugCount = override?.bugs ?? bugs.length;
  const storyCount = override?.stories ?? stories.length;
  const p0p1 = bugs.filter(t => t.priority === 'P0' || t.priority === 'P1').length;
  const avgDays = bugs.length > 0 ? Math.round(bugs.reduce((s, t) => s + (t.daysOpen || 0), 0) / bugs.length) : 0;
  const workarounds = allTickets.filter(t => t.workaround).length;

  // Natural sentence with scorecard data
  let sentence = `We have <span class="summary-count status-review">${bugCount}</span> bug${bugCount !== 1 ? 's' : ''}`;
  sentence += ` and <span class="summary-count status-dev">${storyCount}</span> stor${storyCount !== 1 ? 'ies' : 'y'} open`;
  sentence += ` with an average resolution time of <span class="summary-count">${avgDays} days</span>`;
  if (p0p1 > 0) sentence += ` and <span class="summary-count alert-inline">${p0p1}</span> critical`;
  if (workarounds > 0) sentence += `. <span class="summary-count status-complete">${workarounds}</span> workaround${workarounds !== 1 ? 's' : ''} available`;
  sentence += '.';

  el.innerHTML = `<span class="summary-clause"><span class="howdy-trigger">Howdy.</span> ${sentence}</span>`;
}

// ── Tickets ───────────────────────────────────

function renderTickets() {
  const el = document.getElementById('ticket-categories');
  if (!el) return;

  const cats = DATA.ciwpTesting?.categories || [];
  const jiraBase = DATA.ciwpTesting?.jiraBase || '';

  // Sort categories: bugs first, stories second, additional last
  const typeOrder = { bugs: 0, stories: 1, additional: 2 };
  const sorted = [...cats].sort((a, b) => (typeOrder[a.key] ?? 3) - (typeOrder[b.key] ?? 3));

  // Sort tickets within each category: active first (by priority), done last
  const prioOrder = { P0: 0, P1: 1, P2: 2, P3: 3 };
  sorted.forEach(cat => {
    cat.tickets = [...cat.tickets].sort((a, b) => {
      const aDone = a.status === 'done' ? 1 : 0;
      const bDone = b.status === 'done' ? 1 : 0;
      if (aDone !== bDone) return aDone - bDone;
      return (prioOrder[a.priority] ?? 4) - (prioOrder[b.priority] ?? 4);
    });
  });

  el.innerHTML = sorted.map(cat => `
    <div class="ticket-category">
      <div class="ticket-category-header">
        <span class="ticket-category-label">${cat.label}</span>
        <span class="ticket-category-count">${cat.tickets.length}</span>
      </div>
      ${cat.tickets.map(t => ticketRow(t, jiraBase)).join('')}
    </div>`).join('');

  // Tap to expand
  el.querySelectorAll('.ticket-row').forEach(row => {
    row.addEventListener('click', (e) => {
      if (e.target.closest('a')) return;
      const detail = row.querySelector('.ticket-detail');
      const inner = row.querySelector('.ticket-detail-inner');
      if (!detail) return;

      const isOpen = row.classList.contains('expanded');
      if (isOpen) {
        detail.style.height = detail.scrollHeight + 'px';
        requestAnimationFrame(() => { detail.style.height = '0'; });
        row.classList.remove('expanded');
      } else {
        detail.style.height = inner.scrollHeight + 'px';
        row.classList.add('expanded');
        detail.addEventListener('transitionend', () => {
          if (row.classList.contains('expanded')) detail.style.height = 'auto';
        }, { once: true });
      }
    });
  });
}

function stripCiwpPrefix(title) {
  return title.replace(/^\[CIWP\]\s*/i, '').replace(/^\*?\[CIWP\]\s*/i, '');
}

// ── Sentry Card (Account > Issues > Bug hierarchy) ────────

function renderSentryCard() {
  const el = document.getElementById('sentry-section');
  if (!el) return;

  const issues = DATA.sentry?.issues || [];
  const accountErrors = DATA.sentry?.accountErrors || [];
  const sevOrder = { critical: 0, high: 1, medium: 2, low: 3 };

  const issueMap = {};
  issues.forEach(i => { issueMap[i.id] = i; });

  const openUnlinked = issues.filter(i => !i.resolved && !i.linkedTicket);
  const openLinked = issues.filter(i => !i.resolved && i.linkedTicket);
  let dotClass = 'muted';
  if (openUnlinked.length > 0) {
    const worst = [...openUnlinked].sort((a, b) => (sevOrder[a.severity] ?? 4) - (sevOrder[b.severity] ?? 4))[0];
    dotClass = worst.severity === 'critical' ? 'critical' : worst.severity === 'high' ? 'high' : 'muted';
  }

  let subText = 'All clear';
  if (openUnlinked.length > 0) {
    const parts = [`${openUnlinked.length} unlinked`];
    if (openLinked.length > 0) parts.push(`${openLinked.length} linked`);
    subText = parts.join(' · ');
  } else if (openLinked.length > 0) {
    subText = `${openLinked.length} open, all linked`;
  }

  const attributedIds = new Set(accountErrors.flatMap(ae => ae.issueIds));
  const unattributed = issues.filter(i => !attributedIds.has(i.id) && !i.resolved)
    .sort((a, b) => (sevOrder[a.severity] ?? 4) - (sevOrder[b.severity] ?? 4));
  const resolved = issues.filter(i => i.resolved);

  function accountBlock(ae) {
    const acctIssues = ae.issueIds.map(id => issueMap[id]).filter(Boolean)
      .sort((a, b) => (sevOrder[a.severity] ?? 4) - (sevOrder[b.severity] ?? 4));
    const worstOpen = acctIssues.find(i => !i.resolved);
    const worstDot = worstOpen?.severity || 'muted';
    const openCount = acctIssues.filter(i => !i.resolved).length;
    return `
      <div class="sentry-account-block">
        <div class="sentry-account-row">
          <span class="sentry-sev-dot ${worstDot}"></span>
          <span class="sentry-account-name">${ae.account}</span>
          <span class="tier-pill">${ae.tier}</span>
        </div>
        ${acctIssues.filter(i => !i.resolved).map(sentryIssueRow).join('')}
      </div>`;
  }

  el.innerHTML = `
    <div class="sentry-card" id="sentry-card">
      <button class="sentry-pill" id="sentry-trigger">
        <span class="sentry-sev-dot ${dotClass}"></span>
        <div class="sentry-pill-text">
          <span class="sentry-pill-label">Sentry Monitoring</span>
          <span class="sentry-pill-sub">${subText}</span>
        </div>
        <svg class="sentry-chevron" width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M6 4l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
      <div class="sentry-body" id="sentry-body">
        <div class="sentry-body-inner" id="sentry-body-inner">

          ${accountErrors.map(accountBlock).join('')}

          ${unattributed.length > 0 ? `
          <div class="sentry-account-block sentry-unattributed-block">
            <div class="sentry-account-row">
              <span class="sentry-sev-dot muted"></span>
              <span class="sentry-account-name sentry-pending-name">Account attribution pending</span>
              <span class="sentry-pending-note">Sentry account IDs not yet tagged</span>
            </div>
            ${unattributed.map(sentryIssueRow).join('')}
          </div>` : ''}

          ${resolved.map(i => sentryIssueRow(i)).join('')}

          ${(() => {
            const sir = DATA.sentryIgnoredRate;
            if (!sir) return '';
            const isLive = sir.status === 'live';
            if (!isLive) return '';
            const ignoredIssues = sir.ignoredIssues || [];
            if (ignoredIssues.length === 0) return '';
            return `<div class="sentry-account-block" style="margin-top:8px;border-top:1px solid var(--card-border);padding-top:8px;">
              <div class="sentry-account-row">
                <span class="sentry-sev-dot high"></span>
                <span class="sentry-account-name sentry-pending-name">Ignored (${sir.ignored} · ${sir.ignoredPct}% of open)</span>
              </div>
              ${ignoredIssues.map(issue => `
                <div class="sentry-issue-row sentry-issue-sub">
                  <div class="sentry-issue-body">
                    <div class="sentry-issue-row-top">
                      <span class="sentry-issue-title"><span class="sentry-title-text">${issue.id}</span></span>
                      <span class="sentry-queue">${issue.daysFiring}d</span>
                      <span class="sentry-unlinked-badge">${issue.occurrences} occ.</span>
                    </div>
                  </div>
                </div>`).join('')}
            </div>`;
          })()}

        </div>
      </div>
    </div>`;

  const card = document.getElementById('sentry-card');
  const trigger = document.getElementById('sentry-trigger');
  const body = document.getElementById('sentry-body');
  const inner = document.getElementById('sentry-body-inner');

  trigger.addEventListener('click', () => {
    const isOpen = body.classList.contains('expanded');
    if (isOpen) {
      const currentHeight = body.getBoundingClientRect().height;
      body.style.height = currentHeight + 'px';
      requestAnimationFrame(() => { body.style.height = '0'; });
      body.classList.remove('expanded');
      card.classList.remove('expanded');
    } else {
      const targetHeight = Math.min(inner.scrollHeight, 280) + 24;
      body.style.height = targetHeight + 'px';
      body.classList.add('expanded');
      card.classList.add('expanded');
      body.addEventListener('transitionend', () => {
        if (!body.classList.contains('expanded')) return;
        el.querySelectorAll('.sentry-issue-title').forEach(titleEl => {
          const textEl = titleEl.querySelector('.sentry-title-text');
          if (!textEl) return;
          const overflow = textEl.scrollWidth - titleEl.clientWidth;
          if (overflow > 0) {
            titleEl.style.setProperty('--scroll-distance', `-${overflow}px`);
            titleEl.classList.add('can-scroll');
          }
        });
      }, { once: true });
    }
  });
}

function sentryIssueRow(issue) {
  const jiraBase = DATA.ciwpTesting?.jiraBase || '';
  const linkedHTML = issue.linkedTicket
    ? `<a class="sentry-ticket-link" href="${jiraBase}${issue.linkedTicket}" target="_blank" rel="noopener">${issue.linkedTicket}</a>`
    : `<span class="sentry-unlinked-badge">Unlinked</span>`;

  const queueStr = issue.resolved ? 'Resolved' : `${issue.daysInQueue}d`;
  const resolvedClass = issue.resolved ? ' sentry-row-resolved' : '';

  const errorTypeLabels = {
    'INSUFFICIENT_CONTEXT': 'Insufficient Context',
    'PII_VIOLATION': 'PII Violation',
    'TIMEOUT': 'Timeout',
    'NETWORK': 'Network',
    '403_FORBIDDEN': '403 Forbidden',
    'DB_ERROR': 'DB Error',
    'AI_FAIL': 'AI Failure',
    'AI_PARSE': 'AI Parse',
    'RATE_LIMIT': 'Rate Limit'
  };
  const etKey = issue.errorType || '';
  const etClass = etKey.toLowerCase().replace(/_/g, '-');
  const errorTypeBadge = etKey
    ? `<span class="sentry-error-type-badge sentry-et-${etClass}">${errorTypeLabels[etKey] || etKey}</span>`
    : '';

  const meta = [];
  if (issue.occurrences) meta.push(`${issue.occurrences} occurrences`);
  if (issue.affectedAccounts != null) meta.push(`${issue.affectedAccounts} account${issue.affectedAccounts !== 1 ? 's' : ''} affected`);
  else if (!issue.resolved) meta.push('accounts unknown');

  return `
    <div class="sentry-issue-row sentry-issue-sub${resolvedClass}">
      <div class="sentry-issue-body">
        <div class="sentry-issue-row-top">
          <span class="sentry-issue-title"><span class="sentry-title-text">${issue.title}</span></span>
          ${errorTypeBadge}
          ${linkedHTML}
          <span class="sentry-queue">${queueStr}</span>
        </div>
        ${meta.length > 0 ? `<div class="sentry-issue-meta">${meta.join(' · ')}</div>` : ''}
      </div>
    </div>`;
}

function ticketRow(t, jiraBase) {
  const isLinked = jiraBase && t.id !== '--';
  const idHTML = isLinked
    ? `<a class="ticket-id" href="${jiraBase}${t.id}" target="_blank" rel="noopener">${t.id}</a>`
    : `<span class="ticket-id">${t.id}</span>`;

  const priorityClass = (t.priority || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const title = stripCiwpPrefix(t.title);
  const daysStr = t.daysOpen != null ? t.daysOpen + 'd' : '';

  const impacted = (t.accountsImpacted || []);
  const hasDetail = impacted.length > 0 || t.workaround != null || t.dueDate;

  // Build expand content
  let detailParts = [];
  if (t.workaround != null) {
    detailParts.push(t.workaround
      ? '<span class="workaround-badge yes">Workaround available</span>'
      : '<span class="workaround-badge no">No workaround</span>');
  }
  if (t.dueDate) detailParts.push(`<span class="ticket-meta">Due ${t.dueDate}</span>`);
  if (t.processStage) detailParts.push(`<span class="process-pill">${t.processStage}</span>`);
  if (t.sprint) detailParts.push(`<span class="ticket-meta">${t.sprint}</span>`);
  if (impacted.length > 0) {
    detailParts.push(impacted.map(a => `<span class="ticket-account-pill">${a}</span>`).join(''));
  }

  return `
    <div class="ticket-row${hasDetail ? '' : ' no-expand'}">
      <div class="ticket-line1">
        <span class="priority-label ${priorityClass}">${t.priority || ''}</span>
        ${idHTML}
        <span class="ticket-title">${title}</span>
        <span class="ticket-days">${daysStr}</span>
      </div>
      ${hasDetail ? `
        <div class="ticket-detail">
          <div class="ticket-detail-inner">${detailParts.join('')}</div>
        </div>` : ''}
    </div>`;
}

// ── Bug Velocity Chart ────────────────────────

function renderBugVelocityChart() {
  const el = document.getElementById('bug-velocity-section');
  if (!el) return;

  const bv = DATA.bugVelocity;
  if (!bv) return;

  const labels = bv?.labels || [];
  const opened = bv?.opened || [];
  const closed = bv?.closed || [];

  // Auto-scale from max value across both series
  const allVals = [...opened, ...closed];
  const maxVal = Math.max(...allVals, 1);

  const w = 960, h = 340, padX = 40, padTop = 20, padBottom = 60;
  const chartW = w - padX * 2;
  const chartH = h - padTop - padBottom;
  const n = labels.length;

  function toX(i) {
    return padX + (n > 1 ? (i / (n - 1)) * chartW : chartW / 2);
  }

  function toY(val) {
    return padTop + (1 - val / maxVal) * chartH;
  }

  function buildPolyline(points) {
    return points.map((val, i) => `${toX(i)},${toY(val)}`).join(' ');
  }

  const openedPoints = buildPolyline(opened);
  const closedPoints = buildPolyline(closed);

  // Y-axis gridlines: 0, half, max
  const yGridVals = [0, Math.round(maxVal / 2), maxVal];
  const yGridLines = yGridVals.map(v => {
    const y = toY(v);
    return `
      <line x1="${padX}" y1="${y}" x2="${w - padX}" y2="${y}" stroke="rgba(0,0,0,0.05)" stroke-width="1"/>
      <text x="${padX - 6}" y="${y + 4}" font-size="18" fill="rgba(0,0,0,0.35)" text-anchor="end" font-family="Inter,system-ui,sans-serif">${v}</text>`;
  }).join('');

  // X-axis labels
  const xLabels = labels.map((label, i) => {
    const x = toX(i);
    return `<text x="${x}" y="${h - padBottom + 22}" font-size="18" fill="rgba(0,0,0,0.4)" text-anchor="middle" font-family="Inter,system-ui,sans-serif">${label}</text>`;
  }).join('');

  // Dots on opened line
  const openedDots = opened.map((val, i) =>
    `<circle cx="${toX(i)}" cy="${toY(val)}" r="5" fill="#666666"/>`
  ).join('');

  // Dots on closed line
  const closedDots = closed.map((val, i) =>
    `<circle cx="${toX(i)}" cy="${toY(val)}" r="5" fill="#AC5CCC"/>`
  ).join('');

  // MTTR badge text
  let mttrText;
  const mttrStatus = bv?.mttrStatus;
  if (mttrStatus === 'live' && bv?.mttrDays != null) {
    mttrText = `MTTR: ${bv.mttrDays.toFixed(1)} days`;
  } else if (mttrStatus === 'insufficient_data') {
    mttrText = 'MTTR: insufficient data (\u003c3 closed tickets)';
  } else {
    mttrText = 'MTTR: unavailable';
  }

  const openedCaveat = bv?.openedStatus === 'derived_from_daysOpen'
    ? `<div class="kpi-note" style="margin-top:8px">Opened counts approximate \u2014 derived from days open field</div>`
    : '';

  // Legend
  const legend = `
    <div class="velocity-legend">
      <span class="velocity-legend-item">
        <svg width="20" height="10" viewBox="0 0 20 10"><line x1="0" y1="5" x2="20" y2="5" stroke="#666666" stroke-width="2"/></svg>
        Opened
      </span>
      <span class="velocity-legend-item">
        <svg width="20" height="10" viewBox="0 0 20 10"><line x1="0" y1="5" x2="20" y2="5" stroke="#AC5CCC" stroke-width="2" stroke-dasharray="4 3"/></svg>
        Closed
      </span>
    </div>`;

  el.innerHTML = `
    <div class="section-label">Bug Velocity \u2014 CIWP Launch</div>
    ${legend}
    <div class="velocity-chart-wrap" id="velocity-wrap">
      <svg id="velocity-svg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" style="width:100%;display:block;">
        ${yGridLines}
        <line x1="${padX}" y1="${h - padBottom}" x2="${w - padX}" y2="${h - padBottom}" stroke="rgba(0,0,0,0.08)" stroke-width="1"/>
        ${xLabels}
        <polyline points="${closedPoints}" fill="none" stroke="#AC5CCC" stroke-width="2.5" stroke-dasharray="4 3" stroke-linecap="round" stroke-linejoin="round"/>
        ${closedDots}
        <polyline points="${openedPoints}" fill="none" stroke="#666666" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
        ${openedDots}
        <line id="vel-hover-line" x1="0" y1="${padTop}" x2="0" y2="${h - padBottom}" stroke="rgba(0,0,0,0.15)" stroke-width="1" opacity="0" stroke-dasharray="3 2"/>
        <circle id="vel-dot-opened" cx="0" cy="0" r="6" fill="#666666" stroke="#fff" stroke-width="2" opacity="0"/>
        <circle id="vel-dot-closed" cx="0" cy="0" r="6" fill="#AC5CCC" stroke="#fff" stroke-width="2" opacity="0"/>
      </svg>
      <div class="sparkline-tooltip" id="velocity-tooltip" style="top:12px">
        <div class="tooltip-date" id="vel-tooltip-date"></div>
        <div class="tooltip-row">
          <span class="t-dot" style="background:#666666"></span>
          <span class="t-label">Opened</span>
          <span class="t-val" id="vel-tooltip-opened"></span>
        </div>
        <div class="tooltip-row">
          <span class="t-dot" style="background:#AC5CCC"></span>
          <span class="t-label">Closed</span>
          <span class="t-val" id="vel-tooltip-closed"></span>
        </div>
      </div>
    </div>
    <div class="mttr-badge">${mttrText}</div>
    ${openedCaveat}`;

  const wrap = document.getElementById('velocity-wrap');
  const svg = document.getElementById('velocity-svg');
  const hoverLine = document.getElementById('vel-hover-line');
  const dotOpened = document.getElementById('vel-dot-opened');
  const dotClosed = document.getElementById('vel-dot-closed');
  const tooltip = document.getElementById('velocity-tooltip');
  const tooltipDate = document.getElementById('vel-tooltip-date');
  const tooltipOpened = document.getElementById('vel-tooltip-opened');
  const tooltipClosed = document.getElementById('vel-tooltip-closed');

  function updateHover(clientX) {
    const svgRect = svg.getBoundingClientRect();
    const relX = clientX - svgRect.left;
    const svgSpaceX = (relX / svgRect.width) * w;
    const chartW = w - padX * 2;
    const t = (svgSpaceX - padX) / chartW;
    const nearest = Math.round(Math.max(0, Math.min(n - 1, t * (n - 1))));

    const svgX = toX(nearest);
    const pctX = (svgX / w) * 100;

    hoverLine.setAttribute('x1', svgX);
    hoverLine.setAttribute('x2', svgX);
    hoverLine.setAttribute('opacity', '1');

    dotOpened.setAttribute('cx', svgX);
    dotOpened.setAttribute('cy', toY(opened[nearest]));
    dotOpened.setAttribute('opacity', '1');

    dotClosed.setAttribute('cx', svgX);
    dotClosed.setAttribute('cy', toY(closed[nearest]));
    dotClosed.setAttribute('opacity', '1');

    tooltipDate.textContent = labels[nearest];
    tooltipOpened.textContent = opened[nearest];
    tooltipClosed.textContent = closed[nearest];

    const tooltipL = pctX > 70 ? pctX - 2 : pctX < 30 ? pctX + 2 : pctX;
    tooltip.style.left = tooltipL + '%';
    tooltip.style.transform = `translate(${pctX > 70 ? '-90%' : pctX < 30 ? '-10%' : '-50%'}, 0)`;
    tooltip.style.opacity = '1';
  }

  function clearHover() {
    hoverLine.setAttribute('opacity', '0');
    dotOpened.setAttribute('opacity', '0');
    dotClosed.setAttribute('opacity', '0');
    tooltip.style.opacity = '0';
  }

  wrap.addEventListener('mousemove', e => updateHover(e.clientX));
  wrap.addEventListener('mouseleave', clearHover);
  wrap.addEventListener('touchstart', e => updateHover(e.touches[0].clientX), { passive: true });
  wrap.addEventListener('touchmove', e => { e.preventDefault(); updateHover(e.touches[0].clientX); }, { passive: false });
}

// ── Sentry Ignored Rate ───────────────────────

function renderSentryIgnoredRate() {
  const el = document.getElementById('sentry-ignored-section');
  if (!el) return;

  const sir = DATA.sentryIgnoredRate;
  if (!sir) return;

  const status = sir?.status;
  const isLive = status === 'live';

  let subText;
  if (isLive) {
    subText = `${sir.ignored} ignored \u00b7 ${sir.ignoredPct}% of open issues`;
  } else {
    subText = 'Sentry data unavailable';
  }

  const dotClass = (isLive && sir.ignoredPct > 0) ? 'high' : 'muted';

  const sevBadgeClass = {
    critical: 'sentry-et-insufficient-context',
    high: 'sentry-et-network',
    medium: 'sentry-et-timeout',
    low: 'sentry-et-403-forbidden',
  };

  function severityBadge(sev) {
    const label = sev ? (sev.charAt(0).toUpperCase() + sev.slice(1)) : '';
    const cls = sev === 'critical' ? 'critical' :
                sev === 'high' ? 'high' :
                sev === 'medium' ? 'medium' : 'low';
    return `<span class="sentry-error-type-badge sentry-et-${cls}">${label}</span>`;
  }

  let bodyHTML;
  if (!isLive) {
    bodyHTML = `<div class="sentry-issue-meta" style="padding:12px 0">Sentry API unavailable \u2014 ignored rate cannot be computed.</div>`;
  } else {
    const issues = sir?.ignoredIssues || [];
    bodyHTML = issues.map(issue => `
      <div class="sentry-issue-row sentry-issue-sub">
        <div class="sentry-issue-body">
          <div class="sentry-issue-row-top">
            <span class="sentry-issue-title"><span class="sentry-title-text">${issue.id}</span></span>
            ${severityBadge(issue.severity)}
            <span class="sentry-queue">${issue.daysFiring}d</span>
            <span class="sentry-unlinked-badge">${issue.occurrences} occ.</span>
          </div>
        </div>
      </div>`).join('');
  }

  el.innerHTML = `
    <div class="sentry-card" id="sentry-ignored-card">
      <button class="sentry-pill" id="sentry-ignored-trigger">
        <span class="sentry-sev-dot ${dotClass}"></span>
        <div class="sentry-pill-text">
          <span class="sentry-pill-label">Sentry Ignored Rate</span>
          <span class="sentry-pill-sub">${subText}</span>
        </div>
        <svg class="sentry-chevron" width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M6 4l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
      <div class="sentry-body" id="sentry-ignored-body">
        <div class="sentry-body-inner" id="sentry-ignored-body-inner">
          ${bodyHTML}
        </div>
      </div>
    </div>`;

  const card = document.getElementById('sentry-ignored-card');
  const trigger = document.getElementById('sentry-ignored-trigger');
  const body = document.getElementById('sentry-ignored-body');
  const inner = document.getElementById('sentry-ignored-body-inner');

  trigger.addEventListener('click', () => {
    const isOpen = body.classList.contains('expanded');
    if (isOpen) {
      const currentHeight = body.getBoundingClientRect().height;
      body.style.height = currentHeight + 'px';
      requestAnimationFrame(() => { body.style.height = '0'; });
      body.classList.remove('expanded');
      card.classList.remove('expanded');
    } else {
      const targetHeight = Math.min(inner.scrollHeight, 280) + 24;
      body.style.height = targetHeight + 'px';
      body.classList.add('expanded');
      card.classList.add('expanded');
    }
  });
}

// ── CS Closed Loop Card ───────────────────────

function renderCSClosedLoopCard() {
  const el = document.getElementById('cs-closed-loop-section');
  if (!el) return;

  const cscl = DATA.csClosedLoop;
  const blockerReason = cscl?.blockerReason || 'HubSpot integration not configured \u2014 no CRM data accessible';

  el.innerHTML = `
    <div class="pipeline-step pipeline-step-blocked">
      <div class="pipeline-row">
        <div class="pipeline-left">
          <span class="pipeline-event pipeline-event-muted">CS Closed Loop Rate</span>
          <span class="pipeline-stage-label pipeline-label-muted">${blockerReason}</span>
        </div>
        <div class="pipeline-right">
          <span class="pipeline-pct pipeline-pct-muted">--</span>
          <span class="pipeline-count pipeline-label-muted">Pending integration</span>
        </div>
        <div class="pipeline-bar-track pipeline-bar-track-blocked">
          <div class="pipeline-bar bar-default" style="width: 0%"></div>
        </div>
      </div>
    </div>`;
}

// ── Action View ───────────────────────────────

function buildActionHTML() {
  return `
    <div class="section" id="action-summary-section">
      <div class="testing-summary-wrap">
        <div class="testing-summary-sentence" id="action-summary"></div>
      </div>
    </div>
    <div class="section" id="action-lists-section">
      <div id="action-lists-container"></div>
    </div>
    <div style="height: 100px; flex-shrink: 0;"></div>`;
}

function renderActionData() {
  renderActionSummary();
  renderActionLists();
}

function renderActionSummary() {
  const el = document.getElementById('action-summary');
  if (!el) return;
  const leads = DATA.hitLists?.salesHotLeads?.accounts || [];
  const rescue = DATA.hitLists?.csRescue?.accounts || [];
  const pf = DATA.hitLists?.productFriction;
  const parts = [];
  if (leads.length > 0) parts.push(`${leads.length} free account${leads.length !== 1 ? 's' : ''} ready to pitch`);
  if (rescue.length > 0) parts.push(`${rescue.length} paid account${rescue.length !== 1 ? 's' : ''} need CS outreach`);
  if (pf?.topDropOffStep) parts.push(`${pf.dropOffPct}% drop-off at ${pf.topDropOffStep}`);
  el.textContent = parts.length > 0 ? parts.join('. ') + '.' : 'No action items at this time.';
}

function renderActionLists() {
  const el = document.getElementById('action-lists-container');
  if (!el) return;
  el.innerHTML = actionHotLeadsHTML() + actionCSRescueHTML() + actionProductFrictionHTML();
}

function actionHotLeadsHTML() {
  const leads = DATA.hitLists?.salesHotLeads?.accounts || [];
  const hasInternalCaveat = (DATA.sourceMeta?.limitations || []).some(l =>
    l.toLowerCase().includes('base account') || l.toLowerCase().includes('is_internal')
  );
  const rows = leads.length === 0
    ? `<div class="ticket-row" style="pointer-events:none"><div class="ticket-line1"><span class="ticket-id" style="color:var(--text-muted)">No free accounts have generated a CIWP yet.</span></div></div>`
    : leads.map(a => `
      <div class="ticket-row" style="pointer-events:none">
        <div class="ticket-line1">
          <span class="ticket-title">${a.accountName}</span>
          <span class="tier-pill" style="margin-left:auto">${a.normalizedTier}</span>
          <span class="cta-badge" style="margin-left:8px">Pitch Paid Tier</span>
        </div>
        <div class="ticket-meta">
          <span class="ticket-meta-item">First CIWP: ${a.firstCiwpDate || '--'}</span>
          <span class="ticket-meta-item">${a.ciwpsCreated || 0} generated</span>
        </div>
      </div>`).join('');
  return `
    <div class="ticket-category">
      <div class="ticket-category-header">
        <span class="ticket-category-label">Sales Hot Leads</span>
        <span class="ticket-category-count">${leads.length}</span>
      </div>
      ${hasInternalCaveat ? `<div class="kpi-note" style="margin:0 0 8px">Internal accounts excluded (best-effort \u2014 is_internal not yet instrumented)</div>` : ''}
      ${rows}
    </div>`;
}

function actionCSRescueHTML() {
  const accounts = DATA.hitLists?.csRescue?.accounts || [];
  const caveat = DATA.hitLists?.csRescueCaveat || DATA.hitLists?.csRescue?.csRescueCaveat || '';
  const rows = accounts.length === 0
    ? `<div class="ticket-row" style="pointer-events:none"><div class="ticket-line1"><span class="ticket-id" style="color:var(--text-muted)">All paid accounts have generated a CIWP.</span></div></div>`
    : accounts.map(a => `
      <div class="ticket-row" style="pointer-events:none">
        <div class="ticket-line1">
          <span class="ticket-title">${a.accountName}</span>
          <span class="tier-pill" style="margin-left:auto">${a.normalizedTier}</span>
          <span class="cta-badge" style="margin-left:8px;background:#FFF8ED;color:#B76E00;">No CIWP yet</span>
        </div>
        <div class="ticket-meta">
          <span class="ticket-meta-item">Since enabled: ${a.daysSinceEnabled != null ? a.daysSinceEnabled + 'd' : 'Date unknown'}</span>
        </div>
      </div>`).join('');
  return `
    <div class="ticket-category">
      <div class="ticket-category-header">
        <span class="ticket-category-label">CS Rescue</span>
        <span class="ticket-category-count">${accounts.length}</span>
      </div>
      ${caveat ? `<div class="kpi-note" style="margin:0 0 8px">${caveat}</div>` : ''}
      ${rows}
    </div>`;
}

function actionProductFrictionHTML() {
  const pf = DATA.hitLists?.productFriction;
  if (!pf) return `<div class="ticket-category"><div class="ticket-category-header"><span class="ticket-category-label">Product Friction</span></div><div class="kpi-note">Data unavailable.</div></div>`;
  return `
    <div class="ticket-category">
      <div class="ticket-category-header">
        <span class="ticket-category-label">Product Friction</span>
      </div>
      <div class="ticket-row" style="pointer-events:none">
        <div class="ticket-line1">
          <span class="ticket-title">${pf.topDropOffStep}</span>
          <span class="cta-badge" style="margin-left:auto;background:#FFF0F0;color:#B00000;">${pf.dropOffPct}% drop-off</span>
        </div>
        ${pf.dropOffCount == null && pf.dropOffCountReason
          ? `<div class="ticket-meta"><span class="ticket-meta-item">${pf.dropOffCountReason}</span></div>`
          : ''}
      </div>
      <div class="ticket-row" style="pointer-events:none">
        <div class="ticket-line1">
          <span class="ticket-title" style="color:var(--text-muted)">Sentry account correlation</span>
          <span class="kpi-pending-badge" style="margin-left:auto">Blocked</span>
        </div>
        <div class="ticket-meta"><span class="ticket-meta-item">${pf.sentryBlockedReason}</span></div>
      </div>
    </div>`;
}
