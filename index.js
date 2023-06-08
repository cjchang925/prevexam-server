const express = require('express');
const app = express();

const axios = require('axios');

app.listen(3001, () => { console.log('Server is listening to port 3001 ...') })

const mysql = require('mysql')

const cors = require('cors')

const cookieParser = require('cookie-parser');
app.use(cookieParser())
const corsConfig = {
    credentials: true,
    origin: '*'
};

app.use(cors(corsConfig));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.set('trust proxy', true)

const db = mysql.createConnection({
    host: "mysql",
    user: "root",
    password: "password",
    database: "prevexamdb",
    port: 3306,
});

app.get('/api/get-one-data', (req, res) => {
    db.query("SELECT * FROM one_files", (err, result) => {
        if (err) {
            console.log(err);
        } else {
            let json = JSON.parse(JSON.stringify(result))
            var back = []
            for (const key in json) {
                back.push([json[key].subject, json[key].professor, json[key].year, json[key].exam_type, json[key].file_extension, json[key].original_filename, json[key].file_path])
            }
            res.send(back)
        }
    });
})

app.get('/api/get-two-data', (req, res) => {
    db.query("SELECT * FROM two_files", (err, result) => {
        if (err) {
            console.log(err);
        } else {
            let json = JSON.parse(JSON.stringify(result))
            var back = []
            for (const key in json) {
                back.push([json[key].subject, json[key].professor, json[key].year, json[key].exam_type, json[key].file_extension, json[key].original_filename, json[key].file_path])
            }
            res.send(back)
        }
    });
})

app.get('/api/get-advance-data', (req, res) => {
    db.query("SELECT * FROM advance_files", (err, result) => {
        if (err) {
            console.log(err);
        } else {
            let json = JSON.parse(JSON.stringify(result))
            var back = []
            for (const key in json) {
                back.push([json[key].subject, json[key].professor, json[key].year, json[key].exam_type, json[key].file_extension, json[key].original_filename, json[key].file_path])
            }
            res.send(back)
        }
    });
})

app.get('/api/get-other-data', (req, res) => {
    db.query("SELECT * FROM other_files", (err, result) => {
        if (err) {
            console.log(err);
        } else {
            let json = JSON.parse(JSON.stringify(result))
            var back = []
            for (const key in json) {
                back.push([json[key].subject, json[key].professor, json[key].year, json[key].exam_type, json[key].file_extension, json[key].original_filename, json[key].file_path])
            }
            res.send(back)
        }
    });
})

const fs = require('fs');
const readline = require('readline')

var counter = 0

app.get('/api/upload-one-data', (req, res) => {
    const text = fs.createReadStream('/home/ece-learn/src/csv_file/test.txt', "utf-8")
    const rl = readline.createInterface({
        input: text,
    })

    rl.on("line", (res) => {
        const arr = res.split(',')
        fs.copyFile('/home/node/pastexam/' + arr[6], '/home/node/files/' + counter.toString() + '.' + arr[4], function (err) {
            if (err) console.log(err)
            console.log('Successfully copied with id ' + counter.toString())
        })
        const path = 'files/' + counter.toString() + '.' + arr[4]
        const sql = `INSERT INTO one_files (subject, professor, year, exam_type, file_extension, original_filename, file_path) VALUES (\"${arr[0]}\", \"${arr[1]}\", \"${arr[2]}\", \"${arr[3]}\", \"${arr[4]}\", \"${arr[5]}\", \"${path}\")`
        db.query(sql, (err, result) => {
            if (err) {
                console.log(err);
            }
        });

        counter++;
    })
    res.redirect('/')
})

app.get('/api/upload-two-data', (req, res) => {
    const text = fs.createReadStream('/home/ece-learn/src/csv_file/test.txt', "utf-8")
    const rl = readline.createInterface({
        input: text,
    })

    rl.on("line", (res) => {
        const arr = res.split(',')
        fs.copyFile('/home/node/pastexam/' + arr[6], '/home/node/files/' + counter.toString() + '.' + arr[4], function (err) {
            if (err) console.log(err)
            console.log('Successfully copied with id ' + counter.toString())
        })
        const path = 'files/' + counter.toString() + '.' + arr[4]
        const sql = `INSERT INTO two_files (subject, professor, year, exam_type, file_extension, original_filename, file_path) VALUES (\"${arr[0]}\", \"${arr[1]}\", \"${arr[2]}\", \"${arr[3]}\", \"${arr[4]}\", \"${arr[5]}\", \"${path}\")`
        db.query(sql, (err, result) => {
            if (err) {
                console.log(err);
            }
        });

        counter++;
    })
    res.redirect('/')
})

