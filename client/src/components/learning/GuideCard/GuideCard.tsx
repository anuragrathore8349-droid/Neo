import React from 'react';
import { FileText, ArrowRight, Star } from 'lucide-react';

interface GuideCardProps {
  title: string;
  description: string;
  category: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  rating: { average: number; count: number };
}

const GuideCard: React.FC<GuideCardProps> = ({
  title,
  description,
  category,
  difficulty,
  rating,
}) => {
  const getDifficultyColor = () => {
    switch (difficulty) {
      case 'beginner':
        return 'text-[#22DFBF]';
      case 'intermediate':
        return 'text-[#3D5AF1]';
      case 'advanced':
        return 'text-red-500';
    }
  };

  return (
    <div className="bg-[#1A1B23]/60 backdrop-blur-lg border border-[#3D5AF1]/20 rounded-xl p-6 hover:border-[#3D5AF1]/40 transition-all duration-300">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <FileText className="w-6 h-6 text-[#3D5AF1]" />
          <div>
            <h3 className="text-xl font-bold text-white">{title}</h3>
            <span className="text-sm text-[#3D5AF1]">{category}</span>
          </div>
        </div>
        <span className={`text-sm font-medium ${getDifficultyColor()}`}>
          {difficulty}
        </span>
      </div>

      <p className="text-gray-400 text-sm mb-6">{description}</p>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Star className="w-4 h-4 text-yellow-500 fill-current" />
          <span className="text-white font-medium">{rating.average.toFixed(1)}</span>
          <span className="text-gray-400 text-sm">
            ({rating.count.toLocaleString()} ratings)
          </span>
        </div>
        <ArrowRight className="w-5 h-5 text-[#3D5AF1]" />
      </div>
    </div>
  );
};

export default GuideCard;