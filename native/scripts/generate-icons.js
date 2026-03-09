#!/usr/bin/env node
/**
 * 生成应用图标
 * 需要安装 sharp: npm install --save-dev sharp
 */

const fs = require('fs');
const path = require('path');

// 检查是否安装了 sharp
let sharp;
try {
  sharp = require('sharp');
} catch (e) {
  console.error('请先安装 sharp: npm install --save-dev sharp');
  process.exit(1);
}

const svgPath = path.join(__dirname, 'icons', 'app-icon.svg');
const iconsDir = path.join(__dirname, 'icons');

// 确保图标目录存在
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// 检查 SVG 文件是否存在
if (!fs.existsSync(svgPath)) {
  console.error(`找不到 SVG 图标文件: ${svgPath}`);
  process.exit(1);
}

// 需要生成的图标尺寸
const sizes = [
  { size: 32, name: '32x32.png' },
  { size: 64, name: '64x64.png' },
  { size: 128, name: '128x128.png' },
  { size: 256, name: '128x128@2x.png' },
  { size: 256, name: '256x256.png' },
  { size: 512, name: '512x512.png' },
  { size: 1024, name: '1024x1024.png' },
];

async function generateIcons() {
  console.log('开始生成图标...\n');

  for (const { size, name } of sizes) {
    const outputPath = path.join(iconsDir, name);

    try {
      await sharp(svgPath)
        .resize(size, size, { fit: 'cover', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toFile(outputPath);

      console.log(`✓ 生成 ${name} (${size}x${size})`);
    } catch (error) {
      console.error(`✗ 生成 ${name} 失败:`, error.message);
    }
  }

  // 生成 ICO 文件 (Windows)
  try {
    await sharp(svgPath)
      .resize(256, 256, { fit: 'cover' })
      .png()
      .toFile(path.join(iconsDir, 'icon.ico'));

    console.log(`✓ 生成 icon.ico (Windows)`);
  } catch (error) {
    console.error(`✗ 生成 icon.ico 失败:`, error.message);
  }

  console.log('\n图标生成完成！');
}

generateIcons().catch(console.error);
