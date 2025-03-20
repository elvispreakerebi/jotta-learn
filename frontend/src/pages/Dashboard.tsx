import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Menu, Transition } from "@headlessui/react";
import { ChevronDownIcon, LogOutIcon, FileTextIcon } from "lucide-react";
import { toast } from "react-toastify";
import axiosInstance from "../config/axios";
import YoutubeVideoCard from "../components/YoutubeVideoCard";
import "react-toastify/dist/ReactToastify.css";

// User interface for authentication and display
interface User {
  name: string;
  email: string;
}

// Video data structure for saved flashcards
interface SavedVideo {
  videoId: string;
  title: string;
  thumbnail: string;
  description: string;
}

// Main dashboard component for managing YouTube video flashcards
const Dashboard = () => {
  const navigate = useNavigate();

  const [user, setUser] = useState<User | null>(null);
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [savedVideos, setSavedVideos] = useState<SavedVideo[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const fetchUserAndVideos = async () => {
      try {
        const userResponse = await axiosInstance.get("/auth/user");
        const emailPrefix = userResponse.data.email.split("@")[0];
        setUser({
          name: emailPrefix,
          email: userResponse.data.email,
        });

        await fetchSavedVideos();
      } catch (error: any) {
        console.error("Error fetching user or videos:", error);

        if (error.response?.status === 401) {
          toast.error("Session expired. Please log in again.");
          navigate("/");
        } else {
          toast.error("Failed to fetch user or videos.");
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserAndVideos();

    return () => {
      if (pollingInterval) clearInterval(pollingInterval);
    };
  }, [pollingInterval, navigate]);

  // Retrieve user's saved video flashcards
  const fetchSavedVideos = async () => {
    try {
      const videosResponse = await axiosInstance.get("/youtube/saved-videos");
      setSavedVideos(videosResponse.data);
    } catch (error) {
      console.error("Error fetching saved videos:", error);
      toast.error("Failed to fetch saved videos.");
    }
  };

  // Check if flashcards already exist for a video
  const checkVideoExists = async (videoId: string) => {
    try {
      const response = await axiosInstance.get(`/youtube/${videoId}`, {
        timeout: 5000, // Shorter timeout for status checks
      });
      return response.status === 200;
    } catch (error: any) {
      if (error.response?.status === 404) {
        return false;
      }
      if (error.code === 'ECONNABORTED') {
        console.log('Status check timeout - assuming processing continues');
        return false;
      }
      throw error;
    }
  };

  // Monitor flashcard generation progress
  const checkVideoStatus = async (videoId: string) => {
    try {
      const response = await axiosInstance.get(`/youtube/job/${videoId}`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  };

  // Handle user logout and session cleanup
  const handleLogout = async () => {
    try {
      await axiosInstance.post("/auth/logout");
      window.location.href = "/";
    } catch (error) {
      console.error("Error logging out:", error);
      toast.error("Failed to log out. Please try again.");
    }
  };

  // Process YouTube video URL and initiate flashcard generation
  const handleGenerate = async () => {
    if (isGenerating) {
      try {
        const videoId = youtubeUrl.split("v=")[1]?.split("&")[0];
        await axiosInstance.delete(`/youtube/job/${videoId}`);
        setIsGenerating(false);
        setProgress(0);
        setYoutubeUrl("");
        if (pollingInterval) clearInterval(pollingInterval);
        setPollingInterval(null);
        toast.info("Generation process cancelled.");
      } catch (error: any) {
        console.error("Error cancelling video processing:", error);
        toast.error("Failed to cancel video processing. Please try again.");
      }
      return;
    }
  
    try {
      setIsGenerating(true);
      const videoId = youtubeUrl.split("v=")[1]?.split("&")[0];
      if (!videoId) {
        toast.error("Invalid YouTube URL. Please provide a valid YouTube video URL.");
        setIsGenerating(false);
        return;
      }
  
      try {
        const videoExists = await checkVideoExists(videoId);
        if (videoExists) {
          toast.error("Flashcards already exist for this video.");
          setYoutubeUrl("");
          setIsGenerating(false);
          return;
        }
      } catch (error: any) {
        if (error.code !== 'ECONNABORTED') {
          console.error("Error checking video existence:", error);
          toast.error("Failed to check video existence. Please try again.");
          setIsGenerating(false);
          return;
        }
      }
  
      const response = await axiosInstance.post("/youtube/generate", { videoId });
      toast.success("Starting flashcard generation process...");
  
      const interval = setInterval(async () => {
        try {
          const status = await checkVideoStatus(videoId);
          
          if (status) {
            if (status.status === 'completed') {
              clearInterval(interval);
              setPollingInterval(null);
              await fetchSavedVideos();
              setIsGenerating(false);
              setProgress(100);
              toast.success("Flashcards have been generated successfully!");
              setYoutubeUrl("");
            } else if (status.status === 'failed') {
              clearInterval(interval);
              setPollingInterval(null);
              setIsGenerating(false);
              setProgress(0);
              toast.error(status.error || "Failed to generate flashcards.");
              setYoutubeUrl("");
            } else {
              // Only update progress when we have a valid progress value from backend
              if (status.progress !== undefined) {
                setProgress(status.progress);
              }
            }
          }
          // Don't update progress when no status is available
        } catch (error: any) {
          console.error("Error checking video status:", error);
          // Don't update progress on network errors
        }
      }, 2000);
  
      setPollingInterval(interval);
    } catch (error: any) {
      console.error("Error generating video details:", error);
      const errorMessage = error.response?.data?.error || "Failed to start video processing. Please try again.";
      toast.error(errorMessage);
      setIsGenerating(false);
      setProgress(0);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header with user info and controls */}
      <div className="w-full fixed top-0 bg-white shadow-sm" style={{ zIndex: 10 }}>
        <div className="flex justify-between items-center px-4 py-3">
          <h1 className="text-2xl font-bold text-gray-800">Jotta</h1>
          <div className="flex items-center space-x-4">
            {user && (
              <>
                <p className="text-gray-800">{user.name}</p>
                <Menu as="div" className="relative">
                  <Menu.Button>
                    <ChevronDownIcon className="w-6 h-6 text-gray-600" style={{ cursor: "pointer" }} />
                  </Menu.Button>
                  <Transition
                    enter="transition ease-out duration-100"
                    enterFrom="transform opacity-0 scale-95"
                    enterTo="transform opacity-100 scale-100"
                    leave="transition ease-in duration-75"
                    leaveFrom="opacity-100 scale-100"
                    leaveTo="opacity-0 scale-95"
                  >
                    <Menu.Items className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                      <Menu.Item>
                        {({ active }) => (
                          <button
                            onClick={handleLogout}
                            className={`flex items-center w-full px-4 py-2 text-gray-800 text-sm ${active ? "bg-gray-100" : ""}`}
                          >
                            <LogOutIcon className="w-5 h-5 mr-2 text-gray-600" />
                            Log Out
                          </button>
                        )}
                      </Menu.Item>
                    </Menu.Items>
                  </Transition>
                </Menu>
              </>
            )}
          </div>
        </div>
        <div className="py-4 px-4 sm:px-16 mx-auto max-w-2xl">
          <p className="text-gray-700 mb-4 text-center">
            {savedVideos.length > 0
              ? "Enter a YouTube video link to generate more flashcards or view your previously generated videos below."
              : "Enter a YouTube video link to get started with your first flashcards."}
          </p>
          <div className="flex flex-col sm:flex-row sm:justify-center sm:space-x-2 space-y-2 sm:space-y-0 w-full max-w-2xl">
            <input
              type="text"
              placeholder="Enter YouTube video URL"
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400"
              value={youtubeUrl}
              onChange={(e) => setYoutubeUrl(e.target.value)}
            />
            <button
              onClick={handleGenerate}
              className={`w-full sm:w-auto px-4 py-2 rounded-lg text-white ${isGenerating ? "bg-red-600 hover:bg-red-700" : "bg-blue-600 hover:bg-blue-700"}`}
            >
              {isGenerating ? "Cancel" : "Generate"}
            </button>
          </div>
          {isGenerating && (
            <div className="w-full">
              <div className="w-full bg-gray-200 rounded-lg mt-4">
                <div
                  className="bg-blue-600 text-xs font-medium text-white text-center p-1 rounded-lg"
                  style={{ width: `${progress}%` }}
                >
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main content area with video cards */}
      <div className="px-6 py-72 sm:py-56">
        {isLoading ? (
          <div className="flex justify-center items-center" style={{ height: "8rem" }}>
            <div className="w-12 h-12 border-4 border-blue-500 border-dotted rounded-full animate-spin"></div>
          </div>
        ) : savedVideos.length > 0 ? (
          <>
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Your Flashcard Videos</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {savedVideos.map((video) => (
                <YoutubeVideoCard
                  key={video.videoId}
                  thumbnail={video.thumbnail}
                  title={video.title}
                  onClick={() => navigate(`/flashcards/${video.videoId}`)}
                />
              ))}
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center mt-16 text-gray-600">
            <FileTextIcon className="w-16 h-16 mb-4" />
            <p className="text-lg">No YouTube video flashcards yet.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;