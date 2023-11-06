const express = require('express');
const app = express();
var bodyParser = require('body-parser')
// create application/x-www-form-urlencoded parser
var urlencodedParser = bodyParser.urlencoded({ extended: false })
app.use(urlencodedParser);

// create application/json parser
var jsonParser = bodyParser.json()

const mysql = require('mysql');

var nodemailer = require('nodemailer');
var transporter = nodemailer.createTransport({
    service: 'qq',
    auth: {
        user: '6983299@qq.com',
        pass: process.env.MAIL_PWD
    }
});

//这个值设置的大一些，不期望通过收会员费用来赚钱，主要是想通过流量变现：靠广告来赚钱。
const MAX_DOWNLOAD = 16;

var request = require('request')


const pagesize = 15;

const cors = require('cors');
const {generateUsername} = require("unique-username-generator");
app.use(cors());

//无忧资源网数据库链接
var conn51ziyuan = mysql.createPool({
    host: "13.212.78.127",
    user: "web",
    password: process.env.ZIYUAN_DB_PWD,
    database: "ziyuan",
    multipleStatements: true
});



// var con = mysql.createPool({
//     host: "localhost",
//     user: "root",
//     password: "123456",
//     database: "ibooks",
//     multipleStatements: true
// });
var con = mysql.createPool({
    host: "2296.dnstoo.com",
    user: "ibooks_f",
    password: process.env.DB_PWD,
    database: "ibooks",
    multipleStatements: true
});
// con.connect(function(err) {
//     if (err) throw err;
// });

var jwt = require("jsonwebtoken");
const secret = "membersys-secret"

app.get("/", async function(request, response) {
    console.log("I am here.");
    response.json("Live");
});


//最新，最热
app.get('/books', async function (request, response) {
    con.query("SELECT * FROM books order by id desc limit 30", function (err, result, fields) {
        if (err) throw err;
        response.json(result);
    });

});

app.get('/bookshot', async function (request, response) {
    con.query("select b.*, d.vw_init+d.vw vw, d.dl_init+d.dl dl, d.score from docdata d inner join books b on d.zyid = b.id order by d.vw desc limit 6", function (err, result, fields) {
        if (err) throw err;
        response.json(result);
    });

});

//根据tag获取最热书籍排行
app.post('/bookshots', async function (request, response) {
    con.query("select b.*, d.vw_init+d.vw vw, d.dl_init+d.dl dl, d.score from docdata d " +
        "inner join (select id,catagory,site,token,title,cover_img,pdf_size,epub_size,mobi_size from books where order_hot is not null) b" +
        " on d.zyid = b.id", function (err, result, fields) {
        if (err) throw err;
        response.json(result);
    });
});


app.post('/booksbycat/total', jsonParser,async function (request, response) {
    let sql = "SELECT count(*) total FROM books where tags like '%" + request.body.cat + "%'";
    con.query(sql, function (err, result, fields) {
        if (err) throw err;
        //console.log(parseInt(result[0]['total']/pagesize));
        response.json(parseInt(result[0]['total']/pagesize));
    });
});

//分页
app.post('/booksbycat/:page', jsonParser, async function (request, response) {
    //let pagesize = 5;
    let pagenumber = request.params.page;

    let offset = pagesize*(pagenumber-1);
    let sql = "SELECT * FROM books where tags like '%" + request.body.cat +  "%' order by id limit " + pagesize.toString() +  " OFFSET " + offset.toString();
    console.log(sql);
    con.query(sql, function (err, result, fields) {
        if (err) throw err;
        response.json(result);
    });

});


app.get('/books/total', async function (request, response) {
    con.query("SELECT count(*) total FROM books", function (err, result, fields) {
        if (err) throw err;
        //console.log(parseInt(result[0]['total']/pagesize));
        response.json(parseInt(result[0]['total']/pagesize));
    });
});

//分页
app.get('/books/:page', async function (request, response) {
	//let pagesize = 5;
	let pagenumber = request.params.page;

	offset = pagesize*(pagenumber-1);

    con.query("SELECT * FROM books order by id desc limit " + pagesize + " OFFSET " + offset , function (err, result, fields) {
        if (err) throw err;
        response.json(result);
    });

});

