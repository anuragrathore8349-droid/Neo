'use strict';

/**
 * neoChatEngine.js
 * Zero-dependency, zero-API-cost Portfolio Chat reasoning engine.
 * Replaces Gemini as the PRIMARY brain for /api/ai/chat.
 */

const { scorePortfolioHealth, findGroup, analyzeTaxLossOpportunities } = require('./neoReasoningEngine');

const INTENTS = [
  { name: 'value', keywords: ['worth', 'value', 'total', 'how much', 'net worth', 'balance'] },
  { name: 'performance', keywords: ['best', 'top', 'perform', 'gain', 'winner', 'doing well', 'doing good'] },
  { name: 'underperformance', keywords: ['worst', 'losing', 'loser', 'drag', 'underperform', 'red', 'down the most', 'bad'] },
  { name: 'risk', keywords: ['risk', 'safe', 'volatil', 'exposure', 'danger'] },
  { name: 'diversification', keywords: ['diversif', 'concentrat', 'spread', 'balanced', 'allocation', 'allocated'] },
  { name: 'rebalance', keywords: ['rebalance', 'should i sell', 'should i buy', 'adjust', 'restructure'] },
  { name: 'tax_loss', keywords: ['tax', 'loss harvest', 'write off', 'deduction'] },
  { name: 'pl', keywords: ['profit', 'loss', 'p&l', 'pnl', 'up or down', 'gain or loss'] },
  { name: 'asset_specific', keywords: [] },
  { name: 'greeting', keywords: ['hi', 'hello', 'hey', 'yo', "what's up", 'sup'] },
  { name: 'help', keywords: ['what can you do', 'help', 'how do you work', 'who are you'] },
];

function classifyIntent(message) {
  const msg = message.toLowerCase();
  let best = { name: 'generic', score: 0 };
  for (const intent of INTENTS) {
    let score = 0;
    for (const kw of intent.keywords) {
      if (msg.includes(kw)) score += kw.length > 6 ? 2 : 1;
    }
    if (score > best.score) best = { name: intent.name, score };
  }
  return best.name;
}

function extractSymbol(message, assets) {
  const msg = message.toUpperCase();
  const held = assets.map((a) => (a.symbol || '').toUpperCase()).filter(Boolean);
  const matches = held.filter((sym) => new RegExp(`\\b${sym}\\b`).test(msg));
  if (matches.length === 0) return null;
  return matches.sort((a, b) => b.length - a.length)[0];
}

function computeStats(assets, marketPrices) {
  const withPL = assets.map((a) => ({
    ...a,
    plPct: typeof a.profitLossPercentage === 'number' ? a.profitLossPercentage : 0,
    change24h: marketPrices?.[a.symbol]?.change24h ?? 0,
  }));
  const sortedByPL = [...withPL].sort((a, b) => b.plPct - a.plPct);
  const best = sortedByPL[0] || null;
  const worst = sortedByPL[sortedByPL.length - 1] || null;
  const avgChange24h = withPL.length
    ? withPL.reduce((s, a) => s + Math.abs(a.change24h || 0), 0) / withPL.length
    : 0;
  return { best, worst, avgChange24h, withPL };
}

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const fmt = (n) => Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });
const pct = (n) => `${Number(n || 0) >= 0 ? '+' : ''}${Number(n || 0).toFixed(2)}%`;

