// 直接查询数据库检查Asphalt条目
const neo4j = require('neo4j-driver');

async function checkAsphaltInDatabase() {
  const driver = neo4j.driver(
    process.env.NEO4J_URI || 'bolt://localhost:7687',
    neo4j.auth.basic(
      process.env.NEO4J_USERNAME || 'neo4j', 
      process.env.NEO4J_PASSWORD || '12345678'
    )
  );

  try {
    const session = driver.session();
    
    console.log('🔍 直接查询数据库中的Asphalt相关条目...\n');
    
    // 1. 精确搜索
    const exactQuery = `
      MATCH (n:EmissionFactor)
      WHERE toLower(n.title) CONTAINS 'asphalt'
      RETURN n.title, n.factor, n.unit, n.source, n.sector, n.subsector
      ORDER BY n.title
    `;
    
    const exactResult = await session.run(exactQuery);
    
    if (exactResult.records.length > 0) {
      console.log(`✅ 找到 ${exactResult.records.length} 个Asphalt相关条目:`);
      exactResult.records.forEach((record, index) => {
        console.log(`${index + 1}. "${record.get('n.title')}"`);
        console.log(`   排放因子: ${record.get('n.factor')} ${record.get('n.unit')}`);
        console.log(`   数据源: ${record.get('n.source')}`);
        console.log(`   分类: ${record.get('n.sector')} > ${record.get('n.subsector')}`);
        console.log('');
      });
      
      // 查找特定的6.5%条目
      const exactMatch = exactResult.records.find(record => 
        record.get('n.title').toLowerCase().includes('6.5%') ||
        record.get('n.title').toLowerCase().includes('6.5') ||
        record.get('n.title').toLowerCase().includes('binder')
      );
      
      if (exactMatch) {
        console.log('🎯 找到精确匹配的条目:');
        console.log(`   标题: "${exactMatch.get('n.title')}"`);
        console.log(`   排放因子: ${exactMatch.get('n.factor')} ${exactMatch.get('n.unit')}`);
        console.log(`   数据源: ${exactMatch.get('n.source')}`);
      } else {
        console.log('⚠️ 未找到包含"6.5%"或"binder"的Asphalt条目');
      }
    } else {
      console.log('❌ 数据库中未找到任何Asphalt相关条目');
    }
    
    // 2. 更广泛的搜索 - 查找包含binder的条目
    console.log('\n🔍 搜索包含"binder"的条目...');
    const binderQuery = `
      MATCH (n:EmissionFactor)
      WHERE toLower(n.title) CONTAINS 'binder'
      RETURN n.title, n.factor, n.unit, n.source
      ORDER BY n.title
      LIMIT 10
    `;
    
    const binderResult = await session.run(binderQuery);
    
    if (binderResult.records.length > 0) {
      console.log(`✅ 找到 ${binderResult.records.length} 个包含"binder"的条目:`);
      binderResult.records.forEach((record, index) => {
        console.log(`${index + 1}. "${record.get('n.title')}"`);
        console.log(`   排放因子: ${record.get('n.factor')} ${record.get('n.unit')}`);
        console.log('');
      });
    }
    
    await session.close();
    
  } catch (error) {
    console.error('❌ 数据库查询出错:', error);
  } finally {
    await driver.close();
  }
}

checkAsphaltInDatabase().catch(console.error); 