const { execSync } = require('child_process');
try {
  console.log('Running git status in parent /app:');
  const res = execSync('git -C /app status', { encoding: 'utf8' });
  console.log(res);
} catch (e) {
  console.error('Error in /app:', e.message);
}
try {
  console.log('Running git status in /app/applet:');
  const res = execSync('git status', { encoding: 'utf8' });
  console.log(res);
} catch (e) {
  console.error('Error in /app/applet:', e.message);
}
