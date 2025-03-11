import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Menu, Transition } from "@headlessui/react";
import { ChevronDownIcon, LogOutIcon, FileTextIcon } from "lucide-react";
import { toast } from "react-toastify";
import axios from "axios";
import YoutubeVideoCard from "../components/YoutubeVideoCard";
import "react-toastify/dist/ReactToastify.css";

interface User {
  name: string;
  profileImage: string;
}

interface SavedVideo {
  videoId: string;
  title: string;
  thumbnail: string;
  description: string;
}

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
        const userResponse = await axios.get("/auth/user", { withCredentials: true });
        setUser(userResponse.data);

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

  const fetchSavedVideos = async () => {
    try {
      const videosResponse = await axios.get("/youtube/saved-videos", { withCredentials: true });
      setSavedVideos(videosResponse.data);
    } catch (error) {
      console.error("Error fetching saved videos:", error);
      toast.error("Failed to fetch saved videos.");
    }
  };

  const checkVideoExists = async (videoId: string) => {
    try {
      const response = await axios.get(`/youtube/${videoId}`, { withCredentials: true });
      return response.status === 200;
    } catch (error) {
      return false;
    }
  };

  const handleLogout = async () => {
    try {
      await axios.get("/auth/logout", { withCredentials: true });
      window.location.href = "/";
    } catch (error) {
      console.error("Error logging out:", error);
      toast.error("Failed to log out. Please try again.");
    }
  };

  const handleGenerate = async () => {
    if (isGenerating) {
      setIsGenerating(false);
      setProgress(0);
      setYoutubeUrl("");
      if (pollingInterval) clearInterval(pollingInterval);
      setPollingInterval(null);
      toast.info("Generation process cancelled.");
      return;
    }
  
    try {
      setIsGenerating(true);
      const videoId = youtubeUrl.split("v=")[1]?.split("&")[0];
      if (!videoId) {
        toast.error("Invalid YouTube URL");
        setIsGenerating(false);
        return;
      }
  
      const videoExists = await checkVideoExists(videoId);
      if (videoExists) {
        toast.error("Flashcards already exist for this video.");
        setYoutubeUrl("");
        setIsGenerating(false);
        return;
      }
  
      const response = await axios.post("/youtube/generate", { videoId }, { withCredentials: true });
      toast.success(response.data.message);
  
      const interval = setInterval(async () => {
        const videoExists = await checkVideoExists(videoId);
        if (videoExists) {
          clearInterval(interval);
          setPollingInterval(null);
          await fetchSavedVideos();
          setIsGenerating(false);
          setProgress(100);
          toast.success("Flashcards have been saved!");
          setYoutubeUrl("");
        } else {
          setProgress((prev) => Math.min(prev + 1, 99));
        }
      }, 2000);
  
      setPollingInterval(interval);
    } catch (error: any) {
      console.error("Error generating video details:", error);
  
      const errorMessage =
        error.response?.data?.error || "Failed to generate video details. Please try again.";
      toast.error(errorMessage);
  
      setIsGenerating(false);
      setProgress(0);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="w-full fixed top-0 bg-white shadow-sm" style={{ zIndex: 10 }}>
        <div className="flex justify-between items-center px-16 py-3">
          <h1 className="text-2xl font-bold text-gray-800">Jotta</h1>
          <div className="flex items-center space-x-4">
            {user ? (
              <>
                <img
                  src={user.profileImage || "https://via.placeholder.com/40"}
                  alt="User"
                  className="w-10 h-10 rounded-full border border-gray-300"
                />
                <p className="text-gray-800 hidden sm:block">{user.name}</p>
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
            ) : (
              <p className="text-gray-800">Loading user...</p>
            )}
          </div>
        </div>
        <div className="py-4 px-16" style={{ maxWidth: "42rem", margin: "0 auto" }}>
          <p className="text-gray-700 mb-4 text-center">
            {savedVideos.length > 0
              ? "Enter a YouTube video link to generate more flashcards or view your previously generated videos below."
              : "Enter a YouTube video link to get started with your first flashcards."}
          </p>
          <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-2 space-y-2 sm:space-y-0" style={{ maxWidth: "42rem" }}>
            <input
              type="text"
              placeholder="Enter YouTube video URL"
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
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
            <div className="w-full bg-gray-200 rounded-lg mt-4">
              <div
                className="bg-blue-600 text-xs font-medium text-white text-center p-1 rounded-lg"
                style={{ width: `${progress}%` }}
              >
                {progress}%
              </div>
            </div>
          )}
        </div>
      </div>

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