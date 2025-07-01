const express = require('express');
const router = express.Router();
const mysql = require('mysql2');

// DB Connection (reuse or export from a common config)
const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});

// 🛒 GET /api/store/:storeId/products
router.get('/store/:storeId/products', (req, res) => {
  const { storeId } = req.params;

  const query = `
    SELECT * FROM products 
    WHERE store_id = ?
  `;

  db.query(query, [storeId], (err, results) => {
    if (err) {
      console.error('Error fetching products:', err);
      return res.status(500).json({ error: 'Database error' });
    }

    // Extract unique categories
    const categories = [...new Set(results.map(p => p.product_category))];

    res.json({
      categories,
      products: results
    });
  });
});

// 🛒 GET /api/store/:storeId/bestsellers
router.get('/store/:storeId/bestsellers', (req, res) => {
    const { storeId } = req.params;
  
    const query = `
      SELECT 
        p.*, 
        IFNULL(SUM(oi.quantity), 0) AS total_sold
      FROM 
        products p
      LEFT JOIN 
        order_items oi 
        ON p.product_id = oi.product_id AND oi.store_id = ?
      WHERE 
        p.store_id = ?
      GROUP BY 
        p.product_id
      ORDER BY 
        total_sold DESC
      LIMIT 5
    `;
  
    db.query(query, [storeId, storeId], (err, results) => {
      if (err) {
        console.error('Error fetching bestsellers:', err);
        return res.status(500).json({ error: 'Database error' });
      }
  
      res.json({ bestsellers: results });
    });
  });


  

  
module.exports = router;
