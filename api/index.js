const express = require('express');
const cors = require('cors');
const serverless = require('serverless-http');
const path = require('path');

// Routes
const productsRoute = require('../routes/products');
const customerRoute = require('../routes/customers');
const ordersRoute = require('../routes/orders');
const customerORoute = require('../routes/customers_orders');
const authRoute = require('../routes/auth');
const feedbackRoute = require('../routes/feedback');
const shopRoutes = require('../routes/shopRoutes');
const cartRoutes = require('../routes/carts');
const statRoute = require('../routes/statistics');
const storeRoute = require('../routes/stores');
const storeDetailsRoute = require('../routes/storeDetails');
const customerAuthRoutes = require('../routes/cus_auth');
const customerOrderPlaced = require('../routes/orderplaced');
const overviewRoute = require('../routes/overview');

const app = express();

app.use(cors());
app.use(express.json());
// app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

app.use('/api', cartRoutes);
app.use('/api/products', productsRoute);
app.use('/api/store', storeDetailsRoute);
app.use('/api/customers', customerRoute);
app.use('/api', shopRoutes);
app.use('/api/orders', ordersRoute);
app.use('/api/customers_orders', customerORoute);
app.use('/api/feedback', feedbackRoute);
app.use('/api/auth', authRoute);
app.use('/api/customer/auth', customerAuthRoutes);
app.use('/api', customerOrderPlaced);
app.use('/api/statistics', statRoute);
app.use('/api/stats/overview', overviewRoute);
app.use('/api/adminstore', storeRoute);

// Export as a Vercel serverless function
module.exports = app;
module.exports.handler = serverless(app);
