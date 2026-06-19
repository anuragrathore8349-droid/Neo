import React from 'react';
import { BookOpen, Clock, ArrowRight } from 'lucide-react';

interface ArticleCardProps {
  _id?: string;
  title: string;
  description: string;
  category: string;
  readTime: number;
  thumbnail: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
}

const ArticleCard: React.FC<ArticleCardProps> = ({
  _id,
  title,
  description,
  category,
  readTime,
  thumbnail,
  difficulty,
}) => {
  const getDifficultyColor = () => {
    switch (difficulty) {
      case 'beginner':
        return 'text-[#22DFBF]';
      case 'intermediate':
        return 'text-[#3D5AF1]';
      case 'advanced':
        return 'text-red-500';
      default:
        return 'text-gray-400';
    }
  };

  const handleClick = () => {
    if (_id) {
      window.open(`/learning/article/${_id}`, '_blank');
    }
  };

  return (
    <div
      onClick={handleClick}
      className="cursor-pointer bg-[#1A1B23]/60 backdrop-blur-lg border border-[#3D5AF1]/20 rounded-xl overflow-hidden hover:border-[#3D5AF1]/40 hover:scale-[1.02] transition-all duration-300"
    >
      <div className="relative h-48">
        <img src={thumbnail} alt={title} className="w-full h-full object-cover" />
        <div className="absolute top-4 left-4">
          <span className="px-3 py-1 rounded-full bg-[#1A1B23]/80 text-white text-sm">
            {category}
          </span>
        </div>
      </div>

      <div className="p-6">
        <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
        <p className="text-gray-400 text-sm mb-4 line-clamp-2">{description}</p>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <Clock className="w-4 h-4" />
              <span>{readTime} min read</span>
            </div>
            <span className={`text-sm font-medium ${getDifficultyColor()}`}>
              {difficulty}
            </span>
          </div>
          <ArrowRight className="w-5 h-5 text-[#3D5AF1]" />
        </div>
      </div>
    </div>
  );
};

export default ArticleCard;