const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const archiver = require('archiver');

const distDir = path.resolve(__dirname, '..', 'dist');
const distOfflineDir = path.resolve(__dirname, '..', 'dist-offline');
const targets = ['bundle.js', 'index.html'];

async function createZip() {
  const indexPath = path.join(distOfflineDir, 'index.html');
  const zipPath = path.join(distDir, 'swiss-knife.zip');

  if (!fs.existsSync(indexPath)) {
    console.warn('Skipping swiss-knife.zip - no offline build found');
    return;
  }

  const output = fs.createWriteStream(zipPath);
  const archive = archiver('zip', { zlib: { level: 9 } });

  return new Promise((resolve, reject) => {
    archive.on('error', reject);
    
    output.on('close', () => {
      const stats = fs.statSync(zipPath);
      const fileSizeInKB = (stats.size / 1024).toFixed(2);
      console.log(`✓ Created swiss-knife.zip (${fileSizeInKB} KB)`);
      resolve();
    });

    archive.pipe(output);
    archive.file(indexPath, { name: 'swiss-knife.html' });
    archive.finalize();
  });
}

function compressGzip(sourcePath, data) {
  zlib.gzip(data, { level: 9 }, (err, result) => {
    if (err) {
      console.error('Gzip error for', sourcePath, err);
      return;
    }
    const outPath = sourcePath + '.gz';
    fs.writeFile(outPath, result, (writeErr) => {
      if (writeErr) console.error('Write gzip error for', sourcePath, writeErr);
      else console.log('Created', path.basename(outPath));
    });
  });
}

function compressBrotli(sourcePath, data) {
  zlib.brotliCompress(data, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11 } }, (err, result) => {
    if (err) {
      console.error('Brotli error for', sourcePath, err);
      return;
    }
    const outPath = sourcePath + '.br';
    fs.writeFile(outPath, result, (writeErr) => {
      if (writeErr) console.error('Write brotli error for', sourcePath, writeErr);
      else console.log('Created', path.basename(outPath));
    });
  });
}

function processFile(filename) {
  const filePath = path.join(distDir, filename);
  if (!fs.existsSync(filePath)) {
    console.warn('Skipping missing file', filename);
    return;
  }
  const data = fs.readFileSync(filePath);
  compressGzip(filePath, data);
  compressBrotli(filePath, data);
}

console.log('Starting compression in', distDir);
targets.forEach(processFile);

createZip().catch(console.error);
