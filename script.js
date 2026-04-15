let currentData = null;
let currentRange = '1D';

document.addEventListener('DOMContentLoaded', async () => {
  const res = await fetch('./data.json');
  currentData = await res.json();
  renderRange('1D');
  bindTimeSelector();
  bindSheet();
});

let isTransitioning = false;

function bindTimeSelector() {
  document.querySelectorAll('.time-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const range = btn.dataset.range;
      if (range === currentRange || isTransitioning) return;

      isTransitioning = true;

      document.querySelector('.time-btn.active').classList.remove('active');
      btn.classList.add('active');
      currentRange = range;

      const wrap = document.querySelector('.sparkline-wrap');
      const overlay = document.querySelector('.metric-overlay');

      // Single smooth blur: chart + metric blur out together
      wrap.classList.add('transitioning');
      overlay.classList.add('blur-out');

      // Wait for blur to fully settle, swap content, then resolve
      setTimeout(() => {
        document.querySelectorAll('.hover-line, .hover-dot, .sparkline-tooltip').forEach(el => el.remove());
        renderRange(range, true);

        // Small pause at peak blur for the swap to feel intentional
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

  // Swipe-to-dismiss
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
      requestAnimationFrame(() => {
        sheet.style.transform = '';
      });
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
}

function renderChart(chart, skipAnimation) {
  const svg = document.getElementById('sparkline');
  const wrap = document.querySelector('.sparkline-wrap');
  const w = 960;
  const h = 480;
  const padX = 8;
  const padTop = 40;
  const padBottom = 40;

  // Find global max across all series
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

    <!-- Visits layer (back) -->
    <path d="${buildArea(visitPath, visitCoords)}" fill="url(#fill-visits)" class="chart-area"/>
    <path d="${visitPath}" fill="none" stroke="#00A6FF" stroke-width="2" stroke-linecap="round" class="chart-line"/>

    <!-- Logins layer (middle) -->
    <path d="${buildArea(loginPath, loginCoords)}" fill="url(#fill-logins)" class="chart-area"/>
    <path d="${loginPath}" fill="none" stroke="#666666" stroke-width="3" stroke-linecap="round" class="chart-line"/>

    <!-- Generated layer (front) -->
    <path d="${buildArea(genPath, genCoords)}" fill="url(#fill-generated)" class="chart-area"/>
    <path d="${genPath}" fill="none" stroke="#AC5CCC" stroke-width="2.5" stroke-linecap="round" stroke-dasharray="6 4" class="chart-line"/>
  `;

  // Animate chart paths in
  if (skipAnimation) {
    // Range switch: paths appear instantly, container blur handles the transition
    svg.querySelectorAll('.chart-line, .chart-area').forEach((el) => {
      el.style.opacity = '1';
    });
  } else {
    // Initial load: staggered fade-in
    svg.querySelectorAll('.chart-line, .chart-area').forEach((el, i) => {
      el.style.opacity = '0';
      el.style.transition = 'none';
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const delay = 50 + i * 60;
          el.style.transition = `opacity 0.5s ease ${delay}ms`;
          el.style.opacity = '1';
        });
      });
    });
  }

  // Hover system
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

    const xShift = pctX > 75 ? '-90%' : pctX < 25 ? '-10%' : '-50%';
    const yShift = atPeak ? '0%' : '-100%';
    tooltip.style.transform = `translate(${xShift}, ${yShift})`;
  }

  function showHover() {
    line.style.opacity = '1';
    dot.style.opacity = '1';
    tooltip.style.opacity = '1';
  }

  function hideHover() {
    line.style.opacity = '';
    dot.style.opacity = '';
    tooltip.style.opacity = '';
  }

  // Desktop hover
  wrap.addEventListener('mousemove', (e) => updateHover(e.clientX));

  // Mobile touch
  wrap.addEventListener('touchstart', (e) => {
    showHover();
    updateHover(e.touches[0].clientX);
  }, { passive: true });

  wrap.addEventListener('touchmove', (e) => {
    e.preventDefault();
    updateHover(e.touches[0].clientX);
  }, { passive: false });

  wrap.addEventListener('touchend', () => {
    setTimeout(hideHover, 1500);
  });
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
    </div>`)
    .join('');
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
    </div>`)
    .join('');
}

function renderHealth(health) {
  const el = document.getElementById('account-health');
  const groups = [
    { key: 'active', label: 'Active', dot: 'active', items: health.active },
    { key: 'atRisk', label: 'At Risk', dot: 'at-risk', items: health.atRisk },
    { key: 'dormant', label: 'Dormant', dot: 'dormant', items: health.dormant }
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
    </div>
  `).join('');

  el.querySelectorAll('[data-accordion]').forEach(btn => {
    btn.addEventListener('click', () => {
      const group = btn.parentElement;
      const body = group.querySelector('.health-body');
      const inner = group.querySelector('.health-body-inner');
      const isOpen = group.classList.contains('expanded');

      if (isOpen) {
        body.style.height = body.scrollHeight + 'px';
        requestAnimationFrame(() => {
          body.style.height = '0';
        });
        group.classList.remove('expanded');
      } else {
        const targetHeight = inner.scrollHeight;
        body.style.height = targetHeight + 'px';
        group.classList.add('expanded');
        body.addEventListener('transitionend', () => {
          if (group.classList.contains('expanded')) {
            body.style.height = 'auto';
          }
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
    </div>`)
    .join('');
}

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}
