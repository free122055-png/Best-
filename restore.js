const { execSync } = require('child_process');
try {
  execSync('git checkout src/components/AdminPanel.tsx');
  console.log('Successfully reverted AdminPanel.tsx to clean git state!');
} catch (e) {
  console.error('Error restoring:', e.message);
}
