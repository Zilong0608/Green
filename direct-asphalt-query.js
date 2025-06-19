// 直接查询Asphalt - 6.5% binder content
const { DatabaseManager } = require('./lib/database.ts');

async function findAsphaltDirectly() {
  console.log('🔍 直接查询数据库中的Asphalt条目...\n');
  
  const dbManager = new DatabaseManager();
  
  try {
    // 1. 精确匹配查询
    console.log('=== 精确匹配查询 ===');
    const exactQueries = [
      "Asphalt - 6.5% binder content",
      "asphalt - 6.5% binder content", 
      "Asphalt-6.5% binder content",
      "Asphalt 6.5% binder content"
    ];
    
    for (const query of exactQueries) {
      console.log(`🎯 查询: "${query}"`);
      const results = await dbManager.findExactMatch(query);
      if (results.length > 0) {
        console.log(`✅ 找到 ${results.length} 个精确匹配:`);
        results.forEach((result, index) => {
          console.log(`${index + 1}. 标题: "${result.title}"`);
          console.log(`   排放因子: ${result.factor} ${result.unit}`);
          console.log(`   数据源: ${result.source}`);
          console.log(`   分类: ${result.sector} > ${result.subsector}`);
          console.log('');
        });
        return; // 找到了就返回
      } else {
        console.log('❌ 未找到精确匹配');
      }
    }
    
    // 2. 模糊匹配查询
    console.log('\n=== 模糊匹配查询 ===');
    const fuzzyQueries = [
      "asphalt",
      "binder",
      "asphalt binder",
      "6.5% binder"
    ];
    
    for (const query of fuzzyQueries) {
      console.log(`🔍 模糊查询: "${query}"`);
      const results = await dbManager.findFuzzyMatch(query, 10);
      
      if (results.length > 0) {
        console.log(`找到 ${results.length} 个模糊匹配:`);
        results.forEach((result, index) => {
          console.log(`${index + 1}. "${result.title}"`);
          console.log(`   排放因子: ${result.factor} ${result.unit}`);
          console.log(`   数据源: ${result.source}`);
          
          // 检查是否包含6.5%
          if (result.title.toLowerCase().includes('6.5')) {
            console.log(`   🎯 这个包含6.5%！`);
          }
          if (result.title.toLowerCase().includes('binder')) {
            console.log(`   🎯 这个包含binder！`);
          }
          console.log('');
        });
      } else {
        console.log('❌ 未找到模糊匹配');
      }
    }
    
    // 3. 按分类搜索
    console.log('\n=== 按分类搜索 ===');
    const sectors = ['Materials', 'Construction', 'Infrastructure', 'Building', 'Transport'];
    
    for (const sector of sectors) {
      console.log(`🏗️ 搜索分类: ${sector}`);
      const results = await dbManager.findByHierarchy({ sector: sector, limit: 20 });
      
      const asphaltResults = results.filter(r => 
        r.title.toLowerCase().includes('asphalt') ||
        r.title.toLowerCase().includes('binder')
      );
      
      if (asphaltResults.length > 0) {
        console.log(`在${sector}分类中找到 ${asphaltResults.length} 个相关结果:`);
        asphaltResults.forEach((result, index) => {
          console.log(`${index + 1}. "${result.title}"`);
          console.log(`   排放因子: ${result.factor} ${result.unit}`);
          console.log(`   数据源: ${result.source}`);
          if (result.title.toLowerCase().includes('6.5')) {
            console.log(`   🎯 找到6.5%的条目！`);
          }
          console.log('');
        });
      }
    }
    
  } catch (error) {
    console.error('❌ 查询出错:', error);
  }
}

findAsphaltDirectly().catch(console.error); 