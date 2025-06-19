/**
 * 测试优化后的智能碳排放评估系统
 * 
 * 测试场景：
 * 1. 运输场景：30吨刚性柴油卡车运输集装箱75公里
 * 2. 废料处理：5吨混凝土废料完全回收再利用
 * 3. 液体处理：1000升工业废水处理
 */

const { mainController } = require('./lib/main-controller');

async function testEnhancedSystem() {
  console.log('🚀 开始测试优化后的系统...\n');

  // 测试用例
  const testCases = [
    {
      name: '运输场景测试',
      query: 'Michael operates a 30-ton rigid diesel truck to transport shipping containers across a 75km route from the port to a logistics hub.',
      expectedActivity: 'Rigid truck 26-32t - Container transport - Diesel',
      description: '期望找到刚性卡车运输集装箱的数据，并进行吨公里计算'
    },
    {
      name: '废料处理测试', 
      query: 'A construction crew transports 5 tonnes of concrete waste to a specialized facility where the material is fully recycled into new construction aggregates.',
      expectedActivity: 'Concrete waste disposal (to closed-loop recycling)',
      description: '期望找到混凝土废料闭环回收的数据'
    },
    {
      name: '液体处理测试',
      query: 'Process 1000 liters of industrial wastewater through advanced treatment',
      expectedActivity: 'Industrial wastewater treatment',
      description: '期望找到工业废水处理的数据'
    },
    {
      name: '多场景混合测试',
      query: 'Today I drove 30km in my Tesla Model Y and processed 500L of wastewater at the facility',
      expectedActivity: 'Mixed scenarios',
      description: '期望系统能分别处理电动车驾驶和废水处理两个场景'
    }
  ];

  // 执行测试
  for (let i = 0; i < testCases.length; i++) {
    const testCase = testCases[i];
    console.log(`\n📋 测试 ${i + 1}: ${testCase.name}`);
    console.log(`📝 查询: "${testCase.query}"`);
    console.log(`🎯 期望结果: ${testCase.expectedActivity}`);
    console.log(`📖 描述: ${testCase.description}`);
    console.log('─'.repeat(80));

    try {
      const startTime = Date.now();
      const response = await mainController.processUserQuery(testCase.query, 'en');
      const processingTime = Date.now() - startTime;

      console.log(`⏱️ 处理时间: ${processingTime}ms`);
      console.log(`✅ 成功: ${response.success}`);
      console.log(`🌍 总排放量: ${response.totalEmission}kg CO2`);
      console.log(`📊 结果数量: ${response.results.length}`);

      if (response.results.length > 0) {
        console.log('\n🎯 计算结果:');
        response.results.forEach((result, index) => {
          console.log(`  ${index + 1}. 实体: "${result.entity.name}"`);
          console.log(`     匹配: "${result.emissionFactor.title}"`);
          console.log(`     排放: ${result.totalEmission.toFixed(3)}kg CO2`);
          console.log(`     公式: ${result.calculation.formula}`);
          if (result.entity.entityType) {
            console.log(`     类型: ${result.entity.entityType}`);
          }
          if (result.entity.scenarioDetails) {
            console.log(`     场景: ${JSON.stringify(result.entity.scenarioDetails)}`);
          }
        });
      }

      if (response.suggestions.length > 0) {
        console.log('\n💡 建议:');
        response.suggestions.forEach((suggestion, index) => {
          console.log(`  ${index + 1}. ${suggestion}`);
        });
      }

      console.log(`\n📄 系统消息: "${response.message}"`);

    } catch (error) {
      console.error(`❌ 测试失败:`, error);
    }

    console.log('\n' + '='.repeat(80));
  }

  console.log('\n🎉 测试完成！');
}

// 执行测试
if (require.main === module) {
  testEnhancedSystem().catch(console.error);
}

module.exports = { testEnhancedSystem }; 