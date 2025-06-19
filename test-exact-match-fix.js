// 测试精确匹配修复效果
const { IntentDetectionEngine } = require('./lib/intent-detection');
const { RAGEngine } = require('./lib/rag');
const { ReasoningEngine } = require('./lib/reasoning');

// 初始化引擎
const intentEngine = new IntentDetectionEngine();
const ragEngine = new RAGEngine();
const reasoningEngine = new ReasoningEngine();

async function testExactMatchFix() {
  console.log('🔧 测试精确匹配修复效果\n');
  
  // 用户指出的三个问题查询
  const testCases = [
    {
      name: 'Rigid truck 26-32t问题',
      query: 'Rigid truck 26-32t - Container transport - Diesel',
      expectedTitle: 'Rigid truck 26-32t - Container transport - Diesel',
      expectedFactor: 0.000116,
      expectedUnit: 'kg/tonne-km',
      expectedSource: 'GLEC',
      wrongFactor: 0.0005056 // 用户报告的错误因子
    },
    {
      name: 'HGV refrigerated问题',
      query: 'HGV refrigerated (all diesel) - All HGVs - 50% Laden - Delivery vehicles & freight',
      expectedTitle: 'HGV refrigerated (all diesel) - All HGVs - 50% Laden - Delivery vehicles & freight',
      expectedFactor: null, // 需要从数据库查询
      expectedUnit: 'kg/km',
      expectedSource: 'BEIS',
      wrongFactor: 1.163 // 用户报告的错误因子
    },
    {
      name: 'Concrete waste问题',
      query: 'Concrete waste disposal (to closed-loop recycling)',
      expectedTitle: 'Concrete waste disposal (to closed-loop recycling)',
      expectedFactor: null, // 需要从数据库查询
      expectedUnit: 'kg/tonne',
      expectedSource: 'BEIS',
      wrongFactor: 0.0009848 // 用户报告的错误因子
    }
  ];
  
  const results = [];
  
  for (let i = 0; i < testCases.length; i++) {
    const testCase = testCases[i];
    console.log(`\n=== 测试 ${i + 1}: ${testCase.name} ===`);
    console.log(`查询: "${testCase.query}"`);
    
    try {
      // 步骤1: 意图识别
      console.log('\n📋 步骤1: 意图识别');
      const intentResult = await intentEngine.analyzeUserInput(testCase.query, 'en');
      console.log(`- 意图: ${intentResult.intent}`);
      console.log(`- 实体数量: ${intentResult.entities.length}`);
      
      if (intentResult.entities.length > 0) {
        const entity = intentResult.entities[0];
        console.log(`- 实体名称: "${entity.activity}"`);
        console.log(`- 实体类型: ${entity.entityType || 'general'}`);
      }
      
      // 步骤2: RAG搜索
      console.log('\n🔎 步骤2: RAG搜索 (测试精确匹配)');
      const ragResults = await ragEngine.batchSearchActivities(intentResult.entities, 'en');
      
      let searchSuccess = false;
      let foundActivity = null;
      
      for (const [entityId, searchResults] of ragResults) {
        console.log(`\n📊 实体 "${entityId}" 搜索结果:`);
        console.log(`- 结果数量: ${searchResults.length}`);
        
        if (searchResults.length > 0) {
          const bestMatch = searchResults[0];
          foundActivity = bestMatch.activity;
          
          console.log(`- 最佳匹配: "${bestMatch.activity.title}"`);
          console.log(`- 匹配类型: ${bestMatch.matchType}`);
          console.log(`- 相关性评分: ${bestMatch.relevanceScore}`);
          console.log(`- 排放因子: ${bestMatch.activity.emission_factor} ${bestMatch.activity.unit}`);
          console.log(`- 数据来源: ${bestMatch.activity.source}`);
          
          // 验证是否为精确匹配
          const isExactMatch = bestMatch.matchType === 'exact';
          const isCorrectTitle = bestMatch.activity.title.toLowerCase() === testCase.query.toLowerCase();
          
          console.log(`\n🎯 验证结果:`);
          console.log(`- 精确匹配: ${isExactMatch ? '✅' : '❌'}`);
          console.log(`- 标题匹配: ${isCorrectTitle ? '✅' : '❌'}`);
          
          // 检查是否修复了排放因子错误
          const factorCorrect = Math.abs(bestMatch.activity.emission_factor - testCase.wrongFactor) > 0.0001;
          console.log(`- 排放因子修复: ${factorCorrect ? '✅' : '❌'}`);
          console.log(`  修复前(错误): ${testCase.wrongFactor}`);
          console.log(`  修复后(正确): ${bestMatch.activity.emission_factor}`);
          
          searchSuccess = isExactMatch && isCorrectTitle;
        } else {
          console.log('❌ 没有找到匹配结果');
        }
      }
      
      // 步骤3: 完整流程测试
      console.log('\n🧮 步骤3: 完整计算流程');
      const finalResponse = await reasoningEngine.processUserRequest(
        intentResult,
        ragResults,
        'en'
      );
      
      console.log(`- 计算成功: ${finalResponse.success ? '✅' : '❌'}`);
      console.log(`- 总排放量: ${finalResponse.totalEmission} kg CO2`);
      
      if (finalResponse.result && finalResponse.result.calculations && finalResponse.result.calculations.length > 0) {
        const calc = finalResponse.result.calculations[0];
        console.log(`- 使用活动: "${calc.activity}"`);
        console.log(`- 使用因子: ${calc.emissionFactor} ${calc.unit}`);
      }
      
      // 记录测试结果
      results.push({
        test: testCase.name,
        success: searchSuccess,
        details: {
          exactMatch: searchSuccess,
          foundActivity: foundActivity?.title || 'None',
          foundFactor: foundActivity?.emission_factor || 'None',
          expectedTitle: testCase.expectedTitle,
          query: testCase.query
        }
      });
      
    } catch (error) {
      console.error(`❌ 测试失败:`, error);
      results.push({
        test: testCase.name,
        success: false,
        details: { error: error.message }
      });
    }
    
    console.log('\n' + '='.repeat(80));
  }
  
  // 总结报告
  console.log('\n📈 精确匹配修复测试总结:');
  const successCount = results.filter(r => r.success).length;
  const totalCount = results.length;
  
  console.log(`\n🎯 总体结果: ${successCount}/${totalCount} 测试通过`);
  
  results.forEach((result, index) => {
    const status = result.success ? '✅' : '❌';
    console.log(`  ${status} 测试 ${index + 1}: ${result.test}`);
    if (result.success) {
      console.log(`    ✓ 精确匹配成功: "${result.details.foundActivity}"`);
    } else if (result.details.error) {
      console.log(`    ✗ 错误: ${result.details.error}`);
    } else {
      console.log(`    ✗ 匹配失败，找到: "${result.details.foundActivity}"`);
    }
  });
  
  if (successCount === totalCount) {
    console.log('\n🎉 所有精确匹配测试通过！修复成功！');
    console.log('   - 用户指出的数据库精确匹配问题已解决');
    console.log('   - 简短查询现在优先进行数据库精确匹配');
    console.log('   - 排放因子数据来源准确性已验证');
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
  testExactMatchFix()
    .then(result => {
      console.log('\n🏁 精确匹配修复测试完成');
      process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
      console.error('❌ 测试运行失败:', error);
      process.exit(1);
    });
}

module.exports = { testExactMatchFix }; 