import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Clock, User, BookOpen, Loader, AlertCircle } from 'lucide-react';
import { apiFetch } from '../../services/api';

interface Article {
  _id: string;
  title: string;
  description: string;
  content: string;
  category: string;
  readTime: number;
  thumbnail: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  author: string;
  views: number;
  tags?: string[];
  createdAt?: string;
}

const difficultyColor: Record<string, string> = {
  beginner: 'text-emerald-400',
  intermediate: 'text-blue-400',
  advanced: 'text-red-400',
};

const ArticleDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchArticle = async () => {
      try {
        setLoading(true);
        setError(null);
        if (!id) {
          throw new Error('Article ID is missing');
        }
        const res = await apiFetch<{ data: Article }>(`/api/learning/articles/${id}`);
        setArticle(res.data);
      } catch (err) {
        setError('Article not found or failed to load.');
      } finally {
        setLoading(false);
      }
    };

    fetchArticle();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0B0F] text-white flex items-center justify-center">
        <Loader className="w-10 h-10 text-[#3D5AF1] animate-spin" />
      </div>
    );
  }

  if (error || !article) {
    return (
      <div className="min-h-screen bg-[#0A0B0F] text-white p-6">
        <div className="max-w-3xl mx-auto">
          <Link to="/learning" className="flex items-center gap-2 text-[#3D5AF1] mb-8 hover:underline">
            <ArrowLeft className="w-4 h-4" /> Back to Learning Center
          </Link>
          <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-6 flex items-center gap-3">
            <AlertCircle className="w-6 h-6 text-red-400" />
            <p className="text-red-200">{error || 'Article not found.'}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0B0F] text-white p-6">
      <div className="max-w-3xl mx-auto">
        <Link to="/learning" className="flex items-center gap-2 text-[#3D5AF1] mb-8 hover:underline text-sm">
          <ArrowLeft className="w-4 h-4" /> Back to Learning Center
        </Link>

        {article.thumbnail && (
          <div className="rounded-xl overflow-hidden mb-6 h-64">
            <img src={article.thumbnail} alt={article.title} className="w-full h-full object-cover" />
          </div>
        )}

        <div className="flex items-center gap-3 mb-3">
          <span className="px-3 py-1 rounded-full bg-[#3D5AF1]/20 text-[#3D5AF1] text-xs font-medium">
            {article.category}
          </span>
          <span className={`text-xs font-medium capitalize ${difficultyColor[article.difficulty] || 'text-gray-400'}`}>
            {article.difficulty}
          </span>
        </div>

        <h1 className="text-3xl font-bold text-white mb-4 leading-snug">{article.title}</h1>

        <div className="flex items-center gap-6 text-sm text-gray-400 mb-6 border-b border-white/10 pb-6">
          {article.author && (
            <span className="flex items-center gap-1">
              <User className="w-4 h-4" /> {article.author}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Clock className="w-4 h-4" /> {article.readTime} min read
          </span>
          <span className="flex items-center gap-1">
            <BookOpen className="w-4 h-4" /> {article.views?.toLocaleString() || 0} views
          </span>
        </div>

        <p className="text-gray-300 text-lg mb-6 italic">{article.description}</p>

        <div className="prose prose-invert prose-lg max-w-none text-gray-200 leading-relaxed whitespace-pre-wrap">
          {article.content}
        </div>

        {article.tags && article.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-8 pt-6 border-t border-white/10">
            {article.tags.map(tag => (
              <span key={tag} className="px-3 py-1 rounded-full bg-[#1A1B23] border border-[#3D5AF1]/20 text-xs text-gray-400">
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ArticleDetail;
