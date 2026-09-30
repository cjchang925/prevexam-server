const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const fs = require('fs');
const readline = require('readline');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const axios = require('axios');

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

// OAuth client ID of the frontend (public, not a secret). Access tokens issued
// to any other Google app are rejected.
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID
  || '814398908829-ev3belrqio4b67tp8anlhut0iihr5pb4.apps.googleusercontent.com';

// Browser origins allowed to make state-changing requests (CSRF protection).
// Comma-separated; override for other deployments.
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'https://prevexam.dece.nycu.edu.tw')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

// Enables the bulk CSV import routes when set; callers must send it in the
// X-Admin-Token header. Unset = routes disabled.
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';

const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours, matches the cookie
const MAX_UPLOAD_BYTES = 50 * 1024 * 1024; // 50MB

const app = express();

app.use(cookieParser());
// Cross-origin browser access only from our own origin(s)
app.use(cors({
  origin: (origin, callback) => {
    // No Origin header = same-origin or non-browser request
    callback(null, !origin || ALLOWED_ORIGINS.includes(origin));
  },
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.set('trust proxy', true);

// ---------------------------------------------------------------------------
// Database
// ---------------------------------------------------------------------------

// A pool reconnects on its own when a connection drops, so a MySQL error can
// no longer crash the whole server.
const db = mysql.createPool({
  host: "mysql",
  user: "root",
  password: "password",
  database: "prevexamdb",
  port: 3306,
  waitForConnections: true,
  connectionLimit: 10,
});

let serverStarted = false;
const MAX_RETRIES = 10;
const RETRY_DELAY = 5000; // 5 seconds

// Start listening only once MySQL is reachable (it may still be booting)
function waitForDatabase(retries = 0) {
  db.getConnection((err, connection) => {
    if (err) {
      console.error(`Error connecting to MySQL (attempt ${retries + 1}/${MAX_RETRIES}):`, err.message);

      if (retries < MAX_RETRIES) {
        console.log(`Retrying in ${RETRY_DELAY/1000} seconds...`);
        setTimeout(() => waitForDatabase(retries + 1), RETRY_DELAY);
      } else {
        console.error('Max retries reached. Exiting...');
        process.exit(1);
      }
      return;
    }

    connection.release();
    console.log('Connected to MySQL database successfully');

    if (!serverStarted) {
      serverStarted = true;
      app.listen(3001, () => {
        console.log('Server is listening to port 3001...');
      });
    }
  });
}

waitForDatabase();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Helper function to transform query results
const transformFileResults = (results) => {
  return results.map(row => [
    row.subject,
    row.professor,
    row.year,
    row.exam_type,
    row.file_extension,
    row.original_filename,
    row.file_path
  ]);
};

// Helper function to get data from a specific table
const getDataFromTable = (tableName, res) => {
  const sql = `SELECT * FROM ??`;
  db.query(sql, [tableName], (err, result) => {
    if (err) {
      console.error(`Error fetching data from ${tableName}:`, err);
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(transformFileResults(result));
  });
};

// Unique stored file name: <timestamp><6 random digits><ext>
const makeStoredFileName = (extension) => {
  const timestamp = new Date().toJSON().slice(0, 19).replaceAll(':', '-');
  const random = crypto.randomInt(0, 1000000).toString().padStart(6, '0');
  return timestamp + random + extension;
};

const removeUploadedFile = (req) => {
  if (req.file) {
    fs.unlink(req.file.path, (err) => {
      if (err) console.error('Error deleting rejected upload:', err);
    });
  }
};

// Constant-time comparison for secrets
const safeEqual = (a, b) => {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  return bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);
};

// ---------------------------------------------------------------------------
// Sessions (in memory: [{ token, user, expiresAt }])
// ---------------------------------------------------------------------------

let DB = [];

const findUserByToken = (token) => {
  if (!token) return undefined;
  const session = DB.find((ele) => ele.token === token);
  if (!session) return undefined;
  if (session.expiresAt <= Date.now()) {
    DB = DB.filter((ele) => ele !== session);
    return undefined;
  }
  return session.user;
};

// Drop expired sessions so the list cannot grow without bound
setInterval(() => {
  const now = Date.now();
  DB = DB.filter((ele) => ele.expiresAt > now);
}, 60 * 60 * 1000).unref();

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

// CSRF protection: SameSite=Lax cookies are still sent from sibling
// *.nycu.edu.tw sites, so state-changing requests must come from our origin.
// Browsers always send Origin on POST; requests without one (e.g. curl) carry
// no ambient browser cookies to abuse.
const requireAllowedOrigin = (req, res, next) => {
  const origin = req.get('Origin');
  if (origin && !ALLOWED_ORIGINS.includes(origin)) {
    req.resume();
    return res.status(403).json({ message: 'Forbidden origin' });
  }
  next();
};

// Runs before the upload is accepted, so unauthenticated requests never write
// anything to disk.
const requireSession = (req, res, next) => {
  const user = findUserByToken(req.cookies && req.cookies.token);
  if (!user) {
    // Drain the body so the client reliably receives the 401
    req.resume();
    return res.status(401).json({ message: 'Invalid user!' });
  }
  req.user = user;
  next();
};

const requireAdmin = (req, res, next) => {
  if (!ADMIN_TOKEN) {
    return res.status(404).json({ message: 'Not found' });
  }
  if (!safeEqual(req.get('X-Admin-Token') || '', ADMIN_TOKEN)) {
    return res.status(403).json({ message: 'Forbidden' });
  }
  next();
};

// ---------------------------------------------------------------------------
// Public data
// ---------------------------------------------------------------------------

app.get('/api/get-one-data', (req, res) => {
  getDataFromTable('one_files', res);
});

app.get('/api/get-two-data', (req, res) => {
  getDataFromTable('two_files', res);
});

app.get('/api/get-advance-data', (req, res) => {
  getDataFromTable('advance_files', res);
});

app.get('/api/get-other-data', (req, res) => {
  getDataFromTable('other_files', res);
});

// ---------------------------------------------------------------------------
// Admin: bulk CSV import (disabled unless ADMIN_TOKEN is set)
// ---------------------------------------------------------------------------

const processCSVUpload = async (tableName, req, res) => {
  const csvPath = '/home/ece-learn/src/csv_file/test.txt';
  const sourcePath = '/home/node/pastexam/';
  const destPath = '/home/node/files/';

  try {
    const fileStream = fs.createReadStream(csvPath, 'utf-8');
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });

    const promises = [];

    rl.on('line', (line) => {
      const arr = line.split(',');

      // Validate array has enough elements
      if (arr.length < 7) {
        console.error('Invalid CSV line format:', line);
        return;
      }

      const fileExtension = arr[4];
      const sourceFile = arr[6];
      // Unique name per file, so re-running the import never overwrites files
      const destFileName = makeStoredFileName(`.${fileExtension}`);
      const destFilePath = `${destPath}${destFileName}`;
      const dbPath = `files/${destFileName}`;

      // Create promise for file copy (fails instead of overwriting)
      const copyPromise = new Promise((resolve, reject) => {
        fs.copyFile(`${sourcePath}${sourceFile}`, destFilePath, fs.constants.COPYFILE_EXCL, (err) => {
          if (err) {
            console.error('Error copying file:', err);
            reject(err);
          } else {
            console.log('Successfully copied file', destFileName);
            resolve();
          }
        });
      });

      // Create promise for database insert with parameterized query
      const dbPromise = new Promise((resolve, reject) => {
        const sql = `INSERT INTO ?? (subject, professor, year, exam_type, file_extension, original_filename, file_path) VALUES (?, ?, ?, ?, ?, ?, ?)`;
        db.query(sql, [tableName, arr[0], arr[1], arr[2], arr[3], arr[4], arr[5], dbPath], (err, result) => {
          if (err) {
            console.error('Database insert error:', err);
            reject(err);
          } else {
            resolve(result);
          }
        });
      });

      promises.push(Promise.all([copyPromise, dbPromise]));
    });

    rl.on('close', async () => {
      try {
        await Promise.all(promises);
        res.redirect('/');
      } catch (error) {
        console.error('Error processing uploads:', error);
        res.status(500).json({ error: 'Upload processing failed' });
      }
    });

    rl.on('error', (error) => {
      console.error('Error reading CSV file:', error);
      res.status(500).json({ error: 'Failed to read CSV file' });
    });

  } catch (error) {
    console.error('Error in processCSVUpload:', error);
    res.status(500).json({ error: 'Upload failed' });
  }
};

app.get('/api/upload-one-data', requireAdmin, (req, res) => {
  processCSVUpload('one_files', req, res);
});

app.get('/api/upload-two-data', requireAdmin, (req, res) => {
  processCSVUpload('two_files', req, res);
});

app.get('/api/upload-advance-data', requireAdmin, (req, res) => {
  processCSVUpload('advance_files', req, res);
});

app.get('/api/upload-other-data', requireAdmin, (req, res) => {
  processCSVUpload('other_files', req, res);
});

// ---------------------------------------------------------------------------
// User uploads
// ---------------------------------------------------------------------------

const nameReg = /\.(txt|pdf|zip|rar|7z|jpe?g|png|mp4|mov|heic)$/i;
const emailReg = /@nycu\.edu\.tw$/i;

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'files/');
  },
  filename: (req, file, cb) => {
    cb(null, makeStoredFileName(path.extname(file.originalname).toLowerCase()));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: MAX_UPLOAD_BYTES,
    files: 1,
  },
  // Check the real file's extension before anything is written to disk
  // (the client-sent "filename" field alone can lie)
  fileFilter: (req, file, cb) => {
    if (!nameReg.test(file.originalname)) {
      req.fileRejected = true;
      return cb(null, false);
    }
    cb(null, true);
  },
});

