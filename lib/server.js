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
  res.render('home.html', {
    name: 'quoc'
  });
});

app.post('/', (req, res) => {
  let emails = req.body.emails;
  emails = emails.trim().split('\r\n');
  emails = emails.filter(e => isEmail(e));

  emails.forEach((victim) => {
    email.send({
      text: req.body.body,
      from: 'tuds <tuds@tuds.ninja>',
      to: victim,
      subject: req.body.subject,
      attachment: [{
        data: req.body.body || '',
        alternative: true
      }]
    });
  });

  res.end('done');
});

server.on('request', (req, res) => {
  app(req, res, finalhandler(req, res));
});

module.exports = server;