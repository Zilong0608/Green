/**
 * 测试 RAG 修复
 * 验证 30吨 能正确匹配到 26-32t 范围的数据
 */

const { RAGEngine } = require('./lib/rag');

async function testRAGFix() {
  console.log('🧪 测试 RAG 修复\n');
  
  try {
    const ragEngine = new RAGEngine();
    
    // 测试实体：30吨刚性柴油卡车
    const testEntity = {
      name: '30吨刚性柴油卡车',
      quantity: 30,
      unit: 'ton'
    };
    
    console.log(`🔍 搜索实体: "${testEntity.name}"`);
    console.log(`期望匹配: Rigid truck 26-32t (30吨在26-32t范围内)`);
    console.log(`期望排放因子: 0.000116 kg/tonne-km\n`);
    
    // 执行搜索
    const results = await ragEngine.searchActivities(testEntity, 'zh');
    
    console.log(`📋 搜索结果 (${results.length} 个):`);
    
    if (results.length > 0) {
      results.slice(0, 5).forEach((result, index) => {
        console.log(`${index + 1}. ${result.activity.title}`);
        console.log(`   排放因子: ${result.activity.factor} ${result.activity.unit}`);
        console.log(`   匹配类型: ${result.matchType}`);
        console.log(`   相关性评分: ${result.relevanceScore.toFixed(3)}`);
        console.log(`   分类: ${result.activity.sector} > ${result.activity.subsector}`);
        console.log('');
      });
      
      // 检查最佳匹配
      const bestMatch = results[0];
      const isCorrect = bestMatch.activity.factor === 0.000116;
      
      console.log(`🎯 最佳匹配验证:`);
      console.log(`选择的数据: "${bestMatch.activity.title}"`);
      console.log(`排放因子: ${bestMatch.activity.factor} ${bestMatch.activity.unit}`);
      console.log(`是否正确: ${isCorrect ? '✅ 是' : '❌ 否'}`);
      
      if (isCorrect) {
        console.log(`\n🎉 修复成功！`);
        console.log(`💡 改进点:`);
        console.log(`  1. 修复了中文单位"吨"的识别`);
        console.log(`  2. 范围匹配优先级提升`);
        console.log(`  3. 30吨正确匹配到26-32t范围`);
      } else {
        console.log(`\n❌ 仍需修复`);
        console.log(`🔧 问题分析:`);
        console.log(`  - 期望因子: 0.000116`);
        console.log(`  - 实际因子: ${bestMatch.activity.factor}`);
        console.log(`  - 可能原因: 评分逻辑需要进一步调整`);
      }
      
    } else {
      console.log('❌ 没有找到任何匹配结果');
    }
    
  } catch (error) {
    console.error('测试过程中出错:', error);
  }
}

// 运行测试
testRAGFix().catch(console.error);