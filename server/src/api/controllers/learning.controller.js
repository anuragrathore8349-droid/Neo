const { Article, Video, GlossaryTerm, Guide } = require('../../models/learning.model');
const { logger } = require('../middlewares/logger.middleware');

class LearningController {
  // Article methods
  async getArticles(req, res, next) {
    try {
      logger.debug('Getting articles with query:', req.query);
      
      const { category, difficulty, search, limit = 12, skip = 0 } = req.query;
      let query = {};

      if (category) query.category = category;
      if (difficulty) query.difficulty = difficulty;
      if (search) {
        query.$or = [
          { title: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } }
        ];
      }

      const articles = await Article.find(query)
        .limit(parseInt(limit))
        .skip(parseInt(skip))
        .sort({ createdAt: -1 })
        .lean();

      const total = await Article.countDocuments(query);

      // Increment view count asynchronously
      if (articles.length > 0) {
        Article.updateMany({ _id: { $in: articles.map(a => a._id) } }, { $inc: { views: 1 } }).catch(err => logger.error('View count update failed:', err));
      }

      logger.debug(`Retrieved ${articles.length} articles`);
      
      res.json({
        success: true,
        data: articles,
        pagination: {
          total,
          limit: parseInt(limit),
          skip: parseInt(skip)
        }
      });
    } catch (error) {
      logger.error('Error fetching articles:', error.message, error.stack);
      next(error);
    }
  }

  async getArticleById(req, res, next) {
    try {
      const { id } = req.params;
      const article = await Article.findByIdAndUpdate(
        id,
        { $inc: { views: 1 } },
        { new: true }
      ).lean();

      if (!article) {
        return res.status(404).json({ success: false, message: 'Article not found' });
      }

      res.json({ success: true, data: article });
    } catch (error) {
      logger.error('Error fetching article:', error);
      next(error);
    }
  }

  async createArticle(req, res, next) {
    try {
      const { title, description, content, category, readTime, thumbnail, difficulty, author, tags } = req.body;

      const article = new Article({
        title,
        description,
        content,
        category,
        readTime,
        thumbnail,
        difficulty,
        author: author || 'Learning Team',
        tags: tags || []
      });

      await article.save();
      res.status(201).json({ success: true, data: article });
    } catch (error) {
      logger.error('Error creating article:', error);
      next(error);
    }
  }

  // Video methods
  async getVideos(req, res, next) {
    try {
      const { category, difficulty, instructor, search, limit = 12, skip = 0 } = req.query;
      let query = {};

      if (category) query.category = category;
      if (difficulty) query.difficulty = difficulty;
      if (instructor) query.instructor = instructor;
      if (search) {
        query.$or = [
          { title: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } }
        ];
      }

      const videos = await Video.find(query)
        .limit(parseInt(limit))
        .skip(parseInt(skip))
        .sort({ createdAt: -1 })
        .lean();

      const total = await Video.countDocuments(query);

      // Increment view count asynchronously
      if (videos.length > 0) {
        Video.updateMany({ _id: { $in: videos.map(v => v._id) } }, { $inc: { views: 1 } }).catch(err => logger.error('View count update failed:', err));
      }

      res.json({
        success: true,
        data: videos,
        pagination: {
          total,
          limit: parseInt(limit),
          skip: parseInt(skip)
        }
      });
    } catch (error) {
      logger.error('Error fetching videos:', error);
      next(error);
    }
  }

  async getVideoById(req, res, next) {
    try {
      const { id } = req.params;
      const video = await Video.findByIdAndUpdate(
        id,
        { $inc: { views: 1 } },
        { new: true }
      ).lean();

      if (!video) {
        return res.status(404).json({ success: false, message: 'Video not found' });
      }

      res.json({ success: true, data: video });
    } catch (error) {
      logger.error('Error fetching video:', error);
      next(error);
    }
  }

  async createVideo(req, res, next) {
    try {
      const { title, description, thumbnail, videoUrl, duration, instructor, category, difficulty, tags } = req.body;

      const video = new Video({
        title,
        description,
        thumbnail,
        videoUrl,
        duration,
        instructor,
        category,
        difficulty,
        tags: tags || []
      });

      await video.save();
      res.status(201).json({ success: true, data: video });
    } catch (error) {
      logger.error('Error creating video:', error);
      next(error);
    }
  }

  // Glossary methods
  async getGlossaryTerms(req, res, next) {
    try {
      const { category, search, limit = 12, skip = 0 } = req.query;
      let query = {};

      if (category) query.category = category;
      if (search) {
        query.$or = [
          { term: { $regex: search, $options: 'i' } },
          { definition: { $regex: search, $options: 'i' } }
        ];
      }

      const terms = await GlossaryTerm.find(query)
        .limit(parseInt(limit))
        .skip(parseInt(skip))
        .sort({ term: 1 })
        .lean();

      const total = await GlossaryTerm.countDocuments(query);

      res.json({
        success: true,
        data: terms,
        pagination: {
          total,
          limit: parseInt(limit),
          skip: parseInt(skip)
        }
      });
    } catch (error) {
      logger.error('Error fetching glossary terms:', error);
      next(error);
    }
  }

  async getGlossaryTermById(req, res, next) {
    try {
      const { id } = req.params;
      const term = await GlossaryTerm.findById(id).lean();

      if (!term) {
        return res.status(404).json({ success: false, message: 'Glossary term not found' });
      }

      res.json({ success: true, data: term });
    } catch (error) {
      logger.error('Error fetching glossary term:', error);
      next(error);
    }
  }

  async searchGlossaryTerm(req, res, next) {
    try {
      const { q } = req.query;

      if (!q || q.length < 2) {
        return res.status(400).json({ success: false, message: 'Search query must be at least 2 characters' });
      }

      const terms = await GlossaryTerm.find({
        $or: [
          { term: { $regex: q, $options: 'i' } },
          { definition: { $regex: q, $options: 'i' } },
          { relatedTerms: { $regex: q, $options: 'i' } }
        ]
      }).limit(10).lean();

      res.json({ success: true, data: terms });
    } catch (error) {
      logger.error('Error searching glossary:', error);
      next(error);
    }
  }

  async createGlossaryTerm(req, res, next) {
    try {
      const { term, definition, detailedExplanation, category, relatedTerms, example, references } = req.body;

      const glossaryTerm = new GlossaryTerm({
        term,
        definition,
        detailedExplanation: detailedExplanation || '',
        category,
        relatedTerms: relatedTerms || [],
        example: example || '',
        references: references || []
      });

      await glossaryTerm.save();
      res.status(201).json({ success: true, data: glossaryTerm });
    } catch (error) {
      logger.error('Error creating glossary term:', error);
      next(error);
    }
  }

  // Guide methods
  async getGuides(req, res, next) {
    try {
      const { category, difficulty, search, limit = 12, skip = 0 } = req.query;
      let query = {};

      if (category) query.category = category;
      if (difficulty) query.difficulty = difficulty;
      if (search) {
        query.$or = [
          { title: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } }
        ];
      }

      const guides = await Guide.find(query)
        .limit(parseInt(limit))
        .skip(parseInt(skip))
        .sort({ createdAt: -1 })
        .lean();

      const total = await Guide.countDocuments(query);

      res.json({
        success: true,
        data: guides,
        pagination: {
          total,
          limit: parseInt(limit),
          skip: parseInt(skip)
        }
      });
    } catch (error) {
      logger.error('Error fetching guides:', error);
      next(error);
    }
  }

  async getGuideById(req, res, next) {
    try {
      const { id } = req.params;
      const guide = await Guide.findById(id).lean();

      if (!guide) {
        return res.status(404).json({ success: false, message: 'Guide not found' });
      }

      res.json({ success: true, data: guide });
    } catch (error) {
      logger.error('Error fetching guide:', error);
      next(error);
    }
  }

  async createGuide(req, res, next) {
    try {
      const { title, description, content, category, difficulty, author, estimatedReadTime, tags, sections } = req.body;

      const guide = new Guide({
        title,
        description,
        content,
        category,
        difficulty,
        author: author || 'Learning Team',
        estimatedReadTime,
        tags: tags || [],
        sections: sections || []
      });

      await guide.save();
      res.status(201).json({ success: true, data: guide });
    } catch (error) {
      logger.error('Error creating guide:', error);
      next(error);
    }
  }

  // Statistics
  async getContentStats(req, res, next) {
    try {
      const stats = {
        articles: await Article.countDocuments(),
        videos: await Video.countDocuments(),
        glossaryTerms: await GlossaryTerm.countDocuments(),
        guides: await Guide.countDocuments(),
        categories: {
          articles: await Article.distinct('category'),
          videos: await Video.distinct('category'),
          guides: await Guide.distinct('category')
        }
      };

      res.json({ success: true, data: stats });
    } catch (error) {
      logger.error('Error fetching content stats:', error);
      next(error);
    }
  }

  async getFeaturedContent(req, res, next) {
    try {
      const featured = {
        articles: await Article.find().sort({ views: -1, rating: { average: -1 } }).limit(3).lean(),
        videos: await Video.find().sort({ views: -1, rating: { average: -1 } }).limit(3).lean(),
        guides: await Guide.find().sort({ rating: { average: -1 } }).limit(2).lean()
      };

      res.json({ success: true, data: featured });
    } catch (error) {
      logger.error('Error fetching featured content:', error);
      next(error);
    }
  }

  // External Content Sync
  async syncExternalContent(req, res, next) {
    try {
      const externalContentService = require('../../services/external-content.service');
      const results = await externalContentService.syncExternalContent();

      res.json({
        success: true,
        message: 'External content synced successfully',
        data: results
      });
    } catch (error) {
      logger.error('Error syncing external content:', error);
      next(error);
    }
  }

  async startPeriodicSync(req, res, next) {
    try {
      const { intervalHours = 24 } = req.body;
      const externalContentService = require('../../services/external-content.service');
      
      externalContentService.schedulePeriodicSync(intervalHours);

      res.json({
        success: true,
        message: `Periodic sync started with interval of ${intervalHours} hours`,
        interval: intervalHours
      });
    } catch (error) {
      logger.error('Error starting periodic sync:', error);
      next(error);
    }
  }

  // Live News
  async getLiveNews(req, res, next) {
    try {
      const { symbol } = req.query;
      const learningService = require('../../services/learning.service');
      const news = await learningService.getLiveNews(symbol || null);
      res.json({ success: true, data: news });
    } catch (error) {
      logger.error('Error fetching live news:', error);
      next(error);
    }
  }
}

module.exports = new LearningController();
