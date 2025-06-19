// 专门调试精确匹配的脚本
const neo4j = require('neo4j-driver');

async function debugExactSearch() {
  console.log('🔍 调试精确匹配问题...\n');
  
  let driver;
  try {
    const uri = "neo4j+s://6dbcedff.databases.neo4j.io";
    const username = "neo4j";
    const password = "W8QGT3PQMsS5wGJrlRGFXKdPr4_LPbwPjXcpw6iM1z0";
    
    driver = neo4j.driver(
      uri,
      neo4j.auth.basic(username, password),
      {
        maxConnectionLifetime: 3 * 60 * 60 * 1000,
        maxConnectionPoolSize: 50,
        connectionAcquisitionTimeout: 2 * 60 * 1000
      }
    );

    const session = driver.session({ database: "neo4j" });

    // 用户报告的三个问题查询
    const userQueries = [
      'Rigid truck 26-32t - Container transport - Diesel',
      'HGV refrigerated (all diesel) - All HGVs - 50% Laden - Delivery vehicles & freight',
      'Concrete waste disposal (to closed-loop recycling)'
    ];

    for (let i = 0; i < userQueries.length; i++) {
      const query = userQueries[i];
      console.log(`\n=== 调试查询 ${i + 1}: "${query}" ===`);
      
      // 1. 尝试精确匹配
      console.log('\n🎯 测试1: 精确匹配 (toLower(a.name) = toLower($query))');
      const exactResult = await session.run(`
        MATCH (a)
        WHERE toLower(a.name) = toLower($query)
        RETURN a.name as name, 
               a.emission_factor as factor, 
               a.unit_type as unit,
               a.sector as sector,
               a.subcategory as subcategory,
               a.source as source
      `, { query });
      
      if (exactResult.records.length > 0) {
        console.log(`✅ 精确匹配成功! 找到 ${exactResult.records.length} 个结果:`);
        exactResult.records.forEach((record, index) => {
          console.log(`  ${index + 1}. ${record.get('name')}`);
          console.log(`     因子: ${record.get('factor')} ${record.get('unit')}`);
          console.log(`     来源: ${record.get('source')}`);
          console.log(`     分类: ${record.get('sector')} > ${record.get('subcategory')}`);
        });
      } else {
        console.log('❌ 精确匹配失败');
      }

      // 2. 尝试部分匹配来看看可能的问题
      console.log('\n🔍 测试2: 查看包含关键词的相似数据');
      const keywords = query.split(' ').filter(word => word.length > 2);
      console.log(`  关键词: [${keywords.join(', ')}]`);
      
      for (let j = 0; j < Math.min(keywords.length, 3); j++) {
        const keyword = keywords[j];
        const keywordResult = await session.run(`
          MATCH (a)
          WHERE toLower(a.name) CONTAINS toLower($keyword)
          RETURN a.name as name,
                 a.emission_factor as factor,
                 a.unit_type as unit,
                 a.source as source
          ORDER BY a.name
          LIMIT 5
        `, { keyword });
        
        console.log(`\n  关键词 "${keyword}" 找到 ${keywordResult.records.length} 个结果:`);
        keywordResult.records.forEach((record, index) => {
          const name = record.get('name');
          const factor = record.get('factor');
          const unit = record.get('unit');
          const source = record.get('source');
          
          // 高亮显示如果完全匹配
          const isExactMatch = name.toLowerCase() === query.toLowerCase();
          const prefix = isExactMatch ? '🎯 [完全匹配] ' : '   ';
          
          console.log(`${prefix}${index + 1}. ${name}`);
          console.log(`${prefix.replace(/./g, ' ')}   因子: ${factor} ${unit} (来源: ${source})`);
        });
      }

      // 3. 查找数据中可能的格式差异
      console.log('\n🔧 测试3: 检查格式变化');
      const variations = [
        query,
        query.replace(/\s*-\s*/g, ' - '),   // 标准化连字符
        query.replace(/\s*-\s*/g, ' '),     // 移除连字符
        query.replace(/\s+/g, ' ').trim(),  // 标准化空格
        query.replace(/\([^)]*\)/g, '').trim() // 移除括号内容
      ];
      
      for (const variation of variations) {
        if (variation !== query) {
          const variationResult = await session.run(`
            MATCH (a)
            WHERE toLower(a.name) = toLower($variation)
            RETURN a.name as name,
                   a.emission_factor as factor,
                   a.unit_type as unit,
                   a.source as source
          `, { variation });
          
          if (variationResult.records.length > 0) {
            console.log(`✅ 格式变化匹配成功! "${variation}"`);
            variationResult.records.forEach((record, index) => {
              console.log(`  ${index + 1}. ${record.get('name')}`);
              console.log(`     因子: ${record.get('factor')} ${record.get('unit')}`);
              console.log(`     来源: ${record.get('source')}`);
            });
          }
        }
      }

      console.log('\n' + '='.repeat(70));
    }

    // 4. 额外检查：看看数据库中类似的条目格式
    console.log('\n\n🔍 额外调试: 检查数据库中的命名模式');
    
    const patternQueries = [
      { name: 'Rigid truck相关', pattern: 'rigid truck.*container.*diesel' },
      { name: 'HGV refrigerated相关', pattern: 'hgv.*refrigerated.*laden' },
      { name: 'Concrete waste相关', pattern: 'concrete.*waste.*closed-loop' }
    ];
    
    for (const patternQuery of patternQueries) {
      console.log(`\n--- ${patternQuery.name} ---`);
      const result = await session.run(`
        MATCH (a)
        WHERE toLower(a.name) =~ toLower($pattern)
        RETURN a.name as name,
               a.emission_factor as factor,
               a.unit_type as unit,
               a.source as source
        LIMIT 10
      `, { pattern: `.*${patternQuery.pattern}.*` });
      
      console.log(`找到 ${result.records.length} 个模式匹配:`);
      result.records.forEach((record, index) => {
        console.log(`  ${index + 1}. ${record.get('name')}`);
        console.log(`     因子: ${record.get('factor')} ${record.get('unit')} (${record.get('source')})`);
      });
    }

    await session.close();
    console.log('\n✅ 精确匹配调试完成');

  } catch (error) {
    console.error('❌ 调试失败:', error);
  } finally {
    if (driver) {
      await driver.close();
    }
  }
}

// 运行调试
if (require.main === module) {
  debugExactSearch()
    .then(() => {
      console.log('\n🏁 调试完成');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ 调试运行失败:', error);
      process.exit(1);
    });
}

module.exports = { debugExactSearch }; 