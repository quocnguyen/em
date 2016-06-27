'use strict';
const db = require('./db');
const bus = require('./bus');
const info = require('debug')('em:info');
const email = require('./email');

bus.on('prepare email', prepareEmail);
bus.on('send email', sendEmail);
bus.on('open email', openEmail);

function prepareEmail(id, customer, email) {
  info('prepare email %o', customer.email);

  db.sublevel(id).put(email.id, {
    requestId: id,
    customer: customer,
    email: email,
    isSent: false,
    sentAt: null,
    isOpened: false,
    openedAt: null,
  }, (err) => {
    if (err) { return console.log(err); }
    bus.emit('send email', id, email);
  });
}

function sendEmail(reqId, email) {
  info('sent email req: %o, email: %o', reqId, email.id);

  email.send(email)
  .then(() => updateSentStatus(reqId, email.id))
  .catch(err => console.log(err));
}

function updateSentStatus(reqId, emailId) {
    db.sublevel(reqId).get(emailId, (err, data) => {
    if (err) { return console.log(err); }
    data.isSent = true;
    data.sentAt = Date.now();
    db.sublevel(reqId).put(emailId, data);
  });
}

function openEmail(reqId, emailId) {
  info('open email req: %o, email: %o', reqId, emailId);

  db.sublevel(reqId).get(emailId, (err, data) => {

    if (err) { return console.log(err); }
    data.isOpened = true;
    data.openedAt = Date.now();
    db.sublevel(reqId).put(emailId, data);
  });
}

