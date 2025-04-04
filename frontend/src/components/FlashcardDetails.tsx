import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axiosInstance from "../config/axios";
import {
  Trash2Icon,
  ArrowLeftIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "lucide-react";

// Interfaces for flashcard data structure and video details
interface Flashcard {
  content: string;
  startTime: number; // Start timestamp in milliseconds
  endTime: number; // End timestamp in milliseconds
}

interface Video {
  title: string;
  flashcards: Flashcard[];
}

// Component for displaying and managing individual video flashcards
const FlashcardDetails: React.FC = () => {
  const { videoId } = useParams<{ videoId: string }>();
  const navigate = useNavigate();
  const [video, setVideo] = useState<Video | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [currentFlashcard, setCurrentFlashcard] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Fetch video details and flashcards on component mount
  useEffect(() => {
    const fetchVideoDetails = async () => {
      try {
        const response = await axiosInstance.get(`/youtube/${videoId}`, {
          withCredentials: true,
        });
        console.log(response.data); // Inspect the response
        setVideo(response.data);
      } catch (err) {
        console.error("Error fetching video details:", err);
        setError("Failed to load video details.");
      } finally {
        setLoading(false);
      }
    };
  
    fetchVideoDetails();
  }, [videoId]);  

  // Handle video and flashcards deletion
  const handleDelete = async () => {
    setDeleting(true);
    try {
      await axiosInstance.delete(`/youtube/${videoId}`, {
        withCredentials: true,
      });
      navigate("/dashboard");
    } catch (err) {
      console.error("Error deleting video:", err);
      setError("Failed to delete the video. Please try again.");
    } finally {
      setDeleting(false);
      setShowModal(false);
    }
  };

  // Navigation functions for flashcard carousel
  const handlePreviousFlashcard = () => {
    if (currentFlashcard !== null && currentFlashcard > 0) {
      setCurrentFlashcard(currentFlashcard - 1);
    }
  };

  const handleNextFlashcard = () => {
    if (currentFlashcard !== null && video && currentFlashcard < video.flashcards.length - 1) {
      setCurrentFlashcard(currentFlashcard + 1);
    }
  };

  // Convert milliseconds to formatted time string (HH:MM:SS)
  const formatTime = (ms: number) => {
  if (typeof ms !== "number" || isNaN(ms)) {
    console.error("Invalid time value:", ms);
    return "00:00:00"; // Default fallback
  }

  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
};

  // Loading state UI
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="w-12 h-12 border-4 border-blue-500 border-dotted rounded-full animate-spin"></div>
      </div>
    );
  }

  // Error state UI
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 text-red-600">
        <p>{error}</p>
        <button
          onClick={() => navigate("/dashboard")}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Fixed Top Section */}
      <div className="fixed top-0 right-0 left-0 bg-white shadow-sm z-10 flex space-x-4 items-center px-6 py-3">
        <div className="flex w-full items-center space-x-4">
          <ArrowLeftIcon
            className="w-6 h-6 cursor-pointer text-gray-800"
            onClick={() => navigate("/dashboard")}
          />
          <h1 className="text-lg font-semibold text-gray-800 w-full truncate">{video?.title || "Loading..."}</h1>
        </div>
        <Trash2Icon
          className="w-6 h-6 cursor-pointer text-red-600"
          onClick={() => setShowModal(true)}
        />
      </div>

      {/* Confirmation Modal */}
      {showModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-20"
          style={{
            position: 'fixed',
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 20
          }}
        >
          <div
            className="bg-white p-6 rounded-lg shadow-lg"
            style={{
              backgroundColor: 'white',
              padding: '1.5rem',
              borderRadius: '0.5rem',
              boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)'
            }}
          >
            <h2
              className="text-lg font-bold mb-4"
              style={{
                fontSize: '1.125rem',
                fontWeight: 'bold',
                marginBottom: '1rem'
              }}
            >
              Confirm Deletion
            </h2>
            <p>Are you sure you want to delete this video and its flashcards?</p>
            <div
              className="mt-4 flex justify-end space-x-2"
              style={{
                marginTop: '1rem',
                display: 'flex',
                justifyContent: 'flex-end'
              }}
            >
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: '#e5e7eb',
                  borderRadius: '0.25rem',
                  marginRight: '0.5rem'
                }}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: '#dc2626',
                  color: 'white',
                  borderRadius: '0.25rem'
                }}
                disabled={deleting}
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Grid layout for displaying flashcard previews */}
      <div className="mt-16 px-6 py-16 sm:py-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {video?.flashcards.length ? (
          video.flashcards.map((flashcard, index) => (
            <div
              key={index}
              className="bg-white p-4 rounded-lg shadow-md cursor-pointer"
              onClick={() => setCurrentFlashcard(index)}
            >
              <p>{flashcard.content}</p>
              {/* <p className="text-sm text-gray-500 mt-2">
                Start: {formatTime(flashcard.startTime)} - End: {formatTime(flashcard.endTime)}
              </p> */}
            </div>
          ))
        ) : (
          <p className="text-gray-600 text-center col-span-full">
            No flashcards available for this video.
          </p>
        )}
      </div>

      {/* Modal overlay for viewing individual flashcards */}
      {currentFlashcard !== null && video && (
        <div
          className="fixed inset-0 bg-black bg-opacity-75 flex flex-col items-center justify-center z-30"
          style={{
            position: 'fixed',
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 30
          }}
        >
          <div
            className="bg-white rounded-lg shadow-lg relative max-w-md w-full p-6 text-center"
            style={{
              backgroundColor: 'white',
              borderRadius: '0.5rem',
              boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
              position: 'relative',
              maxWidth: '28rem',
              width: '100%',
              padding: '1.5rem',
              textAlign: 'center'
            }}
          >
            <p
              className="text-gray-600 mb-2 text-left"
              style={{
                color: '#4b5563',
                marginBottom: '0.5rem',
                textAlign: 'left'
              }}
            >
              Flashcard {currentFlashcard + 1} of {video.flashcards.length}
            </p>
            <p
              className="py-6 text-lg text-left"
              style={{
                paddingTop: '1.5rem',
                paddingBottom: '1.5rem',
                fontSize: '1.125rem',
                textAlign: 'left'
              }}
            >
              {video.flashcards[currentFlashcard]?.content}
            </p>
            {/* <p
              className="text-sm text-gray-500 text-left"
              style={{
                fontSize: '0.875rem',
                color: '#6b7280',
                textAlign: 'left'
              }}
            >
              Start: {formatTime(video.flashcards[currentFlashcard].startTime)} - End:{" "}
              {formatTime(video.flashcards[currentFlashcard].endTime)}
            </p> */}
            <button
              className="absolute top-4 right-4 text-gray-500 hover:text-gray-700"
              style={{
                position: 'absolute',
                top: '1rem',
                right: '1rem',
                color: '#6b7280',
                cursor: 'pointer'
              }}
              onClick={() => setCurrentFlashcard(null)}
            >
              Close
            </button>
            <div
              className="flex justify-between items-center mt-4"
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginTop: '1rem'
              }}
            >
              <div
                className="flex items-center justify-center w-10 h-10 bg-gray-200 rounded-full cursor-pointer"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '2.5rem',
                  height: '2.5rem',
                  backgroundColor: '#e5e7eb',
                  borderRadius: '9999px',
                  cursor: 'pointer'
                }}
                onClick={handlePreviousFlashcard}
              >
                <ChevronLeftIcon
                  className="w-6 h-6 text-gray-700"
                  style={{
                    width: '1.5rem',
                    height: '1.5rem',
                    color: '#374151'
                  }}
                />
              </div>
              <div
                className="flex items-center justify-center w-10 h-10 bg-gray-200 rounded-full cursor-pointer"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '2.5rem',
                  height: '2.5rem',
                  backgroundColor: '#e5e7eb',
                  borderRadius: '9999px',
                  cursor: 'pointer'
                }}
                onClick={handleNextFlashcard}
              >
                <ChevronRightIcon
                  className="w-6 h-6 text-gray-700"
                  style={{
                    width: '1.5rem',
                    height: '1.5rem',
                    color: '#374151'
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FlashcardDetails;