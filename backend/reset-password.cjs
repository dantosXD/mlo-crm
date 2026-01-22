const bcrypt = require('bcrypt');
const db = require('better-sqlite3')('../assistant.db');

const newPassword = 'admin123';
const hashedPassword = bcrypt.hashSync(newPassword, 12);

const update = db.prepare('UPDATE users SET password_hash = ? WHERE email = ?');
const result = update.run(hashedPassword, 'admin@example.com');

console.log('Password reset successfully for admin@example.com');
console.log('New password: admin123');
console.log('Rows affected:', result.changes);
