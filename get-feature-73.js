#!/usr/bin/env node

/**
 * Query Feature #73 from the features database
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'assistant.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.all(`
    SELECT * FROM features
    WHERE id = 73
  `, (err, rows) => {
    if (err) {
      console.error('Error:', err);
      process.exit(1);
    }

    if (rows.length === 0) {
      console.log('Feature #73 not found');
      process.exit(1);
    }

    const feature = rows[0];
    console.log('='.repeat(80));
    console.log(`Feature #${feature.id}: ${feature.name}`);
    console.log('='.repeat(80));
    console.log(`Category: ${feature.category}`);
    console.log(`Priority: ${feature.priority}`);
    console.log(`Status: ${feature.passes ? 'PASSING' : 'PENDING'}`);
    console.log(`In Progress: ${feature.in_progress ? 'YES' : 'NO'}`);
    console.log('\nDescription:');
    console.log(feature.description || 'No description');
    console.log('\nSteps:');
    const steps = feature.steps ? JSON.parse(feature.steps) : [];
    steps.forEach((step, i) => {
      console.log(`  ${i + 1}. ${step}`);
    });
    if (feature.dependencies) {
      const deps = JSON.parse(feature.dependencies);
      if (deps.length > 0) {
        console.log(`\nDependencies: ${deps.join(', ')}`);
      }
    }
    console.log('='.repeat(80));

    db.close();
  });
});
