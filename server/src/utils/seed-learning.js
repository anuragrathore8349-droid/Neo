/**
 * Seed script to populate learning content in MongoDB
 * Run with: node src/utils/seed-learning.js
 */

const mongoose = require('mongoose');
const { Article, Video, GlossaryTerm, Guide } = require('../models/learning.model');
const { connectDB } = require('../config/database');

const seedData = {
  articles: [
    {
      title: 'Understanding DeFi Fundamentals',
      description: 'A comprehensive guide to decentralized finance, its key concepts, and how it\'s reshaping the financial landscape.',
      content: 'DeFi represents a paradigm shift in financial services... [Full content here]',
      category: 'DeFi',
      readTime: 12,
      thumbnail: 'https://images.unsplash.com/photo-1639322537228-f710d846310a',
      difficulty: 'beginner',
      author: 'Learning Team',
      tags: ['defi', 'blockchain', 'cryptocurrency'],
    },
    {
      title: 'Advanced Trading Strategies',
      description: 'Learn professional trading techniques, risk management, and market analysis methods used by top traders.',
      content: 'Advanced trading strategies involve multiple techniques... [Full content here]',
      category: 'Trading',
      readTime: 15,
      thumbnail: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3',
      difficulty: 'advanced',
      author: 'Trading Experts',
      tags: ['trading', 'strategies', 'analysis'],
    },
    {
      title: 'Smart Contracts 101',
      description: 'Introduction to smart contracts: what they are, how they work, and their applications in blockchain.',
      content: 'Smart contracts are self-executing programs on the blockchain... [Full content here]',
      category: 'Blockchain',
      readTime: 10,
      thumbnail: 'https://images.unsplash.com/photo-1627873649417-af36141a4016',
      difficulty: 'beginner',
      author: 'Blockchain Academy',
      tags: ['smart-contracts', 'ethereum', 'blockchain'],
    },
    {
      title: 'Security Best Practices',
      description: 'Essential security practices to protect your crypto assets and personal information.',
      content: 'Security is paramount in the crypto space... [Full content here]',
      category: 'Security',
      readTime: 8,
      thumbnail: 'https://images.unsplash.com/photo-1633356122544-f134324ef6db',
      difficulty: 'intermediate',
      author: 'Security Team',
      tags: ['security', 'protection', 'best-practices'],
    },
    {
      title: 'NFT Investment Guide',
      description: 'Understanding NFTs: what they are, how to evaluate them, and investment strategies.',
      content: 'NFTs have revolutionized digital ownership... [Full content here]',
      category: 'NFT',
      readTime: 14,
      thumbnail: 'https://images.unsplash.com/photo-1634361566641-3fb5ba9a2c2d',
      difficulty: 'intermediate',
      author: 'NFT Experts',
      tags: ['nft', 'investment', 'digital-art'],
    },
    {
      title: 'Staking Rewards Explained',
      description: 'Complete guide to earning passive income through cryptocurrency staking.',
      content: 'Staking is a way to earn rewards on your cryptocurrency holdings... [Full content here]',
      category: 'Staking',
      readTime: 9,
      thumbnail: 'https://images.unsplash.com/photo-1625948515291-69613efd103f',
      difficulty: 'beginner',
      author: 'DeFi Masters',
      tags: ['staking', 'passive-income', 'rewards'],
    },
  ],
  videos: [
    {
      title: 'Crypto Trading Masterclass',
      description: 'Complete guide to becoming a professional crypto trader.',
      thumbnail: 'https://images.unsplash.com/photo-1642790551116-18e150f248e5',
      videoUrl: 'https://example.com/video1',
      duration: '45:20',
      instructor: 'Sarah Chen',
      category: 'Trading',
      difficulty: 'advanced',
      tags: ['trading', 'masterclass', 'strategies'],
    },
    {
      title: 'DeFi Yield Farming Guide',
      description: 'Learn how to maximize your returns through yield farming strategies.',
      thumbnail: 'https://images.unsplash.com/photo-1620321023374-d1a68fbc720d',
      videoUrl: 'https://example.com/video2',
      duration: '32:15',
      instructor: 'Michael Brown',
      category: 'DeFi',
      difficulty: 'intermediate',
      tags: ['defi', 'yield-farming', 'passive-income'],
    },
    {
      title: 'Blockchain Technology Explained',
      description: 'Understanding the fundamentals of blockchain technology.',
      thumbnail: 'https://images.unsplash.com/photo-1627873649417-af36141a4016',
      videoUrl: 'https://example.com/video3',
      duration: '28:45',
      instructor: 'Dr. Alex Smith',
      category: 'Blockchain',
      difficulty: 'beginner',
      tags: ['blockchain', 'fundamentals', 'technology'],
    },
    {
      title: 'Security in Crypto',
      description: 'Protect your digital assets with essential security practices.',
      thumbnail: 'https://images.unsplash.com/photo-1633356122544-f134324ef6db',
      videoUrl: 'https://example.com/video4',
      duration: '22:10',
      instructor: 'Security Expert',
      category: 'Security',
      difficulty: 'beginner',
      tags: ['security', 'protection', 'best-practices'],
    },
    {
      title: 'NFT Art and Collectibles',
      description: 'Exploring the world of NFT art and digital collectibles.',
      thumbnail: 'https://images.unsplash.com/photo-1634361566641-3fb5ba9a2c2d',
      videoUrl: 'https://example.com/video5',
      duration: '35:50',
      instructor: 'NFT Curator',
      category: 'NFT',
      difficulty: 'intermediate',
      tags: ['nft', 'art', 'collectibles'],
    },
  ],
  glossaryTerms: [
    {
      term: 'Liquidity Pool',
      definition: 'A crowdsourced pool of cryptocurrencies or tokens locked in a smart contract that is used to facilitate decentralized trading, lending, and other DeFi features.',
      category: 'DeFi',
      relatedTerms: ['AMM', 'Yield Farming', 'Impermanent Loss'],
      example: 'Uniswap uses liquidity pools to enable token swaps.',
    },
    {
      term: 'Smart Contract',
      definition: 'Self-executing contracts with the terms of the agreement directly written into code that automatically enforce and execute the terms when predetermined conditions are met.',
      category: 'Blockchain',
      relatedTerms: ['Ethereum', 'DApp', 'Gas Fees'],
      example: 'An automated loan agreement that executes when collateral is provided.',
    },
    {
      term: 'Yield Farming',
      definition: 'A DeFi practice of earning rewards by providing liquidity to decentralized exchanges or lending protocols.',
      category: 'DeFi',
      relatedTerms: ['Liquidity Pool', 'APY', 'Token Rewards'],
      example: 'Depositing cryptocurrency into a Uniswap pool to earn trading fees.',
    },
    {
      term: 'Gas Fees',
      definition: 'The cost required to execute a transaction or smart contract on a blockchain network, typically measured in gwei or wei.',
      category: 'Blockchain',
      relatedTerms: ['Ethereum', 'Transaction Cost', 'Wei'],
      example: 'A simple Ethereum transfer might cost 21,000 gas units.',
    },
    {
      term: 'Impermanent Loss',
      definition: 'The potential loss that liquidity providers face when the price of assets in a liquidity pool changes relative to when they were deposited.',
      category: 'DeFi',
      relatedTerms: ['Liquidity Pool', 'Slippage', 'AMM'],
      example: 'A 50/50 liquidity provider loses value if one asset appreciates significantly more than the other.',
    },
    {
      term: 'Non-Fungible Token (NFT)',
      definition: 'A unique digital asset that represents ownership of a specific item, artwork, or collectible on the blockchain.',
      category: 'NFT',
      relatedTerms: ['ERC-721', 'Blockchain', 'Digital Asset'],
      example: 'A unique digital artwork sold as an NFT with proof of ownership.',
    },
    {
      term: 'Staking',
      definition: 'The process of holding and validating cryptocurrency in a blockchain network to earn rewards.',
      category: 'Staking',
      relatedTerms: ['Proof of Stake', 'Validator', 'Rewards'],
      example: 'Staking ETH on the Ethereum 2.0 network earns approximately 4-6% annual rewards.',
    },
    {
      term: 'Private Key',
      definition: 'A secret cryptographic key that grants access to your cryptocurrency holdings and must be kept confidential.',
      category: 'Security',
      relatedTerms: ['Public Key', 'Wallet', 'Authentication'],
      example: 'Never share your private key, as anyone with it can access your funds.',
    },
  ],
  guides: [
    {
      title: 'Complete DeFi Strategy Guide',
      description: 'Master the art of DeFi investing with this comprehensive strategy guide.',
      content: 'This comprehensive guide covers all aspects of DeFi investing... [Full content]',
      category: 'DeFi',
      difficulty: 'intermediate',
      estimatedReadTime: 45,
      author: 'DeFi Strategists',
      tags: ['defi', 'strategy', 'investing'],
      sections: [
        { title: 'Introduction to DeFi', content: 'Understanding DeFi fundamentals...' },
        { title: 'Risk Management', content: 'Managing risks in DeFi strategies...' },
        { title: 'Advanced Techniques', content: 'Advanced DeFi investment techniques...' },
      ],
    },
    {
      title: 'Technical Analysis Fundamentals',
      description: 'Learn how to read charts, identify patterns, and make informed trading decisions.',
      content: 'Technical analysis is a crucial skill for traders... [Full content]',
      category: 'Trading',
      difficulty: 'beginner',
      estimatedReadTime: 30,
      author: 'Trading Educators',
      tags: ['trading', 'technical-analysis', 'charts'],
      sections: [
        { title: 'Chart Basics', content: 'Understanding different chart types...' },
        { title: 'Patterns', content: 'Common chart patterns and what they mean...' },
        { title: 'Indicators', content: 'Using technical indicators effectively...' },
      ],
    },
    {
      title: 'Blockchain Security Handbook',
      description: 'Complete guide to securing your blockchain assets and accounts.',
      content: 'Security is the foundation of blockchain safety... [Full content]',
      category: 'Security',
      difficulty: 'intermediate',
      estimatedReadTime: 35,
      author: 'Security Experts',
      tags: ['security', 'blockchain', 'protection'],
      sections: [
        { title: 'Key Management', content: 'Safely managing cryptographic keys...' },
        { title: 'Wallet Security', content: 'Choosing and securing wallets...' },
        { title: 'Best Practices', content: 'Security best practices and habits...' },
      ],
    },
  ],
};

async function seedDatabase() {
  try {
    await connectDB();
    console.log('Connected to database');

    // Clear existing data
    await Article.deleteMany({});
    await Video.deleteMany({});
    await GlossaryTerm.deleteMany({});
    await Guide.deleteMany({});
    console.log('Cleared existing data');

    // Insert new data
    const articles = await Article.insertMany(seedData.articles);
    const videos = await Video.insertMany(seedData.videos);
    const glossaryTerms = await GlossaryTerm.insertMany(seedData.glossaryTerms);
    const guides = await Guide.insertMany(seedData.guides);

    console.log(`✅ Seeded ${articles.length} articles`);
    console.log(`✅ Seeded ${videos.length} videos`);
    console.log(`✅ Seeded ${glossaryTerms.length} glossary terms`);
    console.log(`✅ Seeded ${guides.length} guides`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
}

seedDatabase();
