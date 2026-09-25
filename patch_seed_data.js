const fs = require('fs');
let content = fs.readFileSync('db/scripts/seed_data.js', 'utf8');

content = content.replace(
  "const itemName    = `${catName} ${i}`;",
  "const itemName    = `Item ${i}`;"
);

content = content.replace(
  "const description = `Found a ${catName} near ${locName}`;",
  "const description = `Found on ${fDate.toISOString().split('T')[0]} near ${locName}`;"
);

content = content.replace(
  "const itemName    = `${catName} ${i}`;",
  "const itemName    = `Item ${i}`;"
);

content = content.replace(
  "const description = `Lost a ${catName} near ${locName}`;",
  "const description = `Lost on ${lDate.toISOString().split('T')[0]} near ${locName}`;"
);

fs.writeFileSync('db/scripts/seed_data.js', content);
