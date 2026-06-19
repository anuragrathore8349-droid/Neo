const mongoose = require('mongoose');

// Article Schema
const articleSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    index: true
  },
  description: {
    type: String,
    required: true
  },
  content: {
    type: String,
    required: true
  },
  category: {
    type: String,
    required: true,
    enum: ['DeFi', 'Trading', 'Blockchain', 'Security', 'NFT', 'Staking'],
    index: true
  },
  readTime: {
    type: Number,
    required: true
  },
  thumbnail: {
    type: String,
    required: true
  },
  difficulty: {
    type: String,
    required: true,
    enum: ['beginner', 'intermediate', 'advanced'],
    index: true
  },
  author: {
    type: String,
    default: 'Learning Team'
  },
  views: {
    type: Number,
    default: 0
  },
  rating: {
    average: {
      type: Number,
      default: 0,
      min: 0,
      max: 5
    },
    count: {
      type: Number,
      default: 0
    }
  },
  tags: [String],
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Video Schema
const videoSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    index: true
  },
  description: {
    type: String,
    required: true
  },
  thumbnail: {
    type: String,
    required: true
  },
  videoUrl: {
    type: String,
    required: true
  },
  duration: {
    type: String,
    required: true
  },
  instructor: {
    type: String,
    required: true,
    index: true
  },
  views: {
    type: Number,
    default: 0
  },
  category: {
    type: String,
    required: true,
    enum: ['DeFi', 'Trading', 'Blockchain', 'Security', 'NFT', 'Staking'],
    index: true
  },
  difficulty: {
    type: String,
    required: true,
    enum: ['beginner', 'intermediate', 'advanced']
  },
  rating: {
    average: {
      type: Number,
      default: 0,
      min: 0,
      max: 5
    },
    count: {
      type: Number,
      default: 0
    }
  },
  tags: [String],
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Glossary Term Schema
const glossarySchema = new mongoose.Schema({
  term: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  definition: {
    type: String,
    required: true
  },
  detailedExplanation: {
    type: String,
    default: ''
  },
  category: {
    type: String,
    required: true,
    enum: ['DeFi', 'Trading', 'Blockchain', 'Security', 'NFT', 'Staking'],
    index: true
  },
  relatedTerms: [String],
  example: {
    type: String,
    default: ''
  },
  references: [
    {
      title: String,
      url: String
    }
  ],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Guide Schema
const guideSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    index: true
  },
  description: {
    type: String,
    required: true
  },
  content: {
    type: String,
    required: true
  },
  category: {
    type: String,
    required: true,
    enum: ['DeFi', 'Trading', 'Blockchain', 'Security', 'NFT', 'Staking'],
    index: true
  },
  difficulty: {
    type: String,
    required: true,
    enum: ['beginner', 'intermediate', 'advanced'],
    index: true
  },
  author: {
    type: String,
    default: 'Learning Team'
  },
  rating: {
    average: {
      type: Number,
      default: 0,
      min: 0,
      max: 5
    },
    count: {
      type: Number,
      default: 0
    }
  },
  estimatedReadTime: {
    type: Number,
    required: true
  },
  tags: [String],
  sections: [
    {
      title: String,
      content: String
    }
  ],
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

const Article = mongoose.model('Article', articleSchema);
const Video = mongoose.model('Video', videoSchema);
const GlossaryTerm = mongoose.model('GlossaryTerm', glossarySchema);
const Guide = mongoose.model('Guide', guideSchema);

module.exports = {
  Article,
  Video,
  GlossaryTerm,
  Guide
};