// Wraps multer so its errors (e.g. file too large) become JSON responses
const acceptSingleFile = (req, res, next) => {
  upload.single('files')(req, res, (err) => {
    if (!err) return next();
    removeUploadedFile(req);
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ message: 'File too large!' });
    }
    console.error('Upload error:', err);
    return res.status(400).json({ message: 'Invalid upload!' });
  });
};

// Helper function to sanitize input
const sanitizeInput = (input) => {
  return typeof input === 'string' ? input.replaceAll(/\s/g, '') : '';
};

// Grade to table mapping
const gradeTableMap = {
  '大一': 'one_files',
  '大二': 'two_files',
  '大三以上選修': 'advance_files',
  '通識與其他': 'other_files'
};

app.post('/api/user-upload-file', requireAllowedOrigin, requireSession, acceptSingleFile, async (req, res) => {
  try {
    if (req.fileRejected) {
      return res.status(400).json({ message: 'Invalid file!' });
    }

    // Validate file was uploaded
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const user = req.user;
    if (!user.email || !emailReg.test(user.email)) {
      removeUploadedFile(req);
      return res.status(401).json({ message: 'Invalid user!' });
    }

    // Validate required fields
    if (!req.body.filename || !req.body.grade || !req.body.subject ||
      !req.body.teacher || !req.body.year || !req.body.type) {
      removeUploadedFile(req);
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Sanitize inputs
    const grade = sanitizeInput(req.body.grade);
    const subject = sanitizeInput(req.body.subject);
    const teacher = sanitizeInput(req.body.teacher);
    const year = sanitizeInput(req.body.year);
    const type = sanitizeInput(req.body.type);
    const filename = sanitizeInput(req.body.filename);

    // The displayed filename must be allowed and match the real file's type
    const storedExtension = path.extname(req.file.filename);
    if (!nameReg.test(filename) || path.extname(filename).toLowerCase() !== storedExtension) {
      console.log('Invalid file extension');
      removeUploadedFile(req);
      return res.status(400).json({ message: 'Invalid file!' });
    }

    // Determine table based on grade
    const tableName = gradeTableMap[grade];
    if (!tableName) {
      removeUploadedFile(req);
      return res.status(400).json({ message: 'Invalid grade category!' });
    }

    // Log upload history
    const storedFileName = req.file.filename;
    const logMessage = `Filename: ${storedFileName} grade: ${grade} subject: ${subject} teacher: ${teacher} year: ${year} from ${user.family_name || ''}${user.given_name || ''} email: ${user.email}\r\n`;

    fs.appendFile('/home/node/upload_history.log', logMessage, (err) => {
      if (err) {
        console.error('Error writing to upload history:', err);
      } else {
        console.log('Appended file successfully!');
      }
    });

    const filePath = 'files/' + storedFileName;
    const fullYear = year + '學年';
    const fileExtension = storedExtension.slice(1);

    // Use parameterized query to prevent SQL injection
    const sql = `INSERT INTO ?? (subject, professor, year, exam_type, file_extension, original_filename, file_path) VALUES (?, ?, ?, ?, ?, ?, ?)`;

    db.query(sql, [tableName, subject, teacher, fullYear, type, fileExtension, filename, filePath], (err) => {
      if (err) {
        console.error('Database insert error:', err);
        // Delete uploaded file on database error
        removeUploadedFile(req);
        return res.status(500).json({ message: 'Database error!' });
      }
      res.status(200).json({ message: 'Success!' });
    });

  } catch (error) {
    console.error('Error in file upload:', error);
    // Clean up uploaded file on error
    removeUploadedFile(req);
    res.status(500).json({ message: 'Error!' });
  }
});

// ---------------------------------------------------------------------------
// Authentication
// ---------------------------------------------------------------------------

const GOOGLE_TOKENINFO_URL = 'https://oauth2.googleapis.com/tokeninfo';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v1/userinfo';

app.post('/api/login', requireAllowedOrigin, async (req, res) => {
  try {
    const accessToken = req.body && req.body.access_token;
    if (typeof accessToken !== 'string' || !accessToken) {
      return res.status(400).json({ message: 'Missing access token' });
    }

    // Ask Google about the token instead of trusting the request body:
    // it must have been issued to our client, then gives us the profile.
    let user;
    try {
      const { data: tokenInfo } = await axios.get(GOOGLE_TOKENINFO_URL, {
        params: { access_token: accessToken },
        timeout: 10000,
      });
      if (tokenInfo.aud !== GOOGLE_CLIENT_ID) {
        return res.status(401).json({ message: 'Invalid Google token' });
      }

      const { data } = await axios.get(GOOGLE_USERINFO_URL, {
        headers: { Authorization: `Bearer ${accessToken}` },
        timeout: 10000,
      });
      if (!data || data.id !== tokenInfo.sub) {
        return res.status(401).json({ message: 'Invalid Google token' });
      }
      user = data;
    } catch (error) {
      console.error('Google token verification failed:', error.message);
      return res.status(401).json({ message: 'Invalid Google token' });
    }

    if (!user.id || !user.email) {
      return res.status(400).json({ message: 'Invalid user data' });
    }

    // Only verified NYCU accounts may sign in
    if (!user.verified_email || !emailReg.test(user.email)) {
      return res.status(403).json({ message: 'Invalid user!' });
    }

    // One session per Google account: replace any previous one
    DB = DB.filter((ele) => ele.user.id !== user.id);
    const token = crypto.randomBytes(32).toString('hex');
    DB.push({ token, user, expiresAt: Date.now() + SESSION_TTL_MS });

    res.cookie('token', token, {
      path: '/',
      httpOnly: true,
      secure: req.secure,
      maxAge: SESSION_TTL_MS,
      sameSite: 'lax'
    });
    res.status(200).json({ message: 'Success!' });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Login failed' });
  }
});

app.get('/api/login-status-check', (req, res) => {
  const hasLoginRecord = Boolean(findUserByToken(req.cookies && req.cookies.token));
  res.json({ message: hasLoginRecord ? 'Has record!' : 'No record!' });
});

// POST (not GET) so other sites cannot sign users out with a link or <img>
app.post('/api/logout', requireAllowedOrigin, (req, res) => {
  if (req.cookies && req.cookies.token) {
    DB = DB.filter((ele) => ele.token !== req.cookies.token);
  }
  res.clearCookie('token');
  res.status(200).json({ message: 'Logged out successfully' });
});
