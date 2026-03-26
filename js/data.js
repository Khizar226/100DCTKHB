// =====================================================
//  STATE & DATA MANAGEMENT
// =====================================================

const STORAGE_KEY = 'trading100_v4';

const DEFAULT_STATE = {
  userName: '',
  userAge: 0,
  initialCapital: 0,
  initialTargetPerc: 0,
  startDate: null,
  currentCapital: 0,
  history: [],      // { day, date, startCap, targetPerc, targetAmt, achievedPerc, pnl, endCap, trades }
  gameHistory: [],  // kept for legacy compat — removed quiz
  xp: 0,
  level: 1,
};

let appData = { ...DEFAULT_STATE };

function loadData() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    appData = { ...DEFAULT_STATE, ...JSON.parse(saved) };
    return true;
  }
  return false;
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));
}

function resetData() {
  localStorage.removeItem(STORAGE_KEY);
  appData = { ...DEFAULT_STATE };
}

// =====================================================
//  TARGET PERCENTAGE — GRADUAL LINEAR DECAY
//  Day 1 → initialTargetPerc
//  Day 50 → decay begins, -0.01% per day until Day 90
//  Day 91-100 → very low (capped at 1%)
// =====================================================
function getTargetPercent(dayNum) {
  const base = appData.initialTargetPerc;
  if (!base || base <= 0) return 1;

  if (dayNum <= 50) {
    return base;
  }

  if (dayNum <= 90) {
    // Linear decay: each day after 50 reduces by 0.15% of initial
    const decay = (dayNum - 50) * (base * 0.003);
    return Math.max(1.0, base - decay);
  }

  // Days 91-100: squeeze to 0.5%–1%
  const finalDecay = (dayNum - 90) * 0.05;
  return Math.max(0.5, 1.0 - finalDecay);
}

// =====================================================
//  PROJECTIONS
// =====================================================
function projectCapital(startCap, dailyPerc, days) {
  let cap = startCap;
  for (let i = 0; i < days; i++) {
    cap *= (1 + dailyPerc / 100);
  }
  return cap;
}

function getProjections(horizonDays) {
  const dayNum = appData.history.length + 1;
  const daysLeft = Math.max(0, horizonDays - (dayNum - 1));
  const cap = appData.currentCapital;

  // Average achieved %
  let avgPerc = 0;
  if (appData.history.length > 0) {
    avgPerc = appData.history.reduce((acc, r) => acc + r.achievedPerc, 0) / appData.history.length;
  }

  // Initial goal projection (from day 1)
  const goalAtHorizon = projectCapital(appData.initialCapital, appData.initialTargetPerc, horizonDays);

  // Based on current avg from current capital
  const projActual = projectCapital(cap, avgPerc, daysLeft);

  // Best case: today's target % for remaining days
  const projTarget = projectCapital(cap, getTargetPercent(dayNum), daysLeft);

  return {
    goalAtHorizon,
    projActual,
    projTarget,
    avgPerc,
  };
}

// =====================================================
//  EXPORT CSV
// =====================================================
function exportData() {
  let csv = 'Date,Day,Start Capital,Target %,Achieved %,PnL,End Capital,Trades\n';
  appData.history.forEach(row => {
    csv += `${row.date},${row.day},${row.startCap.toFixed(2)},${row.targetPerc.toFixed(2)},${row.achievedPerc.toFixed(2)},${row.pnl.toFixed(2)},${row.endCap.toFixed(2)},${row.trades}\n`;
  });
  const uri = encodeURI('data:text/csv;charset=utf-8,' + csv);
  const link = document.createElement('a');
  link.setAttribute('href', uri);
  link.setAttribute('download', `${appData.userName.replace(/\s/g, '_')}_challenge.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// =====================================================
//  FORMAT HELPERS
// =====================================================
function formatMoney(num) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(num);
}

function formatPerc(num, digits = 2) {
  const sign = num >= 0 ? '+' : '';
  return `${sign}${num.toFixed(digits)}%`;
}
