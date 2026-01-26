const bcrypt = require('bcrypt');
const password = 'password123';

// Generate hash
const hash = bcrypt.hashSync(password, 10);
console.log('Generated hash:', hash);

// Compare test
const testResult = bcrypt.compareSync(password, hash);
console.log('Comparison result:', testResult);
