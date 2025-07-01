const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

// ✅ Use shared MySQL pool
const pool = require('./db'); // Assuming ./db exports the pool from mysql2/promise

// ✅ Multer setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../uploads');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath);
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  },
});
const upload = multer({ storage });

// // ✅ JWT Authentication Middleware
// function authenticateToken(req, res, next) {
//   const authHeader = req.headers['authorization'];
//   const token = authHeader && authHeader.split(' ')[1]; // Bearer <token>

//   if (!token) return res.status(401).json({ message: 'Token missing' });

//   jwt.verify(token, 'your-secret-key', (err, decoded) => {
//     if (err) return res.status(403).json({ message: 'Invalid token' });
//     req.user = decoded; // { user_id, store_id, user_type }
//     next();
//   });
// }

// ✅ GET /api/adminstore — Get store data for logged-in store
router.get('/', async (req, res) => {
  const store_id = req.query.storeId;

  const query = `SELECT * FROM stores WHERE store_id = ?`;
  try {
    const [results] = await pool.query(query, [store_id]);

    if (results.length === 0) {
      return res.status(404).json({ error: 'Store not found' });
    }
    res.json({ store: results[0] });
  } catch (err) {
    console.error('❌ Error fetching store:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// ✅ PUT /api/adminstore — Update store details for logged-in store
router.put(
  '/',
  upload.fields([
    { name: 'landing_image', maxCount: 1 },
    { name: 'store_photo', maxCount: 1 },
  ]),
  async (req, res) => {
    const store_id = req.query.storeId;
    const {
      store_name,
      store_tagline,
      store_address,
      instagram_link,
      facebook_link,
      store_email,
      store_desc,
    } = req.body;

    const landingImage = req.files['landing_image']
      ? `uploads/${req.files['landing_image'][0].filename}`
      : null;

    const storePhoto = req.files['store_photo']
      ? `uploads/${req.files['store_photo'][0].filename}`
      : null;

    const fields = [];
    const values = [];

    if (store_name) (fields.push('store_name = ?'), values.push(store_name));
    if (store_tagline) (fields.push('store_tagline = ?'), values.push(store_tagline));
    if (store_address) (fields.push('store_address = ?'), values.push(store_address));
    if (instagram_link) (fields.push('instagram_link = ?'), values.push(instagram_link));
    if (facebook_link) (fields.push('facebook_link = ?'), values.push(facebook_link));
    if (store_email) (fields.push('store_email = ?'), values.push(store_email));
    if (store_desc) (fields.push('store_desc = ?'), values.push(store_desc));
    if (landingImage) (fields.push('landing_image = ?'), values.push(landingImage));
    if (storePhoto) (fields.push('store_photo = ?'), values.push(storePhoto));

    fields.push('updated_at = NOW()');
    values.push(store_id); // For WHERE clause

    const query = `UPDATE stores SET ${fields.join(', ')} WHERE store_id = ?`;

    try {
      const [result] = await pool.query(query, values);

      if (result.affectedRows === 0) {
        return res.status(404).json({ error: 'Store not found or no changes' });
      }

      res.json({ message: '✅ Store updated successfully' });
    } catch (err) {
      console.error('❌ Error updating store:', err);
      res.status(500).json({ error: 'Failed to update store' });
    }
  }
);

module.exports = router;
