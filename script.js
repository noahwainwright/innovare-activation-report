document.addEventListener('DOMContentLoaded', async () => {
  const res = await fetch('./data.json');
  const data = await res.json();
  render(data);
});

function render(data) {
  // Date + product label
  document.getElementById('report-date').textContent = formatDate(data.date);
  document.getElementById('report-product').textContent = data.product;
  document.getElementById('client-name').textContent = data.client;

  // Primary metric
  document.getElementById('metric-value').textContent = data.primary.value + data.primary.unit;
  const arrow = document.getElementById('delta-arrow');
  const delta = document.getElementById('delta-value');
  arrow.textContent = data.primary.direction === 'up' ? '\u2191' : '\u2193';
  arrow.className = 'arrow ' + data.primary.direction;
  delta.textContent = data.primary.delta + '% vs yesterday';

  // Accounts
  document.getElementById('accounts').textContent =
    data.accounts.total + ' ' + data.accounts.label;

  // Sparkline
  renderSparkline(data.sparkline);

  // Funnel
  const funnelEl = document.getElementById('funnel');
  funnelEl.innerHTML = data.funnel
    .map(
      (step) => `
    <div class="funnel-row">
      <span class="funnel-label">${step.label}</span>
      <div class="funnel-bar-track">
        <div class="funnel-bar" style="width: ${step.value}%; opacity: ${0.4 + step.value * 0.006}"></div>
      </div>
      <span class="funnel-pct">${step.value}%</span>
    </div>`
    )
    .join('');

  // Cohorts
  const cohortsEl = document.getElementById('cohorts');
  cohortsEl.innerHTML = data.cohorts
    .map(
      (c) => `
    <div class="cohort-card">
      <div class="cohort-name">${c.label}</div>
      <div class="cohort-rate">${c.rate}%</div>
      <div class="cohort-count">${c.accounts} accounts</div>
    </div>`
    )
    .join('');

  // Signals
  const signalsEl = document.getElementById('signals');
  signalsEl.innerHTML = data.signals
    .map(
      (s) => `
    <div class="signal-card">
      <div class="signal-value">${s.value}${s.unit ? (s.unit === '%' ? '' : ' ') + s.unit : ''}</div>
      <div class="signal-label">${s.label}</div>
    </div>`
    )
    .join('');

  // Pill toggle
  const pill = document.getElementById('pill');
  const panel = document.getElementById('expanded-panel');
  pill.addEventListener('click', () => {
    const isOpen = panel.classList.toggle('open');
    pill.textContent = isOpen ? 'See less' : 'See more';
  });
}

function renderSparkline(points) {
  const svg = document.getElementById('sparkline');
  const w = 624;
  const h = 160;
  const pad = 16;

  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;

  const coords = points.map((val, i) => ({
    x: pad + (i / (points.length - 1)) * (w - pad * 2),
    y: pad + (1 - (val - min) / range) * (h - pad * 2),
  }));

  // Build smooth cubic bezier path
  let pathD = `M ${coords[0].x} ${coords[0].y}`;
  for (let i = 1; i < coords.length; i++) {
    const prev = coords[i - 1];
    const curr = coords[i];
    const cpx = (prev.x + curr.x) / 2;
    pathD += ` C ${cpx} ${prev.y}, ${cpx} ${curr.y}, ${curr.x} ${curr.y}`;
  }

  // Area fill path
  const areaD =
    pathD +
    ` L ${coords[coords.length - 1].x} ${h} L ${coords[0].x} ${h} Z`;

  svg.innerHTML = `
    <defs>
      <linearGradient id="area-fill" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#000000" stop-opacity="0.06"/>
        <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
      </linearGradient>
    </defs>
    <path d="${areaD}" fill="url(#area-fill)"/>
    <path d="${pathD}" fill="none" stroke="#000000CC" stroke-width="2" stroke-linecap="round"/>
  `;
}

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}
