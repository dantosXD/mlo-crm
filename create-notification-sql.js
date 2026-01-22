const sqlite3 = require('sqlite3').verbose();
const crypto = require('crypto');

const db = new sqlite3.Database('./backend/dev.db');

function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

const notificationId = uuidv4();
const userId = 'b6698386-7930-4bd5-8d9d-3dd209404c89';
const now = new Date().toISOString();

const sql = `
  INSERT INTO notifications (id, user_id, type, title, message, link, is_read, read_at, metadata, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`;

const params = [
  notificationId,
  userId,
  'DOCUMENT_REMINDER',
  'Document Due Tomorrow: TEST_DOCUMENT_236_W2_Form',
  'The document "TEST_DOCUMENT_236_W2_Form" for client FEATURE_236_TEST_CLIENT is due tomorrow (January 23, 2026).',
  '/documents',
  0, // isRead = false
  null, // readAt = null
  null, // metadata = null
  now,
];

db.run(sql, params, function(err) {
  if (err) {
    console.error('❌ Error creating notification:', err);
  } else {
    console.log('✅ Test notification created successfully!');
    console.log('   Notification ID:', notificationId);
    console.log('   User ID:', userId);
    console.log('   Type: DOCUMENT_REMINDER');
    console.log('   Title: Document Due Tomorrow: TEST_DOCUMENT_236_W2_Form');
  }
  db.close();
});