app.get('/api/upload-advance-data', (req, res) => {
    const text = fs.createReadStream('/home/ece-learn/src/csv_file/test.txt', "utf-8")
    const rl = readline.createInterface({
        input: text,
    })

    rl.on("line", (res) => {
        const arr = res.split(',')
        fs.copyFile('/home/node/pastexam/' + arr[6], '/home/node/files/' + counter.toString() + '.' + arr[4], function (err) {
            if (err) console.log(err)
            console.log('Successfully copied with id ' + counter.toString())
        })
        const path = 'files/' + counter.toString() + '.' + arr[4]
        const sql = `INSERT INTO advance_files (subject, professor, year, exam_type, file_extension, original_filename, file_path) VALUES (\"${arr[0]}\", \"${arr[1]}\", \"${arr[2]}\", \"${arr[3]}\", \"${arr[4]}\", \"${arr[5]}\", \"${path}\")`
        db.query(sql, (err, result) => {
            if (err) {
                console.log(err);
            }
        });

        counter++;
    })
    res.redirect('/')
})

app.get('/api/upload-other-data', (req, res) => {
    const text = fs.createReadStream('/home/ece-learn/src/csv_file/test.txt', "utf-8")
    const rl = readline.createInterface({
        input: text,
    })

    rl.on("line", (res) => {
        const arr = res.split(',')
        fs.copyFile('/home/node/pastexam/' + arr[6], '/home/node/files/' + counter.toString() + '.' + arr[4], function (err) {
            if (err) console.log(err)
            console.log('Successfully copied with id ' + counter.toString())
        })
        const path = 'files/' + counter.toString() + '.' + arr[4]
        const sql = `INSERT INTO other_files (subject, professor, year, exam_type, file_extension, original_filename, file_path) VALUES (\"${arr[0]}\", \"${arr[1]}\", \"${arr[2]}\", \"${arr[3]}\", \"${arr[4]}\", \"${arr[5]}\", \"${path}\")`
        db.query(sql, (err, result) => {
            if (err) {
                console.log(err);
            }
        });

        counter++;
    })
    res.redirect('/')
})

const multer = require("multer");
const path = require('path');

const getRandom = (max) => {
    return Math.random() * max
}

var nowFileName = ""

var storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'files/')
    },
    filename: (req, file, cb) => {
        let randomStr = new Date().toJSON().slice(0, 19).replaceAll(':', '-')
        randomStr += Math.floor(getRandom(999999)).toString()
        nowFileName = randomStr + path.extname(file.originalname)
        cb(null, nowFileName)
    }
})

var upload = multer({ storage: storage })

const nameReg = new RegExp('.(txt|pdf|zip|rar|7z|jpg|png|jpeg|mp4|mov)$')

app.post('/api/user-upload-file', upload.single("files"), (req, res) => {
    let user = {};
    let found = false;
    for (var i = 0; i < DB.length; i++) {
        if (req.cookies.token === DB[i].id) {
            user = DB[i];
            found = true;
            break;
        }
    }

    if (!found || typeof user.email === "undefined" || !req.cookies) {
        res.send({ message: "Invalid user!" })
        return;
    }

    fs.appendFile('/home/node/upload_history.log', 'Filename: ' + nowFileName + ' grade: ' + req.query.grade.replaceAll(/\s/g, '') +
        ' subject: ' + req.query.subject.replaceAll(/\s/g, '') + ' teacher: ' + req.query.teacher.replaceAll(/\s/g, '') + ' year: ' + req.query.year.replaceAll(/\s/g, '') + ' from '
        + user.family_name + user.given_name + ' email: ' + user.email + '\r\n', (err) => {
            if (err) {
                console.log(err);
            }
            else {
                console.log("Appended file successfully!")
            }
        })

    if (!nameReg.test(req.query.filename.replaceAll(/\s/g, ''))) {
        console.log('invalid file')
        res.send({ message: "Invalid file!" })
        return
    }

    const filePath = 'files/' + nowFileName
    var sql = ""
    const fullYear = req.query.year.replaceAll(/\s/g, '') + '學年'
    if (req.query.grade.replaceAll(/\s/g, '') === "大一") {
        sql = `INSERT INTO one_files (subject, professor, year, exam_type, file_extension, original_filename, file_path) VALUES (\"${req.query.subject.replaceAll(/\s/g, '')}\", \"${req.query.teacher.replaceAll(/\s/g, '')}\", \"${fullYear}\", \"${req.query.type.replaceAll(/\s/g, '')}\", \"${path.extname(req.query.filename.replaceAll(/\s/g, '')).slice(1,)}\", \"${req.query.filename.replaceAll(/\s/g, '')}\", \"${filePath}\")`
    }
    if (req.query.grade.replaceAll(/\s/g, '') === "大二") {
        sql = `INSERT INTO two_files (subject, professor, year, exam_type, file_extension, original_filename, file_path) VALUES (\"${req.query.subject.replaceAll(/\s/g, '')}\", \"${req.query.teacher.replaceAll(/\s/g, '')}\", \"${fullYear}\", \"${req.query.type.replaceAll(/\s/g, '')}\", \"${path.extname(req.query.filename.replaceAll(/\s/g, '')).slice(1,)}\", \"${req.query.filename.replaceAll(/\s/g, '')}\", \"${filePath}\")`
    }
    if (req.query.grade.replaceAll(/\s/g, '') === "大三以上選修") {
        sql = `INSERT INTO advance_files (subject, professor, year, exam_type, file_extension, original_filename, file_path) VALUES (\"${req.query.subject.replaceAll(/\s/g, '')}\", \"${req.query.teacher.replaceAll(/\s/g, '')}\", \"${fullYear}\", \"${req.query.type.replaceAll(/\s/g, '')}\", \"${path.extname(req.query.filename.replaceAll(/\s/g, '')).slice(1,)}\", \"${req.query.filename.replaceAll(/\s/g, '')}\", \"${filePath}\")`
    }
    if (req.query.grade.replaceAll(/\s/g, '') === "通識與其他") {
        sql = `INSERT INTO other_files (subject, professor, year, exam_type, file_extension, original_filename, file_path) VALUES (\"${req.query.subject.replaceAll(/\s/g, '')}\", \"${req.query.teacher.replaceAll(/\s/g, '')}\", \"${fullYear}\", \"${req.query.type.replaceAll(/\s/g, '')}\", \"${path.extname(req.query.filename.replaceAll(/\s/g, '')).slice(1,)}\", \"${req.query.filename.replaceAll(/\s/g, '')}\", \"${filePath}\")`
    }

    db.query(sql, (err, result) => {
        if (err) {
            console.log(err);
        }
    });

    res.status(200).send({ message: "Success!" })
})

