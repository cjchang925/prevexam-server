const express = require('express');
const app = express();

app.listen(3001, () => { console.log('Server is listening to port 3001 ...') })

const mysql = require('mysql')

const cors = require('cors')

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
            console.log(back)
            res.send(back)
        }
    });
})

const fs = require('fs');
const readline = require('readline')

app.get('/api/upload-one-data', (req, res) => {
    console.log('hi')
    const text = fs.createReadStream('/home/ece-learn/src/csv_file/test.txt', "utf-8")
    const rl = readline.createInterface({
        input: text,
    })
    var counter = 0
    rl.on("line", (res) => {
        if (counter > 0) {
            const arr = res.split(',')
            fs.rename('/home/node/' + arr[6], '/home/node/files/' + counter.toString() + '.' + arr[4], function (err) {
                if (err) console.log(err)
                console.log('Successfully renamed - AKA moved!')
            })
            const path = 'files/' + counter.toString() + '.' + arr[4]
            const sql = `INSERT INTO one_files (subject, professor, year, exam_type, file_extension, original_filename, file_path) VALUES (\"${arr[0]}\", \"${arr[1]}\", \"${arr[2]}\", \"${arr[3]}\", \"${arr[4]}\", \"${arr[5]}\", \"${path}\")`
            db.query(sql, (err, result) => {
                if (err) {
                    console.log(err);
                }
            });
        }
        counter++;
    })
    res.redirect('/')
})
