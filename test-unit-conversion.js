/**
 * 测试单位转换逻辑
 * 确保5吨=5000kg，1g=0.001kg等基础转换正确
 */

// 模拟单位转换函数
function convertWeight(quantity, fromUnit, toUnit) {
  const weights = {
    'g': 0.001,           // 1g = 0.001kg
    'kg': 1,              // 1kg = 1kg (基准)
    'ton': 1000,          // 1吨 = 1000kg
    'tonne': 1000,        // 1公吨 = 1000kg  
    't': 1000,            // 1t = 1000kg
    '吨': 1000,
    '公吨': 1000,
    '公斤': 1,
    '千克': 1,
    '克': 0.001,
    'pound': 0.453592,
    'lb': 0.453592
  };
  
  const fromKg = weights[fromUnit.toLowerCase()] || 1;
  const toKg = weights[toUnit.toLowerCase()] || 1;
  
  const result = (quantity * fromKg) / toKg;
  console.log(`转换: ${quantity} ${fromUnit} -> ${result} ${toUnit}`);
  console.log(`  计算: ${quantity} × ${fromKg} ÷ ${toKg} = ${result}`);
  
  return result;
}

// 模拟extractUnit函数
function extractUnit(unitExpression) {
  if (!unitExpression) {
    return 'kg'; // 默认单位
  }
  
  // 特殊处理复合单位
  if (unitExpression.includes('tonne-km')) {
    return 'tonne'; // tonne-km 类型的单位，基础单位是 tonne
  }
  
  if (unitExpression.includes('/tonne')) {
    return 'tonne'; // kg/tonne 类型，基础单位是 tonne
  }
  
  if (unitExpression.includes('/kg')) {
    return 'kg'; // 某某/kg 类型，基础单位是 kg
  }
  
  if (unitExpression.includes('/km')) {
    return 'km'; // 某某/km 类型，基础单位是 km
  }
  
  // kg/kg -> kg, L/100km -> L 等
  const match = unitExpression.match(/^([^\/]+)/);
  return match ? match[1].trim() : unitExpression;
}

// 模拟完整的单位转换过程
function simulateConversion(userQuantity, userUnit, emissionFactorUnit) {
  console.log(`\n🔄 模拟转换过程:`);
  console.log(`用户输入: ${userQuantity} ${userUnit}`);
  console.log(`排放因子单位: ${emissionFactorUnit}`);
  
  // 提取基础单位
  const targetUnit = extractUnit(emissionFactorUnit);
  console.log(`提取的目标单位: ${targetUnit}`);
  
  // 进行单位转换
  const convertedQuantity = convertWeight(userQuantity, userUnit, targetUnit);
  
  return {
    original: { quantity: userQuantity, unit: userUnit },
    converted: { quantity: convertedQuantity, unit: targetUnit },
    emissionFactorUnit: emissionFactorUnit
  };
}

