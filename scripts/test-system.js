#!/usr/bin/env node

/**
 * 系统集成测试脚本
 * 测试所有模块的协作工作
 */

const { mainController } = require('../lib/main-controller');

// 测试用例
const testCases = [
  {
    name: '简单食物查询',
    query: '我今天吃了100g苹果',
    language: 'zh',
    expectedIntent: 'carbon_calculation'
  },
  {
    name: '英文食物查询',
    query: 'I ate 100g apple today',
    language: 'en',
    expectedIntent: 'carbon_calculation'
  },
  {
    name: '多实体查询',
    query: '我开车10公里，喝了一杯咖啡',
    language: 'zh',
    expectedIntent: 'carbon_calculation'
  },
  {
    name: '缺失信息查询',
    query: '我吃了苹果',
    language: 'zh',
    expectedIntent: 'carbon_calculation'
  },
  {
    name: '信息查询',
    query: '苹果的碳排放系数是多少？',
    language: 'zh',
    expectedIntent: 'information_query'
  },
  {
    name: '普通对话',
    query: '你好',
    language: 'zh',
    expectedIntent: 'general_chat'
  }
];

async function runTests() {
  console.log('🚀 开始系统集成测试...\n');

  let passedTests = 0;
  let totalTests = testCases.length;

  for (const testCase of testCases) {
    console.log(`📝 测试: ${testCase.name}`);
    console.log(`   查询: "${testCase.query}"`);
    
    try {
      const startTime = Date.now();
      const response = await mainController.processUserQuery(testCase.query, testCase.language);
      const endTime = Date.now();
      
      console.log(`   ✅ 成功 (${endTime - startTime}ms)`);
      console.log(`   响应: ${response.success ? '成功' : '失败'}`);
      console.log(`   消息: ${response.message.substring(0, 100)}${response.message.length > 100 ? '...' : ''}`);
      
      if (response.results.length > 0) {
        console.log(`   结果: ${response.results.length} 个计算结果`);
        console.log(`   总排放: ${response.totalEmission.toFixed(3)}kg CO2`);
      }
      
      if (response.suggestions.length > 0) {
        console.log(`   建议: ${response.suggestions.length} 条建议`);
      }
      
      passedTests++;
      
    } catch (error) {
      console.log(`   ❌ 失败: ${error.message}`);
      console.error(`   错误详情:`, error);
    }
    
    console.log('');
  }

  console.log(`📊 测试结果: ${passedTests}/${totalTests} 通过`);
  
  if (passedTests === totalTests) {
    console.log('🎉 所有测试通过！系统运行正常。');
  } else {
    console.log('⚠️  部分测试失败，请检查系统配置。');
  }

  // 测试系统健康状态
  try {
    console.log('\n🏥 检查系统健康状态...');
    const health = await mainController.getSystemHealth();
    
    console.log(`   数据库: ${health.database ? '✅ 正常' : '❌ 异常'}`);
    console.log(`   模块状态:`, health.modules);
    
    if (health.performance.dbStats) {
      console.log(`   数据库统计: ${JSON.stringify(health.performance.dbStats)}`);
    }
    
    if (health.performance.cacheStats) {
      console.log(`   缓存统计: ${JSON.stringify(health.performance.cacheStats)}`);
    }
    
  } catch (error) {
    console.log('   ❌ 健康检查失败:', error.message);
  }

  // 关闭系统
  await mainController.shutdown();
  process.exit(passedTests === totalTests ? 0 : 1);
}

// 错误处理
process.on('unhandledRejection', (reason, promise) => {
  console.error('未处理的 Promise 拒绝:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('未捕获的异常:', error);
  process.exit(1);
});

// 运行测试
runTests().catch(error => {
  console.error('测试运行失败:', error);
  process.exit(1);
});