let DB = [];

app.post("/api/login", async (req, res) => {
    const user = req.body;
    DB = DB.filter((ele) => {
        return ele.id !== user.id;
    })
    await DB.push(user);
    let allName = [];
    for (var i = 0; i < DB.length; i++) {
        allName.push(DB[i].family_name + DB[i].given_name);
    }
    fs.appendFile('/home/node/user_history.log', allName.join(', ') + '\r\n', (err) => {
        if (err) {
            console.log(err);
        }
    })
    res.header('Access-Control-Allow-Origin', 'http://nginx');
    res.header('Access-Control-Allow-Credentials', true);
    res.cookie('token', user.id, { path: '/', signed: false, maxAge: 86400000 });
    res.status(200).send('Success!');
});

app.get('/api/login-status-check', (req, res) => {
    if (!req.cookies) {
        res.send({ message: "No record!" });
        return;
    }
    let hasLoginRecord = false;
    for (var i = 0; i < DB.length; i++) {
        if (req.cookies.token === DB[i].id) {
            hasLoginRecord = true
            break
        }
    }
    if (hasLoginRecord) {
        res.send({ message: "Has record!" })
    } else {
        res.send({ message: "No record!" })
    }
})

app.get('/api/logout', (req, res) => {
    DB = DB.filter((ele) => {
        return ele.id !== req.cookies.token
    })
    res.clearCookie('token')
    res.end()
})

app.get('/api/clear-login-array', (req, res) => {
    DB.length = 0
    res.status(200).send('Success!')
})

app.get('/api/getAccessToken', async (req, res) => {
    const code = req.query.code;

    const params = new URLSearchParams();
    params.append('client_id', CLIENT_ID);
    params.append('client_secret', CLIENT_SECRET);
    params.append('code', code);

    try {
        const response = await axios.post('https://github.com/login/oauth/access_token', params, {
            headers: {
                Accept: 'application/json'
            }
        })

        const user = await axios.get('https://api.github.com/user', {
            headers: {
                Authorization: `Bearer ${response.data.access_token}`,
                Accept: 'application/json'
            }
        })

        fs.appendFile('/home/node/intern_login.log', 'GitHub username: ' + user.data.login + '\n', (err) => {
            if (err) {
                console.log(err);
            }
        })

        res.json({
            username: user.data.login,
            access_token: response.data.access_token
        });
    } catch (error) {
        // console.error(error);
        res.status(500).json({
            error: 'Internal server error'
        });
    }
});

app.get('/api/getAccessTokenLocal', async (req, res) => {
    const code = req.query.code;

    const params = new URLSearchParams();
    params.append('client_id', '4054e0560380c0e7f341');
    params.append('client_secret', 'f9d19db878ea5ede4660e8e2a9186868ab72dce4');
    params.append('code', code);

    try {
        const response = await axios.post('https://github.com/login/oauth/access_token', params, {
            headers: {
                Accept: 'application/json'
            }
        })

        const user = await axios.get('https://api.github.com/user', {
            headers: {
                Authorization: `Bearer ${response.data.access_token}`,
                Accept: 'application/json'
            }
        })

        fs.appendFile('/home/node/intern_login_local.log', 'GitHub username: ' + user.data.login + '\n', (err) => {
            if (err) {
                console.log(err);
            }
        })

        res.json({
            username: user.data.login,
            access_token: response.data.access_token
        });
    } catch (error) {
        // console.error(error);
        res.status(500).json({
            error: 'Internal server error'
        });
    }
});