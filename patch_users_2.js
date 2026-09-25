const fs = require('fs');
let content = fs.readFileSync('db/scripts/test_matching_engine.js', 'utf8');

content = content.replace(
  "INSERT INTO users (full_name, email, role, password_hash) VALUES ('Test1', 't1@t.c', 'USER', 'x') RETURNING user_id",
  "INSERT INTO users (full_name, email, role, password_hash) VALUES ('Test1', 't1@t.c', 'STANDARD', 'x') RETURNING user_id"
);
content = content.replace(
  "INSERT INTO users (full_name, email, role, password_hash) VALUES ('Test2', 't2@t.c', 'USER', 'x') RETURNING user_id",
  "INSERT INTO users (full_name, email, role, password_hash) VALUES ('Test2', 't2@t.c', 'STANDARD', 'x') RETURNING user_id"
);

fs.writeFileSync('db/scripts/test_matching_engine.js', content);
