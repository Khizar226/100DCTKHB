// =====================================================
//  UI RENDERING MODULE
// =====================================================

// =====================================================
//  TOAST SYSTEM
// =====================================================
function showToast(msg, type = 'success') {
  const container = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = `toast toast--${type}`;
  el.innerHTML = `<i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'exclamation-triangle'} mr-2"></i>${msg}`;
  container.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transition = 'opacity 0.3s';
    setTimeout(() => el.remove(), 300);
  }, 3000);
}

// =====================================================
//  HEALTH BAR (Section 1 — Account Health)
// =====================================================
function renderHealthBar() {
  let health = 100;
  if (appData.history.length > 0) {
    let recentScore = 0;
    const lookback = Math.min(appData.history.length, 10);
    for (let i = 0; i < lookback; i++) {
      const entry = appData.history[appData.history.length - 1 - i];
      if (entry.achievedPerc >= entry.targetPerc) recentScore += 10;
      else if (entry.pnl >= 0) recentScore += 2;
      else recentScore -= 10;
    }
    health = Math.max(0, Math.min(100, 50 + recentScore));
  }

  const fill = document.getElementById('healthFill');
  fill.style.width = `${health}%`;

  if (health > 75) {
    fill.style.background = 'linear-gradient(90deg, #00c88c, #00e0b0)';
    fill.style.boxShadow = '0 0 12px rgba(0,200,140,0.5)';
  } else if (health > 40) {
    fill.style.background = 'linear-gradient(90deg, #f59e0b, #fbbf24)';
    fill.style.boxShadow = 'none';
  } else {
    fill.style.background = 'linear-gradient(90deg, #ef4444, #f97316)';
    fill.style.boxShadow = '0 0 12px rgba(239,68,68,0.4)';
  }
}

// =====================================================
//  SECTION 1 — DASHBOARD STATS
// =====================================================
function renderStats() {
  const dayNum = appData.history.length + 1;
  const cap = appData.currentCapital;
  const initCap = appData.initialCapital;

  document.getElementById('dispUserName').innerText = appData.userName;
  document.getElementById('dispUserAge').innerText = appData.userAge;

  document.getElementById('dispCurrentBalance').innerText = formatMoney(cap);
  document.getElementById('dispDay').innerText = Math.min(dayNum, 100);
  document.getElementById('dayProgressBar').style.width = `${Math.min(dayNum, 100)}%`;

  const totalReturn = ((cap - initCap) / initCap) * 100;
  const retEl = document.getElementById('dispTotalPnL');
  retEl.innerHTML = `<span class="${totalReturn >= 0 ? 'text-emerald' : 'text-red'}">${formatPerc(totalReturn)}</span> Total Return`;

  renderHealthBar();
}

// =====================================================
//  SECTION 2 — PROJECTIONS
// =====================================================
let activeHorizon = 100;

function renderProjections() {
  const p = getProjections(activeHorizon);
  const dayNum = appData.history.length + 1;

  document.getElementById('initialGoalPerc').innerText = `${appData.initialTargetPerc.toFixed(1)}%`;
  document.getElementById('initialGoal100').innerText = formatMoney(p.goalAtHorizon);
  document.getElementById('dispAvgReturnPerc').innerText = formatPerc(p.avgPerc);
  document.getElementById('proj100Actual').innerText = formatMoney(p.projActual);
  document.getElementById('proj100Target').innerText = formatMoney(p.projTarget);

  const horizonLabel = activeHorizon === 30 ? '30-Day' :
                       activeHorizon === 60 ? '60-Day' :
                       activeHorizon === 90 ? '90-Day' : '100-Day';
  document.getElementById('horizonLabel').innerText = horizonLabel;
}

function setHorizon(days) {
  activeHorizon = days;
  document.querySelectorAll('.proj-tab').forEach(t => t.classList.remove('active'));
  document.querySelector(`[data-horizon="${days}"]`).classList.add('active');
  renderProjections();
}

// =====================================================
//  SECTION 3 — DAILY LOG TARGETS
// =====================================================
function renderTargetStrip() {
  const dayNum = appData.history.length + 1;
  const cap = appData.currentCapital;
  const targetPerc = getTargetPercent(dayNum);
  const targetProfit = cap * (targetPerc / 100);
  const worstLossPerc = 15; // Always 15% worst-case loss
  const worstLoss = cap * (worstLossPerc / 100);
  const expectedBalance = cap + targetProfit;

  document.getElementById('targetPercDisplay').innerText = `${targetPerc.toFixed(2)}%`;
  document.getElementById('targetProfitDisplay').innerText = formatMoney(targetProfit);
  document.getElementById('worstLossDisplay').innerText = `-${formatMoney(worstLoss)}`;
  document.getElementById('expectedBalDisplay').innerText = formatMoney(expectedBalance);
}

