// index.js
const express = require('express');
const path = require('path');
const config = require('./config');
const { migrate } = require('./database/db');
const routes = require('./routes/processes');

// Run database migrations
migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});

const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// EJS setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Mount routes
app.use('/', routes);

app.listen(config.port, () => {
  console.log(`Process Manager running on http://localhost:${config.port}`);
});
