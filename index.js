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

const app = express();

app.use(cookieParser());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.set('trust proxy', true);

// MySQL connection with retry logic
let db;
let serverStarted = false;
const MAX_RETRIES = 10;
const RETRY_DELAY = 5000; // 5 seconds

function createDatabaseConnection(retries = 0) {
  db = mysql.createConnection({
    host: "mysql",
    user: "root",
    password: "password",
    database: "prevexamdb",
    port: 3306,
  });

  db.connect((err) => {
    if (err) {
      console.error(`Error connecting to MySQL (attempt ${retries + 1}/${MAX_RETRIES}):`, err.message);
      
      if (retries < MAX_RETRIES) {
        console.log(`Retrying in ${RETRY_DELAY/1000} seconds...`);
        setTimeout(() => createDatabaseConnection(retries + 1), RETRY_DELAY);
      } else {
        console.error('Max retries reached. Exiting...');
        process.exit(1);
      }
    } else {
      console.log('Connected to MySQL database successfully');
      
      // Start the server only after successful database connection
      if (!serverStarted) {
        app.listen(3001, () => {
          console.log('Server is listening to port 3001...');
          serverStarted = true;
        });
      }
    }
  });

  // Handle MySQL connection loss
  db.on('error', (err) => {
    console.error('MySQL error:', err);
    if (err.code === 'PROTOCOL_CONNECTION_LOST') {
      console.error('Database connection lost. Attempting to reconnect...');
      createDatabaseConnection(0);
    } else {
      throw err;
    }
  });
}

// Initialize database connection
createDatabaseConnection();

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

let counter = 0;

