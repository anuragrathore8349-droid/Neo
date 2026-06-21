import React from 'react';
import { Play, User } from 'lucide-react';

interface VideoCardProps {
  title: string;
  thumbnail: string;
  duration: string;
  instructor: string;
  views: number;
  category: string;
  videoUrl?: string;
}

const VideoCard: React.FC<VideoCardProps> = ({
  title,
  thumbnail,
  duration,
  instructor,
  views,
  category,
  videoUrl,
}) => {
  const handleClick = () => {
    if (videoUrl) {
      window.open(videoUrl, '_blank');
    }
  };

  return (
    <div
      onClick={handleClick}
      className="cursor-pointer bg-[#1A1B23]/60 backdrop-blur-lg border border-[#3D5AF1]/20 rounded-xl overflow-hidden hover:border-[#3D5AF1]/40 hover:scale-105 transition-all duration-300 group"
    >
      <div className="relative h-48">
        <img src={thumbnail} alt={title} className="w-full h-full object-cover" />

        <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <Play className="w-12 h-12 text-white" />
        </div>

        <div className="absolute bottom-4 right-4 px-2 py-1 rounded bg-black/80 text-white text-sm">
          {duration}
        </div>
      </div>

      <div className="p-6">
        <div className="text-[#3D5AF1] text-sm mb-2">{category}</div>
        <h3 className="text-xl font-bold text-white mb-3">{title}</h3>

        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2 text-gray-400">
            <User className="w-4 h-4" />
            <span>{instructor}</span>
          </div>
          <span className="text-gray-400">{views?.toLocaleString?.() || 0} views</span>
        </div>
      </div>
    </div>
  );
};

export default VideoCard;