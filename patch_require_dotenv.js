const fs = require('fs');
let content = fs.readFileSync('db/scripts/test_matching_engine.js', 'utf8');

content = "require('dotenv').config({ path: '.env' });\n" + content;
fs.writeFileSync('db/scripts/test_matching_engine.js', content);
