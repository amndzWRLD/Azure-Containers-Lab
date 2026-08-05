'use strict';

const express = require('express');
const cors = require('cors');
const { MongoClient } = require('mongodb');

const {
  MONGO_HOST = 'localhost',
  MONGO_PORT = '27017',
  MONGO_USER,
  MONGO_PASS,
  MONGO_DB = 'appdb',
} = process.env;

const mongoUri = `mongodb://${MONGO_USER}:${MONGO_PASS}@${MONGO_HOST}:${MONGO_PORT}`;

const app = express();

app.use(cors());
app.use(express.json());

let db;

// GET /items — return all documents in the items collection
app.get('/items', async (req, res) => {
  try {
    const items = await db.collection('items').find({}).toArray();
    res.status(200).json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /items — insert a new document into the items collection
app.post('/items', async (req, res) => {
  const { name } = req.body || {};

  if (name === undefined || name === null) {
    return res.status(400).json({ error: 'name is required' });
  }

  try {
    const result = await db.collection('items').insertOne({ name });
    res.status(201).json({ insertedId: result.insertedId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

async function startServer() {
  try {
    const client = new MongoClient(mongoUri);
    await client.connect();
    db = client.db(MONGO_DB);
    console.log(`Connected to MongoDB at ${MONGO_HOST}:${MONGO_PORT}`);

    app.listen(3000, () => {
      console.log('Server running on port 3000');
    });
  } catch (err) {
    console.error('Failed to connect to MongoDB:', err.message);
    process.exit(1);
  }
}

startServer();
