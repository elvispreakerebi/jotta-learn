
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
  origin: process.env.NODE_ENV === 'production' 
    ? process.env.CLIENT_URL 
    : "http://localhost:3000",
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
        secure: process.env.NODE_ENV === 'production', // Set to false in development
        httpOnly: true, // Prevent client-side access to the cookie
        sameSite: 'none', // Use 'lax' for development
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        domain: process.env.NODE_ENV === 'production' ? 'onrender.com' : 'localhost', // Set the domain based on the environment
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