//详情
app.get('/book/:id', async function(request, response) {
    let id = request.params.id;
    con.query("SELECT b.*, d.vw_init+d.vw vw, d.dl_init+d.dl dl FROM books b INNER JOIN docdata d on b.id = d.zyid where b.id=" + id, function (err, result, fields) {
        if (err) {
            console.log(err);
        };
        response.json(result);
    });
});

app.post('/docdata', jsonParser, async function (request, response) {
    const zyids = request.body.zyids;
    console.log(zyids.toString());
    con.query("SELECT zyid, vw_init+vw vw, dl_init+dl dl, score FROM docdata where zyid in (?)", [zyids], function (err, result, fields) {
        if (err) throw err;
        console.log(result);
        response.json(result);
    });
});


app.get("/download/", function(req, res){
    console.log('Go');
    res.set({
        'Content-Disposition': `attachment; filename=asp.pdf`,
        'Content-Type': 'application/pdf',
    });
    //let remote_file_url = request.params.remote_file_url;
    request.get(encodeURI('https://filesrc01.netlify.app/16951787119/[ASP.NET学习手册].吕双等.扫描版.pdf')).pipe(res);
});

function getClientIp(req) {
    var ipAddress;
    var forwardedIpsStr = req.headers['X-Forwarded-For'];//判断是否有反向代理头信息
    if (forwardedIpsStr) {//如果有，则将头信息中第一个地址拿出，该地址就是真实的客户端IP；
        var forwardedIps = forwardedIpsStr.split(',');
        ipAddress = forwardedIps[0];
    }
    if (!ipAddress) {//如果没有直接获取IP；
        ipAddress = req.connection.remoteAddress;
    }
    return ipAddress;
};

app.post("/userregister", jsonParser, function(req, res) {
    const username = req.body.username;
    con.query("select count(*) ct from users where username=?", [req.body.username], function (err, result, fields) {
        if (err) throw err;
        console.log(result);
        if(result[0].ct === 0) {
            const rtime = new Date();
            con.query("insert into users(username,password,rtime, avatar) values(?,?,?,?);", [username, req.body.password, rtime, req.body.avatar], function (err, result, fields) {
                if (err) throw err;
                //console.log(result);
            });

            //设置登录token
            let token = jwt.sign({ id: username }, secret);

            res.json({ret:1, user:{token: token, username: username, regtime:rtime, avatar: req.body.avatar}});
        } else {
            res.json({ret:0, msg:"该用户名已存在"});
        }
    });
});

app.post("/userlogin", jsonParser, function(req, res) {
    const username = req.body.username;
    con.query("select * from users where username=? and password=?", [req.body.username, req.body.password], function (err, result, fields) {
        if (err) throw err;
        console.log(result);
        if(result.length === 1) {
            //设置登录token
            let token = jwt.sign({ id: username }, secret);
            res.json({ret:1, user:{token: token, username: username, regtime: result[0]['rtime'], avatar: result[0]['avatar']}});
        } else {
            res.json({ret:0, msg:"用户名或密码有误"});
        }
    });
});

app.post("/userupdate", jsonParser, function(req, res) {
    let username = verifyUsername(req);
    const avatar = req.body.avatar;
    con.query("update users set avatar = ? where username=?;", [avatar, username], function (err, result, fields) {
        if (err) throw err;
        res.json({ret:1});
    });
});

