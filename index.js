const express = require('express');
const http = require('http');
const Pool = require('pg').Pool;

const authMiddleware = async (req, res, next) => {
  try {
    const token = (req.headers.authorization || '').split(' ')[1];
    if (!token) {
      throw 'Empty authorization token';
    }
    await validateAPIToken(token);
    next();
  } catch (error) {
    console.error(error);
    res.status(401);
  }
};

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const validateAPIToken = (token) => {
  return new Promise((resolve, reject) => {
    pool.query(
      'SELECT id FROM api_tokens WHERE token = $1',
      [token],
      (error, results) => {
        if (error) {
          reject(error);
          return;
        }
        if (results.rows.length === 0) {
          reject(new Error('No such authorization token'));
        }
        resolve();
      }
    );
  });
};

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

app.get('/api/v0/environment', authMiddleware, async (req, res) => {
  const envs = await getEnvironments();
  return res.send(envs);
});

const server = http.createServer(app);
const port = process.env.PORT || 51111;
server.listen(port);
