# Green - 智能碳排放评估系统

## 项目简介

Green 是一个基于 AI 的智能碳排放评估系统，采用 Agentic 架构设计，能够自动分析用户输入并计算相应的碳排放量。

## 核心功能

### 🤖 智能分析引擎
- **意图识别**：理解用户的自然语言输入
- **实体提取**：识别活动、物品和数量信息
- **智能推理**：处理不完整信息并提供合理建议

### 📊 数据驱动
- **Neo4j 图数据库**：三层结构（Sector → Subsector → Activity）
- **精准匹配优先**：优先返回数据库原始数据
- **模糊搜索**：智能匹配相似活动

### 🌐 用户体验
- **中英文界面**：支持语言切换
- **简洁对话框**：清爽的交互界面
- **自然语言输出**：友好的结果展示

## 技术架构

### 前端技术栈
- **Next.js 14**：React 全栈框架
- **TypeScript**：类型安全
- **Styled Components**：样式组件
- **i18next**：国际化支持

### 后端技术栈
- **Node.js**：服务端运行环境
- **Neo4j Driver**：图数据库连接
- **Gemini 2.5 Flash**：AI 推理引擎

### 核心模块
1. **Intent Detection**：意图识别和实体提取
2. **RAG System**：检索增强生成
3. **Reasoning Engine**：智能推理计算

## 快速开始

### 环境要求
- Node.js >= 18.0.0
- Neo4j 数据库访问权限
- Gemini API 密钥

### 安装依赖
```bash
npm install
```

### 配置环境变量
复制 `.env.example` 到 `.env.local` 并填入相应配置：
```env
NEO4J_URI=your_neo4j_uri
NEO4J_USERNAME=your_username
NEO4J_PASSWORD=your_password
NEO4J_DATABASE=your_database
GEMINI_API_KEY=your_gemini_api_key
```

### 运行开发服务器
```bash
npm run dev
```

访问 [http://localhost:3010](http://localhost:3010) 查看应用。

### 构建生产版本
```bash
npm run build
npm start
```

## 部署说明

### Vercel 部署
1. 连接 GitHub 仓库到 Vercel
2. 配置环境变量
3. 自动部署

### 环境变量配置
在 Vercel 控制台中配置相同的环境变量。

## 使用示例

### 基础查询
```
用户输入："我今天吃了一个苹果"
系统输出：苹果：0.3kg CO2/kg，请提供重量以计算精确排放量
```

### 完整信息查询
```
用户输入："我吃了100g苹果和50g香蕉"
系统输出：
- 苹果 100g：0.03kg CO2
- 香蕉 50g：0.02kg CO2
- 总计：0.05kg CO2
```

### 复杂场景处理
```
用户输入："我今天开特斯拉去了公司，路上买了咖啡"
系统分析：
1. 识别交通工具：特斯拉 → 电动汽车
2. 识别消费行为：咖啡
3. 提示补充：距离、咖啡类型和数量
```

## 项目结构

```
Green/
├── app/                    # Next.js App Router
├── components/            # React 组件
├── lib/                   # 核心业务逻辑
│   ├── database.ts       # Neo4j 连接
│   ├── intent-detection.ts  # 意图识别
│   ├── rag.ts            # RAG 模块
│   └── reasoning.ts      # 推理引擎
├── types/                # TypeScript 类型定义
├── utils/                # 工具函数
└── public/               # 静态资源
```

## 开发指南

### 代码规范
- 使用 TypeScript 进行类型检查
- 遵循 ESLint 规则
- 组件和函数使用中文注释

### 测试
```bash
npm run test
```

### 代码检查
```bash
npm run lint
```

## 许可证

MIT License

## 贡献指南

欢迎提交 Issue 和 Pull Request 来改进项目。

---

🌱 **Green** - 让碳排放计算变得简单智能