// copyIdl.js
const fs = require('fs');
const idl = require('./target/idl/madpacks.json');

fs.writeFileSync('./app/src/idl.json', JSON.stringify(idl));