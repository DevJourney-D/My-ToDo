const express = require('express');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Basic middleware
app.use(express.json());

// Simple test route
app.get('/', (req, res) => {
  res.json({ message: 'Simple test server is running!' });
});

app.listen(PORT, () => {
  console.log(`Simple test server is running on port ${PORT}`);
});

module.exports = app;
