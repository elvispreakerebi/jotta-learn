const jwt = require('jsonwebtoken');

const ensureAuthenticated = (req, res, next) => {
  const token = req.cookies.token;

  if (!token) {
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
    res.status(401).json({ error: "Invalid token. Please log in again." });
  }
};
  
  module.exports = ensureAuthenticated;
  