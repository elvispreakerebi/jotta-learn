import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import axiosInstance from "../config/axios";

// Home component handles user authentication (login/register)
const Home = () => {
  // Navigation hook for redirecting after authentication
  const navigate = useNavigate();
  
  // State management
  const [isLogin, setIsLogin] = useState(true); // Toggle between login and register
  const [showPassword, setShowPassword] = useState(false); // Toggle password visibility
  const [formData, setFormData] = useState({ // Form data for auth
    email: "",
    password: "",
  });

  // Handle form submission for both login and register
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const endpoint = isLogin ? "/auth/login" : "/auth/register";
      const response = await axiosInstance.post(endpoint, formData);
      
      if (isLogin) {
        toast.success(response.data.message);
        navigate("/dashboard");
      } else {
        toast.success("Registration successful! Please login.");
        setIsLogin(true);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || "An error occurred");
    }
  };

  // Handle input field changes and update form state
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  return (
    // Main container with centered content
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-full max-w-md p-4">
        {/* Header section with app title and description */}
        <div className="text-center">
          <h1 className="text-4xl font-bold text-black mb-2">Welcome to Jotta</h1>
          <p className="text-gray-800 text-base mb-6">
            Transform your YouTube videos into interactive flashcards for easy learning and better retention.
          </p>
        </div>

        {/* Authentication form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-800">
              Email
            </label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>

          <div>
            <div className="flex justify-between items-center">
              <label htmlFor="password" className="block text-sm font-medium text-gray-800">
                Password
              </label>
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="text-sm text-gray-600 hover:underline border-none focus:outline-none bg-transparent"
              >
                {showPassword ? "Hide password" : "Show password"}
              </button>
            </div>
            <div className="mt-1">
              <input
                type={showPassword ? "text" : "password"}
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-2 px-4 mt-4 border border-transparent rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none"
          >
            {isLogin ? "Log in" : "Register"}
          </button>
        </form>

        {/* Toggle between login and register modes */}
        {isLogin ? (
          <div className="text-center mt-4">
            <button
              onClick={() => setIsLogin(false)}
              className=" text-sm font-medium hover:underline bg-transparent border-none"
            >
              <span className="text-gray-700 text-sm">Need an account? </span>
              <span className="text-blue-600 text-sm underline font-bold">Register</span>
              
            </button>
          </div>
        ) : (
          <div className="text-center mt-4">
            <button
              onClick={() => setIsLogin(true)}
              className="text-sm font-medium hover:underline bg-transparent border-none"
            >
              <span className="text-gray-700 text-sm">Already have an account? </span>
              <span className="text-blue-600 text-sm underline font-bold">Sign In</span>
              
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Home;