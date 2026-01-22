const fs = require('fs');

const data = JSON.parse(fs.readFileSync('assistant.db', 'utf8'));
const features = data.features || [];
const feature = features.find(f => f.id === 72);

if (feature) {
  console.log('Feature #72:');
  console.log('Name:', feature.name);
  console.log('Category:', feature.category);
  console.log('Description:', feature.description);
  console.log('Steps:', feature.steps);
  console.log('Passing:', feature.passes);
  console.log('In Progress:', feature.in_progress);
} else {
  console.log('Feature #72 not found');
}
