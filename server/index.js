const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Test route
app.get('/', (req, res) => {
  res.json({ message: 'BlinkSpeak server running!' });
});

// Save a message log
app.post('/api/messages', (req, res) => {
  const { message, timestamp } = req.body;
  console.log(`Message received: ${message} at ${timestamp}`);
  res.json({ success: true, message });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));