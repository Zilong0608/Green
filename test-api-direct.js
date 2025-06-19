// 直接测试API
const fetch = require('node-fetch');

async function testAPI() {
  console.log('🔧 通过API测试重量范围匹配修复...\n');
  
  // 等待服务器启动
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  const testCases = [
    {
      query: "Michael operates a 30-ton rigid diesel truck to transport shipping containers across a 75km route from the port to a logistics hub",
      expected: 0.000116
    },
    {
      query: "Rigid truck 26-32t - Container transport - Diesel",
      expected: 0.000116
    }
  ];
  
  for (const testCase of testCases) {
    console.log(`\n🚛 测试: "${testCase.query}"`);
    console.log('=' + '='.repeat(60));
    
    try {
      const response = await fetch('http://localhost:3000/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: testCase.query
        })
      });
      
      if (!response.ok) {
        console.log(`❌ HTTP错误: ${response.status}`);
        continue;
      }
      
      const result = await response.json();
      
      if (result.success && result.results && result.results.length > 0) {
        const firstResult = result.results[0];
        console.log(`✅ 成功响应:`);
        console.log(`  实体: ${firstResult.entity?.name || '未知'}`);
        console.log(`  排放因子: ${firstResult.emissionFactor?.factor || 'N/A'} ${firstResult.emissionFactor?.unit || ''}`);
        console.log(`  数据源: ${firstResult.emissionFactor?.source || 'N/A'}`);
        console.log(`  总排放: ${firstResult.totalEmission || 0}kg CO2`);
        console.log(`  标题: ${firstResult.emissionFactor?.title || 'N/A'}`);
        
        // 验证排放因子
        const actualFactor = firstResult.emissionFactor?.factor;
        if (actualFactor) {
          if (Math.abs(actualFactor - testCase.expected) < 0.000001) {
            console.log(`🎯 正确匹配! 排放因子: ${actualFactor}`);
          } else {
            console.log(`⚠️ 排放因子不匹配:`);
            console.log(`   期望: ${testCase.expected}`);
            console.log(`   实际: ${actualFactor}`);
            console.log(`   误差倍数: ${(actualFactor / testCase.expected).toFixed(2)}x`);
          }
        }
        
        // 检查是否匹配到正确的数据
        if (firstResult.emissionFactor?.title?.includes('26-32t')) {
          console.log(`✅ 正确匹配到26-32t范围数据`);
        }
        
      } else {
        console.log(`❌ 处理失败: ${result.message || '未知错误'}`);
      }
      
    } catch (error) {
      console.error(`❌ 请求出错: ${error.message}`);
    }
    
    console.log('-'.repeat(70));
  }
}

testAPI().catch(console.error); 