function composeReply(intent, ctx) {
  const { totalValue, totalPL, totalPLPercentage, assets } = ctx;
  switch (intent) {
    case 'value':
      return pick([
        `Your portfolio is currently worth $${fmt(totalValue)} across ${assets.length} position${assets.length === 1 ? '' : 's'}, with an overall P&L of ${pct(totalPLPercentage)} ($${fmt(totalPL)}).`,
        `Right now you're holding $${fmt(totalValue)} total across ${assets.length} asset${assets.length === 1 ? '' : 's'}. That's ${totalPL >= 0 ? 'up' : 'down'} $${fmt(Math.abs(totalPL))} (${pct(totalPLPercentage)}) from your cost basis.`,
      ]);
    case 'performance': {
      const { best } = ctx.stats;
      if (!best) return `You don't have any open positions yet, so there's no performance to show.`;
      const sorted = [...assets].sort((a, b) => (b.profitLossPercentage || 0) - (a.profitLossPercentage || 0)).slice(0, 3);
      const list = sorted.map((a) => `${a.symbol} (${pct(a.profitLossPercentage)})`).join(', ');
      return pick([
        `Your top performer is ${best.symbol}, up ${pct(best.plPct)}. Your strongest holdings overall: ${list}.`,
        `${best.symbol} is leading your book at ${pct(best.plPct)}. Top three by return: ${list}.`,
      ]);
    }
    case 'underperformance': {
      const { worst } = ctx.stats;
      if (!worst) return `You don't have any open positions to evaluate yet.`;
      const losers = assets.filter((a) => (a.profitLossPercentage || 0) < 0)
        .sort((a, b) => (a.profitLossPercentage || 0) - (b.profitLossPercentage || 0)).slice(0, 3);
      const list = losers.length
        ? losers.map((a) => `${a.symbol} (${pct(a.profitLossPercentage)})`).join(', ')
        : 'none — everything is currently in the green';
      return pick([
        `${worst.symbol} is your biggest drag right now at ${pct(worst.plPct)}. Positions currently underwater: ${list}.`,
        `Your weakest position is ${worst.symbol} (${pct(worst.plPct)}). Underwater positions: ${list}.`,
      ]);
    }
    case 'risk': {
      const health = scorePortfolioHealth(assets.map((a) => ({ ...a, value: a.value || a.amount * a.currentPrice })));
      const warn = health.concentrationWarning ? ` ${health.concentrationWarning}` : ' Exposure looks reasonably spread across sectors.';
      return `Your diversification score is ${health.diversificationScore}/100 (100 = perfectly spread, 0 = single asset).${warn} Average 24h volatility across your holdings is ${ctx.stats.avgChange24h.toFixed(2)}%.`;
    }
    case 'diversification': {
      const health = scorePortfolioHealth(assets.map((a) => ({ ...a, value: a.value || a.amount * a.currentPrice })));
      const exposureLines = Object.entries(health.groupExposure).sort((a, b) => b[1] - a[1]).slice(0, 4)
        .map(([g, v]) => `${g}: ${v}%`).join(', ');
      return `Diversification score: ${health.diversificationScore}/100. Sector exposure → ${exposureLines}.${health.concentrationWarning ? ` ⚠️ ${health.concentrationWarning}` : ''}`;
    }
    case 'rebalance': {
      const health = scorePortfolioHealth(assets.map((a) => ({ ...a, value: a.value || a.amount * a.currentPrice })));
      if (health.diversificationScore >= 70) {
        return `Your allocation is already well diversified (score ${health.diversificationScore}/100) — no urgent rebalance needed. Keep monitoring after big market moves.`;
      }
      return `Your diversification score is ${health.diversificationScore}/100.${health.concentrationWarning ? ` ${health.concentrationWarning}` : ''} Consider trimming your largest group and redistributing into under-weighted sectors to bring concentration down.`;
    }
    case 'tax_loss': {
      const result = analyzeTaxLossOpportunities(assets.map((a) => ({
        symbol: a.symbol, name: a.name, amount: a.quantity ?? a.amount,
        costBasis: a.costBasis ?? (a.value && a.quantity ? a.value / a.quantity : 0),
        currentPrice: a.currentPrice, profit: a.profitLoss,
      })));
      if (result.opportunityCount === 0) {
        return `No tax-loss harvesting opportunities right now — none of your positions show an unrealised loss.`;
      }
      const top = result.opportunities[0];
      return `Found ${result.opportunityCount} tax-loss opportunit${result.opportunityCount === 1 ? 'y' : 'ies'} worth up to $${fmt(result.totalPotentialTaxSavings)} in potential tax savings. Largest: ${top.symbol}, down $${fmt(top.lossAmount)}.${top.suggestedSwap ? ` Consider rotating into ${top.suggestedSwap.suggestedSymbol} to preserve exposure.` : ''} This isn't tax advice — consult a professional.`;
    }
    case 'pl':
      return `Overall you're ${totalPL >= 0 ? 'up' : 'down'} $${fmt(Math.abs(totalPL))} (${pct(totalPLPercentage)}) on a total cost basis of $${fmt(ctx.totalCost)}.`;
    case 'greeting':
      return pick([
        `Hey! I'm Neo. Ask me about your portfolio value, top/worst performers, risk, diversification, or tax-loss opportunities.`,
        `Hi there — happy to dig into your holdings. Try asking about performance, risk, or whether you should rebalance.`,
      ]);
    case 'help':
      return `I can answer questions about: total portfolio value, P&L, best/worst performing assets, risk and volatility, diversification/concentration, rebalancing suggestions, tax-loss harvesting opportunities, and specific assets you hold (just mention the symbol, e.g. "how's my ETH doing?").`;
    default:
      return `I can see your portfolio is worth $${fmt(totalValue)} across ${assets.length} holding(s). Try asking about performance, risk, diversification, or a specific asset by symbol.`;
  }
}

function composeAssetReply(symbol, ctx) {
  const asset = ctx.assets.find((a) => (a.symbol || '').toUpperCase() === symbol);
  if (!asset) return `I don't see ${symbol} in your current portfolio.`;
  const group = findGroup(symbol);
  const live = ctx.marketPrices?.[symbol];
  const livePriceLine = live ? ` Live price: $${fmt(live.price)} (${pct(live.change24h)} 24h).` : '';
  return `${symbol} (${asset.name || symbol}): you hold ${asset.quantity ?? asset.amount}, worth $${fmt(asset.value)} (${(asset.allocation || 0).toFixed(1)}% of portfolio). P&L: ${pct(asset.profitLossPercentage)} ($${fmt(asset.profitLoss)}).${livePriceLine} Sector: ${group}.`;
}

function generateChatReply(message, history, portfolioContext, marketPrices = {}) {
  const assets = portfolioContext.assets || [];
  const symbol = extractSymbol(message, assets);
  const stats = computeStats(assets, marketPrices);
  const ctx = { ...portfolioContext, assets, stats, marketPrices };

  let intent = classifyIntent(message);
  let reply;

  if (symbol && (intent === 'generic' || intent === 'asset_specific' || intent === 'pl' || intent === 'performance')) {
    reply = composeAssetReply(symbol, ctx);
    intent = 'asset_specific';
  } else {
    reply = composeReply(intent, ctx);
  }

  return { reply, intent, source: 'neo_reasoning_engine' };
}

module.exports = { generateChatReply, classifyIntent, extractSymbol };