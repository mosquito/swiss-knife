const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

const distOfflineDir = path.resolve(__dirname, '..', 'dist-offline');
const distDir = path.resolve(__dirname, '..', 'dist');
const indexPath = path.join(distOfflineDir, 'index.html');
const zipPath = path.join(distDir, 'swiss-knife.zip');

async function createZip() {
  if (!fs.existsSync(indexPath)) {
    console.error('Error: index.html not found in dist-offline/');
    process.exit(1);
  }

  const output = fs.createWriteStream(zipPath);
  const archive = archiver('zip', { zlib: { level: 9 } });

  archive.on('error', (err) => {
    throw err;
  });

  output.on('close', () => {
    const stats = fs.statSync(zipPath);
    const fileSizeInKB = (stats.size / 1024).toFixed(2);
    console.log(`✓ Created swiss-knife.zip (${fileSizeInKB} KB)`);
    console.log(`  Contains: swiss-knife.html`);
  });

  archive.pipe(output);
  archive.file(indexPath, { name: 'swiss-knife.html' });
  await archive.finalize();
}

createZip().catch(console.error);
