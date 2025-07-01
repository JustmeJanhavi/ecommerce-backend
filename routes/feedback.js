const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
require('dotenv').config();

// ✅ Use shared connection pool
const pool = require('./db');

// // Middleware to verify JWT and attach user info
// function authenticateToken(req, res, next) {
//   const authHeader = req.headers['authorization'];
//   const token = authHeader && authHeader.split(' ')[1]; // Bearer <token>

//   if (!token) return res.status(401).json({ message: 'Token missing' });

//   jwt.verify(token, 'your-secret-key', (err, decoded) => {
//     if (err) return res.status(403).json({ message: 'Invalid token' });
//     console.log('✅ Decoded token:', decoded);  // <-- Add this temporarily

//     req.user = decoded; // contains user_id, store_id, user_type
//     next();
//   });
// }

// GET /api/feedback - fetch feedback only for the logged-in shop owner's store
router.get('/', async (req, res) => {
  const store_id = req.query.storeId;

  if (!store_id) {
    return res.status(400).json({ error: 'storeId is required in query' });
  }

  const sql = `
    SELECT 
      f.feedback_id, 
      f.review_date, 
      f.rating, 
      f.review_description, 
      c.customer_name, 
      p.product_name
    FROM feedback f
    JOIN customers c ON f.customer_id = c.customer_id
    JOIN products p ON f.product_id = p.product_id
    WHERE f.store_id = ?
    ORDER BY f.review_date DESC
  `;

  try {
    const [results] = await pool.query(sql, [store_id]);
    res.json(results);
  } catch (err) {
    console.error('Error fetching feedback:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});


module.exports = router;
