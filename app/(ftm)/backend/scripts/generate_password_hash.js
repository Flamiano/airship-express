const bcryptjs = require('bcryptjs');

// Generate bcrypt hash for demo password
async function generateHash() {
  const demoPassword = 'Demo@12345';
  const salt = await bcryptjs.genSalt(10);
  const hash = await bcryptjs.hash(demoPassword, salt);
  console.log(`Password: ${demoPassword}`);
  console.log(`Hash: ${hash}`);
  return hash;
}

generateHash().then(hash => {
  console.log('\nUse this hash in the SQL migration:');
  console.log(`'${hash}'`);
  process.exit(0);
}).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
