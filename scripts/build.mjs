#!/usr/bin/env node
// 全量构建与打包脚本
//
// 1. 校验 package.json 与 extension/manifest.json 版本严格一致
// 2. 自动构建发布级 Chrome Web Store zip 包（剥离本地专用 key，输出到 dist/）
// 3. 校验 npm pack 待分发文件清单
// 4. 输出打包报告与产物规格
//
// 用法：
//   npm run build
//   npm run pack

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const EXT_SRC = path.join(ROOT, 'extension');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const manifest = JSON.parse(fs.readFileSync(path.join(EXT_SRC, 'manifest.json'), 'utf8'));

console.log(`\n📦 chrome-agent-browser v${pkg.version} 构建与打包\n`);

// 1. 版本一致性校验
if (pkg.version !== manifest.version) {
  console.error(`❌ 版本不一致：package.json (${pkg.version}) vs manifest.json (${manifest.version})`);
  process.exit(1);
}
console.log(`  ✅ 版本核验通过：v${pkg.version}`);

// 2. 准备输出目录
const distDir = path.join(ROOT, 'dist');
fs.mkdirSync(distDir, { recursive: true });

// 3. 打包 Chrome MV3 扩展 (剥掉开发专用 key)
const zipName = `chrome-agent-browser-${pkg.version}.zip`;
const zipPath = path.join(distDir, zipName);
const stage = fs.mkdtempSync(path.join(os.tmpdir(), 'ab-build-'));

try {
  fs.cpSync(EXT_SRC, stage, {
    recursive: true,
    filter: (p) => !/\.DS_Store$|\/content\/?$/.test(p),
  });

  const { key, ...cleanManifest } = manifest;
  fs.writeFileSync(path.join(stage, 'manifest.json'), JSON.stringify(cleanManifest, null, 2) + '\n');

  try { fs.unlinkSync(zipPath); } catch {}
  if (process.platform === 'win32') {
    execFileSync('tar.exe', ['-a', '-cf', zipPath, '*'], { cwd: stage });
  } else {
    execFileSync('zip', ['-qr', zipPath, '.'], { cwd: stage });
  }
  const zipSize = Math.round(fs.statSync(zipPath).size / 1024);
  console.log(`  ✅ Chrome 扩展分发包：dist/${zipName} (${zipSize}KB)`);
} finally {
  fs.rmSync(stage, { recursive: true, force: true });
}

// 4. 验证 npm 包分发面（fail-closed：预检失败必须阻断构建）
try {
  const packJson = execFileSync('npm', ['pack', '--dry-run', '--json'], { cwd: ROOT, encoding: 'utf8' });
  const packInfo = JSON.parse(packJson)[0];
  console.log(`  ✅ npm 包分发核验：${packInfo.filename} (${Math.round(packInfo.size / 1024)}KB，共 ${packInfo.files.length} 个文件)`);
} catch (e) {
  console.error(`  ❌ npm pack 预检失败：${e.message}`);
  process.exit(1);
}

console.log('\n构建产物就绪：');
console.log(`  • Chrome Web Store 提交包：${path.relative(ROOT, zipPath)}`);
console.log(`  • 本地开发加载目录：extension/（保留 RSA key，ID 保持稳定）`);
console.log(`  • 快速体检：npm run doctor\n`);
