// server/src/services/learning.service.js
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

  // Fetch live crypto news from CryptoPanic (free, no key needed for public feed)
  async getLiveNews(symbol = null) {
    try {
      const url = symbol
        ? `https://cryptopanic.com/api/v1/posts/?auth_token=free&currencies=${symbol}&kind=news`
        : `https://cryptopanic.com/api/v1/posts/?auth_token=free&kind=news`;
      const resp = await axios.get(url, { timeout: 8000 });
      return (resp.data?.results || []).slice(0, 20).map(item => ({
        title: item.title,
        url: item.url,
        publishedAt: item.published_at,
        source: item.source?.title || 'CryptoPanic',
        currencies: (item.currencies || []).map(c => c.code),
        sentiment: item.votes?.positive > item.votes?.negative ? 'positive' : 'neutral',
      }));
    } catch (err) {
      logger.warn('Live news fetch failed:', err.message);
      return [];
    }
  }
}

module.exports = new LearningService();
