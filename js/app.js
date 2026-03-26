// =====================================================
//  APP LOGIC — INIT, SUBMIT, EDIT, DELETE
// =====================================================

// =====================================================
//  INIT
// =====================================================
function init() {
  if (loadData()) {
    document.getElementById('setupModal').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    renderDashboard();
  } else {
    document.getElementById('setupModal').classList.remove('hidden');
    document.getElementById('initCapital').addEventListener('input', updateSetupProjection);
    document.getElementById('initialTargetPerc').addEventListener('input', updateSetupProjection);

    // Default date to today
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('startDate').value = today;
  }
}

// =====================================================
//  SETUP MODAL
// =====================================================
function updateSetupProjection() {
  const capital = parseFloat(document.getElementById('initCapital').value) || 0;
  const targetPerc = parseFloat(document.getElementById('initialTargetPerc').value) || 0;
  if (capital > 0 && targetPerc > 0) {
    let projected = capital;
    for (let i = 0; i < 100; i++) projected *= (1 + targetPerc / 100);
    document.getElementById('initialProjectionDisplay').innerText = formatMoney(projected);
  } else {
    document.getElementById('initialProjectionDisplay').innerText = '$0.00';
  }
}

function startChallenge() {
  const name = document.getElementById('userName').value.trim();
  const age = parseInt(document.getElementById('userAge').value) || 0;
  const capital = parseFloat(document.getElementById('initCapital').value);
  const targetPerc = parseFloat(document.getElementById('initialTargetPerc').value);
  const startDate = document.getElementById('startDate').value;

  if (!name || !capital || !targetPerc || !startDate) {
    showToast('Please fill in all fields.', 'error');
    return;
  }
  if (capital <= 0 || targetPerc <= 0) {
    showToast('Capital and target % must be greater than zero.', 'error');
    return;
  }

  appData.userName = name;
  appData.userAge = age;
  appData.initialCapital = capital;
  appData.currentCapital = capital;
  appData.initialTargetPerc = targetPerc;
  appData.startDate = startDate;
  appData.history = [];
  appData.gameHistory = [];
  appData.xp = 0;

  saveData();

  document.getElementById('setupModal').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  renderDashboard();
  showToast(`Welcome, ${name}. Challenge initialized. Day 1 starts now!`, 'success');
}

// =====================================================
//  SUBMIT DAY
// =====================================================
function submitDay() {
  const pnlRaw = document.getElementById('dailyPnL').value;
  const trades = parseInt(document.getElementById('dailyTrades').value) || 0;
  const pnl = parseFloat(pnlRaw);

  if (isNaN(pnl)) {
    showToast('Please enter a valid P&L amount.', 'error');
    return;
  }

  const currentDayNum = appData.history.length + 1;
  if (currentDayNum > 100) {
    showToast('Challenge complete! Cannot log more days.', 'warn');
    return;
  }

  let dateObj = new Date(appData.startDate);
  dateObj.setDate(dateObj.getDate() + (currentDayNum - 1));

  const startCap = appData.currentCapital;
  const targetPerc = getTargetPercent(currentDayNum);
  const targetAmt = startCap * (targetPerc / 100);
  const achievedPerc = (pnl / startCap) * 100;
  const endCap = startCap + pnl;

  appData.currentCapital = endCap;
  appData.history.push({
    day: currentDayNum,
    date: dateObj.toISOString().split('T')[0],
    startCap,
    targetPerc,
    targetAmt,
    achievedPerc,
    pnl,
    endCap,
    trades,
  });

  document.getElementById('dailyPnL').value = '';
  document.getElementById('dailyTrades').value = '';

  saveData();
  renderDashboard();

  const hitTarget = achievedPerc >= targetPerc;
  if (hitTarget) {
    showToast(`Day ${currentDayNum} logged! 🎯 Target hit. Great work!`, 'success');
  } else if (pnl >= 0) {
    showToast(`Day ${currentDayNum} logged. Profitable but below target. Keep pushing.`, 'warn');
  } else {
    showToast(`Day ${currentDayNum} logged. Loss day. Analyze and recover.`, 'error');
  }
}

