const express = require('express');
const http = require('http');
const Pool = require('pg').Pool;

console.log('process.env.DATABASE_URL', process.env.DATABASE_URL);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const getEnvironments = () => {
  return new Promise((resolve, reject) => {
    pool.query(
      'SELECT * FROM environment ORDER BY id ASC',
      (error, results) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(results.rows);
      }
    );
  });
};

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.get('/environment', async (req, res) => {
  const envs = await getEnvironments();
  return res.send(envs);
});

const server = http.createServer(app);
const port = process.env.PORT || 51111;
server.listen(port);
