/**
 * 测试两阶段搜索策略
 * 第一阶段：类型搜索
 * 第二阶段：范围匹配
 */

// 模拟更全面的数据库
const mockDatabase = [
  // 卡车类 - 不同重量范围
  {
    id: 'rigid-3.5-7.5t',
    title: 'Rigid truck 3.5-7.5t - Average/mixed load - Diesel',
    factor: 0.000315,
    unit: 'kg/tonne-km',
    sector: 'Transport',
    subsector: 'Private Vehicle Ownership & Related Services',
    source: 'GLEC'
  },
  {
    id: 'rigid-7.5-12t',
    title: 'Rigid truck 7.5-12t - Average/mixed load - Diesel',
    factor: 0.00021,
    unit: 'kg/tonne-km',
    sector: 'Transport',
    subsector: 'Transport Equipment & Vehicle Acquisition',
    source: 'GLEC'
  },
  {
    id: 'rigid-12-20t',
    title: 'Rigid truck 12-20t - Average/mixed load - Diesel',
    factor: 0.000179,
    unit: 'kg/tonne-km',
    sector: 'Transport',
    subsector: 'Transport Equipment & Vehicle Acquisition',
    source: 'GLEC'
  },
  {
    id: 'rigid-26-32t-container',
    title: 'Rigid truck 26-32t - Container transport - Diesel',
    factor: 0.000116,
    unit: 'kg/tonne-km',
    sector: 'Transport',
    subsector: 'Direct Transport Operations',
    source: 'GLEC'
  },
  {
    id: 'rigid-26-32t-mixed',
    title: 'Rigid truck 26-32t - Average/mixed load - Diesel',
    factor: 0.000116,
    unit: 'kg/tonne-km',
    sector: 'Transport',
    subsector: 'Direct Transport Operations',
    source: 'GLEC'
  },
  
  // HGV类 - 不同载重状态
  {
    id: 'hgv-ref-0',
    title: 'HGV refrigerated (all diesel) - All HGVs - 0% Laden - Delivery vehicles & freight',
    factor: 0.1604,
    unit: 'kg/km',
    sector: 'Transport',
    subsector: 'Transport Equipment & Vehicle Acquisition',
    source: 'BEIS'
  },
  {
    id: 'hgv-ref-50',
    title: 'HGV refrigerated (all diesel) - All HGVs - 50% Laden - Delivery vehicles & freight',
    factor: 0.2316,
    unit: 'kg/km',
    sector: 'Transport',
    subsector: 'Transport Infrastructure & Support Services',
    source: 'BEIS'
  },
  {
    id: 'hgv-ref-100',
    title: 'HGV refrigerated (all diesel) - All HGVs - 100% Laden - Delivery vehicles & freight',
    factor: 0.2222,
    unit: 'kg/km',
    sector: 'Transport',
    subsector: 'Transport Infrastructure & Support Services',
    source: 'BEIS'
  },
  
  // 废料处理类 - 不同材料和处理方式
  {
    id: 'concrete-landfill',
    title: 'Concrete waste disposal',
    factor: 0.001234,
    unit: 'kg/tonne',
    sector: 'Waste',
    subsector: 'Material-Specific End-of-Life Management',
    source: 'BEIS'
  },
  {
    id: 'concrete-recycling',
    title: 'Concrete waste disposal (to closed-loop recycling)',
    factor: 0.0009848,
    unit: 'kg/tonne',
    sector: 'Waste',
    subsector: 'Thermal Treatment & Landfilling',
    source: 'BEIS'
  },
  {
    id: 'plastic-recycling',
    title: 'Average plastic rigid (closed-loop recycled source)',
    factor: 1.907,
    unit: 'kg/tonne',
    sector: 'Materials_and_Manufacturing',
    subsector: 'Fertilizer Production',
    source: 'BEIS'
  },
  
  // 运输距离类 - 不同距离范围
  {
    id: 'short-transport-1-5km',
    title: 'Short distance transport 1-5km - Urban delivery',
    factor: 0.8,
    unit: 'kg/km',
    sector: 'Transport',
    subsector: 'Direct Transport Operations',
    source: 'LOCAL'
  },
  {
    id: 'medium-transport-10-50km',
    title: 'Medium distance transport 10-50km - Regional delivery',
    factor: 0.5,
    unit: 'kg/km',
    sector: 'Transport',
    subsector: 'Direct Transport Operations',
    source: 'LOCAL'
  },
  {
    id: 'long-transport-100-500km',
    title: 'Long distance transport 100-500km - Inter-city freight',
    factor: 0.3,
    unit: 'kg/km',
    sector: 'Transport',
    subsector: 'Direct Transport Operations',
    source: 'LOCAL'
  },
  
  // 设备功率类 - 不同功率范围
  {
    id: 'small-engine-50-100kw',
    title: 'Small engine 50-100kW - Construction equipment',
    factor: 2.5,
    unit: 'kg/kWh',
    sector: 'Energy',
    subsector: 'Equipment Usage',
    source: 'LOCAL'
  },
  {
    id: 'medium-engine-200-500kw',
    title: 'Medium engine 200-500kW - Industrial equipment',
    factor: 2.2,
    unit: 'kg/kWh',
    sector: 'Energy',
    subsector: 'Equipment Usage',
    source: 'LOCAL'
  }
];

