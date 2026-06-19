/**
 * External APIs Integration for Learning Center
 * Fetches content from various external sources
 */

const axios = require('axios');
const { Article, Video, GlossaryTerm, Guide } = require('../models/learning.model');
const { logger } = require('../api/middlewares/logger.middleware');

class ExternalContentService {

  /**
   * Fetch articles from Dev.to
   */
  async fetchArticlesFromDevTo() {
    try {
      const response = await axios.get('https://dev.to/api/articles', {
        params: {
          tag: 'cryptocurrency,blockchain,defi,trading',
          per_page: 10,
          state: 'published'
        }
      });

      return response.data.map(article => ({
        title: article.title,
        description: article.description || article.body_markdown?.substring(0, 200),
        content: article.body_markdown,
        category: this.categorizeContent(article.tag_list),
        readTime: Math.ceil(article.body_markdown?.split(' ').length / 200) || 5,
        thumbnail: article.cover_image || 'https://via.placeholder.com/300',
        difficulty: 'beginner',
        author: article.user.name,
        tags: article.tag_list || []
      }));

    } catch (error) {
      logger.error('Error fetching from Dev.to:', error.message);
      return [];
    }
  }

  /**
   * Fetch articles from Medium (placeholder)
   */
  async fetchArticlesFromMedium() {
    try {
      const response = await axios.get('https://medium.com/feed/tag/cryptocurrency', {
        responseType: 'text'
      });

      logger.info('Medium RSS fetch requires XML parsing');
      return [];

    } catch (error) {
      logger.error('Error fetching from Medium:', error.message);
      return [];
    }
  }

  /**
   * Fetch videos from YouTube API
   */
async fetchVideosFromYouTube() {
  try {
    const apiKey = process.env.YOUTUBE_API_KEY;

    if (!apiKey) {
      logger.warn('YouTube API key not configured');
      return [];
    }

    const queries = [
      'cryptocurrency for beginners English',
      'blockchain explained English',
      'DeFi tutorial English',
      'crypto trading strategy English'
    ];

    const allowedChannels = [
      'Coin Bureau',
      'Whiteboard Crypto',
      'Finematics',
      'Binance Academy',
      'Coinbase',
      'Kraken',
      'Investopedia',
      'Simplilearn',
      'freeCodeCamp.org'
    ];

    let allItems = [];

    // 🔁 Fetch from multiple queries
    for (const q of queries) {
      const response = await axios.get('https://www.googleapis.com/youtube/v3/search', {
        params: {
          part: 'snippet',
          q,
          type: 'video',
          maxResults: 10,
          key: apiKey,
          order: 'relevance',
          relevanceLanguage: 'en',
          videoDuration: 'medium',
          safeSearch: 'strict'
        }
      });

      allItems.push(...response.data.items);
    }

    // 🔥 FILTER + CLEAN
    const videos = allItems
      .filter(item => {
        const title = item.snippet.title.toLowerCase();
        const channel = item.snippet.channelTitle.toLowerCase();

        // ❌ Remove shorts / spam
        if (title.includes('shorts') || title.includes('#shorts')) return false;

        // ❌ Remove non-English hint (basic filter)
        if (/[\u0900-\u097F]/.test(title)) return false; // Hindi chars

        // ✅ Allow only trusted channels
        return allowedChannels.some(ch =>
          channel.includes(ch.toLowerCase())
        );
      })
      .map(item => {
        const videoId = item.id.videoId;

        return {
          title: item.snippet.title,
          description: item.snippet.description,
          thumbnail: item.snippet.thumbnails.high.url,
          videoUrl: `https://www.youtube.com/watch?v=${videoId}`,
          duration: '0:00',
          instructor: item.snippet.channelTitle,
          category: this.categorizeContent(item.snippet.tags || []),
          difficulty: 'beginner',
          tags: item.snippet.tags || []
        };
      });

    logger.info(`Filtered ${videos.length} high-quality videos`);
    return videos;

  } catch (error) {
    logger.error('Error fetching from YouTube:', error.message);
    return [];
  }
}
  /**
   * Fetch glossary
   */
  async fetchCryptoGlossary() {
    try {
      await axios.get('https://api.coingecko.com/api/v3/global', { timeout: 10000 });

      return [
        {
          term: 'Market Cap',
          definition: 'Total market capitalization of a cryptocurrency',
          category: 'Trading',
          example: 'Bitcoin market cap represents total BTC value'
        },
        {
          term: 'Volume',
          definition: 'Total trading volume in 24 hours',
          category: 'Trading',
          example: '24h volume shows trading activity'
        }
      ];

    } catch (error) {
      logger.error('Error fetching crypto glossary:', error.message);
      return [];
    }
  }

