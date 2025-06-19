/**
 * 调试搜索过程 - 查看为什么没匹配到正确数据
 */

const neo4j = require('neo4j-driver');

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

async function debugSearch() {
  console.log('🔍 调试搜索过程...');
  
  let driver;
  try {
    const uri = process.env.NEO4J_URI;
    const username = process.env.NEO4J_USERNAME;
    const password = process.env.NEO4J_PASSWORD;
    
    driver = neo4j.driver(
      uri,
      neo4j.auth.basic(username, password),
      {
        maxConnectionLifetime: 3 * 60 * 60 * 1000,
        maxConnectionPoolSize: 50,
        connectionAcquisitionTimeout: 2 * 60 * 1000
      }
    );

    const session = driver.session({ database: process.env.NEO4J_DATABASE });

    // 1. 直接搜索您说的精确数据
    console.log('\n🎯 查找精确的26-32t数据:');
    const exactResult = await session.run(`
      MATCH (a)
      WHERE toLower(a.name) CONTAINS '26-32t'
      RETURN a.name as name, 
             a.emission_factor as factor, 
             a.unit_type as unit,
             a.sector as sector,
             a.subcategory as subcategory,
             a.source as source
      ORDER BY a.name
    `);
    
    console.log(`找到 ${exactResult.records.length} 个26-32t相关结果:`);
    exactResult.records.forEach((record, index) => {
      console.log(`${index + 1}. ${record.get('name')}`);
      console.log(`   因子: ${record.get('factor')} ${record.get('unit')}`);
      console.log(`   分类: ${record.get('sector')} > ${record.get('subcategory')}`);
      console.log(`   来源: ${record.get('source')}`);
      console.log('');
    });

    // 2. 搜索包含"rigid truck"的所有数据
    console.log('\n🚛 查找所有"rigid truck"数据:');
    const rigidTruckResult = await session.run(`
      MATCH (a)
      WHERE toLower(a.name) CONTAINS 'rigid truck'
      RETURN a.name as name, 
             a.emission_factor as factor, 
             a.unit_type as unit,
             a.sector as sector,
             a.subcategory as subcategory,
             a.source as source
      ORDER BY a.name
    `);
    
    console.log(`找到 ${rigidTruckResult.records.length} 个rigid truck结果:`);
    rigidTruckResult.records.forEach((record, index) => {
      console.log(`${index + 1}. ${record.get('name')}`);
      console.log(`   因子: ${record.get('factor')} ${record.get('unit')}`);
      console.log(`   分类: ${record.get('sector')} > ${record.get('subcategory')}`);
      console.log(`   来源: ${record.get('source')}`);
      console.log('');
    });

    // 3. 搜索包含"rigid"的所有数据（看看有什么其他的）
    console.log('\n🔍 查找所有包含"rigid"的数据:');
    const allRigidResult = await session.run(`
      MATCH (a)
      WHERE toLower(a.name) CONTAINS 'rigid'
      RETURN a.name as name, 
             a.emission_factor as factor, 
             a.unit_type as unit,
             a.sector as sector,
             a.subcategory as subcategory,
             a.source as source
      ORDER BY a.sector, a.name
      LIMIT 20
    `);
    
    console.log(`找到 ${allRigidResult.records.length} 个rigid相关结果:`);
    allRigidResult.records.forEach((record, index) => {
      console.log(`${index + 1}. ${record.get('name')}`);
      console.log(`   因子: ${record.get('factor')} ${record.get('unit')}`);
      console.log(`   分类: ${record.get('sector')} > ${record.get('subcategory')}`);
      console.log(`   来源: ${record.get('source')}`);
      console.log('');
    });

    // 4. 检查是否有您说的精确数据
    console.log('\n🎯 检查是否存在您提到的精确数据:');
    const checkData = [
      'Rigid truck 26-32t - Average/mixed load - Diesel',
      'Rigid truck 26-32t - Container transport - Diesel'
    ];
    
    for (const dataName of checkData) {
      const checkResult = await session.run(`
        MATCH (a)
        WHERE toLower(a.name) = toLower($name)
        RETURN a.name as name, 
               a.emission_factor as factor, 
               a.unit_type as unit,
               a.sector as sector,
               a.subcategory as subcategory,
               a.source as source
      `, { name: dataName });
      
      if (checkResult.records.length > 0) {
        const record = checkResult.records[0];
        console.log(`✅ 找到: ${record.get('name')}`);
        console.log(`   因子: ${record.get('factor')} ${record.get('unit')}`);
        console.log(`   分类: ${record.get('sector')} > ${record.get('subcategory')}`);
        console.log(`   来源: ${record.get('source')}`);
      } else {
        console.log(`❌ 未找到: ${dataName}`);
      }
      console.log('');
    }

    await session.close();
    console.log('✅ 调试搜索完成');

  } catch (error) {
    console.error('❌ 调试失败:', error);
  } finally {
    if (driver) {
      await driver.close();
    }
  }
}

debugSearch();