// 模拟两阶段搜索算法
function simulateTwoStageSearch(query) {
  console.log(`\n🔍 两阶段搜索: "${query}"`);
  
  // 第一阶段：类型搜索
  const stage1Results = stageOneTypeSearch(query);
  console.log(`第一阶段 - 类型搜索: 找到 ${stage1Results.length} 个候选项`);
  stage1Results.forEach((item, index) => {
    console.log(`  ${index + 1}. ${item.title} (${item.factor} ${item.unit})`);
  });
  
  // 第二阶段：范围匹配
  const stage2Results = stageTwoRangeMatching(query, stage1Results);
  console.log(`第二阶段 - 范围匹配: 过滤到 ${stage2Results.length} 个精确匹配`);
  stage2Results.forEach((item, index) => {
    console.log(`  ${index + 1}. ${item.title} (${item.factor} ${item.unit}) - 评分: ${item.score}`);
  });
  
  return stage2Results.length > 0 ? stage2Results : stage1Results;
}

// 第一阶段：基于类型的搜索
function stageOneTypeSearch(query) {
  const queryLower = query.toLowerCase();
  let candidates = [];
  
  if (queryLower.includes('truck') || queryLower.includes('rigid')) {
    // 搜索所有卡车
    candidates = mockDatabase.filter(item => 
      item.title.toLowerCase().includes('truck') ||
      item.title.toLowerCase().includes('rigid')
    );
  } else if (queryLower.includes('hgv') || (queryLower.includes('heavy') && queryLower.includes('goods'))) {
    // 搜索HGV
    candidates = mockDatabase.filter(item => 
      item.title.toLowerCase().includes('hgv')
    );
    if (queryLower.includes('refrigerat')) {
      candidates = candidates.filter(item => 
        item.title.toLowerCase().includes('refrigerat')
      );
    }
  } else if (queryLower.includes('waste') && (queryLower.includes('recycl') || queryLower.includes('disposal'))) {
    // 搜索废料处理
    candidates = mockDatabase.filter(item => 
      item.title.toLowerCase().includes('waste') ||
      item.title.toLowerCase().includes('disposal')
    );
    if (queryLower.includes('concrete')) {
      candidates = candidates.filter(item => 
        item.title.toLowerCase().includes('concrete')
      );
    }
    if (queryLower.includes('recycl')) {
      candidates = candidates.filter(item => 
        item.title.toLowerCase().includes('recycl') ||
        item.title.toLowerCase().includes('closed-loop')
      );
    }
  } else if (queryLower.includes('transport') || queryLower.includes('delivery')) {
    // 搜索运输服务
    candidates = mockDatabase.filter(item => 
      item.sector === 'Transport' &&
      (item.title.toLowerCase().includes('transport') ||
       item.title.toLowerCase().includes('delivery'))
    );
  } else if (queryLower.includes('engine') || queryLower.includes('equipment')) {
    // 搜索设备
    candidates = mockDatabase.filter(item => 
      item.title.toLowerCase().includes('engine') ||
      item.title.toLowerCase().includes('equipment')
    );
  } else {
    // 通用搜索
    candidates = mockDatabase.filter(item => {
      const words = queryLower.split(' ');
      return words.some(word => item.title.toLowerCase().includes(word));
    });
  }
  
  return candidates;
}

// 第二阶段：范围匹配
function stageTwoRangeMatching(query, candidates) {
  const numericValues = extractNumericValues(query);
  
  if (numericValues.length === 0) {
    console.log('  用户没有提供数值，跳过范围过滤');
    return candidates.map(c => ({...c, score: 0.8}));
  }
  
  console.log(`  用户提供的数值: ${JSON.stringify(numericValues)}`);
  
  const rangeMatched = [];
  
  for (const candidate of candidates) {
    let bestScore = 0;
    
    for (const userValue of numericValues) {
      const score = checkRangeMatchSimple(userValue, candidate);
      if (score > bestScore) {
        bestScore = score;
      }
    }
    
    if (bestScore > 0) {
      rangeMatched.push({...candidate, score: bestScore});
    }
  }
  
  // 按评分排序
  rangeMatched.sort((a, b) => b.score - a.score);
  
  return rangeMatched;
}

