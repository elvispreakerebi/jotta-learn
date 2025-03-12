
require("dotenv").config();
const express = require("express");
const connectDB = require("./config/db");
const session = require("express-session");
const passport = require("passport");
const flash = require("connect-flash");
const cors = require("cors");
const MongoStore = require("connect-mongo");


const app = express();

// Cors Middleware
app.use(cors({
  origin: ["http://localhost:3000", "https://jotta.onrender.com"],
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));



// Connect to MongoDB
connectDB();

// Passport Configuration
require("./config/passport")(passport);

// Session Middleware using MongoDB
app.use(
    session({
      secret: process.env.SESSION_SECRET || "your_secret", // Use a strong secret in production
      resave: false,
      saveUninitialized: false,
      store: MongoStore.create({
        mongoUrl: process.env.MONGO_URI, // Your MongoDB connection string
      }),
      cookie: {
        secure: true, // Set to true for HTTPS
        httpOnly: true, // Prevent client-side access to the cookie
        sameSite: 'none', // Required for cross-site cookies
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
      },
    })
);

// Flash Middleware
app.use(flash());

// Passport Middleware
app.use(passport.initialize());
app.use(passport.session());

// Routes
app.use("/auth", require("./routes/auth"));
app.use("/youtube", require("./routes/youtube"));


// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
