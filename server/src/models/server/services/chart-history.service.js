const axios = require('axios');
const DefiChart = require('../models/defi-chart.model');

class ChartHistoryService {
  // Fetch 30-day TVL history for a Uniswap pool from TheGraph
  async fetchUniswapPoolHistory(poolId) {
    const query = `{
      poolDayDatas(first: 30, orderBy: date, orderDirection: desc, where: { pool: "${poolId}" }) {
        date tvlUSD volumeUSD feesUSD
      }
    }`;
    const res = await axios.post(UNISWAP_THEGRAPH_URL, { query });
    const days = res.data.data.poolDayDatas;

    const chartData = days.map(d => ({
      date: new Date(d.date * 1000),
      value: parseFloat(d.tvlUSD)
    }));

    await DefiChart.findOneAndUpdate(
      { entityId: poolId, entityType: 'pool', metric: 'tvl' },
      { data: chartData, lastUpdated: new Date() },
      { upsert: true }
    );
    return chartData;
  }

  // Fetch 30-day APY history for Curve pool
  async fetchCurvePoolHistory(poolAddress) {
    const res = await axios.get(`https://api.curve.fi/api/getSubgraphData/ethereum`);
    // extract daily APY for the specific pool and store
  }

  // Get stored chart data (with staleness check)
  async getChartData(entityId, entityType, metric, maxAgeMinutes = 60) {
    const doc = await DefiChart.findOne({ entityId, entityType, metric });
    if (doc && (Date.now() - doc.lastUpdated) < maxAgeMinutes * 60000) {
      return doc.data;
    }
    // Re-fetch if stale
    return this.fetchAndStore(entityId, entityType, metric);
  }
}

module.exports = new ChartHistoryService();