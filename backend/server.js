
require("dotenv").config();
const express = require("express");
const connectDB = require("./config/db");
const passport = require("passport");
const flash = require("connect-flash");


const app = express();


// Connect to MongoDB
connectDB();

// Passport Configuration
require("./config/passport")(passport);

// Flash Middleware
app.use(flash());

// Passport Middleware
app.use(passport.initialize());
app.use(passport.session());


// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
