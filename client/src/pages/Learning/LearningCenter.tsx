import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  Play,
  Book,
  FileText,
  Search,
  Filter,
  GraduationCap,
  Loader,
  AlertCircle,
} from 'lucide-react';
import { apiFetch } from '../../services/api';
import ArticleCard from '../../components/learning/ArticleCard/ArticleCard';
import VideoCard from '../../components/learning/VideoCard/VideoCard';
import GlossaryCard from '../../components/learning/GlossaryCard/GlossaryCard';
import GuideCard from '../../components/learning/GuideCard/GuideCard';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3003/api';

interface Article {
  _id: string;
  title: string;
  description: string;
  category: string;
  readTime: number;
  thumbnail: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  views: number;
  rating: { average: number; count: number };
}

interface Video {
  _id: string;
  title: string;
  thumbnail: string;
  duration: string;
  instructor: string;
  views: number;
  category: string;
}

interface GlossaryTerm {
  _id: string;
  term: string;
  definition: string;
  category: string;
  relatedTerms: string[];
}

interface Guide {
  _id: string;
  title: string;
  description: string;
  category: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  rating: { average: number; count: number };
}

const LearningCenter: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [articles, setArticles] = useState<Article[]>([]);
  const [videos, setVideos] = useState<Video[]>([]);
  const [glossaryTerms, setGlossaryTerms] = useState<GlossaryTerm[]>([]);
  const [guides, setGuides] = useState<Guide[]>([]);
  const [liveNews, setLiveNews] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [activeDifficulty, setActiveDifficulty] = useState<string | null>(null);
  const [selectedTerm, setSelectedTerm] = useState<GlossaryTerm | null>(null);
  // Fetch all learning content
  useEffect(() => {
    const fetchLearningContent = async () => {
      try {
        setLoading(true);
        setError(null);

        const params = new URLSearchParams();
        if (activeCategory) params.append('category', activeCategory);
        if (activeDifficulty) params.append('difficulty', activeDifficulty);
        if (searchQuery) params.append('search', searchQuery);

        const [articlesData, videosData, glossaryData, guidesData] = await Promise.all([
          apiFetch<any>(`/api/learning/articles?${params}`),
          apiFetch<any>(`/api/learning/videos?${params}`),
          apiFetch<any>(`/api/learning/glossary?${params}`),
          apiFetch<any>(`/api/learning/guides?${params}`),
        ]);

        setArticles(articlesData?.data || []);
        setVideos(videosData?.data || []);
        setGlossaryTerms(glossaryData?.data || []);
        setGuides(guidesData?.data || []);
        
        // Fetch live news
        const newsData = await apiFetch<any>('/api/learning/news');
        setLiveNews(newsData?.data || []);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load learning content';
        setError(errorMessage);
        console.error('Learning content fetch error:', err);
        
        // Fallback to default content if API fails
        setArticles([]);
        setVideos([]);
        setGlossaryTerms([]);
        setGuides([]);
      } finally {
        setLoading(false);
      }
    };

    const debounceTimer = setTimeout(fetchLearningContent, 300);
    return () => clearTimeout(debounceTimer);
  }, [searchQuery, activeCategory, activeDifficulty]);

  const categories = ['DeFi', 'Trading', 'Blockchain', 'Security', 'NFT', 'Staking'];
  const difficulties = ['beginner', 'intermediate', 'advanced'];

  return (
    <div className="min-h-screen bg-[#0A0B0F] text-white p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <GraduationCap className="w-8 h-8 text-[#3D5AF1]" />
          <h1 className="text-3xl font-bold">Learning Center</h1>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-4 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
            <p className="text-red-200">{error}</p>
          </div>
        )}

        {/* Search and Filters */}
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search for articles, videos, and guides..."
                className="w-full bg-[#1A1B23] border border-[#3D5AF1]/20 rounded-xl py-3 pl-12 pr-4 text-white placeholder-gray-400 focus:outline-none focus:border-[#3D5AF1]/40 transition-colors"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <button className="flex items-center gap-2 px-4 py-3 bg-[#1A1B23] border border-[#3D5AF1]/20 rounded-xl text-white hover:border-[#3D5AF1]/40 transition-colors">
              <Filter className="w-5 h-5" />
              <span>Filters</span>
            </button>
          </div>

          {/* Category and Difficulty Filters */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Category Filter */}
            <div>
              <p className="text-sm font-semibold mb-2 text-gray-400">Category</p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setActiveCategory(null)}
                  className={`px-3 py-1 rounded-lg text-sm transition-colors ${
                    activeCategory === null
                      ? 'bg-[#3D5AF1] text-white'
                      : 'bg-[#1A1B23] border border-[#3D5AF1]/20 text-gray-300 hover:border-[#3D5AF1]/40'
                  }`}
                >
                  All
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={`px-3 py-1 rounded-lg text-sm transition-colors ${
                      activeCategory === cat
                        ? 'bg-[#3D5AF1] text-white'
                        : 'bg-[#1A1B23] border border-[#3D5AF1]/20 text-gray-300 hover:border-[#3D5AF1]/40'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Difficulty Filter */}
            <div>
              <p className="text-sm font-semibold mb-2 text-gray-400">Difficulty</p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setActiveDifficulty(null)}
                  className={`px-3 py-1 rounded-lg text-sm transition-colors capitalize ${
                    activeDifficulty === null
                      ? 'bg-[#3D5AF1] text-white'
                      : 'bg-[#1A1B23] border border-[#3D5AF1]/20 text-gray-300 hover:border-[#3D5AF1]/40'
                  }`}
                >
                  All
                </button>
                {difficulties.map((diff) => (
                  <button
                    key={diff}
                    onClick={() => setActiveDifficulty(diff)}
                    className={`px-3 py-1 rounded-lg text-sm transition-colors capitalize ${
                      activeDifficulty === diff
                        ? 'bg-[#3D5AF1] text-white'
                        : 'bg-[#1A1B23] border border-[#3D5AF1]/20 text-gray-300 hover:border-[#3D5AF1]/40'
                    }`}
                  >
                    {diff}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader className="w-8 h-8 text-[#3D5AF1] animate-spin" />
          </div>
        )}

        {/* Featured Articles */}
        {!loading && articles.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-6">
              <BookOpen className="w-5 h-5 text-[#3D5AF1]" />
              <h2 className="text-xl font-semibold">Featured Articles</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {articles.slice(0, 6).map((article) => (
                <ArticleCard key={article._id} {...article} />
              ))}
            </div>
          </div>
        )}

        {/* Video Tutorials */}
        {!loading && videos.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-6">
              <Play className="w-5 h-5 text-[#3D5AF1]" />
              <h2 className="text-xl font-semibold">Video Tutorials</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {videos.slice(0, 6).map((video) => (
<VideoCard
  key={video._id}
  {...video}
  videoUrl={video.videoUrl}
/>              ))}
            </div>
          </div>
        )}

        {/* Live News */}
        {!loading && liveNews.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-6">
              <FileText className="w-5 h-5 text-[#3D5AF1]" />
              <h2 className="text-xl font-semibold">Live News</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {liveNews.slice(0, 6).map((newsItem, index) => (
                <div key={index} className="bg-[#1A1B23] border border-[#3D5AF1]/20 rounded-xl p-4 hover:border-[#3D5AF1]/40 transition-colors cursor-pointer">
                  <h3 className="text-lg font-semibold text-white mb-2">{newsItem.title}</h3>
                  <p className="text-gray-400 text-sm mb-3">{newsItem.description}</p>
                  {newsItem.source && <p className="text-xs text-[#3D5AF1]">Source: {newsItem.source}</p>}
                  {newsItem.timestamp && <p className="text-xs text-gray-500 mt-2">{new Date(newsItem.timestamp).toLocaleDateString()}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Market Guides */}
        {!loading && guides.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-6">
              <FileText className="w-5 h-5 text-[#3D5AF1]" />
              <h2 className="text-xl font-semibold">Market Guides</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {guides.slice(0, 4).map((guide) => (
                <GuideCard key={guide._id} {...guide} />
              ))}
            </div>
          </div>
        )}

{/* Glossary */}
{!loading && glossaryTerms.length > 0 && (
  <div>
    <div className="flex items-center gap-2 mb-6">
      <Book className="w-5 h-5 text-[#3D5AF1]" />
      <h2 className="text-xl font-semibold">Glossary</h2>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {glossaryTerms.slice(0, 9).map((term) => (
        <GlossaryCard
          key={term._id}
          {...term}
          onClick={() => setSelectedTerm(term)}
        />
      ))}
    </div>
  </div>
)}
        {/* No Content Message */}
        {!loading && articles.length === 0 && videos.length === 0 && guides.length === 0 && glossaryTerms.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12">
            <BookOpen className="w-12 h-12 text-gray-500 mb-4" />
            <p className="text-gray-400 text-center">
              No content found. Try adjusting your filters or search query.
            </p>
          </div>
        )}
              </div>

      {/* ✅ ADD MODAL HERE */}
      {selectedTerm && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
          onClick={() => setSelectedTerm(null)}
        >
          <div
            className="bg-[#1A1B23] rounded-xl p-6 max-w-md w-full border border-[#3D5AF1]/30"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-2xl font-bold text-white mb-2">
              {selectedTerm.term}
            </h2>

            <p className="text-[#3D5AF1] text-sm mb-4">
              {selectedTerm.category}
            </p>

            <p className="text-gray-300 mb-4">
              {selectedTerm.definition}
            </p>

            <button
              onClick={() => setSelectedTerm(null)}
              className="mt-4 px-4 py-2 bg-[#3D5AF1] rounded-lg text-white"
            >
              Close
            </button>
          </div>
        </div>
      )}

    </div>
  );
};

export default LearningCenter;