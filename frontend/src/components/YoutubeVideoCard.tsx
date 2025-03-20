import React from "react";

// Props interface for the YouTube video card component
interface YoutubeVideoCardProps {
  thumbnail: string;  // URL of the video thumbnail image
  title: string;      // Title of the YouTube video
  onClick: () => void; // Handler for card click event
}

// Card component to display YouTube video preview with thumbnail and title
const YoutubeVideoCard: React.FC<YoutubeVideoCardProps> = ({ thumbnail, title, onClick }) => {
  return (
    <div
      onClick={onClick}
      className="bg-white border border-gray-200 rounded-lg shadow-md hover:shadow-lg transition-shadow"
      style={{ cursor: "pointer", overflow: "hidden" }}
    >
      {/* Video thumbnail image */}
      <img src={thumbnail} alt={title} style={{ width: "100%", height: "12rem", objectFit: "cover" }} />
      {/* Video title with 2-line clamp */}
      <div className="p-4">
        <h4 className="text-md font-medium text-gray-800" style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
          {title}
        </h4>
      </div>
    </div>
  );
};

export default YoutubeVideoCard;