// =====================================================
//  SECTION 4 — PERFORMANCE / LEVELING
// =====================================================
function renderPerformance() {
  const h = appData.history;
  const xp = calcXP(h);
  const tier = getTier(xp);
  const nextTier = getNextTier(xp);
  const xpProg = getXPProgress(xp);
  const scores = calcCompositeScore(h);
  const achievements = getUnlockedAchievements(h);
  const streak = getCurrentStreak(h);
  const scoreLabel = getScoreLabel(scores.composite);

  // Tier badge
  const tierBadge = document.getElementById('tierBadge');
  tierBadge.innerHTML = `${tier.icon} ${tier.name}`;
  tierBadge.style.background = tier.bg;
  tierBadge.style.border = `1px solid ${tier.border}`;
  tierBadge.style.color = tier.color;

  // XP display
  document.getElementById('xpDisplay').innerText = `${xp.toLocaleString()} XP`;
  document.getElementById('xpBarFill').style.width = `${xpProg.pct}%`;

  const nextLabel = nextTier ? `${xpProg.xpInTier} / ${xpProg.xpNeeded} XP → ${nextTier.name}` : 'MAX TIER — Legend';
  document.getElementById('xpNextLabel').innerText = nextLabel;

  // Composite score
  document.getElementById('compositeScore').innerText = scores.composite;
  document.getElementById('compositeLabel').innerText = scoreLabel.label;
  document.getElementById('compositeLabel').style.color = scoreLabel.color;

  // Streak
  document.getElementById('streakDisplay').innerText = `${streak} days`;

  // Metric breakdown
  document.getElementById('scoreWR').innerText = Math.round(scores.wr);
  document.getElementById('scoreCS').innerText = Math.round(scores.cs);
  document.getElementById('scoreDS').innerText = Math.round(scores.ds);
  document.getElementById('scoreRM').innerText = Math.round(scores.rm);

  // Color the scores
  const colorScore = (id, val) => {
    const el = document.getElementById(id);
    el.style.color = val >= 70 ? 'var(--emerald)' : val >= 50 ? 'var(--amber)' : 'var(--red)';
  };
  colorScore('scoreWR', scores.wr);
  colorScore('scoreCS', scores.cs);
  colorScore('scoreDS', scores.ds);
  colorScore('scoreRM', scores.rm);

  // Achievements
  const achContainer = document.getElementById('achievementsRow');
  achContainer.innerHTML = achievements.map(a => `
    <div class="achievement ${a.unlocked ? 'unlocked' : ''}" title="${a.desc}">
      <span class="ach-icon">${a.icon}</span>
      <span>${a.label}</span>
    </div>
  `).join('');
}

// =====================================================
//  DATA TABLE — with Edit/Delete
// =====================================================
function renderTable() {
  const tbody = document.getElementById('logBody');
  tbody.innerHTML = '';

  if (!appData.history.length) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:32px;color:var(--text-muted)">No days logged yet. Complete today's quiz and log your results.</td></tr>`;
    return;
  }

  [...appData.history].reverse().forEach(row => {
    const tr = document.createElement('tr');
    const pnlClass = row.pnl >= 0 ? 'text-emerald' : 'text-red';
    const hitTarget = row.achievedPerc >= row.targetPerc;

    tr.innerHTML = `
      <td style="color:var(--text-muted)">${row.date}</td>
      <td style="color:var(--text-secondary)">Day ${row.day}</td>
      <td>${formatMoney(row.startCap)}</td>
      <td style="color:var(--cyan)">${row.targetPerc.toFixed(2)}%</td>
      <td class="${hitTarget ? 'text-emerald fw-700' : ''}">${row.achievedPerc.toFixed(2)}%</td>
      <td class="${pnlClass} fw-700">${row.pnl >= 0 ? '+' : ''}${formatMoney(row.pnl)}</td>
      <td style="color:var(--text-primary);font-weight:700">${formatMoney(row.endCap)}</td>
      <td style="color:var(--text-muted)">${row.trades || 0}</td>
      <td>
        <div class="td-actions">
          <button class="btn btn-secondary btn-icon" onclick="editDay(${row.day})" title="Edit">
            <i class="fas fa-pencil-alt"></i>
          </button>
          <button class="btn btn-danger btn-icon" onclick="deleteDay(${row.day})" title="Delete">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// =====================================================
//  FULL DASHBOARD RENDER
// =====================================================
function renderDashboard() {
  renderStats();
  renderProjections();
  renderTargetStrip();
  renderPerformance();
  renderTable();
}
