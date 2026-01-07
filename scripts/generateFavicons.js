const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const sizes = [16, 32, 48, 192, 256, 512];
const svgPath = path.resolve(__dirname, '../public/favicon.svg');
const distDirs = ['dist'];

async function generateFavicons() {
  const svgBuffer = fs.readFileSync(svgPath);

  for (const distDir of distDirs) {
    const distPath = path.resolve(__dirname, '..', distDir);
    if (!fs.existsSync(distPath)) continue;

    // Generate PNG for each size
    for (const size of sizes) {
      await sharp(svgBuffer)
        .resize(size, size)
        .png()
        .toFile(path.join(distPath, `favicon-${size}.png`));
      console.log(`Generated ${distDir}/favicon-${size}.png`);
    }

    // Generate main favicon.png (32x32)
    await sharp(svgBuffer)
      .resize(32, 32)
      .png()
      .toFile(path.join(distPath, 'favicon.png'));
    console.log(`Generated ${distDir}/favicon.png`);
  }
}

generateFavicons().catch(console.error);
