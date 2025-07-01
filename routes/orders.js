const express = require('express');
const router = express.Router();
require('dotenv').config();

// ✅ Use shared connection pool
const pool = require('./db');

// ✅ GET: all orders for a store
router.get('/', async (req, res) => {
  const storeId = req.query.storeId;
  if (!storeId) return res.status(400).json({ error: 'storeId is required in query' });

  const sql = `
    SELECT o.order_id, o.date_ordered, o.total_amount, o.status, c.customer_name
    FROM orders o
    JOIN customers c ON o.customer_id = c.customer_id
    WHERE c.store_id = ?
    ORDER BY o.date_ordered DESC
  `;

  try {
    const [results] = await pool.query(sql, [storeId]);
    res.json(results);
  } catch (err) {
    console.error('🔴 Error fetching orders:', err.message);
    res.status(500).json({ error: 'Database error while fetching orders' });
  }
});

// ✅ POST: create new order with store_id
router.post('/', async (req, res) => {
  const { customer_id, total_amount, status, items, store_id } = req.body;

  if (!customer_id || !total_amount || !status || !store_id || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Missing required fields (customer_id, total_amount, status, store_id, items)' });
  }

  const orderSql = `
    INSERT INTO orders (date_ordered, total_amount, customer_id, status)
    VALUES (NOW(), ?, ?, ?)
  `;

  try {
    const [result] = await pool.query(orderSql, [total_amount, customer_id, status]);
    const orderId = result.insertId;

    const itemSql = `
      INSERT INTO order_items (order_id, product_id, quantity, store_id)
      VALUES ?
    `;
    const values = items.map(item => [orderId, item.product_id, item.quantity, store_id]);

    await pool.query(itemSql, [values]);

    res.status(201).json({
      message: '✅ Order and items saved successfully',
      orderId
    });
  } catch (err) {
    console.error('🔴 Error saving order:', err.message);
    res.status(500).json({ error: 'Database error while saving order or items' });
  }
});

// ✅ PUT: update order status and insert into sales if Delivered
router.put('/:orderId/status', async (req, res) => {
  const { orderId } = req.params;
  const { status, storeId } = req.body;

  if (!status || !storeId) {
    return res.status(400).json({ error: 'Both status and storeId are required in body' });
  }

  const updateSql = `
    UPDATE orders o
    JOIN customers c ON o.customer_id = c.customer_id
    SET o.status = ?
    WHERE o.order_id = ? AND c.store_id = ?
  `;

  try {
    const [result] = await pool.query(updateSql, [status, orderId, storeId]);

    if (result.affectedRows === 0) {
      return res.status(403).json({ error: 'Unauthorized: Order not found for this store or not allowed' });
    }

    if (status !== 'Delivered') {
      return res.json({ message: '✅ Order status updated successfully' });
    }

    // ✅ Step 1: Get order items
    const fetchItemsSql = `
      SELECT 
        oi.product_id,
        oi.quantity,
        p.price AS price,
        o.customer_id,
        o.date_ordered
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.order_id
      JOIN customers c ON o.customer_id = c.customer_id
      JOIN products p ON oi.product_id = p.product_id
      WHERE oi.order_id = ? AND c.store_id = ?
    `;

    const [items] = await pool.query(fetchItemsSql, [orderId, storeId]);

    if (!items || items.length === 0) {
      return res.status(404).json({ error: 'No order items found for this order' });
    }

    const salesValues = items.map(item => [
      item.date_ordered,
      'online',
      item.product_id,
      item.quantity,
      item.price,
      item.price * item.quantity,
      storeId,
      item.customer_id
    ]);

    const insertSalesSql = `
      INSERT INTO sales (
        sale_date, sale_type, product_id,
        quantity_sold, unit_price_at_sale,
        total_sale_amount, store_id, customer_id
      ) VALUES ?
    `;

    await pool.query(insertSalesSql, [salesValues]);

    res.json({ message: '✅ Order marked as Delivered and sales recorded' });
  } catch (err) {
    console.error('🔴 Error processing order status update:', err.message);
    res.status(500).json({ error: 'Server error while updating order and recording sales' });
  }
});

// ✅ GET: products for a store
router.get('/products', async (req, res) => {
  const storeId = req.query.storeId;
  if (!storeId) {
    return res.status(400).json({ error: 'storeId is required in query' });
  }

  const sql = `SELECT * FROM products WHERE store_id = ?`;

  try {
    const [results] = await pool.query(sql, [storeId]);
    res.json(results);
  } catch (err) {
    console.error('🔴 Error fetching products:', err.message);
    res.status(500).json({ error: 'Database error while fetching products' });
  }
});

// ✅ NEW: GET customers filtered by storeId
router.get('/customers_orders', async (req, res) => {
  const storeId = req.query.storeId;
  if (!storeId) return res.status(400).json({ error: 'storeId is required in query' });

  const sql = `SELECT customer_id, customer_name FROM customers WHERE store_id = ?`;

  try {
    const [results] = await pool.query(sql, [storeId]);
    res.json(results);
  } catch (err) {
    console.error('🔴 Error fetching customers:', err.message);
    res.status(500).json({ error: 'Database error while fetching customers' });
  }
});

module.exports = router;
