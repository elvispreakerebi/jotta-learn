
require("dotenv").config();
const express = require("express");
const connectDB = require("./config/db");
const passport = require("passport");
const flash = require("connect-flash");
const cors = require("cors");


const app = express();

// Cors Middleware
app.use(
    cors({
      origin: process.env.NODE_ENV === "production"
        ? "http://localhost:3000" // Your frontend's production URL
        : "http://localhost:3000", // Development URL
      credentials: true, // Allow credentials
    })
);
app.use(express.json());
app.use(express.urlencoded({ extended: false }));



// Connect to MongoDB
connectDB();

// Passport Configuration
require("./config/passport")(passport);

// Flash Middleware
app.use(flash());

// Passport Middleware
app.use(passport.initialize());
app.use(passport.session());

// Routes
app.use("/auth", require("./routes/auth"));


// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
