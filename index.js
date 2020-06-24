const express = require('express');
const http = require('http');
const pg = require('pg');
const moment = require('moment-timezone');

const MAX_RESULT_LEN = 100;

const validateISOTimestamp = (value) => {
  const isValid = value ? moment(value, moment.ISO_8601).isValid() : false;
  if (!isValid) {
    throw new Error(`Wrong timestamp: ${value}`);
  }
  return value;
};

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
    res.status(401, 'Unauthorized').end();
  }
};

const pool = new pg.Pool({
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

const getEnvironments = (since) => {
  let condition = '';
  let parameters = [];
  if (since) {
    condition = `WHERE last_changed >= timestamp $1`;
    parameters = [since];
  }

  return new Promise((resolve, reject) => {
    pool.query(
      `SELECT id, org_id, owner, note, last_changed FROM environment ${condition} ORDER BY id ASC LIMIT ${MAX_RESULT_LEN}`,
      parameters,
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

const getReservations = (since) => {
  let condition = '';
  let parameters = [];
  if (since) {
    condition = `WHERE last_changed >= timestamp $1`;
    parameters = [since];
  }
  const query = `SELECT id, environment_id, lower(duration) as begin, upper(duration) as end, note, by_user, last_changed FROM reservation ${condition} ORDER BY duration ASC LIMIT ${MAX_RESULT_LEN}`;
  return new Promise((resolve, reject) => {
    pool.query(query, parameters, (error, results) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(results.rows);
    });
  });
};

const addReservation = ({ begin, end, environmentId, user }) => {
  const query = `INSERT INTO reservation(environment_id, duration, by_user) VALUES ($1, tstzrange($2, $3, '[)'), $4);`;
  return new Promise((resolve, reject) => {
    pool.query(query, [environmentId, begin, end, user], (error, results) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(results.rows);
    });
  });
};

const updateReservation = ({
  reservationId,
  begin,
  end,
  environmentId,
  note,
}) => {
  const query = `UPDATE reservation SET duration = tstzrange($3, $4, '[)'), note = $5 WHERE id = $1 and environment_id = $2`;
  return new Promise((resolve, reject) => {
    pool.query(
      query,
      [reservationId, begin, end, environmentId, note],
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

app.post(
  '/api/v0/environment/:environmentId/add-reservation',
  authMiddleware,
  async (req, res) => {
    let { begin, end, user } = req.body || {};
    begin = validateISOTimestamp(begin);
    end = validateISOTimestamp(end);
    if (!user) {
      throw new Error('No details about who made reservation');
    }
    const newReservation = await addReservation({
      begin,
      end,
      environmentId: req.params.environmentId,
      user,
    });
    return res.send(newReservation);
  }
);

app.put(
  '/api/v0/environment/:environmentId/reservation/:reservationId',
  authMiddleware,
  async (req, res) => {
    let { begin, end, note } = req.body || {};
    begin = validateISOTimestamp(begin);
    end = validateISOTimestamp(end);
    const updatedReservation = await updateReservation({
      begin,
      end,
      environmentId: req.params.environmentId,
      reservationId: req.params.reservationId,
      note: note || null,
    });
    return res.send(updatedReservation);
  }
);

app.get('/api/v0/environment', authMiddleware, async (req, res) => {
  const since = req.query.since
    ? validateISOTimestamp(req.query.since)
    : undefined;
  const envs = await getEnvironments(since);
  return res.send(envs);
});

app.get('/api/v0/reservation', authMiddleware, async (req, res) => {
  const since = req.query.since
    ? validateISOTimestamp(req.query.since)
    : undefined;
  const reservations = await getReservations(since);
  return res.send(reservations);
});

const server = http.createServer(app);
const port = process.env.PORT || 51111;
server.listen(port);
