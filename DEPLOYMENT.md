# Green 系统部署指南

## 快速开始

### 本地开发

1. **克隆项目**
```bash
git clone <repository-url>
cd Green
```

2. **安装依赖**
```bash
npm install
```

3. **配置环境变量**
复制 `.env.example` 到 `.env.local` 并填入配置：
```bash
cp .env.example .env.local
```

编辑 `.env.local`：
```env
# Neo4j 数据库配置
NEO4J_URI=neo4j+s://6e0d3aeb.databases.neo4j.io
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=h4jX7AeJu9W3g7FNTGTrwelUErLHzGwalJWS5jGI1tY
NEO4J_DATABASE=neo4j

# Gemini AI 配置
GEMINI_API_KEY=AIzaSyDPdEbFUulM2XC6drCLddhIMDQokaQIjuw

# 应用配置
NODE_ENV=development
NEXT_PUBLIC_APP_NAME=Green Carbon Assessment
```

4. **运行开发服务器**
```bash
npm run dev
```

访问 [http://localhost:3010](http://localhost:3010)

### 测试系统

1. **运行单元测试**
```bash
npm run test
```

2. **运行集成测试**
```bash
node scripts/test-system.js
```

3. **代码检查**
```bash
npm run lint
```

## Vercel 部署

### 自动部署（推荐）

1. **连接 GitHub**
   - 在 Vercel 控制台中连接您的 GitHub 仓库
   - 选择 `Green` 项目

2. **配置环境变量**
   在 Vercel 项目设置中添加以下环境变量：
   
   ```
   NEO4J_URI=neo4j+s://6e0d3aeb.databases.neo4j.io
   NEO4J_USERNAME=neo4j
   NEO4J_PASSWORD=h4jX7AeJu9W3g7FNTGTrwelUErLHzGwalJWS5jGI1tY
   NEO4J_DATABASE=neo4j
   GEMINI_API_KEY=AIzaSyDPdEbFUulM2XC6drCLddhIMDQokaQIjuw
   NODE_ENV=production
   NEXT_PUBLIC_APP_NAME=Green Carbon Assessment
   ```

3. **部署**
   - 推送代码到 main 分支即可自动部署
   - Vercel 会自动检测 Next.js 项目并进行构建

### 手动部署

1. **安装 Vercel CLI**
```bash
npm i -g vercel
```

2. **登录 Vercel**
```bash
vercel login
```

3. **部署项目**
```bash
vercel --prod
```

### 部署验证

部署完成后，访问以下端点验证系统状态：

1. **健康检查**
```
GET https://your-domain.vercel.app/api/health
```

2. **分类数据**
```
GET https://your-domain.vercel.app/api/categories
```

3. **聊天测试**
```
POST https://your-domain.vercel.app/api/chat
Content-Type: application/json

{
  "query": "我今天吃了100g苹果",
  "language": "zh"
}
```

## 环境要求

### 系统要求
- Node.js >= 18.0.0
- npm >= 8.0.0

### 外部服务
- **Neo4j 数据库**: 需要有效的连接信息
- **Gemini API**: 需要有效的 API 密钥

### 性能配置

#### Vercel 函数配置
- **超时时间**: 30秒（适用于复杂查询）
- **内存限制**: 1024MB
- **并发限制**: 10个并发请求

#### 缓存策略
- **RAG 结果缓存**: 内存缓存，15分钟TTL
- **数据库连接池**: 最大50个连接
- **API 响应缓存**: 基于查询内容的智能缓存

## 监控和日志

### 应用监控
- **健康检查**: `/api/health` 端点
- **性能监控**: 通过 Vercel Analytics
- **错误追踪**: 控制台日志和 Vercel 函数日志

### 日志级别
- **开发环境**: DEBUG 级别
- **生产环境**: INFO 级别以上

### 关键指标
- **响应时间**: 平均 < 5秒
- **成功率**: > 95%
- **数据库连接**: 健康状态检查

## 故障排除

### 常见问题

1. **数据库连接失败**
   - 检查 Neo4j 连接信息
   - 验证网络连接
   - 检查数据库服务状态

2. **Gemini API 错误**
   - 验证 API 密钥有效性
   - 检查配额限制
   - 确认 API 端点可访问

3. **部署失败**
   - 检查环境变量配置
   - 验证依赖安装
   - 查看构建日志

4. **性能问题**
   - 检查数据库查询性能
   - 监控内存使用情况
   - 分析缓存命中率

### 调试步骤

1. **本地调试**
```bash
# 设置调试模式
NODE_ENV=development npm run dev

# 查看详细日志
DEBUG=* npm run dev
```

2. **生产环境调试**
```bash
# 查看 Vercel 函数日志
vercel logs

# 实时监控
vercel logs --follow
```

3. **数据库调试**
```bash
# 测试数据库连接
node -e "
const { dbManager } = require('./lib/database');
dbManager.getDatabaseStats().then(console.log).catch(console.error);
"
```

## 安全配置

### 环境变量安全
- 所有敏感信息通过环境变量配置
- 生产环境不包含 `.env.local` 文件
- 定期轮换 API 密钥

### API 安全
- 输入验证和清理
- 请求限制（长度、频率）
- CORS 配置

### 数据安全
- 只读数据库访问
- 加密传输（HTTPS）
- 不存储用户个人信息

## 维护和更新

### 定期维护
- 监控系统性能
- 更新依赖包
- 检查安全漏洞

### 更新部署
1. 测试新版本
2. 更新环境变量（如需要）
3. 部署到生产环境
4. 验证功能正常

### 备份策略
- 代码版本控制（Git）
- 环境配置备份
- 依赖版本锁定（package-lock.json）

---

## 支持联系

如有部署问题或技术支持需求，请：

1. 查看项目 README.md
2. 检查 GitHub Issues
3. 联系开发团队

🌱 **Green** - 让碳排放计算变得简单智能