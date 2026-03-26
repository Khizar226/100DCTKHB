// =====================================================
//  PERFORMANCE ENGINE — XP + TIER + SCORE BREAKDOWN
//
//  Algorithms used:
//  - Consistency Score: exponential moving average of hit-rate
//  - Win Rate: simple ratio with streak bonuses
//  - Discipline Score: penalizes excessive trades, rewards balance
//  - XP: weighted composite with streak multipliers
//  - Tier: 6-level system (Recruit → Legend)
// =====================================================

const TIERS = [
  { name: 'Recruit',    minXP: 0,    color: '#6b7fa3', icon: '🔩', bg: 'rgba(107,127,163,0.1)',  border: 'rgba(107,127,163,0.3)' },
  { name: 'Apprentice', minXP: 200,  color: '#3b82f6', icon: '⚡', bg: 'rgba(59,130,246,0.1)',   border: 'rgba(59,130,246,0.3)'  },
  { name: 'Trader',     minXP: 600,  color: '#a855f7', icon: '🔮', bg: 'rgba(168,85,247,0.1)',   border: 'rgba(168,85,247,0.3)'  },
  { name: 'Pro',        minXP: 1200, color: '#00b4d8', icon: '🌊', bg: 'rgba(0,180,216,0.1)',    border: 'rgba(0,180,216,0.3)'   },
  { name: 'Elite',      minXP: 2200, color: '#00c88c', icon: '⚔️', bg: 'rgba(0,200,140,0.1)',    border: 'rgba(0,200,140,0.3)'   },
  { name: 'Legend',     minXP: 3500, color: '#f59e0b', icon: '👑', bg: 'rgba(245,158,11,0.1)',   border: 'rgba(245,158,11,0.3)'  },
];

const ACHIEVEMENTS = [
  { id: 'first_blood',  icon: '🩸', label: 'First Blood',    desc: 'Log your first day',         check: h => h.length >= 1 },
  { id: 'week_warrior', icon: '🗓️', label: 'Week Warrior',   desc: '7 days completed',            check: h => h.length >= 7 },
  { id: 'win_streak_5', icon: '🔥', label: 'On Fire',        desc: '5-day profit streak',         check: h => getMaxStreak(h) >= 5 },
  { id: 'target_hit_10',icon: '🎯', label: 'Sharpshooter',  desc: '10 days hitting target',      check: h => h.filter(r => r.achievedPerc >= r.targetPerc).length >= 10 },
  { id: 'halfway',      icon: '🏁', label: 'Halfway There',  desc: 'Reach Day 50',                check: h => h.length >= 50 },
  { id: 'century',      icon: '💯', label: 'Centurion',      desc: 'Complete 100 days',           check: h => h.length >= 100 },
  { id: 'no_loss_week', icon: '🛡️', label: 'Iron Shield',    desc: '7 consecutive profitable',   check: h => getMaxStreak(h) >= 7 },
  { id: 'big_day',      icon: '🚀', label: 'Moon Shot',      desc: 'Achieve 2x target in a day', check: h => h.some(r => r.achievedPerc >= r.targetPerc * 2) },
  { id: 'discipline',   icon: '🧘', label: 'Disciplined',    desc: '20 days ≤ 3 trades each',    check: h => h.filter(r => r.trades <= 3).length >= 20 },
  { id: 'comeback',     icon: '🔄', label: 'Comeback King',  desc: 'Profit after 3 losses',      check: h => hasComebackPattern(h) },
];

function getMaxStreak(history) {
  let max = 0, cur = 0;
  for (const r of history) {
    if (r.pnl >= 0) { cur++; max = Math.max(max, cur); }
    else cur = 0;
  }
  return max;
}

function hasComebackPattern(history) {
  for (let i = 3; i < history.length; i++) {
    const last3 = history.slice(i - 3, i);
    if (last3.every(r => r.pnl < 0) && history[i].pnl > 0) return true;
  }
  return false;
}

function getCurrentStreak(history) {
  let streak = 0;
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].pnl >= 0) streak++;
    else break;
  }
  return streak;
}

// =====================================================
//  SCORE CALCULATIONS (each returns 0-100)
// =====================================================

/**
 * Win Rate Score
 * Base: profitable days / total days
 * Bonus: current streak adds up to 15 points
 */
function calcWinRate(history) {
  if (!history.length) return 0;
  const wins = history.filter(r => r.pnl >= 0).length;
  const base = (wins / history.length) * 100;
  const streakBonus = Math.min(15, getCurrentStreak(history) * 2);
  return Math.min(100, base + streakBonus);
}

/**
 * Consistency Score — Exponential Moving Average of target-hit-rate
 * Recent days weighted heavier (alpha = 0.2)
 * Penalizes high variance.
 */
