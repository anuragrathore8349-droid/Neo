const natural = require('natural');
const { logger } = require('../api/middlewares/logger.middleware');

const analyzeSentiment = async (text) => {
  try {
    const analyzer = new natural.SentimentAnalyzer();
    const tokenizer = new natural.WordTokenizer();
    
    // Preprocess text
    const processedText = preprocessText(text);
    
    // Tokenize
    const tokens = tokenizer.tokenize(processedText);
    
    // Get base sentiment score
    const baseSentiment = analyzer.getSentiment(tokens);
    
    // Enhance sentiment analysis with additional features
    const enhancedSentiment = enhanceSentimentAnalysis(text, baseSentiment);
    
    return {
      score: enhancedSentiment.score,
      label: getSentimentLabel(enhancedSentiment.score),
      confidence: calculateConfidence(enhancedSentiment),
      features: enhancedSentiment.features
    };
  } catch (error) {
    logger.error('Error analyzing sentiment:', error);
    throw error;
  }
};

const preprocessText = (text) => {
  // Convert to lowercase
  let processed = text.toLowerCase();
  
  // Remove URLs
  processed = processed.replace(/https?:\/\/\S+/g, '');
  
  // Remove special characters
  processed = processed.replace(/[^\w\s]/g, '');
  
  // Remove extra whitespace
  processed = processed.replace(/\s+/g, ' ').trim();
  
  return processed;
};

const enhanceSentimentAnalysis = (text, baseSentiment) => {
  const features = {
    emoticons: analyzeEmoticons(text),
    emphasis: analyzeEmphasis(text),
    marketTerms: analyzeMarketTerms(text),
    subjectivity: analyzeSubjectivity(text)
  };
  
  // Adjust base sentiment based on features
  let adjustedScore = baseSentiment;
  
  // Adjust for emoticons
  adjustedScore += features.emoticons.score * 0.2;
  
  // Adjust for emphasis
  adjustedScore += features.emphasis.score * 0.1;
  
  // Adjust for market-specific terms
  adjustedScore += features.marketTerms.score * 0.3;
  
  // Normalize final score to [-1, 1] range
  const normalizedScore = Math.max(-1, Math.min(1, adjustedScore));
  
  return {
    score: normalizedScore,
    features,
    confidence: calculateFeatureConfidence(features)
  };
};

const analyzeEmoticons = (text) => {
  const positiveEmoticons = /[:;]-?[\)D]/g;
  const negativeEmoticons = /[:;]-?[\(]/g;
  
  const positive = (text.match(positiveEmoticons) || []).length;
  const negative = (text.match(negativeEmoticons) || []).length;
  
  return {
    score: (positive - negative) * 0.1,
    positive,
    negative
  };
};

const analyzeEmphasis = (text) => {
  const exclamations = (text.match(/!/g) || []).length;
  const allCaps = (text.match(/\b[A-Z]{2,}\b/g) || []).length;
  
  return {
    score: (exclamations + allCaps) * 0.05,
    exclamations,
    allCaps
  };
};

const analyzeMarketTerms = (text) => {
  const bullishTerms = /\b(bull|buy|long|growth|profit|gain|up|rally|surge)\b/gi;
  const bearishTerms = /\b(bear|sell|short|loss|crash|down|dip|dump)\b/gi;
  
  const bullish = (text.match(bullishTerms) || []).length;
  const bearish = (text.match(bearishTerms) || []).length;
  
  return {
    score: (bullish - bearish) * 0.15,
    bullish,
    bearish
  };
};

const analyzeSubjectivity = (text) => {
  const subjectiveTerms = /\b(think|believe|feel|suspect|assume|expect)\b/gi;
  const factualTerms = /\b(is|are|was|were|fact|data|report|show)\b/gi;
  
  const subjective = (text.match(subjectiveTerms) || []).length;
  const factual = (text.match(factualTerms) || []).length;
  
  return {
    score: factual > subjective ? 0.1 : -0.1,
    subjective,
    factual
  };
};

const getSentimentLabel = (score) => {
  if (score > 0.2) return 'positive';
  if (score < -0.2) return 'negative';
  return 'neutral';
};

const calculateConfidence = (sentiment) => {
  const featureConfidence = calculateFeatureConfidence(sentiment.features);
  const scoreConfidence = Math.abs(sentiment.score) * 50 + 50;
  
  return Math.round((featureConfidence + scoreConfidence) / 2);
};

const calculateFeatureConfidence = (features) => {
  const weights = {
    emoticons: 0.2,
    emphasis: 0.1,
    marketTerms: 0.4,
    subjectivity: 0.3
  };
  
  let totalConfidence = 0;
  let totalWeight = 0;
  
  Object.entries(features).forEach(([feature, data]) => {
    const weight = weights[feature];
    const featureConfidence = calculateFeatureSpecificConfidence(feature, data);
    totalConfidence += featureConfidence * weight;
    totalWeight += weight;
  });
  
  return Math.round((totalConfidence / totalWeight) * 100);
};

const calculateFeatureSpecificConfidence = (feature, data) => {
  switch (feature) {
    case 'emoticons':
      return Math.min(1, (data.positive + data.negative) / 5);
    case 'emphasis':
      return Math.min(1, (data.exclamations + data.allCaps) / 10);
    case 'marketTerms':
      return Math.min(1, (data.bullish + data.bearish) / 8);
    case 'subjectivity':
      return Math.min(1, (data.factual / (data.subjective + data.factual)) || 0.5);
    default:
      return 0.5;
  }
};

module.exports = {
  analyzeSentiment
};