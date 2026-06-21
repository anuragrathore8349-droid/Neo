// FILE: src/models/defi-chart.model.js
// REPLACE ENTIRE FILE

const mongoose = require('mongoose');

const defiChartSchema = new mongoose.Schema({
  entityId: { type: String, required: true, index: true },
  entityType: { type: String, enum: ['pool', 'farm', 'protocol', 'staking'], required: true },
  metric: { type: String, enum: ['tvl', 'apy', 'volume', 'price'], required: true },
  data: [{
    date: { type: Date, required: true },
    value: { type: Number, required: true }
  }],
  lastUpdated: { type: Date, default: Date.now }
}, { timestamps: true });

defiChartSchema.index({ entityId: 1, entityType: 1, metric: 1 }, { unique: true });

// ─── STATIC: get or create chart entry, append today's value ───────────────
defiChartSchema.statics.getOrCreateChart = async function (params) {
  const {
    farmId, protocol, currentApy, tvl,
    estimatedDailyReward, estimatedWeeklyReward, estimatedMonthlyReward
  } = params;

  let chart = await this.findOne({
    entityId: farmId,
    entityType: 'farm',
    metric: 'apy'
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (!chart) {
    chart = new this({
      entityId: farmId,
      entityType: 'farm',
      metric: 'apy',
      data: []
    });
  }

  // Append today's data point only if not already recorded
  const todayExists = chart.data.some(d => {
    const dd = new Date(d.date);
    dd.setHours(0, 0, 0, 0);
    return dd.getTime() === today.getTime();
  });

  if (!todayExists && currentApy != null && !isNaN(currentApy)) {
    chart.data.push({ date: today, value: parseFloat(currentApy) });
    // Keep 90 days max
    if (chart.data.length > 90) chart.data.shift();
  }

  // Store estimated rewards as virtual fields (not persisted, just passed through)
  chart._estimatedDailyReward = estimatedDailyReward || null;
  chart._estimatedWeeklyReward = estimatedWeeklyReward || null;
  chart._estimatedMonthlyReward = estimatedMonthlyReward || null;

  chart.lastUpdated = new Date();
  await chart.save();
  return chart;
};

// ─── STATIC: upsert a TVL data point for a pool ────────────────────────────
defiChartSchema.statics.upsertPoolTvl = async function (poolId, tvlValue) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let chart = await this.findOne({ entityId: poolId, entityType: 'pool', metric: 'tvl' });
  if (!chart) {
    chart = new this({ entityId: poolId, entityType: 'pool', metric: 'tvl', data: [] });
  }

  const todayExists = chart.data.some(d => {
    const dd = new Date(d.date);
    dd.setHours(0, 0, 0, 0);
    return dd.getTime() === today.getTime();
  });

  if (!todayExists) {
    chart.data.push({ date: today, value: parseFloat(tvlValue) || 0 });
    if (chart.data.length > 90) chart.data.shift();
  }

  chart.lastUpdated = new Date();
  await chart.save();
  return chart;
};

// ─── INSTANCE: return last 30 days formatted for frontend charts ────────────
defiChartSchema.methods.get30DayHistory = function () {
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const sorted = [...this.data]
    .filter(d => new Date(d.date).getTime() >= cutoff)
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  // Expose estimated reward fields if set
  const result = sorted.map(d => ({
    date: new Date(d.date).toISOString().split('T')[0],
    apy: parseFloat(d.value.toFixed(4))
  }));

  result.estimatedDailyReward = this._estimatedDailyReward;
  result.estimatedWeeklyReward = this._estimatedWeeklyReward;
  result.estimatedMonthlyReward = this._estimatedMonthlyReward;

  return result;
};

// ─── INSTANCE: return last 30 days as TVL series for pool cards ─────────────
defiChartSchema.methods.get30DayTvlHistory = function () {
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  return [...this.data]
    .filter(d => new Date(d.date).getTime() >= cutoff)
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .map(d => ({
      date: new Date(d.date).toISOString().split('T')[0],
      tvl: parseFloat(d.value)
    }));
};

module.exports = mongoose.model('DefiChart', defiChartSchema);