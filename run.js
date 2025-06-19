/**
 * 简单启动脚本
 */

const { exec } = require('child_process');

console.log('🚀 正在启动 Green Carbon Assessment 系统...');
console.log('📍 端口: 3010');
console.log('🌐 访问地址: http://localhost:3010');
console.log('⏱️  首次启动可能需要几秒钟...\n');

// 直接执行 Next.js 命令
const startCommand = 'npx --yes next@latest dev -p 3010';

const child = exec(startCommand, { 
  cwd: __dirname,
  env: { ...process.env, NODE_ENV: 'development' }
});

child.stdout.on('data', (data) => {
  console.log(data.toString());
});

child.stderr.on('data', (data) => {
  console.error(data.toString());
});

child.on('close', (code) => {
  console.log(`\n服务器进程退出，代码: ${code}`);
});

// 处理退出信号
process.on('SIGINT', () => {
  console.log('\n\n🛑 正在关闭服务器...');
  child.kill('SIGINT');
  process.exit(0);
});

console.log('✅ 启动命令已执行');
console.log('📝 如果看到 "Ready" 消息，说明启动成功');
console.log('🔗 然后可以在浏览器中访问 http://localhost:3010');
console.log('⚡ 按 Ctrl+C 停止服务器\n');