# 🚀 Green Carbon Assessment 系统运行指南

## ✅ 系统已修复完成！

所有数据库连接问题已解决，刚性柴油卡车查询功能正常工作。

## 📋 运行方法

### 方法1：使用npm (推荐)
```bash
cd /home/zilong/Green
npm run dev
```

### 方法2：使用npx
```bash
cd /home/zilong/Green
npx next dev -p 3010
```

### 方法3：直接用Node.js
```bash
cd /home/zilong/Green
node node_modules/.bin/next dev -p 3010
```

## 🌐 访问地址
- 本地访问：http://localhost:3010
- 网络访问：http://10.255.255.254:3010

## 🧪 测试功能

启动成功后，您可以测试以下查询：

1. **刚性柴油卡车测试**：
   - 输入：`"Michael operates a 30-ton rigid diesel truck to transport containers across 75km"`
   - 预期结果：约 135.3g CO2

2. **其他测试用例**：
   - `"我今天吃了100g苹果"`
   - `"开车20公里"`
   - `"用电5度"`

## 🔧 如果遇到问题

1. **端口占用**：确保3010端口未被占用
2. **环境变量**：确保.env.local文件存在且配置正确
3. **依赖问题**：可以尝试重新安装依赖

## ✨ 修复内容总结

✅ 数据库字段映射已修正
✅ 查询算法已优化
✅ 刚性卡车匹配精度提升
✅ 计算逻辑准确无误
✅ 端到端测试通过

## 🎯 核心功能验证

经过测试验证：
- "30吨刚性柴油卡车运输75公里" → 匹配"Road freight diesel rigids HGV average laden"
- 排放因子：0.00006013 kg/tonne-km
- 计算结果：0.135293 kg CO2 (135.3g CO2)

**系统现在可以正常使用！** 🎉