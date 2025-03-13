
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

const Home = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Check if user is already authenticated
    const checkAuth = async () => {
      try {
        const response = await fetch("https://jotta.onrender.com/auth/user", {
          credentials: "include",
        });
        const data = await response.json();
        
        if (response.ok && data.user) {
          navigate("/dashboard");
        }
      } catch (error) {
        console.error("Error checking auth status:", error);
      }
    };

    checkAuth();

    // Add event listener for message from popup
    const handleMessage = (event: MessageEvent) => {
      if (event.origin === "https://jotta.onrender.com" && event.data.user) {
        navigate("/dashboard");
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [navigate]);

  const handleGoogleLogin = () => {
    window.location.href = "https://jotta.onrender.com/auth/google";
  };

  return (
    <div className="flex items-center justify-center h-screen bg-gray-50">
      <div className="flex flex-col items-center text-center">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">Welcome to Jotta</h1>
        <p className="text-gray-600 text-lg max-w-md mb-8">
          Transform your YouTube videos into interactive flashcards for easy learning and better retention.
        </p>

        <button
          onClick={handleGoogleLogin}
          className="px-16 py-2 bg-blue-600 hover:bg-blue-700 text-white text-lg font-semibold rounded-lg shadow-md transition duration-300"
        >
          Sign in with Google
        </button>
      </div>
    </div>
  );
};

export default Home;