app.post("/userdownload", jsonParser, function(req, res) {
    const zyid = req.body.zyid;
    console.log(zyid);

    //用户登录验证

    let username = verifyUsername(req);
    //const username = req.body.username;
    console.log(username);

    if(username != null) {

        const userip = getClientIp(req);
        //const userdvid = req.body.userdvid;


        con.query("SELECT count(*) ct FROM userdownload where DATE(happentime) = DATE(now()) and (userip=? or username=?)", [userip,username], function (err, result, fields) {
            if (err) throw err;
            console.log("获取用户今天下载总数");
            console.log(result);

            //没有超过免费额度
            if (result[0].ct < MAX_DOWNLOAD) {
                //如果下载过，则不重新对该用户计数 userdownload
                con.query("INSERT into docdata(zyid,dl) values(?,1) on DUPLICATE KEY UPDATE dl = dl + 1; " +
                    "insert into userdownload(zyid,userip,username) select * from (select ?, ?, ?) as tmp where not EXISTS(select zyid from userdownload where (userip=? or username=?) and zyid=? )",
                    [zyid, zyid, userip, username, userip, username, zyid], function (err, result, fields) {
                    if (err) throw err;
                    console.log(result);
                });
                console.log("2222222222");
                res.json({ret:1});
            } else {
                //检查：是否已经下载过，或者 已付费、赠送
                con.query("select count(*) ct from userpayment where username = ? and  ( (order_type = 0 and order_content = ?) or ( (order_type = 1 or order_type = 2) and   DATE_ADD(ptime, interval order_content DAY) > now()  ) ) ",
                    [username, zyid], function (err, result, fields) {
                    if (err) throw err;
                    console.log(result);

                    console.log("是否已经付费");
                    console.log(result[0].ct);
                    if(result[0].ct > 0) {
                        //有权限：要么买了单个资源，要么VIP
                        console.log("YES");
                        con.query("INSERT into docdata(zyid,dl) values(?,1) on DUPLICATE KEY UPDATE dl = dl + 1; " +
                            "insert into userdownload(zyid,userip,username) select * from (select ?, ?, ?) as tmp where not EXISTS(select zyid from userdownload where (userip=? or username=?) and zyid=? )",
                            [zyid, zyid, userip, username, userip, username, zyid], function (err, result, fields) {
                            if (err) throw err;
                            console.log(result);
                        });

                        res.json({ret:1});
                    } else {
                        console.log("NO");
                        //无权限

                        //检查是否下载过
                        con.query("select count(*) ct from userdownload where username = ? and zyid=? ",
                            [username, zyid], function (err, result, fields) {
                                if (err) throw err;
                                console.log(result);
                                if(result[0].ct > 0) {
                                    //下载过的
                                    res.json({ret:1});
                                } else {
                                    res.json({ret:0});
                                }
                        });

                    }

                });

            }

        });
    } else {
        console.log("未登录，无法下载");
        res.json({ret:0});
    }

});

app.post("/userview", jsonParser, function(req, res) {
    const zyid = req.body.zyid;
    con.query("INSERT into docdata(zyid,vw) values(?,1) on DUPLICATE KEY UPDATE vw = vw + 1", [zyid.toString()], function (err, result, fields) {
        if (err) throw err;
        //console.log(result);
        res.json({ret:1});
    });
});
app.post("/usermark", jsonParser, function(req, res) {
    const zyid = req.body.zyid;
    const score = req.body.score;
    con.query("INSERT into docdata(zyid,sr) values(?,1) on DUPLICATE KEY UPDATE sr = sr + 1;INSERT into docdata(zyid,score) values(?,?) on DUPLICATE KEY UPDATE score = (score + ?)/2;", [zyid, zyid, score, score], function (err, result, fields) {
        if (err) throw err;
        //console.log(result);
        res.json({ret:1});
    });
});


//下载
// app.get('/download',
//     async (req, res) => {
//         try {
//             const fileName = 'file.pdf'
//             const fileURL = '/path/to/file/file.pdf'
//             const stream = fs.createReadStream(fileURL);
//             res.set({
//                 'Content-Disposition': `attachment; filename='${fileName}'`,
//                 'Content-Type': 'application/pdf',
//             });
//             stream.pipe(res);
//         } catch (e) {
//             console.error(e)
//             res.status(500).end();
//         }
//     }
// )


const CryptoJS = require('crypto-js');
const password = 'userorder';

