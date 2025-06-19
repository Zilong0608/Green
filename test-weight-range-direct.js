// 直接测试重量范围匹配
const { MainController } = require('./lib/main-controller');

async function testWeightRangeMatching() {
  console.log('🔧 测试重量范围匹配修复...\n');
  
  const controller = new MainController();
  
  // 测试Michael的30吨卡车场景
  const testQueries = [
    "Michael operates a 30-ton rigid diesel truck to transport shipping containers across a 75km route from the port to a logistics hub",
    "Rigid truck 26-32t - Container transport - Diesel"
  ];
  
  for (const query of testQueries) {
    console.log(`\n🚛 测试查询: "${query}"`);
    console.log('=' + '='.repeat(50));
    
    try {
      const result = await controller.processQuery(query);
      
      if (result.success && result.results.length > 0) {
        const firstResult = result.results[0];
        console.log(`✅ 成功匹配:`);
        console.log(`  实体: ${firstResult.entity.name}`);
        console.log(`  排放因子: ${firstResult.emissionFactor.factor} ${firstResult.emissionFactor.unit}`);
        console.log(`  数据源: ${firstResult.emissionFactor.source}`);
        console.log(`  总排放: ${firstResult.totalEmission.toFixed(3)}kg CO2`);
        console.log(`  计算: ${firstResult.calculation.formula}`);
        
        // 检查是否是正确的26-32t数据
        if (firstResult.emissionFactor.title.includes('26-32t')) {
          console.log(`🎯 正确匹配到26-32t范围数据!`);
        } else if (firstResult.emissionFactor.factor === 0.000116) {
          console.log(`✅ 匹配到正确的排放因子 0.000116`);
        } else {
          console.log(`⚠️ 可能匹配错误 - 排放因子: ${firstResult.emissionFactor.factor}`);
          console.log(`   标题: ${firstResult.emissionFactor.title}`);
        }
      } else {
        console.log(`❌ 处理失败: ${result.message}`);
      }
      
    } catch (error) {
      console.error(`❌ 测试出错: ${error.message}`);
    }
    
    console.log('-'.repeat(60));
  }
}

testWeightRangeMatching().catch(console.error); 