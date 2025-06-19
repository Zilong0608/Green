const { IntentDetectionEngine } = require('./lib/intent-detection.ts');
const { RAGEngine } = require('./lib/rag.ts');
const { ReasoningEngine } = require('./lib/reasoning.ts');

async function testWeightRangeFix() {
  console.log('🔧 测试重量范围匹配修复...\n');
  
  const intentEngine = new IntentDetectionEngine();
  const ragEngine = new RAGEngine();
  const reasoningEngine = new ReasoningEngine();
  
  // 测试用例：Michael的30吨刚性卡车场景
  const queries = [
    {
      query: "Michael operates a 30-ton rigid diesel truck to transport shipping containers across a 75km route from the port to a logistics hub",
      expected: {
        factor: 0.000116, // 应该匹配26-32t范围
        calculation: "30 × 75 × 0.000116 = 0.261kg CO2"
      }
    },
    {
      query: "25吨刚性柴油卡车运输集装箱50公里",
      expected: {
        factor: 0.000116, // 应该匹配26-32t范围（如果有的话）或最接近的范围
      }
    },
    {
      query: "5吨货车运输货物100公里",
      expected: {
        factor: 0.0005056, // 应该匹配3.5-7.5t范围
      }
    }
  ];
  
  for (const testCase of queries) {
    console.log(`\n🚛 测试查询: "${testCase.query}"`);
    console.log('=' + '='.repeat(60));
    
    try {
      // 1. 意图识别
      const intentResult = await intentEngine.detectIntent(testCase.query);
      console.log(`📋 识别到实体: ${intentResult.entities.length}个`);
      
      for (const entity of intentResult.entities) {
        console.log(`  - ${entity.name} (${entity.quantity || '?'}${entity.unit || ''})`);
        
        // 2. RAG搜索
        const ragResults = await ragEngine.searchActivities(entity);
        
        if (ragResults.length > 0) {
          const bestMatch = ragResults[0];
          console.log(`\n🎯 最佳匹配:`);
          console.log(`  标题: ${bestMatch.activity.title}`);
          console.log(`  排放因子: ${bestMatch.activity.factor} ${bestMatch.activity.unit}`);
          console.log(`  匹配类型: ${bestMatch.matchType}`);
          console.log(`  相关性: ${(bestMatch.relevanceScore * 100).toFixed(1)}%`);
          
          // 3. 推理计算
          if (intentResult.intent === 'carbon_calculation') {
            const reasoningResults = await reasoningEngine.calculateEmissions(intentResult.entities, ragResults);
            
            if (reasoningResults.length > 0) {
              const result = reasoningResults[0];
              console.log(`\n💡 计算结果:`);
              console.log(`  总排放量: ${result.totalEmission.toFixed(3)}kg CO2`);
              console.log(`  计算公式: ${result.calculation.formula}`);
              
              // 验证期望结果
              if (testCase.expected.factor) {
                const factorMatch = Math.abs(result.emissionFactor.factor - testCase.expected.factor) < 0.000001;
                console.log(`  ✅ 排放因子匹配: ${factorMatch ? '正确' : '错误'} (期望: ${testCase.expected.factor}, 实际: ${result.emissionFactor.factor})`);
                
                if (!factorMatch) {
                  console.log(`  🚨 排放因子不匹配! 期望 ${testCase.expected.factor} 但得到 ${result.emissionFactor.factor}`);
                  console.log(`  📊 误差倍数: ${(result.emissionFactor.factor / testCase.expected.factor).toFixed(2)}x`);
                }
              }
            }
          }
        } else {
          console.log('❌ 未找到匹配的排放因子');
        }
      }
      
    } catch (error) {
      console.error('❌ 测试出错:', error.message);
    }
    
    console.log('\n' + '-'.repeat(80));
  }
  
  // 专门测试范围匹配
  console.log('\n🔍 专门测试范围匹配逻辑...');
  
  // 直接测试数据库查询
  const directQueries = [
    "Rigid truck 26-32t - Container transport - Diesel",
    "rigid truck 30t container",
    "30 ton truck container transport diesel"
  ];
  
  for (const query of directQueries) {
    console.log(`\n🔍 直接查询: "${query}"`);
    const results = await ragEngine.searchActivities({
      name: query,
      originalText: query,
      confidence: 1.0,
      quantity: 30,
      unit: 't'
    });
    
    if (results.length > 0) {
      console.log(`找到 ${results.length} 个结果:`);
      results.slice(0, 3).forEach((result, index) => {
        console.log(`  ${index + 1}. ${result.activity.title}`);
        console.log(`     排放因子: ${result.activity.factor} ${result.activity.unit}`);
        console.log(`     相关性: ${(result.relevanceScore * 100).toFixed(1)}%`);
      });
    } else {
      console.log('❌ 未找到结果');
    }
  }
}

// 运行测试
testWeightRangeFix().catch(console.error); 