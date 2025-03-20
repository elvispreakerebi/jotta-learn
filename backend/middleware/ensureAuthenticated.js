const jwt = require('jsonwebtoken');

const ensureAuthenticated = (req, res, next) => {
  // Check for token in cookies first
  let token = req.cookies.token;

  // If no token in cookies, check Authorization header (for API clients)
  if (!token && req.headers.authorization) {
    const authHeader = req.headers.authorization;
    if (authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }
  }

  if (!token) {
    console.log('Authentication failed: No token provided');
    return res.status(401).json({ error: "Unauthorized. Please log in." });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = {
      id: decoded.id,
      _id: decoded.id  // Adding _id for mongoose compatibility
    };
    next();
  } catch (error) {
    console.log(`Authentication failed: ${error.message}`);
    res.status(401).json({ error: "Invalid token. Please log in again." });
  }
};
  
  module.exports = ensureAuthenticated;
  