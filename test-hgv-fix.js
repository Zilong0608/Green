const { handleUserQuery } = require('./lib/main-controller');

async function testHGVFix() {
  console.log('🔧 测试 HGV 匹配修复...\n');
  
  const testCases = [
    {
      description: 'HGV 直接查询',
      query: 'HGV refrigerated (all diesel) - All HGVs - 50% Laden - Delivery vehicles & freight',
      expectedMatch: 'HGV refrigerated',
      expectedUnit: 'kg/km'
    },
    {
      description: 'Sarah 的 HGV 场景',
      query: 'Sarah drives a diesel-powered refrigerated heavy goods vehicle, half-loaded with perishable goods, making deliveries over a 120km route between distribution centers.',
      expectedMatch: 'HGV refrigerated',
      expectedUnit: 'kg/km',
      expectedCalculation: '120km × 0.2316kg/km = 27.792kg CO2'
    },
    {
      description: '重型货运车辆场景',
      query: '一辆柴油驱动的冷藏重型货运车辆，半载运输易腐货物，行驶120公里',
      expectedMatch: 'HGV refrigerated',
      expectedUnit: 'kg/km'
    }
  ];
  
  const results = [];
  
  for (let i = 0; i < testCases.length; i++) {
    const testCase = testCases[i];
    console.log(`\n📝 测试 ${i + 1}: ${testCase.description}`);
    console.log(`查询: "${testCase.query}"`);
    
    try {
      const startTime = Date.now();
      const result = await handleUserQuery(testCase.query);
      const processingTime = Date.now() - startTime;
      
      // 分析结果
      const success = result.success;
      const entities = result.result?.calculations || [];
      
      console.log(`\n📊 结果分析:`);
      console.log(`- 处理成功: ${success ? '✅' : '❌'}`);
      console.log(`- 处理时间: ${processingTime}ms`);
      console.log(`- 实体数量: ${entities.length}`);
      
      if (entities.length > 0) {
        const entity = entities[0];
        console.log(`- 匹配到: "${entity.activity}"`);
        console.log(`- 单位: ${entity.unit}`);
        console.log(`- 排放因子: ${entity.emissionFactor}`);
        console.log(`- 排放量: ${entity.emissions}`);
        
        // 验证匹配正确性
        const matchCorrect = entity.activity.toLowerCase().includes('hgv') && entity.activity.toLowerCase().includes('refrigerated');
        const unitCorrect = entity.unit === 'kg/km';
        
        console.log(`\n🎯 验证结果:`);
        console.log(`- HGV冷藏车匹配: ${matchCorrect ? '✅' : '❌'}`);
        console.log(`- 单位正确(kg/km): ${unitCorrect ? '✅' : '❌'}`);
        
        // 检查计算结果（对于有距离的查询）
        if (testCase.query.includes('120km') || testCase.query.includes('120公里')) {
          const expectedEmissions = 120 * 0.2316;
          const actualEmissions = parseFloat(entity.emissions.toString());
          const calculationCorrect = Math.abs(actualEmissions - expectedEmissions) < 0.1;
          
          console.log(`- 计算正确(≈27.8kg): ${calculationCorrect ? '✅' : '❌'}`);
          console.log(`  预期: ${expectedEmissions.toFixed(3)}kg CO2`);
          console.log(`  实际: ${actualEmissions}kg CO2`);
        }
        
        results.push({
          test: testCase.description,
          success: success && matchCorrect && unitCorrect,
          details: {
            matchCorrect,
            unitCorrect,
            activity: entity.activity,
            unit: entity.unit,
            emissions: entity.emissions
          }
        });
      } else {
        console.log('❌ 没有找到匹配的实体');
        results.push({
          test: testCase.description,
          success: false,
          details: { error: '没有找到实体' }
        });
      }
      
    } catch (error) {
      console.log(`❌ 测试出错: ${error.message}`);
      results.push({
        test: testCase.description,
        success: false,
        details: { error: error.message }
      });
    }
    
    console.log('\n' + '='.repeat(60));
  }
  
  // 总结报告
  console.log('\n📈 测试总结报告:');
  const successCount = results.filter(r => r.success).length;
  const totalCount = results.length;
  
  console.log(`\n🎯 总体结果: ${successCount}/${totalCount} 测试通过`);
  
  results.forEach((result, index) => {
    const status = result.success ? '✅' : '❌';
    console.log(`  ${status} 测试 ${index + 1}: ${result.test}`);
    if (!result.success && result.details.error) {
      console.log(`    错误: ${result.details.error}`);
    }
  });
  
  if (successCount === totalCount) {
    console.log('\n🎉 所有 HGV 测试通过！修复成功！');
  } else {
    console.log('\n⚠️ 部分测试失败，需要进一步调试');
  }
  
  return {
    success: successCount === totalCount,
    passed: successCount,
    total: totalCount,
    details: results
  };
}

// 运行测试
if (require.main === module) {
  testHGVFix()
    .then(result => {
      console.log('\n🏁 HGV 修复测试完成');
      process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
      console.error('❌ 测试运行失败:', error);
      process.exit(1);
    });
}

module.exports = { testHGVFix }; 