// Helper function to process CSV upload
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
      const destFileName = `${counter}.${fileExtension}`;
      const destFilePath = `${destPath}${destFileName}`;
      const dbPath = `files/${destFileName}`;

      // Create promise for file copy
      const copyPromise = new Promise((resolve, reject) => {
        fs.copyFile(`${sourcePath}${sourceFile}`, destFilePath, (err) => {
          if (err) {
            console.error('Error copying file:', err);
            reject(err);
          } else {
            console.log('Successfully copied file with id', counter);
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
      counter++;
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

app.get('/api/upload-one-data', (req, res) => {
  processCSVUpload('one_files', req, res);
});

app.get('/api/upload-two-data', (req, res) => {
  processCSVUpload('two_files', req, res);
});

app.get('/api/upload-advance-data', (req, res) => {
  processCSVUpload('advance_files', req, res);
});

app.get('/api/upload-other-data', (req, res) => {
  processCSVUpload('other_files', req, res);
});

const getRandom = (max) => {
  return Math.floor(Math.random() * max);
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'files/');
  },
  filename: (req, file, cb) => {
    let randomStr = new Date().toJSON().slice(0, 19).replaceAll(':', '-');
    randomStr += getRandom(999999).toString().padStart(6, '0');
    cb(null, randomStr + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  }
});

const nameReg = /\.(txt|pdf|zip|rar|7z|jpe?g|png|mp4|mov|heic)$/i;
const emailReg = /@nycu\.edu\.tw$/i;
app.get('/api/test', (req, res) => {
  console.log('Call API');
  res.status(200).end();
});

// Helper function to find the signed-in user by session token
const findUserByToken = (token) => {
  const session = DB.find((ele) => ele.token === token);
  return session && session.user;
};

// Helper function to sanitize input
const sanitizeInput = (input) => {
  return input ? input.replaceAll(/\s/g, '') : '';
};

// Grade to table mapping
const gradeTableMap = {
  '大一': 'one_files',
  '大二': 'two_files',
  '大三以上選修': 'advance_files',
  '通識與其他': 'other_files'
};

app.post('/api/user-upload-file', upload.single('files'), async (req, res) => {
  try {
    // Validate request
    if (!req.cookies || !req.cookies.token) {
      return res.status(401).json({ message: 'No authentication token' });
    }

    // Validate file was uploaded
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    // Find and validate user
    const user = findUserByToken(req.cookies.token);
    if (!user || !user.email || !emailReg.test(user.email)) {
      // Delete uploaded file if user is invalid
      fs.unlink(req.file.path, (err) => {
        if (err) console.error('Error deleting invalid upload:', err);
      });
      return res.status(401).json({ message: 'Invalid user!' });
    }

    console.log('Valid user and ready to upload');

    // Validate required fields
    if (!req.body.filename || !req.body.grade || !req.body.subject ||
      !req.body.teacher || !req.body.year || !req.body.type) {
      fs.unlink(req.file.path, (err) => {
        if (err) console.error('Error deleting invalid upload:', err);
      });
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Sanitize inputs
    const grade = sanitizeInput(req.body.grade);
    const subject = sanitizeInput(req.body.subject);
    const teacher = sanitizeInput(req.body.teacher);
    const year = sanitizeInput(req.body.year);
    const type = sanitizeInput(req.body.type);
    const filename = sanitizeInput(req.body.filename);

    // Validate filename extension
    if (!nameReg.test(filename)) {
      console.log('Invalid file extension');
      fs.unlink(req.file.path, (err) => {
        if (err) console.error('Error deleting invalid file:', err);
      });
      return res.status(400).json({ message: 'Invalid file!' });
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

    // Determine table based on grade
    const tableName = gradeTableMap[grade];
    if (!tableName) {
      fs.unlink(req.file.path, (err) => {
        if (err) console.error('Error deleting file:', err);
      });
      return res.status(400).json({ message: 'Invalid grade category!' });
    }

    const filePath = 'files/' + storedFileName;
    const fullYear = year + '學年';
    const fileExtension = path.extname(filename).slice(1);

    // Use parameterized query to prevent SQL injection
    const sql = `INSERT INTO ?? (subject, professor, year, exam_type, file_extension, original_filename, file_path) VALUES (?, ?, ?, ?, ?, ?, ?)`;

    db.query(sql, [tableName, subject, teacher, fullYear, type, fileExtension, filename, filePath], (err) => {
      if (err) {
        console.error('Database insert error:', err);
        // Delete uploaded file on database error
        fs.unlink(req.file.path, (unlinkErr) => {
          if (unlinkErr) console.error('Error deleting file after DB error:', unlinkErr);
        });
        return res.status(500).json({ message: 'Database error!' });
      }
      res.status(200).json({ message: 'Success!' });
    });

  } catch (error) {
    console.error('Error in file upload:', error);
    // Clean up uploaded file on error
    if (req.file) {
      fs.unlink(req.file.path, (err) => {
        if (err) console.error('Error deleting file after error:', err);
      });
    }
    res.status(500).json({ message: 'Error!' });
  }
});

// In-memory sessions: [{ token, user }]
let DB = [];

const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v1/userinfo';

app.post('/api/login', async (req, res) => {
  try {
    const accessToken = req.body && req.body.access_token;
    if (!accessToken) {
      return res.status(400).json({ message: 'Missing access token' });
    }

    // Ask Google who the token belongs to instead of trusting the request body
    let user;
    try {
      const response = await axios.get(GOOGLE_USERINFO_URL, {
        headers: { Authorization: `Bearer ${accessToken}` },
        timeout: 10000,
      });
      user = response.data;
    } catch (error) {
      console.error('Google token verification failed:', error.message);
      return res.status(401).json({ message: 'Invalid Google token' });
    }

    if (!user || !user.id || !user.email) {
      return res.status(400).json({ message: 'Invalid user data' });
    }

    // Only verified NYCU accounts may sign in
    if (!user.verified_email || !emailReg.test(user.email)) {
      return res.status(403).json({ message: 'Invalid user!' });
    }

    // One session per Google account: replace any previous one
    DB = DB.filter((ele) => ele.user.id !== user.id);
    const token = crypto.randomBytes(32).toString('hex');
    DB.push({ token, user });

    res.header('Access-Control-Allow-Origin', 'http://nginx');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.cookie('token', token, {
      path: '/',
      httpOnly: true,
      secure: req.secure,
      maxAge: 86400000, // 24 hours
      sameSite: 'lax'
    });
    res.status(200).json({ message: 'Success!' });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Login failed' });
  }
});

app.get('/api/login-status-check', (req, res) => {
  if (!req.cookies || !req.cookies.token) {
    return res.json({ message: 'No record!' });
  }

  const hasLoginRecord = Boolean(findUserByToken(req.cookies.token));

  if (hasLoginRecord) {
    res.json({ message: 'Has record!' });
  } else {
    res.json({ message: 'No record!' });
  }
});

app.get('/api/logout', (req, res) => {
  if (req.cookies && req.cookies.token) {
    DB = DB.filter((ele) => ele.token !== req.cookies.token);
  }
  res.clearCookie('token');
  res.status(200).json({ message: 'Logged out successfully' });
});

app.get('/api/clear-login-array', (req, res) => {
  DB.length = 0;
  res.status(200).json({ message: 'Success!' });
});
