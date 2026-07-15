// index.js
const express = require('express');
const path = require('path');
const config = require('./config');

const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

app.get('/', (req, res) => {
  res.send('Process Manager running!');
});

app.listen(config.port, () => {
  console.log(`Process Manager running on http://localhost:${config.port}`);
});
