/**
 * 测试范围匹配问题
 * 验证 30吨 是否正确匹配到 26-32t 范围
 */

// 模拟 extractNumericValues 方法
function extractNumericValues(text) {
  const values = [];
  
  // 排除数据库字段中的百分比标识符，避免误识别
  const excludePatterns = [
    /\d+%\s*laden/gi,     // "50% Laden" 
    /\d+%\s*loaded/gi,    // "50% Loaded"
    /\d+%\s*load/gi,      // "50% Load"
    /all\s*hgvs/gi,       // "All HGVs"
    /\d+-\d+\s*t\b/gi     // "26-32t" (范围，不是具体重量)
  ];
  
  // 检查是否包含应该排除的模式
  let filteredText = text;
  for (const excludePattern of excludePatterns) {
    if (excludePattern.test(text)) {
      console.log(`🚫 排除数据库字段模式: ${text.match(excludePattern)?.[0]}`);
      filteredText = text.replace(excludePattern, ''); // 移除这些模式
    }
  }
  
  // 匹配各种数值+单位模式
  const patterns = [
    // 重量: 30吨, 30-ton, 30t (但排除范围如26-32t)
    {regex: /(?<!\d-)\b(\d+(?:\.\d+)?)[- ]?(?:ton|tonne|t|吨|公吨)(?:s?)\b(?!\s*-\s*\d)/g, type: 'weight', unit: 't'},
    // 距离: 75km, 75公里, 75 kilometers
    {regex: /(\d+(?:\.\d+)?)[- ]?(?:km|kilometers?|公里|千米)\b/g, type: 'distance', unit: 'km'},
    // 功率: 100kW, 100千瓦
    {regex: /(\d+(?:\.\d+)?)[- ]?(?:kw|kva|kilowatt|千瓦)\b/gi, type: 'power', unit: 'kW'},
    // 容量: 20m3, 20立方米
    {regex: /(\d+(?:\.\d+)?)[- ]?(?:m3|cubic|立方米|立方)\b/gi, type: 'volume', unit: 'm3'},
    // 年份: 2020年, 2020-model
    {regex: /(\d{4})[- ]?(?:年|year|model)?\b/g, type: 'year', unit: 'year'}
  ];
  
  for (const pattern of patterns) {
    let match;
    pattern.regex.lastIndex = 0; // 重置regex
    while ((match = pattern.regex.exec(filteredText)) !== null) {
      const value = parseFloat(match[1]);
      console.log(`✅ 提取数值: ${value} ${pattern.unit} (${pattern.type}) 从 "${match[0]}"`);
      values.push({
        value: value,
        unit: pattern.unit,
        type: pattern.type
      });
    }
  }
  
  return values;
}

// 模拟 extractRanges 方法
function extractRanges(text) {
  const ranges = [];
  
  // 匹配范围模式
  const patterns = [
    // 重量范围: 26-32t, 12-20 tonnes
    {regex: /(\d+(?:\.\d+)?)[- ]?(?:to|-)[ ]?(\d+(?:\.\d+)?)[- ]?(?:ton|tonne|t|吨)(?:s?)\b/g, type: 'weight', unit: 't'},
    // 距离范围: 50-200km
    {regex: /(\d+(?:\.\d+)?)[- ]?(?:to|-)[ ]?(\d+(?:\.\d+)?)[- ]?(?:km|kilometers?|公里)\b/g, type: 'distance', unit: 'km'},
    // 功率范围: 10-100kW
    {regex: /(\d+(?:\.\d+)?)[- ]?(?:to|-)[ ]?(\d+(?:\.\d+)?)[- ]?(?:kw|kilowatt|千瓦)\b/gi, type: 'power', unit: 'kW'},
    // 年份范围: 2015-2020
    {regex: /(\d{4})[- ]?(?:to|-)[ ]?(\d{4})\b/g, type: 'year', unit: 'year'}
  ];
  
  for (const pattern of patterns) {
    let match;
    pattern.regex.lastIndex = 0; // 重置regex
    while ((match = pattern.regex.exec(text)) !== null) {
      ranges.push({
        min: parseFloat(match[1]),
        max: parseFloat(match[2]),
        unit: pattern.unit,
        type: pattern.type
      });
    }
  }
  
  return ranges;
}

