/**
 * 测试修复效果
 */

const { IntentDetectionEngine } = require('./lib/intent-detection.ts');
const { RAGEngine } = require('./lib/rag.ts');
const { ReasoningEngine } = require('./lib/reasoning.ts');

// 手动加载环境变量
const fs = require('fs');
const path = require('path');

function loadEnv() {
  try {
    const envPath = path.join(__dirname, '.env.local');
    const envContent = fs.readFileSync(envPath, 'utf8');
    const lines = envContent.split('\n');
    
    lines.forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, value] = trimmed.split('=');
        if (key && value) {
          process.env[key.trim()] = value.trim();
        }
      }
    });
  } catch (error) {
    console.error('无法加载 .env.local 文件:', error.message);
  }
}

loadEnv();

async function testFixes() {
  console.log('🧪 测试修复效果...\n');
  
  try {
    // 测试1: Sarah的冷藏货运车辆 (应该匹配HGV refrigerated 0.2316kg/km)
    console.log('📝 测试1: Sarah的冷藏货运车辆');
    console.log('输入: "Sarah drives a diesel-powered refrigerated heavy goods vehicle, half-loaded with perishable goods, making deliveries over a 120km route"');
    
    const intentEngine = new IntentDetectionEngine();
    const ragEngine = new RAGEngine();
    
    const intentResult1 = await intentEngine.analyzeUserInput(
      "Sarah drives a diesel-powered refrigerated heavy goods vehicle, half-loaded with perishable goods, making deliveries over a 120km route"
    );
    
    console.log('意图识别结果:');
    console.log(`- 意图: ${intentResult1.intent}`);
    console.log('- 实体:');
    intentResult1.entities.forEach(entity => {
      console.log(`  * ${entity.name}: ${entity.quantity} ${entity.unit || 'N/A'}`);
    });
    
    // 搜索活动
    const ragResults1 = new Map();
    for (const entity of intentResult1.entities) {
      const results = await ragEngine.searchActivities(entity);
      ragResults1.set(entity.name, results);
      
      console.log(`\n${entity.name} 的搜索结果:`);
      results.slice(0, 3).forEach((result, index) => {
        console.log(`  ${index + 1}. ${result.activity.title}`);
        console.log(`     因子: ${result.activity.factor} ${result.activity.unit}`);
        console.log(`     评分: ${result.relevanceScore}`);
      });
    }
    
    console.log('\n' + '='.repeat(60) + '\n');
    
    // 测试2: 混凝土废料回收 (应该匹配closed-loop recycling 0.0009848kg/tonne)
    console.log('📝 测试2: 混凝土废料回收');
    console.log('输入: "A construction crew transports 5 tonnes of concrete waste to a specialized facility where the material is fully recycled"');
    
    const intentResult2 = await intentEngine.analyzeUserInput(
      "A construction crew transports 5 tonnes of concrete waste to a specialized facility where the material is fully recycled"
    );
    
    console.log('意图识别结果:');
    console.log(`- 意图: ${intentResult2.intent}`);
    console.log('- 实体:');
    intentResult2.entities.forEach(entity => {
      console.log(`  * ${entity.name}: ${entity.quantity} ${entity.unit || 'N/A'}`);
    });
    
    // 搜索活动
    const ragResults2 = new Map();
    for (const entity of intentResult2.entities) {
      const results = await ragEngine.searchActivities(entity);
      ragResults2.set(entity.name, results);
      
      console.log(`\n${entity.name} 的搜索结果:`);
      results.slice(0, 3).forEach((result, index) => {
        console.log(`  ${index + 1}. ${result.activity.title}`);
        console.log(`     因子: ${result.activity.factor} ${result.activity.unit}`);
        console.log(`     评分: ${result.relevanceScore}`);
      });
    }
    
    console.log('\n✅ 测试完成');
    
  } catch (error) {
    console.error('❌ 测试失败:', error);
  }
}

testFixes();