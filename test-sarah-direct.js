// 直接测试 Sarah 的 HGV 场景
const fs = require('fs');
const path = require('path');

// 引入所需模块
const { IntentDetectionEngine } = require('./lib/intent-detection');
const { RAGEngine } = require('./lib/rag');
const { ReasoningEngine } = require('./lib/reasoning');

// 初始化引擎
const intentEngine = new IntentDetectionEngine();
const ragEngine = new RAGEngine();
const reasoningEngine = new ReasoningEngine();

async function testSarahScenario() {
  console.log('🔍 测试 Sarah 的 HGV 冷藏车场景\n');
  
  const testQuery = "Sarah drives a diesel-powered refrigerated heavy goods vehicle, half-loaded with perishable goods, making deliveries over a 120km route between distribution centers.";
  
  console.log(`🧪 测试查询: "${testQuery}"\n`);
  
  try {
    // 步骤1: 意图识别
    console.log('📋 步骤1: 意图识别和实体提取');
    const intentResult = await intentEngine.analyzeUserInput(testQuery, 'en');
    
    console.log(`- 意图: ${intentResult.intent}`);
    console.log(`- 实体数量: ${intentResult.entities.length}`);
    
    if (intentResult.entities.length > 0) {
      intentResult.entities.forEach((entity, index) => {
        console.log(`  实体${index + 1}: "${entity.activity}" (${entity.quantity} ${entity.unit})`);
        if (entity.scenarioDetails) {
          console.log(`    车辆类型: ${entity.scenarioDetails.vehicleType}`);
          console.log(`    装载状态: ${entity.scenarioDetails.loadStatus}`);
          console.log(`    燃料类型: ${entity.scenarioDetails.fuelType}`);
          console.log(`    距离: ${entity.scenarioDetails.distance}`);
        }
      });
    }
    
    // 步骤2: RAG搜索
    console.log('\n🔎 步骤2: RAG搜索相关活动');
    const ragResults = await ragEngine.batchSearchActivities(intentResult.entities, 'en');
    
    console.log(`- 搜索结果数量: ${ragResults.size}`);
    
    for (const [entityId, results] of ragResults) {
      console.log(`\n📊 实体 "${entityId}" 的搜索结果:`);
      if (results.length > 0) {
        results.slice(0, 3).forEach((result, index) => {
          console.log(`  ${index + 1}. "${result.title}"`);
          console.log(`     排放因子: ${result.emission_factor} ${result.unit}`);
          console.log(`     数据源: ${result.source}`);
        });
      } else {
        console.log('  ❌ 没有找到匹配结果');
      }
    }
    
    // 步骤3: 推理和计算
    console.log('\n🧮 步骤3: 推理和计算');
    const finalResponse = await reasoningEngine.processUserRequest(
      intentResult,
      ragResults,
      'en'
    );
    
    console.log(`- 处理成功: ${finalResponse.success}`);
    console.log(`- 总排放量: ${finalResponse.totalEmission} kg CO2`);
    
    if (finalResponse.result && finalResponse.result.calculations) {
      console.log('\n📈 详细计算结果:');
      finalResponse.result.calculations.forEach((calc, index) => {
        console.log(`  计算${index + 1}:`);
        console.log(`    活动: "${calc.activity}"`);
        console.log(`    排放因子: ${calc.emissionFactor} ${calc.unit}`);
        console.log(`    数量: ${calc.quantity} ${calc.quantityUnit}`);
        console.log(`    排放量: ${calc.emissions} kg CO2`);
      });
    }
    
    // 验证结果
    console.log('\n🎯 结果验证:');
    
    if (finalResponse.success && finalResponse.result && finalResponse.result.calculations.length > 0) {
      const calc = finalResponse.result.calculations[0];
      
      // 检查是否匹配到HGV refrigerated
      const isHGVMatch = calc.activity.toLowerCase().includes('hgv') && 
                        calc.activity.toLowerCase().includes('refrigerated');
      console.log(`- HGV冷藏车匹配: ${isHGVMatch ? '✅' : '❌'}`);
      
      // 检查单位是否正确
      const isUnitCorrect = calc.unit === 'kg/km';
      console.log(`- 单位正确(kg/km): ${isUnitCorrect ? '✅' : '❌'}`);
      
      // 检查计算是否合理
      const expectedEmissions = 120 * 0.2316; // 120km × 0.2316kg/km
      const actualEmissions = parseFloat(calc.emissions.toString());
      const isCalculationReasonable = Math.abs(actualEmissions - expectedEmissions) < 5;
      console.log(`- 计算合理(约27.8kg): ${isCalculationReasonable ? '✅' : '❌'}`);
      console.log(`  预期: ${expectedEmissions.toFixed(3)} kg CO2`);
      console.log(`  实际: ${actualEmissions} kg CO2`);
      
      // 总体评估
      const overallSuccess = isHGVMatch && isUnitCorrect && isCalculationReasonable;
      console.log(`\n🏆 总体评估: ${overallSuccess ? '✅ 成功' : '❌ 失败'}`);
      
      if (!overallSuccess) {
        console.log('\n⚠️ 问题分析:');
        if (!isHGVMatch) {
          console.log('- 没有匹配到正确的HGV冷藏车数据');
        }
        if (!isUnitCorrect) {
          console.log('- 单位不正确，应该是kg/km');
        }
        if (!isCalculationReasonable) {
          console.log('- 计算结果不合理');
        }
      }
      
      return overallSuccess;
    } else {
      console.log('❌ 处理失败或没有计算结果');
      return false;
    }
    
  } catch (error) {
    console.error('❌ 测试过程中发生错误:', error);
    return false;
  }
}

// 运行测试
if (require.main === module) {
  testSarahScenario()
    .then(success => {
      console.log(`\n🏁 Sarah 场景测试完成: ${success ? '✅ 成功' : '❌ 失败'}`);
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('❌ 测试运行失败:', error);
      process.exit(1);
    });
}

module.exports = { testSarahScenario }; 