// 模拟 checkRangeMatch 方法
function checkRangeMatch(userValue, candidate) {
  const titleLower = candidate.title.toLowerCase();
  const dbRanges = extractRanges(titleLower);
  
  let bestScore = 0;
  
  console.log(`检查候选项: "${candidate.title}"`);
  console.log(`提取的范围: ${JSON.stringify(dbRanges)}`);
  
  for (const range of dbRanges) {
    console.log(`  范围: ${range.min}-${range.max} ${range.unit} (${range.type})`);
    console.log(`  用户值: ${userValue.value} ${userValue.unit} (${userValue.type})`);
    
    if (userValue.type === range.type && userValue.unit === range.unit) {
      console.log(`  类型和单位匹配!`);
      if (userValue.value >= range.min && userValue.value <= range.max) {
        let score = 0.95; // 基础范围匹配分数
        
        // 根据匹配精确度加分
        const rangeMidpoint = (range.min + range.max) / 2;
        const deviation = Math.abs(userValue.value - rangeMidpoint) / (range.max - range.min);
        score += (1 - deviation) * 0.05; // 越接近中点分数越高
        
        bestScore = Math.max(bestScore, Math.min(1.0, score));
        
        console.log(`  ✅ 在范围内! 评分: ${score.toFixed(3)}`);
      } else {
        console.log(`  ❌ 不在范围内 (${userValue.value} 不在 ${range.min}-${range.max})`);
      }
    } else {
      console.log(`  ❌ 类型或单位不匹配`);
    }
  }
  
  return bestScore;
}

// 测试用例
function testRangeMatching() {
  console.log('🧪 测试范围匹配功能\\n');
  
  // 测试1：用户输入 "30吨刚性柴油卡车"
  console.log('=== 测试1: 用户输入 "30吨刚性柴油卡车" ===');
  const userInput1 = "30吨刚性柴油卡车";
  const userValues1 = extractNumericValues(userInput1.toLowerCase());
  console.log(`用户输入: "${userInput1}"`);
  console.log(`提取的数值: ${JSON.stringify(userValues1)}\\n`);
  
  // 候选数据库项目
  const candidates = [
    {
      title: "Rigid truck 26-32t - Container transport - Diesel",
      factor: 0.000116,
      unit: "kg/tonne-km"
    },
    {
      title: "Rigid truck 3.5-7.5 t - Average/ mixed load - Refrig/temp controlled - Diesel 5% biodiesel blend",
      factor: 0.0005056,
      unit: "kg/tonne-km"
    },
    {
      title: "Rigid truck 20-26t - Average/mixed load - Diesel",
      factor: 0.00013,
      unit: "kg/tonne-km"
    }
  ];
  
  if (userValues1.length > 0) {
    const weightValue = userValues1.find(v => v.type === 'weight');
    if (weightValue) {
      console.log(`找到重量值: ${weightValue.value} ${weightValue.unit}\\n`);
      
      candidates.forEach((candidate, index) => {
        console.log(`候选项 ${index + 1}:`);
        const score = checkRangeMatch(weightValue, candidate);
        console.log(`最终评分: ${score.toFixed(3)}\\n`);
      });
    }
  }
  
  // 测试2：验证数据库标题中的范围提取
  console.log('=== 测试2: 验证数据库标题范围提取 ===');
  const dbTitles = [
    "Rigid truck 26-32t - Container transport - Diesel",
    "Rigid truck 3.5-7.5 t - Average/ mixed load",
    "Rigid truck 20-26t - Average/mixed load - Diesel"
  ];
  
  dbTitles.forEach(title => {
    console.log(`标题: "${title}"`);
    const ranges = extractRanges(title.toLowerCase());
    console.log(`提取范围: ${JSON.stringify(ranges)}\\n`);
  });
  
  // 测试3：验证用户输入模式是否被正确识别
  console.log('=== 测试3: 验证各种用户输入模式 ===');
  const testInputs = [
    "30吨刚性柴油卡车",
    "30 ton rigid truck",
    "30t diesel truck",
    "30-ton vehicle",
    "rigid truck 30 tonnes"
  ];
  
  testInputs.forEach(input => {
    console.log(`输入: "${input}"`);
    const values = extractNumericValues(input.toLowerCase());
    console.log(`提取值: ${JSON.stringify(values)}\\n`);
  });
}

testRangeMatching();