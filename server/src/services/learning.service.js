// server/src/services/learning.service.js — REPLACE ENTIRE FILE
'use strict';

const { Article, Video, GlossaryTerm, Guide } = require('../models/learning.model');
const axios = require('axios');
const { logger } = require('../api/middlewares/logger.middleware');

class LearningService {
  async getArticles({ category, difficulty, search, limit = 12, skip = 0 } = {}) {
    const query = {};
    if (category) query.category = category;
    if (difficulty) query.difficulty = difficulty;
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }
    const [articles, total] = await Promise.all([
      Article.find(query).limit(parseInt(limit)).skip(parseInt(skip)).sort({ createdAt: -1 }).lean(),
      Article.countDocuments(query),
    ]);
    Article.updateMany({ _id: { $in: articles.map(a => a._id) } }, { $inc: { views: 1 } }).catch(() => {});
    return { articles, total };
  }

  async getArticleById(id) {
    return Article.findByIdAndUpdate(id, { $inc: { views: 1 } }, { new: true }).lean();
  }

  async getVideos({ category, difficulty, search, limit = 12, skip = 0 } = {}) {
    const query = {};
    if (category) query.category = category;
    if (difficulty) query.difficulty = difficulty;
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }
    const [videos, total] = await Promise.all([
      Video.find(query).limit(parseInt(limit)).skip(parseInt(skip)).sort({ createdAt: -1 }).lean(),
      Video.countDocuments(query),
    ]);
    return { videos, total };
  }

  async getGlossary({ search, limit = 50, skip = 0 } = {}) {
    const query = search ? { term: { $regex: search, $options: 'i' } } : {};
    const [terms, total] = await Promise.all([
      GlossaryTerm.find(query).sort({ term: 1 }).limit(parseInt(limit)).skip(parseInt(skip)).lean(),
      GlossaryTerm.countDocuments(query),
    ]);
    return { terms, total };
  }

  async getGuides({ category, difficulty, limit = 12, skip = 0 } = {}) {
    const query = {};
    if (category) query.category = category;
    if (difficulty) query.difficulty = difficulty;
    const [guides, total] = await Promise.all([
      Guide.find(query).limit(parseInt(limit)).skip(parseInt(skip)).sort({ createdAt: -1 }).lean(),
      Guide.countDocuments(query),
    ]);
    return { guides, total };
  }

  async getLiveNews(symbol = null) {
    // Try CoinDesk RSS (no auth needed, always available)
    try {
      const Parser = require('rss-parser');
      const parser = new Parser({ timeout: 8000 });
      const feed = await parser.parseURL('https://www.coindesk.com/arc/outboundfeeds/rss/');
      const items = (feed.items || []).slice(0, 20);
      const symbolUpper = symbol?.toUpperCase();
      const filtered = symbolUpper
        ? items.filter(item => (item.title + (item.contentSnippet || '')).toUpperCase().includes(symbolUpper))
        : items;
      return (filtered.length > 0 ? filtered : items).slice(0, 12).map(item => ({
        title: item.title || 'Crypto News',
        url: item.link || '#',
        description: item.contentSnippet?.slice(0, 200) || '',
        publishedAt: item.pubDate || new Date().toISOString(),
        source: 'CoinDesk',
        currencies: symbolUpper ? [symbolUpper] : [],
        sentiment: 'neutral',
        timestamp: item.pubDate || new Date().toISOString(),
      }));
    } catch (rssErr) {
      logger.warn('CoinDesk RSS fetch failed:', rssErr.message);
    }

    // Final fallback: CryptoCompare (completely free, no auth)
    try {
      const resp = await axios.get(
        `https://min-api.cryptocompare.com/data/v2/news/?lang=EN${symbol ? `&categories=${symbol}` : ''}`,
        { timeout: 8000 }
      );
      return (resp.data?.Data || []).slice(0, 12).map(item => ({
        title: item.title,
        url: item.url,
        description: item.body?.slice(0, 200) || '',
        publishedAt: new Date(item.published_on * 1000).toISOString(),
        source: item.source_info?.name || item.source || 'CryptoCompare',
        currencies: (item.categories || '').split('|').filter(Boolean),
        sentiment: 'neutral',
        timestamp: new Date(item.published_on * 1000).toISOString(),
      }));
    } catch (fallbackErr) {
      logger.warn('CryptoCompare news fetch failed:', fallbackErr.message);
      return [];
    }
  }
}

module.exports = new LearningService();