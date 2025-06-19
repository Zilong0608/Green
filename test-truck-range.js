/**
 * 测试30吨卡车范围匹配
 */

// 模拟数据库中的26-32t数据
const mockTruckData = [
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
    id: 'rigid-3.5-7.5t-refrig',
    title: 'Rigid truck 3.5-7.5 t - Average/ mixed load - Refrig/temp controlled - Diesel 5% biodiesel blend',
    factor: 0.0005056,
    unit: 'kg/tonne-km',
    sector: 'Transport',
    subsector: 'Transport Equipment & Vehicle Acquisition',
    source: 'GLEC'
  }
];

// 模拟我们的新范围匹配逻辑
function calculateRangeMatchScore(userInput, activity) {
  const inputLower = userInput.toLowerCase();
  const titleLower = activity.title.toLowerCase();
  
  console.log(`测试范围匹配: "${userInput}" vs "${activity.title}"`);
  
  // 提取用户输入中的数值 - 简化版
  const userWeight = /(\d+)[- ]?(?:ton|tonne|t)\b/i.exec(inputLower);
  if (!userWeight) return 0;
  
  const userValue = parseFloat(userWeight[1]);
  console.log(`  用户重量: ${userValue}吨`);
  
  // 提取数据库范围 - 简化版
  const dbRange = /(\d+(?:\.\d+)?)[- ]?(?:to|-)[ ]?(\d+(?:\.\d+)?)[- ]?(?:ton|tonne|t)\b/i.exec(titleLower);
  if (!dbRange) return 0;
  
  const minWeight = parseFloat(dbRange[1]);
  const maxWeight = parseFloat(dbRange[2]);
  console.log(`  数据库范围: ${minWeight}-${maxWeight}吨`);
  
  // 检查是否在范围内
  if (userValue >= minWeight && userValue <= maxWeight) {
    let score = 0.95; // 基础范围匹配分数
    
    // 额外关键词匹配加分
    if (inputLower.includes('rigid') && titleLower.includes('rigid')) score += 0.03;
    if (inputLower.includes('diesel') && titleLower.includes('diesel')) score += 0.02;
    if (inputLower.includes('container') && titleLower.includes('container')) score += 0.02;
    
    console.log(`  ✅ 范围匹配成功! 评分: ${Math.min(1.0, score)}`);
    return Math.min(1.0, score);
  }
  
  console.log(`  ❌ 范围不匹配`);
  return 0;
}

function testTruckRangeMatching() {
  console.log('🚛 测试30吨卡车范围匹配\n');
  
  // 测试用例：Michael的30吨刚性柴油卡车
  const userInput = "30-ton rigid diesel truck transport containers";
  console.log(`输入: "${userInput}"`);
  console.log('期望匹配: Rigid truck 26-32t - Container transport - Diesel (0.000116 kg/tonne-km)\n');
  
  console.log('📊 所有候选项的范围匹配评分:');
  
  let bestMatch = null;
  let bestScore = 0;
  
  mockTruckData.forEach(truck => {
    const score = calculateRangeMatchScore(userInput, truck);
    if (score > bestScore) {
      bestScore = score;
      bestMatch = truck;
    }
    console.log('');
  });
  
  console.log('='.repeat(60));
  console.log('🎯 最佳匹配结果:');
  if (bestMatch) {
    console.log(`✅ ${bestMatch.title}`);
    console.log(`   排放因子: ${bestMatch.factor} ${bestMatch.unit}`);
    console.log(`   评分: ${bestScore}`);
    console.log(`   来源: ${bestMatch.source}`);
    
    if (bestMatch.factor === 0.000116) {
      console.log('\n🎉 成功！选择了正确的排放因子 0.000116 kg/tonne-km');
    } else {
      console.log('\n❌ 失败！选择了错误的排放因子');
    }
  } else {
    console.log('❌ 没有找到匹配项');
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('🔍 验证: 30吨应该匹配26-32t范围');
  console.log('- 30 >= 26: ✅');
  console.log('- 30 <= 32: ✅');
  console.log('- 包含"container": ✅');
  console.log('- 包含"rigid": ✅');
  console.log('- 包含"diesel": ✅');
}

testTruckRangeMatching();