const AlipaySdk = require('alipay-sdk').default;
// TypeScript，可以使用 import AlipaySdk from 'alipay-sdk';
// 普通公钥模式
const alipaySdk = new AlipaySdk({
    appId: '2021004105625781',
    privateKey: process.env.ALI_PRV_KEY,
    alipayPublicKey: process.env.ALI_PBL_KEY,
});
const AlipayFormData = require('alipay-sdk/lib/form').default;

app.post('/createpayment', jsonParser, async function(request, response) {
    const message = request.body.username + "~" + request.body.order_type + "~" + request.body.order_content;
    console.log(message);
    const ciphertext = CryptoJS.AES.encrypt(message, password);
    console.log(ciphertext);
    const result = await alipaySdk.exec('alipay.trade.precreate', {
        notify_url: 'http://13.212.78.127:88/paymentcallback', // 通知回调地址
        bizContent: {
            out_trade_no: request.body.out_trade_no,
            total_amount: request.body.total_amount,
            subject: '天空网yesky.online',
            body: ciphertext.toString()
        }
    });
    console.log(result);
    response.json(result.qrCode);
});


app.get('/h5payment',jsonParser, async function(request, response) {
    const formData = new AlipayFormData();
    formData.setMethod('get');
    formData.addField('bizContent', {
        outTradeNo: '1234567822112', // 订单号
        productCode: 'QUICK_WAP_WAY',
        totalAmount: '0.01',
        subject: 'biaoti标题',
        body: 'miaoshu描述',
    });
    console.log(formData)
    console.log(formData.fields[0].value)

    const result = alipaySdk.exec('alipay.trade.wap.pay', {}, {
        formData: formData
    }, { validateSign: true }).then(result => {
        console.log('支付宝返回支付链接：',result);
    });
    response.json({});
});


//验证http头中user正确性
function verifyUsername(request) {
    console.log("aaaa");
    let token = request.headers["accesstoken"];
    console.log(token);
    if (!token) {
        return null;
    }
    return jwt.verify(token, secret, (err, decoded) => {
        if (err) {
            return null;
        }
        console.log("decoded.id:");
        console.log(decoded.id);
        if(decoded.id != null && decoded.id != undefined) {
            console.log("yes");
            return decoded.id;
        } else {
            console.log("no");
            return null;
        }
    });
}

function sendmail(to, subject, htmlContent) {
    var mailOptions = {
        from: '6983299@qq.com',
        to: to,
        subject: subject,
        html: htmlContent
    };

    transporter.sendMail(mailOptions, function(error, info){
        if (error) {
            console.log(error);
        } else {
            console.log('Email sent: ' + info.response);
        }
    });
}

//用户申请vip
app.post('/userapplyvip', jsonParser, async function(request, response) {
    let username = verifyUsername(request);
    con.query("insert into applyvip(username,proof) values(?,?) on DUPLICATE KEY UPDATE proof = CONCAT( proof, ',', ?);", [username, request.body.proof, request.body.proof], function (err, result, fields) {
        if (err) {
            console.log(err);
        };
        response.json(result);
    });
});

app.post('/userqueryapplyvip', jsonParser, async function(request, response) {
    let username = verifyUsername(request);
    con.query("select * from applyvip where username=?", [username], function (err, result, fields) {
        if (err) {
            console.log(err);
        };
        response.json(result);
    });
});

//管理员:查询用户apply
app.get('/admqueryuserapply', jsonParser, async function(request, response) {
    let username = verifyUsername(request);
    console.log(username);
    if(username === 'admin') {
        con.query("select * from applyvip", function (err, result, fields) {
            if (err) {
                console.log(err);
            };
            console.log(result);
            response.json(result);
        });
    }
});

//批准奖励用户VIP
app.post('/admapprovevip', jsonParser, async function(request, response) {
    //验证管理员
    let username = verifyUsername(request);
    if(username === 'admin') {
        con.query("update applyvip set status=1 where id=?; insert into userpayment(order_type, order_content, username) values(?,?,?);", [request.body.applyId, 2, request.body.order_content, request.body.username], function (err, result, fields) {
            if (err) {
                console.log(err);
            };
            response.json(result);
        });
        //邮件通知
    } else {
        response.json();
    }
});



