'use strict';
const http = require('http');
const server = http.createServer();
const finalhandler = require('finalhandler');
const v = require('consolidate');
const path = require('path');
const Router = require('router');
const qs = require('querystring');
const isEmail = require('isemail').validate;
const serveStatic = require('serve-static');

const from = require('from2');
const through =  require('through2');
const mustache = require('mustache');
const bus = require('./bus');
const shortid = require('shortid');
const db = require('./db');

const app = new Router();

// serve sratic file (css/image,js)
app.use(serveStatic(path.resolve(__dirname, '..', 'public')));

// render views
app.use((req, res, next) => {
  res.render = (file, params) => {
    let filename = path.resolve(__dirname, '..', 'views', file);
    v.mustache(filename, params || {}, (err, html) => {
      if (err) { return next(err); }
      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/html;charset=UTF-8');
      res.end(html);
    });
  };

  next();
});

// parse post
app.use((req, res, next) => {
  if (req.method !== 'POST') {
    return next();
  }
  req.body = {};
  let body = '';
  req.on('data', (buf) => {
    body += buf.toString();
  });

  req.on('end', () => {
    req.body = qs.parse(body);
    next();
  });
});

app.get('/:reqId/:emailId.gif', (req, res) => {
  bus.emit('open email', req.params.reqId, req.params.emailId);
  let image = new Buffer(img());
  res.statusCode = 200;
  res.writeHead(200, {
    'Content-Type': 'image/gif',
    'Content-Length': image.length,
  });
  res.end(image);
});

app.get('/', (req, res) => {
  res.render('home.html');
});

app.get('/login', (req, res) => {
  res.render('login.html');
});

app.get('/signup', (req, res) => {
  res.render('signup.html');
});

app.get('/forgotpassword', (req, res) => {
  res.render('forgotpassword.html');
});

app.get('/dashboard', (req, res) => {
  res.render('dashboard.html');
});

app.get('/list-user', (req, res) => {
  res.render('list-user.html');
});

app.get('/create-list-user', (req, res) => {
  res.render('create-list-user.html');
});

app.get('/list-theme', (req, res) => {
  res.render('list-theme.html');
});

app.get('/create-theme', (req, res) => {
  res.render('create-theme.html');
});

app.get('/setting-sent-mail', (req, res) => {
  res.render('setting-sent-mail.html');
});

app.get('/:reqId', (req, res) => {
  let jobs = [];
  db.sublevel(req.params.reqId)
    .createReadStream()
    .on('data', (data) => {
      jobs.push(data.value);
    })
    .on('end', () => {
      res.render('request.html', {
        reqId: req.params.reqId,
        jobs: jobs,
      });
    });
});

app.post('/', (req, res) => {
  let requestId = shortid.generate();
  let customers = req.body.customers.trim().split(/\r?\n/);
  if (customers.length === 0) {
    res.statusCode = 400;
    return res.render('home.html', {
      msg: 'customers not found',
    });
  }

  let placeholder = customers.shift().split(';');
  let emailIndex = placeholder.indexOf('email');
  if (emailIndex === -1) {
    res.statusCode = 400;
    return res.render('home.html', {
      msg: 'placeholder `email` not found',
    });
  }

  // filter out customer with invalid email or duplicate
  let cache = [];
  customers = customers.filter(customer => {
    let c = customer.split(';');
    let email = c[emailIndex].trim().toLowerCase();
    if (isEmail(email) && cache.indexOf(email) === -1) {
      cache.push(email);
      return true;
    } else {
      return false;
    }
  });

  fromCustomers(customers)
    .pipe(through.obj(function(buf, _, cb) {
      let customer = parse(buf, placeholder);
      let email = getEmail(req.body, customer, requestId);
      bus.emit('prepare email', requestId, customer, email);
      cb();
    }));

    res.end(requestId);
});

// apply data to raw and return a ready to send object
function getEmail(raw, customer, reqId) {
  let id = shortid.generate();
  raw.body += `<img src="http://${process.env.VIRTUAL_HOST}/${reqId}/${id}.gif">`;
  return {
    id: id,
    to: customer.email,
    from: raw.from,
    body: mustache.render(lb2br(raw.body), customer),
    subject: mustache.render(raw.subject, customer),
  };
}

// convert customers array to readable stream
function fromCustomers(c) {
  return from((size, next) => {
    if (c.length <= 0) return next(null, null);
    next(null, c.shift());
  });
}

// parse buffer to object using placeholder
function parse(buf, placeholder) {
  let data = buf.toString().split(';');
  let customer = {};
  placeholder
    .forEach((name, i) => customer[name] = data[i].trim());

  return customer;
}

// replace line break with <br>
function lb2br(str) {
  return str.split(/\r?\n/).join('<br>');
}

// 1x1px transparent img
function img() {
  return [
    0x47,0x49, 0x46,0x38, 0x39,0x61, 0x01,0x00,
    0x01,0x00, 0x80,0x00, 0x00,0xFF, 0xFF,0xFF,
    0x00,0x00, 0x00,0x21, 0xf9,0x04, 0x04,0x00,
    0x00,0x00, 0x00,0x2c, 0x00,0x00, 0x00,0x00,
    0x01,0x00, 0x01,0x00, 0x00,0x02, 0x02,0x44,
    0x01,0x00, 0x3b
  ];
}

server.on('request', (req, res) => {
  app(req, res, finalhandler(req, res));
});

module.exports = server;