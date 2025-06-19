/**
 * 测试意图检测修复 - 验证实体组合逻辑
 */

// 模拟修复后的意图检测逻辑
function mockFixedIntentDetection(userQuery) {
  console.log(`🧠 意图检测: "${userQuery}"`);
  
  // 模拟AI响应 - 可能会错误地拆分实体
  let aiResponse = {
    intent: 'carbon_calculation',
    entities: [],
    missingInfo: [],
    confidence: 0.9,
    originalQuery: userQuery
  };
  
  // 根据不同查询类型模拟不同的拆分情况
  if (userQuery.includes('Rigid truck 26-32t - Container transport - Diesel')) {
    // 模拟错误拆分的情况
    aiResponse.entities = [
      {
        name: 'Rigid truck',
        quantity: 26,
        unit: 'tonne',
        confidence: 0.9,
        originalText: 'Rigid truck 26-32t'
      },
      {
        name: 'Container transport', 
        quantity: null,
        unit: null,
        confidence: 0.8,
        originalText: 'Container transport'
      },
      {
        name: 'Diesel',
        quantity: null,
        unit: null,
        confidence: 0.8,
        originalText: 'Diesel'
      }
    ];
    
    console.log('❌ AI错误拆分为3个独立实体:');
    aiResponse.entities.forEach((entity, index) => {
      console.log(`  ${index + 1}. "${entity.name}" (${entity.quantity || '无数量'} ${entity.unit || '无单位'})`);
    });
    
  } else if (userQuery.includes('30吨刚性柴油卡车运输集装箱75公里')) {
    // 正确的组合实体
    aiResponse.entities = [
      {
        name: '30吨刚性柴油卡车运输集装箱75公里',
        quantity: 30,
        unit: 'tonne',
        confidence: 0.95,
        originalText: userQuery
      }
    ];
    
    console.log('✅ AI正确识别为1个组合实体:');
    console.log(`  1. "${aiResponse.entities[0].name}" (${aiResponse.entities[0].quantity} ${aiResponse.entities[0].unit})`);
  }
  
  return aiResponse;
}

// 模拟实体合并逻辑
function mergeTransportEntities(entities, originalQuery) {
  if (entities.length < 2) return entities;
  
  const transportKeywords = ['truck', 'vehicle', 'car', 'transport', 'delivery', 'diesel', 'rigid', 'hgv', 'container'];
  const distanceKeywords = ['distance', 'route', 'km', 'miles', 'across'];
  
  // 查找运输相关实体和距离实体
  const transportEntities = [];
  const distanceEntities = [];
  const otherEntities = [];
  
  for (const entity of entities) {
    const nameLower = entity.name.toLowerCase();
    
    if (transportKeywords.some(keyword => nameLower.includes(keyword))) {
      transportEntities.push(entity);
    } else if (distanceKeywords.some(keyword => nameLower.includes(keyword)) || 
               (entity.unit && ['km', 'miles', 'mile'].includes(entity.unit.toLowerCase()))) {
      distanceEntities.push(entity);
    } else {
      otherEntities.push(entity);
    }
  }
  
  // 如果同时存在运输实体和距离实体，合并它们
  if (transportEntities.length > 0 && distanceEntities.length > 0) {
    console.log('\\n🔧 检测到分离的运输实体，正在合并...');
    
    const mainTransport = transportEntities[0];
    const mainDistance = distanceEntities[0];
    
    // 创建合并实体
    const mergedEntity = {
      name: `${mainTransport.name} ${mainDistance.quantity}${mainDistance.unit} transport`,
      quantity: mainTransport.quantity || mainDistance.quantity,
      unit: mainTransport.unit || mainDistance.unit,
      confidence: Math.min(mainTransport.confidence, mainDistance.confidence),
      originalText: originalQuery
    };
    
    console.log(`✅ 合并实体: "${mergedEntity.name}"`);
    
    return [mergedEntity, ...otherEntities];
  }
  
  // 如果有多个同类运输实体，也尝试合并
  if (transportEntities.length > 1) {
    console.log('\\n🔧 检测到多个运输实体，正在合并...');
    
    const combinedNames = transportEntities.map(e => e.name).join(' ');
    const mainEntity = transportEntities[0];
    
    const mergedEntity = {
      name: combinedNames,
      quantity: mainEntity.quantity,
      unit: mainEntity.unit,
      confidence: Math.min(...transportEntities.map(e => e.confidence)),
      originalText: originalQuery
    };
    
    console.log(`✅ 合并多个运输实体: "${mergedEntity.name}"`);
    
    return [mergedEntity, ...distanceEntities, ...otherEntities];
  }
  
  return entities;
}

// 完整的意图检测流程
function completeIntentDetection(userQuery) {
  console.log(`\\n=== 完整意图检测流程 ===`);
  
  // 1. AI响应
  let aiResponse = mockFixedIntentDetection(userQuery);
  
  // 2. 实体合并
  console.log(`\\n🔄 后处理 - 实体合并:`);
  let mergedEntities = mergeTransportEntities(aiResponse.entities, userQuery);
  
  // 3. 最终结果
  console.log(`\\n📋 最终结果:`);
  console.log(`意图: ${aiResponse.intent}`);
  console.log(`实体数量: ${mergedEntities.length}`);
  mergedEntities.forEach((entity, index) => {
    console.log(`  ${index + 1}. "${entity.name}"`);
    console.log(`     数量: ${entity.quantity || '无'} ${entity.unit || ''}`);
    console.log(`     置信度: ${entity.confidence}`);
  });
  
  return {
    ...aiResponse,
    entities: mergedEntities
  };
}

function testIntentFix() {
  console.log('🧪 测试意图检测修复\\n');
  
  const testCases = [
    {
      name: '问题场景：拆分错误',
      query: 'Rigid truck 26-32t - Container transport - Diesel',
      expectedResult: '应该合并为一个运输实体'
    },
    {
      name: '正确场景：组合实体',
      query: '30吨刚性柴油卡车运输集装箱75公里',
      expectedResult: '保持为一个完整实体'
    }
  ];
  
  testCases.forEach((testCase, index) => {
    console.log(`\\n📝 测试 ${index + 1}: ${testCase.name}`);
    console.log(`查询: "${testCase.query}"`);
    console.log(`期望: ${testCase.expectedResult}`);
    console.log('='.repeat(80));
    
    const result = completeIntentDetection(testCase.query);
    
    console.log(`\\n✅ 测试完成`);
    console.log(`最终实体数量: ${result.entities.length}`);
    
    if (result.entities.length === 1) {
      console.log(`🎉 成功：实体正确合并为单一实体`);
    } else {
      console.log(`❌ 需要优化：仍有${result.entities.length}个实体`);
    }
    
    console.log('\\n' + '='.repeat(120));
  });
  
  console.log(`\\n📋 修复总结:`);
  console.log(`✅ 添加了实体组合逻辑`);
  console.log(`✅ 防止运输场景被过度拆分`);
  console.log(`✅ 保持完整的活动上下文`);
  console.log(`✅ 修复了"Rigid truck + Container transport + Diesel"拆分问题`);
}

testIntentFix();