const express = require("express");
const User = require("../models/User");
const { hashPassword, comparePassword, generateToken, verifyToken, validateEmail } = require("../middleware/auth");

const router = express.Router();

// Register Route
router.post("/register", async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    if (!validateEmail(email)) {
      return res.status(400).json({ message: "Invalid email format" });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    // Hash password and create user
    const hashedPassword = await hashPassword(password);
    const user = await User.create({
      email,
      password: hashedPassword
    });

    // Generate token and set cookie
    const token = generateToken(user._id);

    // Determine if we're in development or production
    const isProduction = process.env.NODE_ENV === 'production';

    // Configure cookie settings based on environment
    res.cookie("token", token, {
      httpOnly: true,
      secure: isProduction, // Only use secure in production
      sameSite: isProduction ? "none" : "lax", // Use "none" for cross-site in production, "lax" for development
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    });

    res.status(201).json({
      message: "User registered successfully",
      user: {
        email: user.email
      }
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ message: "Error registering user" });
  }
});

// Login Route
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Verify password
    const isValidPassword = await comparePassword(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Generate token and set cookie
    const token = generateToken(user._id);

    // Determine if we're in development or production
    const isProduction = process.env.NODE_ENV === 'production';

    // Configure cookie settings based on environment
    res.cookie("token", token, {
      httpOnly: true,
      secure: isProduction, // Only use secure in production
      sameSite: isProduction ? "none" : "lax", // Use "none" for cross-site in production, "lax" for development
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    });

    res.json({
      message: "Login successful",
      user: {
        email: user.email
      },
      token: token
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Error logging in" });
  }
});

// Get Current User Route
router.get("/user", verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json({
      id: user._id,
      email: user.email
    });
  } catch (error) {
    console.error("Error fetching user:", error);
    if (error.name === 'CastError') {
      return res.status(400).json({ message: "Invalid user ID format" });
    }
    res.status(500).json({ message: "Error fetching user data" });
  }
});

// Logout Route
router.post("/logout", (req, res) => {
  res.clearCookie("token");
  res.json({ message: "Logged out successfully" });
});

module.exports = router;