  /**
   * Fetch guides (placeholder)
   */
  async fetchEducationalGuides() {
    try {
      await axios.get('https://www.blockchain.com/learn', { timeout: 10000 });
      logger.info('Guide scraping requires HTML parsing');
      return [];

    } catch (error) {
      logger.error('Error fetching guides:', error.message);
      return [];
    }
  }

  /**
   * Categorization
   */
  categorizeContent(tags) {
    const categoryMap = {
      'defi': 'DeFi',
      'trading': 'Trading',
      'blockchain': 'Blockchain',
      'security': 'Security',
      'nft': 'NFT',
      'staking': 'Staking',
      'ethereum': 'Blockchain',
      'bitcoin': 'Blockchain',
      'crypto': 'Trading'
    };

    if (!Array.isArray(tags)) tags = [tags];

    for (let tag of tags) {
      const lower = tag.toLowerCase();
      for (let [key, value] of Object.entries(categoryMap)) {
        if (lower.includes(key)) return value;
      }
    }

    return 'Blockchain';
  }

  /**
   * MAIN SYNC (NO DUPLICATES)
   */
  async syncExternalContent() {
    try {
      logger.info('🚀 Starting external content sync...');

      const results = {
        articlesAdded: 0,
        videosAdded: 0,
        glossaryAdded: 0,
        guidesAdded: 0,
        errors: []
      };

      // ARTICLES
      try {
        const articles = await this.fetchArticlesFromDevTo();

        for (const article of articles) {
          const res = await Article.updateOne(
            { title: article.title },
            { $setOnInsert: article },
            { upsert: true }
          );

          if (res.upsertedCount > 0) results.articlesAdded++;
        }

      } catch (error) {
        results.errors.push(`Dev.to: ${error.message}`);
      }

      // VIDEOS
      try {
        const videos = await this.fetchVideosFromYouTube();

        for (const video of videos) {
          const res = await Video.updateOne(
            { title: video.title },
            { $setOnInsert: video },
            { upsert: true }
          );

          if (res.upsertedCount > 0) results.videosAdded++;
        }

      } catch (error) {
        results.errors.push(`YouTube: ${error.message}`);
      }

      // GLOSSARY
      try {
        const glossary = await this.fetchCryptoGlossary();

        for (const term of glossary) {
          const res = await GlossaryTerm.updateOne(
            { term: term.term },
            { $setOnInsert: term },
            { upsert: true }
          );

          if (res.upsertedCount > 0) results.glossaryAdded++;
        }

      } catch (error) {
        results.errors.push(`Glossary: ${error.message}`);
      }

      // GUIDES (optional)
      try {
        const guides = await this.fetchEducationalGuides();

        for (const guide of guides) {
          const res = await Guide.updateOne(
            { title: guide.title },
            { $setOnInsert: guide },
            { upsert: true }
          );

          if (res.upsertedCount > 0) results.guidesAdded++;
        }

      } catch (error) {
        results.errors.push(`Guides: ${error.message}`);
      }

      logger.info('✅ Content sync completed', results);
      return results;

    } catch (error) {
      logger.error('❌ External content sync failed:', error);
      throw error;
    }
  }

  /**
   * Schedule periodic sync
   */
  schedulePeriodicSync(intervalHours = 24) {
    const intervalMs = intervalHours * 60 * 60 * 1000;

    setInterval(async () => {
      try {
        await this.syncExternalContent();
      } catch (error) {
        logger.error('Scheduled sync failed:', error);
      }
    }, intervalMs);

    logger.info(`⏱ Scheduled external content sync every ${intervalHours} hours`);
  }
}

module.exports = new ExternalContentService();