'use strict';


require('dotenv').config({silent: true});
require('./lib/hook');
const server = require('./lib/server');

server.listen(process.env.PORT);
console.log('server runing on port', process.env.PORT);
