const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
require('dotenv').config();

// ✅ Use shared connection pool
const pool = require('./db');

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
router.get('/', authenticateToken, async (req, res) => {
  const { store_id, user_type } = req.user;

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

  try {
    const [results] = await pool.query(sql, [store_id]);
    res.json(results);
  } catch (err) {
    console.error('Error fetching feedback:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/customers/add
router.post('/add', authenticateToken, async (req, res) => {
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

  try {
    await pool.query(sql, values);
    res.status(201).json({ message: 'Customer added successfully' });
  } catch (err) {
    console.error('Error inserting customer:', err);
    res.status(500).json({ error: 'Database insert failed' });
  }
});

module.exports = router;
