#!/usr/bin/env node
/**
 * 生成应用图标
 */

import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import pngToIco from 'png-to-ico';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const svgPath = path.join(__dirname, '../icons/app-icon.svg');
const iconsDir = path.join(__dirname, '../icons');

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
];

async function generateIcons() {
  console.log('开始生成图标...\n');

  // 生成 PNG 图标
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

  // 生成 ICO 文件 (Windows) 使用 png-to-ico
  try {
    // 需要多个尺寸的 PNG 文件来生成 ICO
    const icoSizes = [16, 32, 48, 256];
    const pngPaths = [];

    for (const size of icoSizes) {
      const pngPath = path.join(iconsDir, `temp_${size}.png`);
      await sharp(svgPath)
        .resize(size, size, { fit: 'cover' })
        .png()
        .toFile(pngPath);
      pngPaths.push(pngPath);
    }

    const icoBuffer = await pngToIco(pngPaths);
    fs.writeFileSync(path.join(iconsDir, 'icon.ico'), icoBuffer);

    // 清理临时文件
    pngPaths.forEach(p => fs.unlinkSync(p));

    console.log(`✓ 生成 icon.ico (Windows) - ${icoSizes.length} 尺寸`);
  } catch (error) {
    console.error(`✗ 生成 icon.ico 失败:`, error.message);
    // 备用方案：直接复制 256x256 PNG 作为 ICO
    try {
      const fallbackPng = await sharp(svgPath)
        .resize(256, 256, { fit: 'cover' })
        .png()
        .toBuffer();
      fs.writeFileSync(path.join(iconsDir, 'icon.ico'), fallbackPng);
      console.log(`✓ 生成 icon.ico (备用方案)`);
    } catch (e) {
      console.error(`✗ 备用方案也失败:`, e.message);
    }
  }

  // 生成 ICNS (macOS) 的替代 - 使用 PNG
  try {
    const icnsBuffer = await sharp(svgPath)
      .resize(1024, 1024, { fit: 'cover' })
      .png()
      .toBuffer();

    fs.writeFileSync(path.join(iconsDir, 'icon.icns'), icnsBuffer);
    console.log(`✓ 生成 icon.icns (macOS - PNG 替代)`);
  } catch (error) {
    console.error(`✗ 生成 icon.icns 失败:`, error.message);
  }

  console.log('\n图标生成完成！');
  console.log('\n提示：');
  console.log('- Windows: icon.ico 已生成');
  console.log('- macOS: icon.icns 建议使用专业工具生成');
}

generateIcons().catch(console.error);
