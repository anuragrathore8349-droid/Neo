import React from 'react';
import { Book } from 'lucide-react';

interface GlossaryCardProps {
  term: string;
  definition: string;
  category: string;
  relatedTerms?: string[];
  onClick?: () => void;
}

const GlossaryCard: React.FC<GlossaryCardProps> = ({
  term,
  definition,
  category,
  onClick,
}) => {
  return (
    <div
      onClick={onClick}
      className="cursor-pointer bg-[#1A1B23]/60 backdrop-blur-lg border border-[#3D5AF1]/20 rounded-xl p-6 hover:border-[#3D5AF1]/40 hover:scale-[1.02] transition-all duration-300"
    >
      <div className="flex items-start justify-between mb-2">
        <div>
          <h3 className="text-xl font-bold text-white">{term}</h3>
          <span className="text-sm text-[#3D5AF1]">{category}</span>
        </div>
        <Book className="w-6 h-6 text-[#22DFBF]" />
      </div>

      <p className="text-gray-400 text-sm line-clamp-2">
        {definition}
      </p>
    </div>
  );
};

export default GlossaryCard;