import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import axiosInstance from "../config/axios";

const Home = () => {
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-full max-w-md p-4">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-black mb-2">Welcome to Jotta</h1>
          <p className="text-gray-800 text-base mb-6">
            Transform your YouTube videos into interactive flashcards for easy learning and better retention.
          </p>
        </div>

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
            <label htmlFor="password" className="block text-sm font-medium text-gray-800">
              Password
            </label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>

          <button
            type="submit"
            className="w-full py-2 px-4 mt-4 border border-transparent rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none"
          >
            {isLogin ? "Log in" : "Register"}
          </button>
        </form>

        {isLogin ? (
          <div className="text-center mt-4">
            <button
              onClick={() => setIsLogin(false)}
              className=" text-sm font-medium hover:underline bg-transparent border-none"
            >
              <span className="text-gray-700 text-sm">Need an account? </span>
              <span className="text-blue-600 text-sm">Register</span>
              
            </button>
          </div>
        ) : (
          <div className="text-center mt-4">
            <button
              onClick={() => setIsLogin(true)}
              className="text-sm font-medium hover:underline bg-transparent border-none"
            >
              <span className="text-gray-700 text-sm">Already have an account? </span>
              <span className="text-blue-600 text-sm underline">Sign In</span>
              
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Home;