//无忧资源：管理用户提交vip申请=========================== start  ===========================


//管理员:查询用户apply
app.get('/ziyuanadmqueryuserapply', jsonParser, async function(request, response) {
    let username = verifyUsername(request);
    console.log(username);
    if(username === 'admin') {
        conn51ziyuan.query("select * from pre_applyvip", function (err, result, fields) {
            if (err) {
                console.log(err);
            };
            console.log(result);
            response.json(result);
        });
    }
});

//批准奖励用户VIP
app.post('/ziyuanadmapprovevip', jsonParser, async function(request, response) {
    //验证管理员
    let username = verifyUsername(request);
    if(username === 'admin') {
        let seconds = Number(request.body.days) * 86400;
        conn51ziyuan.query("update pre_applyvip set status=1 where id=?; update pre_common_member set actived=1, expired= (  case actived when 1 then expired+? else UNIX_TIMESTAMP()+? end  )  where username=?", [request.body.applyId, seconds,seconds, request.body.username], function (err, result, fields) {
            if (err) {
                console.log(err);
            };
            response.json(result);
        });

        //邮件通知
    } else {
        response.json();
    }
});

//无忧资源：管理用户提交vip申请  =========================== end  ===========================



app.get('/getpayment', async function(request, response) {
    let username = verifyUsername(request);
    con.query("select * from userpayment where username=?;", [username], function (err, result, fields) {
        if (err) {
            console.log(err);
        };
        response.json(result);
    });
});

app.post('/checkpayment', jsonParser, async function(request, response) {

    let outTradeNo = request.body.out_trade_no;
    let orderType = request.body.order_type;
    let orderContent = request.body.order_content;
    console.log(orderContent);

    let username = verifyUsername(request);
    //验证用户

    const resultPay = await alipaySdk.exec('alipay.trade.query', {
        bizContent: {
            out_trade_no: outTradeNo,
        }
    });

    console.log(resultPay);
    const flag= resultPay.tradeStatus === "TRADE_SUCCESS";

    if(flag) {
        con.query("select count(*) ct from userpayment where out_trade_no=?", [outTradeNo], function (err, result, fields) {
            if (err) {
                console.log(err);
            };
            console.log(result);
            console.log(result[0]["ct"]);

            if (result[0]["ct"] == 0) {ps
                //之前没有支付，现在开始支付
                con.query("insert into userpayment(out_trade_no,order_type,order_content,total_amount,username) values(?,?,?,?,?);", [outTradeNo, orderType, orderContent, resultPay.totalAmount, username], function (err, result, fields) {
                    if (err) {
                        console.log(err);
                    };
                });
                response.json({ret:flag});

            } else {
                //之前已经支付
                response.json({ret:flag});
            }

        });

    } else {
        //支付状态：没有支付
        response.json({ret:flag});
    }

});

app.post('/paymentcallback', async function(request, response) {
    //console.log(request);
    console.log("pcallback");
    //console.log(request.body);
    if(request.body.trade_status === "TRADE_SUCCESS") {
        const outTradeNo = request.body.out_trade_no;
        //request.body.gmt_payment,
        const totalAmount = request.body.total_amount;
        //console.log(request.body);
        const bytes = CryptoJS.AES.decrypt(request.body.body, password);
        const plaintext = bytes.toString(CryptoJS.enc.Utf8);
        console.log(plaintext);

        const orderdetail = plaintext.split('~');
        const orderType = orderdetail[1];
        const orderContent = orderdetail[2];
        const username = orderdetail[0];

        con.query("insert into userpayment(out_trade_no,order_type,order_content,total_amount,username)  select * from (select ?,?,?,?,?) as tmp where not EXISTS(select id from userpayment where out_trade_no=?);", [outTradeNo, orderType, orderContent, totalAmount, username, outTradeNo], function (err, result, fields) {
            if (err) {
                console.log(err);
            };
        });

    }
    response.json({});
});


app.listen(process.env.PORT,() => console.log(('listening :)')))