// =====================================================
//  EDIT DAY — inline modal
// =====================================================
function editDay(dayNum) {
  const idx = appData.history.findIndex(r => r.day === dayNum);
  if (idx === -1) return;
  const row = appData.history[idx];

  const modal = document.getElementById('editModal');
  document.getElementById('editDayNum').innerText = dayNum;
  document.getElementById('editPnL').value = row.pnl;
  document.getElementById('editTrades').value = row.trades || 0;

  modal.classList.remove('hidden');

  document.getElementById('editSaveBtn').onclick = function () {
    const newPnL = parseFloat(document.getElementById('editPnL').value);
    const newTrades = parseInt(document.getElementById('editTrades').value) || 0;

    if (isNaN(newPnL)) {
      showToast('Invalid P&L value.', 'error');
      return;
    }

    // Recalculate from that day forward
    row.pnl = newPnL;
    row.trades = newTrades;
    row.achievedPerc = (newPnL / row.startCap) * 100;
    row.endCap = row.startCap + newPnL;
    appData.history[idx] = row;

    // Cascade: fix all subsequent days' startCap
    for (let i = idx + 1; i < appData.history.length; i++) {
      const prev = appData.history[i - 1];
      const cur = appData.history[i];
      cur.startCap = prev.endCap;
      cur.targetAmt = cur.startCap * (cur.targetPerc / 100);
      cur.achievedPerc = (cur.pnl / cur.startCap) * 100;
      cur.endCap = cur.startCap + cur.pnl;
    }

    // Recalculate current capital
    appData.currentCapital = appData.history[appData.history.length - 1].endCap;

    saveData();
    renderDashboard();
    modal.classList.add('hidden');
    showToast(`Day ${dayNum} updated and cascade-recalculated.`, 'success');
  };
}

function closeEditModal() {
  document.getElementById('editModal').classList.add('hidden');
}

// =====================================================
//  DELETE DAY
// =====================================================
function deleteDay(dayNum) {
  const idx = appData.history.findIndex(r => r.day === dayNum);
  if (idx === -1) return;

  const confirmed = window.confirm(`Delete Day ${dayNum}? All subsequent days will be cascade-recalculated.`);
  if (!confirmed) return;

  appData.history.splice(idx, 1);

  // Re-number and cascade recalculate from deleted point
  // We can't truly recalculate previous days, so rebuild from idx onward
  // The startCap for the deleted index position now gets prev endCap
  for (let i = idx; i < appData.history.length; i++) {
    const cur = appData.history[i];
    cur.day = i + 1; // Renumber
    if (i === 0) {
      cur.startCap = appData.initialCapital;
    } else {
      cur.startCap = appData.history[i - 1].endCap;
    }
    cur.targetPerc = getTargetPercent(cur.day);
    cur.targetAmt = cur.startCap * (cur.targetPerc / 100);
    cur.achievedPerc = (cur.pnl / cur.startCap) * 100;
    cur.endCap = cur.startCap + cur.pnl;
  }

  // Recalculate current capital
  if (appData.history.length > 0) {
    appData.currentCapital = appData.history[appData.history.length - 1].endCap;
  } else {
    appData.currentCapital = appData.initialCapital;
  }

  // Also clean up gameHistory
  appData.gameHistory = appData.gameHistory.filter(g => g.day !== dayNum);

  saveData();
  renderDashboard();
  showToast(`Day ${dayNum} deleted. History recalculated.`, 'warn');
}

// =====================================================
//  RESET
// =====================================================
function confirmReset() {
  const confirmed = window.confirm('⚠️ Are you sure? This will permanently wipe all 100-day progress. This cannot be undone.');
  if (!confirmed) return;
  resetData();
  location.reload();
}
