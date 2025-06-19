#!/usr/bin/env node

/**
 * 启动脚本 - 绕过权限问题
 */

const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 启动 Green Carbon Assessment 系统...');
console.log('📍 端口: 3010');
console.log('🌐 地址: http://localhost:3010');

// 设置环境变量
process.env.NODE_ENV = 'development';

// 启动 Next.js 开发服务器
const nextPath = path.join(__dirname, 'node_modules', '.bin', 'next');
const child = spawn('node', [nextPath, 'dev', '-p', '3010'], {
  stdio: 'inherit',
  shell: true
});

child.on('error', (error) => {
  console.error('❌ 启动失败:', error);
  console.log('\n💡 请尝试以下解决方案:');
  console.log('1. 检查 Node.js 是否正确安装');
  console.log('2. 检查端口 3010 是否被占用');
  console.log('3. 确保 .env.local 文件存在且配置正确');
});

child.on('close', (code) => {
  console.log(`\n🔄 服务器进程退出，代码: ${code}`);
});