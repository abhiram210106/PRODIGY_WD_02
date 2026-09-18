(() => {
  'use strict';

  /* ---------- Elements ---------- */
  const hhEl = document.getElementById('hh');
  const mmEl = document.getElementById('mm');
  const ssEl = document.getElementById('ss');
  const csEl = document.getElementById('cs');

  const startBtn = document.getElementById('startBtn');
  const lapBtn = document.getElementById('lapBtn');
  const resetBtn = document.getElementById('resetBtn');
  const clearLapsBtn = document.getElementById('clearLaps');

  const startLabel = document.getElementById('startLabel');
  const statusDot = document.getElementById('statusDot');
  const statusText = document.getElementById('statusText');
  const lapCountEl = document.getElementById('lapCount');

  const lapsList = document.getElementById('lapsList');
  const lapsEmpty = document.getElementById('lapsEmpty');

  const progressRing = document.getElementById('progressRing');
  const tickGroup = document.getElementById('tickMarks');

  const iconPlay = startBtn.querySelector('.icon-play');
  const iconPause = startBtn.querySelector('.icon-pause');

  const RING_CIRC = 2 * Math.PI * 140;

  /* ---------- State ---------- */
  // elapsed = total accumulated ms before the current run segment.
  // runStart = performance.now() timestamp when the current run segment began (null if not running).
  let elapsed = 0;
  let runStart = null;
  let running = false;
  let rafId = null;
  let laps = []; // { totalMs, deltaMs }

  /* ---------- Build tick marks (60 around the dial) ---------- */
  (function buildTicks() {
    const cx = 160, cy = 160;
    const rOuter = 150;
    for (let i = 0; i < 60; i++) {
      const angle = (i / 60) * Math.PI * 2 - Math.PI / 2;
      const isMajor = i % 5 === 0;
      const len = isMajor ? 12 : 6;
      const rInner = rOuter - len;
      const x1 = cx + rOuter * Math.cos(angle);
      const y1 = cy + rOuter * Math.sin(angle);
      const x2 = cx + rInner * Math.cos(angle);
      const y2 = cy + rInner * Math.sin(angle);
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', x1.toFixed(2));
      line.setAttribute('y1', y1.toFixed(2));
      line.setAttribute('x2', x2.toFixed(2));
      line.setAttribute('y2', y2.toFixed(2));
      line.setAttribute('class', isMajor ? 'tick tick--major' : 'tick');
      tickGroup.appendChild(line);
    }
  })();

  /* ---------- Helpers ---------- */
  function pad(n, len = 2) {
    return String(n).padStart(len, '0');
  }

  function formatParts(ms) {
    const totalCs = Math.floor(ms / 10);
    const cs = totalCs % 100;
    const totalSec = Math.floor(totalCs / 100);
    const sec = totalSec % 60;
    const totalMin = Math.floor(totalSec / 60);
    const min = totalMin % 60;
    const hrs = Math.floor(totalMin / 60);
    return { hrs, min, sec, cs };
  }

  function render(ms) {
    const { hrs, min, sec, cs } = formatParts(ms);
    hhEl.textContent = hrs > 0 ? `${pad(hrs)}:` : '';
    mmEl.textContent = pad(min);
    ssEl.textContent = pad(sec);
    csEl.textContent = '.' + pad(cs);

    // sweep the progress ring once per 60 seconds
    const sweepMs = ms % 60000;
    const fraction = sweepMs / 60000;
    const offset = RING_CIRC * (1 - fraction);
    progressRing.style.strokeDashoffset = offset.toFixed(2);
  }

  function currentElapsed() {
    return running ? elapsed + (performance.now() - runStart) : elapsed;
  }

  function tick() {
    render(currentElapsed());
    rafId = requestAnimationFrame(tick);
  }

  /* ---------- Controls ---------- */
  function start() {
    if (running) return;
    running = true;
    runStart = performance.now();
    rafId = requestAnimationFrame(tick);

    iconPlay.style.display = 'none';
    iconPause.style.display = '';
    startBtn.classList.add('is-running');
    startBtn.title = 'Pause';
    startBtn.setAttribute('aria-label', 'Pause stopwatch');
    startLabel.textContent = 'PAUSE';

    lapBtn.disabled = false;
    progressRing.classList.add('is-running');

    statusDot.className = 'status__dot is-running';
    statusText.textContent = 'Running';
  }

  function pause() {
    if (!running) return;
    elapsed += performance.now() - runStart;
    running = false;
    runStart = null;
    cancelAnimationFrame(rafId);
    render(elapsed);

    iconPlay.style.display = '';
    iconPause.style.display = 'none';
    startBtn.classList.remove('is-running');
    startBtn.title = 'Start';
    startBtn.setAttribute('aria-label', 'Resume stopwatch');
    startLabel.textContent = 'START';

    lapBtn.disabled = true;
    progressRing.classList.remove('is-running');

    statusDot.className = 'status__dot is-paused';
    statusText.textContent = elapsed === 0 ? 'Ready' : 'Paused';
  }

  function reset() {
    running = false;
    runStart = null;
    elapsed = 0;
    cancelAnimationFrame(rafId);
    render(0);

    iconPlay.style.display = '';
    iconPause.style.display = 'none';
    startBtn.classList.remove('is-running');
    startBtn.title = 'Start';
    startBtn.setAttribute('aria-label', 'Start stopwatch');
    startLabel.textContent = 'START';

    lapBtn.disabled = true;
    progressRing.classList.remove('is-running');
    progressRing.style.strokeDashoffset = RING_CIRC;

    statusDot.className = 'status__dot';
    statusText.textContent = 'Ready';

    laps = [];
    renderLaps();
  }

  function recordLap() {
    if (!running) return;
    const total = currentElapsed();
    const prevTotal = laps.length ? laps[laps.length - 1].totalMs : 0;
    const delta = total - prevTotal;
    laps.push({ totalMs: total, deltaMs: delta });
    renderLaps();
  }

  function clearLaps() {
    laps = [];
    renderLaps();
  }

  function renderLaps() {
    lapCountEl.textContent = `${laps.length} lap${laps.length === 1 ? '' : 's'}`;
    clearLapsBtn.disabled = laps.length === 0;

    lapsList.innerHTML = '';

    if (laps.length === 0) {
      lapsList.appendChild(lapsEmpty);
      return;
    }

    let bestIdx = -1, worstIdx = -1;
    if (laps.length > 1) {
      let best = Infinity, worst = -Infinity;
      laps.forEach((l, i) => {
        if (l.deltaMs < best) { best = l.deltaMs; bestIdx = i; }
        if (l.deltaMs > worst) { worst = l.deltaMs; worstIdx = i; }
      });
    }

    // newest first
    for (let i = laps.length - 1; i >= 0; i--) {
      const lap = laps[i];
      const li = document.createElement('li');
      li.className = 'lap-row';
      if (i === bestIdx) li.classList.add('lap-row--best');
      if (i === worstIdx) li.classList.add('lap-row--worst');

      const { min: dMin, sec: dSec, cs: dCs } = formatParts(lap.deltaMs);
      const { hrs: tHrs, min: tMin, sec: tSec, cs: tCs } = formatParts(lap.totalMs);

      li.innerHTML = `
        <span class="lap-row__index">${pad(i + 1)}</span>
        <span class="lap-row__delta">+${pad(dMin)}:${pad(dSec)}.${pad(dCs)}</span>
        <span class="lap-row__total">${tHrs > 0 ? pad(tHrs) + ':' : ''}${pad(tMin)}:${pad(tSec)}.${pad(tCs)}</span>
      `;
      lapsList.appendChild(li);
    }
  }

  /* ---------- Wire up events ---------- */
  startBtn.addEventListener('click', () => {
    running ? pause() : start();
  });
  lapBtn.addEventListener('click', recordLap);
  resetBtn.addEventListener('click', () => {
    if (running) pause();
    reset();
  });
  clearLapsBtn.addEventListener('click', clearLaps);

  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
      e.preventDefault();
      running ? pause() : start();
    } else if (e.key.toLowerCase() === 'l') {
      recordLap();
    } else if (e.key.toLowerCase() === 'r') {
      if (running) pause();
      reset();
    }
  });

  /* ---------- Init ---------- */
  render(0);
  lapBtn.disabled = true;
  progressRing.style.strokeDashoffset = RING_CIRC;
})();
