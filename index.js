'use strict';


require('dotenv').config({silent: true});
const server = require('./lib/server');

server.listen(process.env.PORT);
console.log('server runing on port', process.env.PORT);
