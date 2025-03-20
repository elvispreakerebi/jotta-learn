require("dotenv").config();
const express = require("express");
const connectDB = require("./config/db");
const cors = require("cors");
const cookieParser = require("cookie-parser");


const app = express();

// Cors Middleware
const allowedOrigins = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'https://jotta-learn.netlify.app'
];

// If CLIENT_URL is set in environment, add it to allowed origins
if (process.env.CLIENT_URL) {
  allowedOrigins.push(process.env.CLIENT_URL);
}

app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, etc.)
    if (!origin) return callback(null, true);

    if (allowedOrigins.indexOf(origin) === -1) {
      console.log(`CORS blocked request from: ${origin}`);
      return callback(null, false);
    }
    console.log(`CORS allowed request from: ${origin}`);
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());



// Connect to MongoDB
connectDB();





// Routes
app.use("/auth", require("./routes/auth"));
app.use("/youtube", require("./routes/youtube"));


// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
