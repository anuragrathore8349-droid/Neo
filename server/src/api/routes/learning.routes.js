const express = require('express');
const { authMiddleware } = require('../middlewares/auth.middleware');
const learningController = require('../controllers/learning.controller');

const router = express.Router();

// Public routes - Content retrieval
router.get('/articles', learningController.getArticles);
router.get('/articles/:id', learningController.getArticleById);

router.get('/videos', learningController.getVideos);
router.get('/videos/:id', learningController.getVideoById);

router.get('/glossary', learningController.getGlossaryTerms);
router.get('/glossary/:id', learningController.getGlossaryTermById);
router.get('/glossary/search', learningController.searchGlossaryTerm);

router.get('/guides', learningController.getGuides);
router.get('/guides/:id', learningController.getGuideById);

// Statistics and featured content
router.get('/stats', learningController.getContentStats);
router.get('/featured', learningController.getFeaturedContent);

// Live news route
router.get('/news', learningController.getLiveNews);

// External content sync (protected - requires authentication)
router.post('/sync/external', authMiddleware, learningController.syncExternalContent);
router.post('/sync/schedule', authMiddleware, learningController.startPeriodicSync);

// Protected routes - Content creation (admin only)
router.use(authMiddleware);

router.post('/articles', learningController.createArticle);
router.post('/videos', learningController.createVideo);
router.post('/glossary', learningController.createGlossaryTerm);
router.post('/guides', learningController.createGuide);

module.exports = router;
