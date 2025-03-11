
const Home = () => {
  const handleGoogleLogin = () => {
    window.location.href = "https://jotta.onrender.com/auth/google"; // Redirect to backend
  };

  return (
    <div className="flex items-center justify-center h-screen bg-gray-50">
      <div className="flex flex-col items-center text-center">
        {/* Icon */}

        {/* Welcome Text */}
        <h1 className="text-3xl font-bold text-gray-800 mb-2">Welcome to Jotta</h1>
        <p className="text-gray-600 text-lg max-w-md mb-8">
          Transform your YouTube videos into interactive flashcards for easy learning and better retention.
        </p>

        {/* Sign-in Button */}
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