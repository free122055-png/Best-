const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

async function buildAllIcons() {
  console.log('🚀 Starting generation of all Android, Play Store, and PWA icons...');

  const svgPath = path.join(__dirname, '..', 'public', 'samity_logo.svg');
  if (!fs.existsSync(svgPath)) {
    throw new Error('SVG logo file not found at: ' + svgPath);
  }

  // 1. Generate master 1024x1024 and 512x512 icons
  const base512Buffer = await sharp(svgPath)
    .resize(512, 512)
    .png()
    .toBuffer();

  const publicAppIcon = path.join(__dirname, '..', 'public', 'app_icon.png');
  fs.writeFileSync(publicAppIcon, base512Buffer);
  console.log('✅ Generated public/app_icon.png (512x512)');

  const distDir = path.join(__dirname, '..', 'dist');
  if (fs.existsSync(distDir)) {
    fs.writeFileSync(path.join(distDir, 'app_icon.png'), base512Buffer);
  }

  // Apple touch icon (180x180)
  await sharp(base512Buffer)
    .resize(180, 180)
    .png()
    .toFile(path.join(__dirname, '..', 'public', 'apple-touch-icon.png'));
  console.log('✅ Generated public/apple-touch-icon.png (180x180)');

  // Favicon (64x64)
  await sharp(base512Buffer)
    .resize(64, 64)
    .png()
    .toFile(path.join(__dirname, '..', 'public', 'favicon.png'));
  console.log('✅ Generated public/favicon.png (64x64)');

  // Copy SVG to android main assets if directory exists
  const androidAssets = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'assets', 'public');
  if (fs.existsSync(androidAssets)) {
    fs.copyFileSync(svgPath, path.join(androidAssets, 'samity_logo.svg'));
    fs.writeFileSync(path.join(androidAssets, 'app_icon.png'), base512Buffer);
    console.log('✅ Updated android assets with samity_logo.svg and app_icon.png');
  }

  // Google Play Store high-res icon: 512x512 in android/app/src/main/
  const playStoreIcon = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'ic_launcher-web.png');
  fs.writeFileSync(playStoreIcon, base512Buffer);
  console.log('✅ Generated Play Store ic_launcher-web.png (512x512)');

  // 2. Generate Android launcher icons (ic_launcher, ic_launcher_round, ic_launcher_foreground)
  const androidResDir = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'res');
  if (fs.existsSync(androidResDir)) {
    const densities = [
      { name: 'mipmap-mdpi', size: 48, fgSize: 108 },
      { name: 'mipmap-hdpi', size: 72, fgSize: 162 },
      { name: 'mipmap-xhdpi', size: 96, fgSize: 216 },
      { name: 'mipmap-xxhdpi', size: 144, fgSize: 324 },
      { name: 'mipmap-xxxhdpi', size: 192, fgSize: 432 },
    ];

    for (const d of densities) {
      const targetDir = path.join(androidResDir, d.name);
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      // Standard square icon
      await sharp(base512Buffer)
        .resize(d.size, d.size)
        .png()
        .toFile(path.join(targetDir, 'ic_launcher.png'));

      // Round icon (circle mask)
      const circleSvg = Buffer.from(
        `<svg width="${d.size}" height="${d.size}"><circle cx="${d.size / 2}" cy="${d.size / 2}" r="${d.size / 2}" fill="#000000"/></svg>`
      );
      await sharp(base512Buffer)
        .resize(d.size, d.size)
        .composite([{ input: circleSvg, blend: 'dest-in' }])
        .png()
        .toFile(path.join(targetDir, 'ic_launcher_round.png'));

      // Adaptive foreground (108dp canvas with safe zone center icon)
      // Safe zone is ~66% of the canvas size
      const safeIconSize = Math.round(d.fgSize * 0.72);
      const innerIconBuffer = await sharp(base512Buffer)
        .resize(safeIconSize, safeIconSize)
        .png()
        .toBuffer();

      const topOffset = Math.round((d.fgSize - safeIconSize) / 2);
      const leftOffset = Math.round((d.fgSize - safeIconSize) / 2);

      await sharp({
        create: {
          width: d.fgSize,
          height: d.fgSize,
          channels: 4,
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        }
      })
        .composite([{ input: innerIconBuffer, top: topOffset, left: leftOffset }])
        .png()
        .toFile(path.join(targetDir, 'ic_launcher_foreground.png'));

      console.log(`✅ Generated ${d.name} icons (${d.size}x${d.size}, fg: ${d.fgSize}x${d.fgSize})`);
    }

    // 3. Splash screen graphics
    const splashDirs = [
      'drawable',
      'drawable-port-mdpi',
      'drawable-port-hdpi',
      'drawable-port-xhdpi',
      'drawable-port-xxhdpi',
      'drawable-port-xxxhdpi',
      'drawable-land-mdpi',
      'drawable-land-hdpi',
      'drawable-land-xhdpi',
      'drawable-land-xxhdpi',
      'drawable-land-xxxhdpi'
    ];

    for (const sDir of splashDirs) {
      const fullPath = path.join(androidResDir, sDir);
      if (fs.existsSync(fullPath)) {
        await sharp(base512Buffer)
          .resize(480, 480, { fit: 'inside' })
          .png()
          .toFile(path.join(fullPath, 'splash.png'));
      }
    }
    console.log('✅ Updated splash.png across all splash drawable folders');
  }

  console.log('🎉 All icons successfully built and synchronized!');
}

buildAllIcons().catch(err => {
  console.error('❌ Icon generation failed:', err);
  process.exit(1);
});
