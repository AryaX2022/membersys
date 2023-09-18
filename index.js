const express = require('express');
const app = express();
const mysql = require('mysql');

const cors = require('cors');
app.use(cors());

var con = mysql.createConnection({
    host: "13.212.78.127",
    user: "web",
    password: "a!r56Z@+",
    database: "ibooks"
});
con.connect(function(err) {
    if (err) throw err;
});

app.get('/list', async function (request, response) {
    con.query("SELECT * FROM books", function (err, result, fields) {
        if (err) throw err;
        response.json({ret:result[0].title});;
    });


});

app.listen(8080, () => console.log(('listening :)')))