'use strict';
const http = require('http');
const server = http.createServer();
const finalhandler = require('finalhandler');
const v = require('consolidate');
const path = require('path');
const Router = require('router');
const qs = require('querystring');
const isEmail = require('isemail').validate;
const emailjs = require('emailjs');
const from = require('from2');
const split = require('split2');
const through =  require('through2');
const mustache = require('mustache');

const email = emailjs.server.connect({
  user: process.env.SMTP_USER,
  password: process.env.SMTP_PASSWORD,
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  ssl: false
});

const app = new Router();

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

app.get('/', (req, res) => {
  res.render('home.html');
});

app.post('/', (req, res) => {
  let customers = req.body.customers.trim().split(/\r?\n/);
  if (customers.length === 0) {
    res.statusCode = 400;
    return res.render('home.html', {
      msg: 'customers not found',
    });
  }

  let header = customers.shift().split(';');
  let emailIndex = header.indexOf('email');
  if (emailIndex === -1) {
    res.statusCode = 400;
    return res.render('home.html', {
      msg: 'customer email not found',
    });
  }

  // filter out customer with invalid email
  customers = customers.filter(customer => {
    let c = customer.split(';');
    return isEmail(c[emailIndex]);
  });

  fromCustomers(customers)
    .pipe(through.obj(function(buf, enc, cb) {
      let data = buf.toString().split(';');
      let customer = {};
      header.forEach((name, i) => customer[name] = data[i].trim());

      let html = req.body.body.split('\r\n').join('<br>');
      let body = mustache.render(html, customer);

      email.send({
        text: body,
        from: process.env.ADMIN_EMAIL,
        to: customer.email,
        subject: mustache.render(req.body.subject, customer),
        attachment: [{
          data: body || '',
          alternative: true
        }]
      }, err => {
        if (err) { res.write('err: ' + customer.email); }

        this.push(customer);
        cb();
      });
    }))
    .on('data', function(customer) {
      res.write(customer.email + '\r\n');
    })
    .on('end', () => res.end());
});


function fromCustomers(c) {
  return from((size, next) => {
    if (c.length <= 0) return next(null, null);
    next(null, c.shift());
  });
}

server.on('request', (req, res) => {
  app(req, res, finalhandler(req, res));
});

module.exports = server;