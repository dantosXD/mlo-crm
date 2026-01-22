const bcrypt = require('./backend/node_modules/bcryptjs');
const Database = require('better-sqlite3');

const db = new Database('backend/prisma/dev.db');

async function updateAdminPassword() {
  try {
    const email = 'admin@example.com';
    const password = 'admin123';
    const hashedPassword = await bcrypt.hash(password, 10);

    const check = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (check) {
      console.log('Updating admin password...');
      db.prepare('UPDATE users SET password_hash = ? WHERE email = ?').run(hashedPassword, email);
      console.log('✅ Admin password updated successfully');
      console.log('Email:', email);
      console.log('Password:', password);
    } else {
      console.log('❌ Admin user not found');
    }

  } catch (err) {
    console.error('Error:', err);
  } finally {
    db.close();
  }
}

updateAdminPassword();
