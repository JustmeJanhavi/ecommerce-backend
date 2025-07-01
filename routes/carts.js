const express = require('express');
const router = express.Router();
const mysql = require('mysql2');

// DB Connection
const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});

// ✅ Create or get active cart
router.post('/carts', (req, res) => {
  const { store_id, customer_id } = req.body;

  // Check if any cart exists (regardless of status)
  const checkQuery = `
    SELECT cart_id, status FROM carts
    WHERE store_id = ? AND customer_id = ?
  `;

  db.query(checkQuery, [store_id, customer_id], (err, results) => {
    if (err) {
      console.error('Error checking cart:', err);
      return res.status(500).json({ error: 'Server error' });
    }

    if (results.length > 0) {
      const cart = results[0];

      if (cart.status === 'completed') {
        // 🟡 Reactivate the cart
        const updateQuery = `
          UPDATE carts SET status = 'active', updated_at = NOW()
          WHERE cart_id = ?
        `;
        db.query(updateQuery, [cart.cart_id], (err) => {
          if (err) {
            console.error('Error reactivating cart:', err);
            return res.status(500).json({ error: 'Server error' });
          }

          return res.json({ cart_id: cart.cart_id });
        });
      } else {
        // 🟢 Cart is already active
        return res.json({ cart_id: cart.cart_id });
      }
    } else {
      // 🔵 No cart exists → create one
      const insertQuery = `
        INSERT INTO carts (store_id, customer_id, status, created_at, updated_at)
        VALUES (?, ?, 'active', NOW(), NOW())
      `;

      db.query(insertQuery, [store_id, customer_id], (err, result) => {
        if (err) {
          console.error('Error creating cart:', err);
          return res.status(500).json({ error: 'Server error' });
        }

        res.status(201).json({ cart_id: result.insertId });
      });
    }
  });
});


// ✅ Add item to cart
router.post('/cart-items', (req, res) => {
  const { cart_id, product_id, quantity } = req.body;

  // Check if item already exists
  const checkQuery = `
    SELECT * FROM cart_items WHERE cart_id = ? AND product_id = ?
  `;

  db.query(checkQuery, [cart_id, product_id], (err, results) => {
    if (err) {
      console.error('Error checking item:', err);
      return res.status(500).json({ error: 'Server error' });
    }

    if (results.length > 0) {
      // Update quantity if exists
      const updateQuery = `
        UPDATE cart_items SET quantity = quantity + ?
        WHERE cart_id = ? AND product_id = ?
      `;

      db.query(updateQuery, [quantity, cart_id, product_id], (err) => {
        if (err) {
          console.error('Error updating quantity:', err);
          return res.status(500).json({ error: 'Server error' });
        }

        return res.json({ message: 'Quantity updated' });
      });

    } else {
      // Insert new cart item
      const insertQuery = `
        INSERT INTO cart_items (cart_id, product_id, quantity)
        VALUES (?, ?, ?)
      `;

      db.query(insertQuery, [cart_id, product_id, quantity], (err) => {
        if (err) {
          console.error('Error inserting item:', err);
          return res.status(500).json({ error: 'Server error' });
        }

        return res.status(201).json({ message: 'Item added to cart' });
      });
    }
  });
});


// ✅ GET /api/carts/:storeId/:customerId/items → fetch items in cart
router.get('/carts/:storeId/:customerId/items', (req, res) => {
    const { storeId, customerId } = req.params;
  
    const query = `
      SELECT ci.item_id, ci.product_id, ci.quantity, p.product_name AS name, p.price, p.image_url
      FROM carts c
      JOIN cart_items ci ON c.cart_id = ci.cart_id
      JOIN products p ON ci.product_id = p.product_id
      WHERE c.store_id = ? AND c.customer_id = ? AND c.status = 'active'
    `;
  
    db.query(query, [storeId, customerId], (err, results) => {
      if (err) {
        console.error('Error fetching cart items:', err);
        return res.status(500).json({ error: 'Server error' });
      }
      res.json(results);
    });
  });

  
  router.put('/cart-items/:item_id', (req, res) => {
    const { quantity } = req.body;
    const { item_id } = req.params;
  
    if (quantity < 1) {
      return res.status(400).json({ error: 'Quantity must be at least 1' });
    }
  
    const updateQuery = `
      UPDATE cart_items SET quantity = ?
      WHERE item_id = ?
    `;
  
    db.query(updateQuery, [quantity, item_id], (err, result) => {
      if (err) {
        console.error('Error updating quantity:', err);
        return res.status(500).json({ error: 'Server error' });
      }
      res.json({ message: 'Quantity updated successfully' });
    });
  });

  
  router.delete('/cart-items/:item_id', (req, res) => {
    const { item_id } = req.params;
  
    const deleteQuery = `DELETE FROM cart_items WHERE item_id = ?`;
  
    db.query(deleteQuery, [item_id], (err, result) => {
      if (err) {
        console.error('Error deleting cart item:', err);
        return res.status(500).json({ error: 'Server error' });
      }
  
      res.json({ message: 'Item removed from cart' });
    });
  });
  
  router.post('/cart/orders', (req, res) => {
    const { customer_id, store_id, total_amount, status, items } = req.body;
    const now = new Date();
  
    // Step 1: Insert into orders
    const orderQuery = `
      INSERT INTO orders (date_ordered, total_amount, customer_id, status)
      VALUES (?, ?, ?, ?)
    `;
  
    db.query(orderQuery, [now, total_amount, customer_id, status], (err, orderResult) => {
      if (err) {
        console.error('Error inserting order:', err);
        return res.status(500).json({ error: 'Failed to place order' });
      }
  
      const orderId = orderResult.insertId;
  
      // Step 2: Insert into order_items
      const orderItems = items.map(item => [orderId, item.product_id, item.quantity, store_id]);
      const orderItemsQuery = `
        INSERT INTO order_items (order_id, product_id, quantity, store_id)
        VALUES ?
      `;
  
      db.query(orderItemsQuery, [orderItems], (err) => {
        if (err) {
          console.error('Error inserting order items:', err);
          return res.status(500).json({ error: 'Failed to add order items' });
        }
  
        // Step 3: Get the active cart_id for this customer and store
        const cartQuery = `
          SELECT cart_id FROM carts
          WHERE customer_id = ? AND store_id = ? AND status = 'active'
        `;
  
        db.query(cartQuery, [customer_id, store_id], (err, cartResults) => {
          if (err) {
            console.error('Error fetching cart:', err);
            return res.status(500).json({ error: 'Failed to fetch cart' });
          }
  
          if (cartResults.length === 0) {
            return res.status(404).json({ error: 'No active cart found' });
          }
  
          const cart_id = cartResults[0].cart_id;
  
          // Step 4: Delete cart items
          db.query('DELETE FROM cart_items WHERE cart_id = ?', [cart_id], (err) => {
            if (err) {
              console.error('Error deleting cart items:', err);
              return res.status(500).json({ error: 'Failed to clear cart' });
            }
  
            // Step 5: Mark the cart as completed
            db.query(
              'UPDATE carts SET status = "completed", updated_at = NOW() WHERE cart_id = ?',
              [cart_id],
              (err) => {
                if (err) {
                  console.error('Error updating cart status:', err);
                  return res.status(500).json({ error: 'Failed to update cart' });
                }
  
                return res.status(201).json({ message: 'Order placed and cart cleared' });
              }
            );
          });
        });
      });
    });
  });
  

module.exports = router;