// 测试用例
function runUnitConversionTests() {
  console.log('🧪 单位转换测试\n');
  
  const testCases = [
    {
      name: '5吨混凝土废料回收',
      userQuantity: 5,
      userUnit: 'tonne',
      emissionFactorUnit: 'kg/tonne',
      expectedConversion: 5, // 5 tonne -> 5 tonne (无需转换)
      emissionFactor: 0.0009848,
      expectedResult: 5 * 0.0009848
    },
    {
      name: '5000kg混凝土废料 (如果用户输入kg)',
      userQuantity: 5000,
      userUnit: 'kg',
      emissionFactorUnit: 'kg/tonne',
      expectedConversion: 5, // 5000kg -> 5 tonne
      emissionFactor: 0.0009848,
      expectedResult: 5 * 0.0009848
    },
    {
      name: '100g苹果',
      userQuantity: 100,
      userUnit: 'g',
      emissionFactorUnit: 'kg/kg',
      expectedConversion: 0.1, // 100g -> 0.1kg
      emissionFactor: 0.5,
      expectedResult: 0.1 * 0.5
    },
    {
      name: '1000g食物',
      userQuantity: 1000,
      userUnit: 'g',
      emissionFactorUnit: 'kg/kg', 
      expectedConversion: 1, // 1000g -> 1kg
      emissionFactor: 2.0,
      expectedResult: 1 * 2.0
    },
    {
      name: '2吨卡车',
      userQuantity: 2,
      userUnit: 't',
      emissionFactorUnit: 'kg/tonne-km',
      expectedConversion: 2, // 2t -> 2 tonne
      emissionFactor: 0.000116,
      expectedDistance: 75, // 假设75km
      expectedResult: 2 * 75 * 0.000116
    }
  ];
  
  testCases.forEach((testCase, index) => {
    console.log(`📝 测试${index + 1}: ${testCase.name}`);
    
    const conversion = simulateConversion(
      testCase.userQuantity, 
      testCase.userUnit, 
      testCase.emissionFactorUnit
    );
    
    console.log(`✅ 转换结果: ${conversion.converted.quantity} ${conversion.converted.unit}`);
    console.log(`🎯 期望结果: ${testCase.expectedConversion} ${conversion.converted.unit}`);
    
    const isCorrect = Math.abs(conversion.converted.quantity - testCase.expectedConversion) < 0.0001;
    console.log(`${isCorrect ? '✅' : '❌'} 转换${isCorrect ? '正确' : '错误'}`);
    
    // 计算最终排放量
    let finalEmission;
    if (testCase.emissionFactorUnit.includes('tonne-km')) {
      // 需要距离信息
      finalEmission = conversion.converted.quantity * testCase.expectedDistance * testCase.emissionFactor;
      console.log(`📊 最终计算: ${conversion.converted.quantity} × ${testCase.expectedDistance}km × ${testCase.emissionFactor} = ${finalEmission.toFixed(6)}kg CO2`);
    } else {
      finalEmission = conversion.converted.quantity * testCase.emissionFactor;
      console.log(`📊 最终计算: ${conversion.converted.quantity} × ${testCase.emissionFactor} = ${finalEmission.toFixed(6)}kg CO2`);
    }
    
    console.log(`🎯 期望排放: ${testCase.expectedResult.toFixed(6)}kg CO2`);
    const emissionCorrect = Math.abs(finalEmission - testCase.expectedResult) < 0.0001;
    console.log(`${emissionCorrect ? '✅' : '❌'} 排放计算${emissionCorrect ? '正确' : '错误'}`);
    
    console.log('='.repeat(80));
  });
  
  // 特殊案例：验证基础转换
  console.log('\n📋 基础转换验证:');
  
  const basicTests = [
    { from: 5, unit: 'tonne', to: 'kg', expected: 5000, desc: '5吨 = 5000kg' },
    { from: 1, unit: 'g', to: 'kg', expected: 0.001, desc: '1g = 0.001kg' },
    { from: 2000, unit: 'g', to: 'kg', expected: 2, desc: '2000g = 2kg' },
    { from: 3, unit: 't', to: 'tonne', expected: 3, desc: '3t = 3 tonne' },
    { from: 500, unit: 'g', to: 't', expected: 0.0005, desc: '500g = 0.0005t' }
  ];
  
  basicTests.forEach(test => {
    const result = convertWeight(test.from, test.unit, test.to);
    const isCorrect = Math.abs(result - test.expected) < 0.000001;
    console.log(`${isCorrect ? '✅' : '❌'} ${test.desc}: ${result} (期望: ${test.expected})`);
  });
  
  console.log('\n🔍 问题诊断:');
  console.log('如果某些转换失败，可能的原因:');
  console.log('1. extractUnit()函数没有正确提取基础单位');
  console.log('2. convertWeight()函数中的转换系数错误');
  console.log('3. 单位匹配时大小写或别名问题');
  console.log('4. 计算逻辑中没有调用单位转换');
}

runUnitConversionTests();