// 提取数值
function extractNumericValues(text) {
  const values = [];
  const patterns = [
    {regex: /(\d+(?:\.\d+)?)[- ]?(?:ton|tonne|t|吨)(?:s?)\b/gi, type: 'weight', unit: 't'},
    {regex: /(\d+(?:\.\d+)?)[- ]?(?:km|kilometers?|公里)\b/gi, type: 'distance', unit: 'km'},
    {regex: /(\d+(?:\.\d+)?)[- ]?(?:kw|kilowatt|千瓦)\b/gi, type: 'power', unit: 'kW'},
    {regex: /(\d+(?:\.\d+)?)[- ]?%/gi, type: 'percentage', unit: '%'}
  ];
  
  for (const pattern of patterns) {
    let match;
    pattern.regex.lastIndex = 0;
    while ((match = pattern.regex.exec(text)) !== null) {
      values.push({
        value: parseFloat(match[1]),
        unit: pattern.unit,
        type: pattern.type
      });
    }
  }
  
  return values;
}

// 简化范围匹配
function checkRangeMatchSimple(userValue, candidate) {
  const titleLower = candidate.title.toLowerCase();
  
  // 重量范围匹配
  if (userValue.type === 'weight') {
    const weightRange = /(\d+(?:\.\d+)?)[- ]?(?:to|-)[ ]?(\d+(?:\.\d+)?)[- ]?(?:ton|tonne|t)\b/i.exec(titleLower);
    if (weightRange) {
      const min = parseFloat(weightRange[1]);
      const max = parseFloat(weightRange[2]);
      if (userValue.value >= min && userValue.value <= max) {
        return 0.95;
      }
    }
  }
  
  // 距离范围匹配
  if (userValue.type === 'distance') {
    const distanceRange = /(\d+(?:\.\d+)?)[- ]?(?:to|-)[ ]?(\d+(?:\.\d+)?)[- ]?(?:km)\b/i.exec(titleLower);
    if (distanceRange) {
      const min = parseFloat(distanceRange[1]);
      const max = parseFloat(distanceRange[2]);
      if (userValue.value >= min && userValue.value <= max) {
        return 0.95;
      }
    }
  }
  
  // 功率范围匹配
  if (userValue.type === 'power') {
    const powerRange = /(\d+(?:\.\d+)?)[- ]?(?:to|-)[ ]?(\d+(?:\.\d+)?)[- ]?(?:kw)\b/i.exec(titleLower);
    if (powerRange) {
      const min = parseFloat(powerRange[1]);
      const max = parseFloat(powerRange[2]);
      if (userValue.value >= min && userValue.value <= max) {
        return 0.95;
      }
    }
  }
  
  // 百分比匹配
  if (userValue.type === 'percentage') {
    if (titleLower.includes(`${userValue.value}%`)) {
      return 0.98;
    }
  }
  
  return 0;
}

// 测试用例
function runTests() {
  console.log('🧪 测试两阶段搜索策略\n');
  
  const testCases = [
    {
      name: '30吨刚性柴油卡车',
      query: '30-ton rigid diesel truck container transport',
      expected: 'Rigid truck 26-32t - Container transport - Diesel (0.000116)'
    },
    {
      name: '8吨刚性卡车',
      query: '8-ton rigid truck mixed load',
      expected: 'Rigid truck 7.5-12t - Average/mixed load - Diesel (0.00021)'
    },
    {
      name: '冷藏重型货运车辆 50%载重',
      query: 'refrigerated heavy goods vehicle 50% laden',
      expected: 'HGV refrigerated 50% Laden (0.2316)'
    },
    {
      name: '混凝土废料回收',
      query: '5 tonnes concrete waste fully recycled',
      expected: 'Concrete waste closed-loop recycling (0.0009848)'
    },
    {
      name: '30公里中距离运输',
      query: '30km regional transport delivery',
      expected: 'Medium distance transport 10-50km (0.5)'
    },
    {
      name: '300千瓦中型设备',
      query: '300kW industrial equipment',
      expected: 'Medium engine 200-500kW (2.2)'
    }
  ];
  
  testCases.forEach((testCase, index) => {
    console.log(`📝 测试${index + 1}: ${testCase.name}`);
    console.log(`查询: "${testCase.query}"`);
    console.log(`期望: ${testCase.expected}`);
    
    const results = simulateTwoStageSearch(testCase.query);
    const bestResult = results[0];
    
    if (bestResult) {
      console.log(`✅ 实际: ${bestResult.title} (${bestResult.factor})`);
      console.log(`匹配成功: ${bestResult.title.includes(testCase.expected.split('(')[0].trim()) ? '是' : '否'}`);
    } else {
      console.log('❌ 未找到匹配结果');
    }
    
    console.log('='.repeat(80));
  });
  
  console.log('\\n📊 总结: 两阶段搜索策略');
  console.log('第一阶段 - 类型搜索: 根据关键词筛选相关类别');
  console.log('第二阶段 - 范围匹配: 在候选集中进行精确数值匹配');
  console.log('优势: 提高搜索精确度，避免选择错误的排放因子');
}

runTests();