function calcConsistency(history) {
  if (!history.length) return 0;
  const alpha = 0.2;
  let ema = history[0].achievedPerc >= history[0].targetPerc ? 100 : 0;
  for (let i = 1; i < history.length; i++) {
    const hit = history[i].achievedPerc >= history[i].targetPerc ? 100 : 0;
    ema = alpha * hit + (1 - alpha) * ema;
  }
  // Also factor in low variance of achieved %
  const percValues = history.map(r => r.achievedPerc);
  const mean = percValues.reduce((a, b) => a + b, 0) / percValues.length;
  const variance = percValues.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / percValues.length;
  const stdDev = Math.sqrt(variance);
  const variancePenalty = Math.min(20, stdDev * 1.5);
  return Math.max(0, Math.min(100, ema - variancePenalty));
}

/**
 * Discipline Score
 * Rewards: hitting target with ≤3 trades
 * Penalizes: overtrading (>5 trades)
 * Penalizes: large losses vs balance
 */
function calcDiscipline(history) {
  if (!history.length) return 50; // neutral start
  let score = 50;
  let points = 0;

  for (const r of history) {
    const tradeCount = r.trades || 0;
    const hitTarget = r.achievedPerc >= r.targetPerc;

    if (hitTarget && tradeCount <= 3) points += 2;       // Clean win
    else if (hitTarget) points += 1;                      // Win but overtraded
    else if (!hitTarget && tradeCount > 5) points -= 2;  // Loss + overtraded
    else if (r.pnl < 0) points -= 1;                     // Simple loss
    else points += 0.5;                                   // Break-even or close
  }

  score = 50 + (points / Math.max(history.length, 1)) * 15;
  return Math.max(0, Math.min(100, score));
}

/**
 * Risk Management Score
 * Checks: did losses stay within the expected worst-case range?
 * loss > 20% of capital on any day = heavy penalty
 */
function calcRiskManagement(history) {
  if (!history.length) return 100;
  let score = 100;
  for (const r of history) {
    if (r.pnl < 0) {
      const lossPerc = Math.abs(r.pnl / r.startCap) * 100;
      if (lossPerc > 20) score -= 15;
      else if (lossPerc > 15) score -= 8;
      else if (lossPerc > 10) score -= 3;
    }
  }
  return Math.max(0, Math.min(100, score));
}

// =====================================================
//  COMPOSITE SCORE & XP
// =====================================================
function calcCompositeScore(history) {
  const wr = calcWinRate(history);
  const cs = calcConsistency(history);
  const ds = calcDiscipline(history);
  const rm = calcRiskManagement(history);

  // Weighted average: Win Rate 30%, Consistency 30%, Discipline 25%, Risk 15%
  const composite = wr * 0.30 + cs * 0.30 + ds * 0.25 + rm * 0.15;
  return { composite: Math.round(composite), wr, cs, ds, rm };
}

function calcXP(history) {
  if (!history.length) return 0;
  let xp = 0;
  for (const r of history) {
    // Base XP per day logged
    xp += 10;
    // Profitable
    if (r.pnl > 0) xp += 15;
    // Hit target
    if (r.achievedPerc >= r.targetPerc) xp += 25;
    // Exceeded target by 50%+
    if (r.achievedPerc >= r.targetPerc * 1.5) xp += 20;
    // Clean trade (≤3 trades)
    if ((r.trades || 0) <= 3 && r.pnl >= 0) xp += 10;
  }

  // Streak multiplier
  const streak = getCurrentStreak(history);
  if (streak >= 10) xp = Math.floor(xp * 1.3);
  else if (streak >= 5) xp = Math.floor(xp * 1.15);

  return xp;
}

function getTier(xp) {
  let tier = TIERS[0];
  for (const t of TIERS) {
    if (xp >= t.minXP) tier = t;
  }
  return tier;
}

function getNextTier(xp) {
  for (const t of TIERS) {
    if (xp < t.minXP) return t;
  }
  return null; // already Legend
}

function getXPProgress(xp) {
  const tier = getTier(xp);
  const next = getNextTier(xp);
  if (!next) return { pct: 100, xpInTier: 0, xpNeeded: 0 };
  const xpInTier = xp - tier.minXP;
  const xpNeeded = next.minXP - tier.minXP;
  return { pct: Math.min(100, (xpInTier / xpNeeded) * 100), xpInTier, xpNeeded };
}

function getUnlockedAchievements(history) {
  return ACHIEVEMENTS.map(a => ({ ...a, unlocked: a.check(history) }));
}

function getScoreLabel(score) {
  if (score >= 85) return { label: 'Exceptional', color: '#00c88c' };
  if (score >= 70) return { label: 'Strong',      color: '#00b4d8' };
  if (score >= 55) return { label: 'Developing',  color: '#f59e0b' };
  if (score >= 40) return { label: 'Struggling',  color: '#f97316' };
  return { label: 'Critical', color: '#ef4444' };
}
