import React from "react";

interface YoutubeVideoCardProps {
  thumbnail: string;
  title: string;
  onClick: () => void;
}

const YoutubeVideoCard: React.FC<YoutubeVideoCardProps> = ({ thumbnail, title, onClick }) => {
  return (
    <div
      onClick={onClick}
      className="bg-white border border-gray-200 rounded-lg shadow-md hover:shadow-lg transition-shadow"
      style={{ cursor: "pointer", overflow: "hidden" }}
    >
      <img src={thumbnail} alt={title} style={{ width: "100%", height: "12rem", objectFit: "cover" }} />
      <div className="p-4">
        <h4 className="text-md font-medium text-gray-800" style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
          {title}
        </h4>
      </div>
    </div>
  );
};

export default YoutubeVideoCard;