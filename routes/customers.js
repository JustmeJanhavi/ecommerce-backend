const express = require('express');
const router = express.Router();
const mysql = require('mysql2');
const jwt = require('jsonwebtoken');
require('dotenv').config();


// DB Connection (replace values as per your local setup)
const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});

// Middleware to verify JWT and attach user info
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer <token>

  if (!token) return res.status(401).json({ message: 'Token missing' });

  jwt.verify(token, 'your-secret-key', (err, decoded) => {
    if (err) return res.status(403).json({ message: 'Invalid token' });
    console.log('✅ Decoded token:', decoded);  // <-- Add this temporarily

    req.user = decoded; // contains user_id, store_id, user_type
    next();
  });
}

// GET /api/customers
router.get('/', authenticateToken, (req, res) => {
  const { store_id, user_type } = req.user;

  // Optional: Only allow shop_owner to access
  if (user_type !== 'shop_owner') {
    return res.status(403).json({ message: 'Access denied' });
  }

  const sql = `
  SELECT
  c.customer_id,
  c.customer_name,
  c.date_joined,
  c.phone_number,
  COUNT(DISTINCT o.order_id) AS no_of_orders,
  IFNULL(SUM(p.price * oi.quantity), 0) AS amount_spent
FROM customers c
LEFT JOIN orders o ON c.customer_id = o.customer_id
LEFT JOIN order_items oi ON o.order_id = oi.order_id
LEFT JOIN products p ON oi.product_id = p.product_id
WHERE c.store_id = ?
GROUP BY c.customer_id
ORDER BY c.date_joined DESC;

  `;

  db.query(sql, [store_id], (err, results) => {
    if (err) {
      console.error('Error fetching feedback:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }

    res.json(results);
  });
});


// POST /api/customers/add
router.post('/add', authenticateToken, (req, res) => {
  const { store_id } = req.user;
  const { customer_name, email, phone_number, address, password } = req.body;

  if (!customer_name || !email || !phone_number || !password) {
    return res.status(400).json({ message: 'Missing required fields' });
  }

  const sql = `
    INSERT INTO customers (customer_name, email, phone_number, address, password, date_joined, store_id)
    VALUES (?, ?, ?, ?, ?, NOW(), ?)
  `;

  const values = [customer_name, email, phone_number, address, password, store_id];

  db.query(sql, values, (err, result) => {
    if (err) {
      console.error('Error inserting customer:', err);
      return res.status(500).json({ error: 'Database insert failed' });
    }

    res.status(201).json({ message: 'Customer added successfully' });
  });
});

module.exports = router;
