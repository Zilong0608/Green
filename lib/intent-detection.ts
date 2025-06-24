/**
 * Intent Detection 模块 - 意图识别和实体提取
 * 
 * 功能：
 * - 分析用户自然语言输入
 * - 识别用户意图（碳排放计算、信息查询、普通对话）
 * - 提取实体信息（物品名称、数量、单位）
 * - 处理复杂输入（文章、多实体等）
 * - 识别缺失信息并提供建议
 * - 智能区分用户实际数量 vs 数据库规格描述
 */

import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import { IntentDetectionResult, QueryEntity, GeminiRequest, GeminiResponse } from '@/types';

export class IntentDetectionEngine {
  private genAI: GoogleGenerativeAI;
  private model: GenerativeModel;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY!;
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
  }

  /**
   * 主要意图识别和实体提取接口
   */
  async analyzeUserInput(userQuery: string, language: 'zh' | 'en' = 'zh'): Promise<IntentDetectionResult> {
    try {
      const prompt = this.buildAdvancedIntentDetectionPrompt(userQuery, language);
      const response = await this.callGemini(prompt);
      
      return this.parseIntentResponse(response.text, userQuery);
    } catch (error) {
      console.error('意图识别失败:', error);
      return this.getDefaultIntentResult(userQuery);
    }
  }

  /**
   * 构建增强版意图识别 Prompt
   */
  private buildAdvancedIntentDetectionPrompt(userQuery: string, language: 'zh' | 'en'): string {
    const examples = language === 'zh' ? this.getAdvancedChineseExamples() : this.getAdvancedEnglishExamples();
    
    return `
你是一个专业的碳排放评估系统的意图识别模块。你需要分析用户输入，识别意图并提取相关实体信息。

## 关键原则 - 真正的智能理解

**CRITICAL: 深度理解用户意图，智能推断缺失信息！**

1. **智能数量识别**
   - 明确数量：two planes, 2000km, 15 hours ← 直接提取
   - 隐含数量：I drive to work ← 推断为1辆车
   - 集合数量：a fleet of trucks ← 推断为多辆，标记需要具体数量
   - 避免规格：26-32t (规格范围), 50% laden (状态) ← 不是用户数量

2. **智能信息推断**
   - 地理推断：Sydney to Melbourne ← 自动推断距离713km
   - 时间推断：during work hours ← 推断为8小时
   - 设备推断：computer running ← 推断为电力消耗活动
   - 用途推断：commute to office ← 推断为日常通勤

3. **上下文语义理解**
   - 不硬编码设备类型，理解任何用户提到的具体设备
   - 识别活动类型：运输、能耗、制造、废料处理等
   - 推断缺失的关键信息并标记

4. **智能实体构建**
   - 保持用户原始描述的完整性
   - 提取可计算的核心信息
   - 智能标记需要补充的信息

## 输出格式
严格按照以下JSON格式输出：
{
  "intent": "carbon_calculation|information_query|general_chat",
  "entities": [
    {
      "name": "完整场景描述",
      "quantity": 用户的实际数量|null,
      "unit": "实际单位"|null,
      "confidence": 0.0-1.0,
      "originalText": "原文中的文本片段",
      "entityType": "transport|waste|liquid|food|energy",
      "scenarioDetails": {
        "vehicleType": "车辆类型",
        "cargoType": "货物类型", 
        "fuelType": "燃料类型",
        "distance": 距离数值,
        "distanceUnit": "距离单位",
        "wasteType": "废料类型",
        "processingMethod": "处理方式",
        "loadStatus": "装载状态"
      }
    }
  ],
  "missingInfo": ["缺失信息描述"],
  "confidence": 0.0-1.0,
  "originalQuery": "原始用户输入"
}

## 场景识别规则

### 1. 运输场景识别
**关键词**: truck, transport, delivery, shipping, vehicle, drive, route
**组合模式**: [重量] + [车辆] + [货物] + [距离] + [燃料]
**示例**: "30-ton rigid diesel truck transport containers 75km"

### 2. 废料处理场景
**关键词**: waste, disposal, recycling, treatment, facility
**组合模式**: [重量] + [废料类型] + [处理方式]  
**示例**: "5 tonnes concrete waste closed-loop recycling"

### 3. 液体处理场景
**关键词**: liquid, water, oil, chemical, treatment, processing
**组合模式**: [体积] + [液体类型] + [处理方式]
**示例**: "1000L wastewater treatment"

## 数值识别规则

### ✅ 用户实际数量（要提取）
- 30 ton, 75 km, 5 tonnes
- 1000 liters, 50 gallons
- 3 hours, 100 kg

### ❌ 数据库规格（不要提取为数量）
- 26-32t (这是重量范围，不是用户数量)
- 50% laden (这是装载状态，不是重量)
- Model 3, Type A (这是型号，不是数量)
- 2023, Year 2024 (这是年份，不是重量)

### 🔧 智能识别策略
1. **范围识别**: "26-32t" → 不是用户数量，是规格范围
2. **百分比识别**: "50%" → 除非明确是用户使用量，否则是状态描述
3. **型号识别**: "Model Y", "Type 3" → 是产品型号，不是数量
4. **年份识别**: 四位数年份 → 是时间，不是重量

## 示例参考
${examples}

现在请分析以下用户输入：
"${userQuery}"

请严格按照JSON格式输出结果，特别注意区分用户实际数量和数据库规格描述：`;
  }

  /**
   * 增强版中文示例
   */
  private getAdvancedChineseExamples(): string {
    return `
### 示例1：运输场景 - 完整组合
用户输入："Michael操作一辆30吨刚性柴油卡车运输集装箱，行程75公里"
输出：
{
  "intent": "carbon_calculation",
  "entities": [
    {
      "name": "30吨刚性柴油卡车运输集装箱75公里",
      "quantity": 30,
      "unit": "tonne",
      "confidence": 0.95,
      "originalText": "30吨刚性柴油卡车运输集装箱，行程75公里",
      "entityType": "transport",
      "scenarioDetails": {
        "vehicleType": "rigid diesel truck",
        "cargoType": "containers",
        "fuelType": "diesel",
        "distance": 75,
        "distanceUnit": "km",
        "loadStatus": "loaded"
      }
    }
  ],
  "missingInfo": [],
  "confidence": 0.95,
  "originalQuery": "Michael操作一辆30吨刚性柴油卡车运输集装箱，行程75公里"
}

### 示例2：废料处理场景
用户输入："建筑队运输5吨混凝土废料到专业设施进行完全回收再利用"
输出：
{
  "intent": "carbon_calculation",
  "entities": [
    {
      "name": "5吨混凝土废料完全回收再利用",
      "quantity": 5,
      "unit": "tonne",
      "confidence": 0.95,
      "originalText": "5吨混凝土废料到专业设施进行完全回收再利用",
      "entityType": "waste",
      "scenarioDetails": {
        "wasteType": "concrete",
        "processingMethod": "closed-loop recycling"
      }
    }
  ],
  "missingInfo": [],
  "confidence": 0.95,
  "originalQuery": "建筑队运输5吨混凝土废料到专业设施进行完全回收再利用"
}

### 示例3：错误示例 - 避免提取规格为数量
用户输入："我需要了解26-32吨卡车的排放数据"
输出：
{
  "intent": "information_query",
  "entities": [
    {
      "name": "26-32吨卡车排放数据查询",
      "quantity": null,
      "unit": null,
      "confidence": 0.90,
      "originalText": "26-32吨卡车的排放数据",
      "entityType": "transport",
      "scenarioDetails": {
        "vehicleType": "truck",
        "weightRange": "26-32t"
      }
    }
  ],
  "missingInfo": ["需要具体的运输重量和距离进行计算"],
  "confidence": 0.90,
  "originalQuery": "我需要了解26-32吨卡车的排放数据"
}`;
  }

  /**
   * 增强版英文示例  
   */
  private getAdvancedEnglishExamples(): string {
    return `
### Example 1: Transport Scenario - Complete Integration
User Input: "Michael operates a 30-ton rigid diesel truck to transport shipping containers across a 75km route"
Output:
{
  "intent": "carbon_calculation",
  "entities": [
    {
      "name": "30-ton rigid diesel truck container transport 75km",
      "quantity": 30,
      "unit": "tonne",
      "confidence": 0.95,
      "originalText": "30-ton rigid diesel truck to transport shipping containers across a 75km route",
      "entityType": "transport",
      "scenarioDetails": {
        "vehicleType": "rigid diesel truck", 
        "cargoType": "shipping containers",
        "fuelType": "diesel",
        "distance": 75,
        "distanceUnit": "km",
        "loadStatus": "loaded"
      }
    }
  ],
  "missingInfo": [],
  "confidence": 0.95,
  "originalQuery": "Michael operates a 30-ton rigid diesel truck to transport shipping containers across a 75km route"
}

### Example 2: Multiple Vehicles Scenario - CRITICAL PATTERN
User Input: "In the fleet of ABC Logistics Company, there are two diesel refrigerated heavy-duty trucks. They travel 2,000 kilometers per month under an average laden for cold chain food delivery."
Output:
{
  "intent": "carbon_calculation",
  "entities": [
    {
      "name": "two diesel refrigerated heavy-duty trucks cold chain food delivery 2000 kilometers",
      "quantity": 2,
      "unit": "vehicles",
      "confidence": 0.95,
      "originalText": "two diesel refrigerated heavy-duty trucks travel 2,000 kilometers",
      "entityType": "transport",
      "scenarioDetails": {
        "vehicleType": "HGV refrigerated diesel",
        "cargoType": "cold chain food",
        "fuelType": "diesel",
        "distance": 2000,
        "distanceUnit": "km",
        "loadStatus": "average laden",
        "vehicleCount": 2,
        "timeframe": "per month"
      }
    }
  ],
  "missingInfo": [],
  "confidence": 0.95,
  "originalQuery": "In the fleet of ABC Logistics Company, there are two diesel refrigerated heavy-duty trucks. They travel 2,000 kilometers per month under an average laden for cold chain food delivery."
}

### Example 3: Electricity Consumption - Correct Unit Handling
User Input: "The factory receives 2000 kWh electricity supplied from the national grid for managed electrical assets."
Output:
{
  "intent": "carbon_calculation",
  "entities": [
    {
      "name": "2000 kWh electricity from national grid",
      "quantity": 2000,
      "unit": "kWh",
      "confidence": 0.95,
      "originalText": "2000 kWh electricity supplied from the national grid",
      "entityType": "energy",
      "scenarioDetails": {
        "energyType": "electricity",
        "source": "national grid",
        "purpose": "managed electrical assets"
      }
    }
  ],
  "missingInfo": [],
  "confidence": 0.95,
  "originalQuery": "The factory receives 2000 kWh electricity supplied from the national grid for managed electrical assets."
}

### Example 4: Smart Geographic Inference
User Input: "Two Boeing 737s fly from Sydney to Melbourne"
Output:
{
  "intent": "carbon_calculation",
  "entities": [
    {
      "name": "two Boeing 737s Sydney to Melbourne flight",
      "quantity": 2,
      "unit": "vehicles",
      "confidence": 0.90,
      "originalText": "Two Boeing 737s fly from Sydney to Melbourne",
      "entityType": "transport",
      "scenarioDetails": {
        "vehicleType": "Boeing 737",
        "vehicleCategory": "aircraft",
        "vehicleCount": 2,
        "route": "Sydney to Melbourne",
        "distance": 713,
        "distanceUnit": "km",
        "inferredInfo": "distance calculated from city pair"
      }
    }
  ],
  "missingInfo": [],
  "confidence": 0.90,
  "originalQuery": "Two Boeing 737s fly from Sydney to Melbourne"
}

### Example 5: Implicit Quantity Recognition
User Input: "I drive my Tesla Model 3 to work every day"
Output:
{
  "intent": "carbon_calculation", 
  "entities": [
    {
      "name": "Tesla Model 3 daily commute",
      "quantity": 1,
      "unit": "vehicles",
      "confidence": 0.85,
      "originalText": "drive my Tesla Model 3 to work every day",
      "entityType": "transport",
      "scenarioDetails": {
        "vehicleType": "Tesla Model 3",
        "vehicleCategory": "electric car",
        "vehicleCount": 1,
        "frequency": "daily",
        "purpose": "commute",
        "inferredInfo": "quantity inferred from singular possessive"
      }
    }
  ],
  "missingInfo": ["commute distance needed for accurate calculation"],
  "confidence": 0.85,
  "originalQuery": "I drive my Tesla Model 3 to work every day"
}

### Example 6: Smart Device Recognition with Time
User Input: "My MacBook Pro and iPad ran for 8 hours during the meeting"
Output:
{
  "intent": "carbon_calculation",
  "entities": [
    {
      "name": "MacBook Pro 8 hours operation",
      "quantity": 1,
      "unit": "devices",
      "confidence": 0.90,
      "originalText": "MacBook Pro ran for 8 hours",
      "entityType": "energy",
      "scenarioDetails": {
        "deviceType": "MacBook Pro",
        "deviceCategory": "laptop",
        "deviceCount": 1,
        "operationTime": 8,
        "timeUnit": "hours",
        "context": "meeting"
      }
    },
    {
      "name": "iPad 8 hours operation", 
      "quantity": 1,
      "unit": "devices",
      "confidence": 0.90,
      "originalText": "iPad ran for 8 hours",
      "entityType": "energy",
      "scenarioDetails": {
        "deviceType": "iPad",
        "deviceCategory": "tablet",
        "deviceCount": 1,
        "operationTime": 8,
        "timeUnit": "hours",
        "context": "meeting"
      }
    }
  ],
  "missingInfo": [],
  "confidence": 0.90,
  "originalQuery": "My MacBook Pro and iPad ran for 8 hours during the meeting"
}

### Example 7: Vague Quantity Handling
User Input: "Our office has several printers running all day"
Output:
{
  "intent": "carbon_calculation",
  "entities": [
    {
      "name": "office printers all day operation",
      "quantity": null,
      "unit": "devices",
      "confidence": 0.70,
      "originalText": "several printers running all day",
      "entityType": "energy",
      "scenarioDetails": {
        "deviceType": "printer",
        "deviceCategory": "office equipment",
        "quantityDescription": "several",
        "operationTime": 8,
        "timeUnit": "hours",
        "context": "office",
        "inferredInfo": "all day assumed as 8 work hours"
      }
    }
  ],
  "missingInfo": ["specific number of printers needed for calculation"],
  "confidence": 0.70,
  "originalQuery": "Our office has several printers running all day"
}

### Example 2: Waste Processing Scenario
User Input: "A construction crew transports 5 tonnes of concrete waste to a specialized facility where the material is fully recycled into new construction aggregates"
Output:
{
  "intent": "carbon_calculation",
  "entities": [
    {
      "name": "5 tonnes concrete waste closed-loop recycling",
      "quantity": 5,
      "unit": "tonne",
      "confidence": 0.95,
      "originalText": "5 tonnes of concrete waste...fully recycled into new construction aggregates",
      "entityType": "waste",
      "scenarioDetails": {
        "wasteType": "concrete",
        "processingMethod": "closed-loop recycling"
      }
    }
  ],
  "missingInfo": [],
  "confidence": 0.95,
  "originalQuery": "A construction crew transports 5 tonnes of concrete waste to a specialized facility where the material is fully recycled into new construction aggregates"
}

### Example 3: Liquid Processing Scenario
User Input: "Process 1000 liters of industrial wastewater through advanced treatment"
Output:
{
  "intent": "carbon_calculation",
  "entities": [
    {
      "name": "1000 liters industrial wastewater advanced treatment",
      "quantity": 1000,
      "unit": "liter",
      "confidence": 0.95,
      "originalText": "1000 liters of industrial wastewater through advanced treatment",
      "entityType": "liquid",
      "scenarioDetails": {
        "liquidType": "industrial wastewater",
        "processingMethod": "advanced treatment"
      }
    }
  ],
  "missingInfo": [],
  "confidence": 0.95,
  "originalQuery": "Process 1000 liters of industrial wastewater through advanced treatment"
}

### Example 4: Avoid Database Specs - Information Query
User Input: "What's the emission factor for 26-32t trucks?"
Output:
{
  "intent": "information_query",
  "entities": [
    {
      "name": "26-32t truck emission factor inquiry",
      "quantity": null,
      "unit": null,
      "confidence": 0.90,
      "originalText": "26-32t trucks",
      "entityType": "transport",
      "scenarioDetails": {
        "vehicleType": "truck",
        "weightRange": "26-32t"
      }
    }
  ],
  "missingInfo": ["Need specific transport weight and distance for calculation"],
  "confidence": 0.90,
  "originalQuery": "What's the emission factor for 26-32t trucks?"
}`;
  }

  /**
   * 调用 Gemini API
   */
  private async callGemini(prompt: string): Promise<GeminiResponse> {
    try {
      const result = await this.model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.3,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 2048,
        }
      });

      const response = await result.response;
      const text = response.text();

      return {
        text,
        confidence: 0.8, // 默认置信度
        usage: {
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0
        }
      };
    } catch (error) {
      console.error('Gemini API 调用失败:', error);
      throw error;
    }
  }

  /**
   * 解析 Gemini 响应
   */
  private parseIntentResponse(responseText: string, originalQuery: string): IntentDetectionResult {
    try {
      // 提取JSON部分
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('无法找到有效的JSON响应');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      
      // 验证和标准化输出
      let entities = this.validateAdvancedEntities(parsed.entities || []);
      
      // 后处理：执行实体优化
      entities = this.postProcessEntities(entities, originalQuery);
      
      return {
        intent: this.validateIntent(parsed.intent),
        entities,
        missingInfo: Array.isArray(parsed.missingInfo) ? parsed.missingInfo : [],
        confidence: Math.max(0, Math.min(1, parsed.confidence || 0.5)),
        originalQuery
      };
    } catch (error) {
      console.error('解析意图响应失败:', error);
      return this.getDefaultIntentResult(originalQuery);
    }
  }

  /**
   * 合并运输相关实体
   */
  private mergeTransportEntities(entities: QueryEntity[], originalQuery: string): QueryEntity[] {
    if (entities.length < 2) return entities;
    
    const transportKeywords = ['truck', 'vehicle', 'car', 'transport', 'delivery', 'diesel', 'rigid', 'hgv', 'container'];
    const distanceKeywords = ['distance', 'route', 'km', 'miles', 'across'];
    
    // 查找运输相关实体和距离实体
    const transportEntities: QueryEntity[] = [];
    const distanceEntities: QueryEntity[] = [];
    const otherEntities: QueryEntity[] = [];
    
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
      console.log('检测到分离的运输实体，正在合并...');
      
      const mainTransport = transportEntities[0];
      const mainDistance = distanceEntities[0];
      
      // 创建合并实体
      const mergedEntity: QueryEntity = {
        name: `${mainTransport.name} ${mainDistance.quantity}${mainDistance.unit} transport`,
        quantity: mainTransport.quantity || mainDistance.quantity,
        unit: mainTransport.unit || mainDistance.unit,
        confidence: Math.min(mainTransport.confidence, mainDistance.confidence),
        originalText: originalQuery
      };
      
      console.log(`合并实体: "${mergedEntity.name}"`);
      
      return [mergedEntity, ...otherEntities];
    }
    
    // 如果有多个同类运输实体，也尝试合并
    if (transportEntities.length > 1) {
      console.log('检测到多个运输实体，正在合并...');
      
      const combinedNames = transportEntities.map(e => e.name).join(' ');
      const mainEntity = transportEntities[0];
      
      const mergedEntity: QueryEntity = {
        name: combinedNames,
        quantity: mainEntity.quantity,
        unit: mainEntity.unit,
        confidence: Math.min(...transportEntities.map(e => e.confidence)),
        originalText: originalQuery
      };
      
      console.log(`合并多个运输实体: "${mergedEntity.name}"`);
      
      return [mergedEntity, ...distanceEntities, ...otherEntities];
    }
    
    return entities;
  }

  /**
   * 验证意图类型
   */
  private validateIntent(intent: string): 'carbon_calculation' | 'information_query' | 'general_chat' {
    const validIntents = ['carbon_calculation', 'information_query', 'general_chat'];
    return validIntents.includes(intent) ? intent as any : 'general_chat';
  }

  /**
   * 验证实体信息 - 增强版
   */
  private validateEntities(entities: any[]): QueryEntity[] {
    return entities
      .filter(entity => entity && typeof entity.name === 'string')
      .map(entity => ({
        name: entity.name.trim(),
        quantity: typeof entity.quantity === 'number' ? entity.quantity : null,
        unit: typeof entity.unit === 'string' ? entity.unit.trim() : null,
        confidence: Math.max(0, Math.min(1, entity.confidence || 0.5)),
        originalText: entity.originalText || entity.name,
        entityType: entity.entityType || undefined,
        scenarioDetails: entity.scenarioDetails || undefined
      }));
  }

  /**
   * 增强版实体验证 - 包含场景详情
   */
  private validateAdvancedEntities(entities: any[]): QueryEntity[] {
    return entities
      .filter(entity => entity && typeof entity.name === 'string')
      .map(entity => {
        // 基础验证
        const validatedEntity: QueryEntity = {
          name: entity.name.trim(),
          quantity: this.validateQuantity(entity.quantity, entity.name),
          unit: typeof entity.unit === 'string' ? entity.unit.trim() : null,
          confidence: Math.max(0, Math.min(1, entity.confidence || 0.5)),
          originalText: entity.originalText || entity.name
        };

        // 添加实体类型
        if (entity.entityType && ['transport', 'waste', 'liquid', 'food', 'energy'].includes(entity.entityType)) {
          validatedEntity.entityType = entity.entityType;
        }

        // 验证和添加场景详情
        if (entity.scenarioDetails) {
          validatedEntity.scenarioDetails = this.validateScenarioDetails(entity.scenarioDetails);
        }

        return validatedEntity;
      });
  }

  /**
   * 验证数量 - 防止误识别规格为数量
   */
  private validateQuantity(quantity: any, entityName: string): number | undefined {
    if (typeof quantity !== 'number') return undefined;
    
    // 检查是否是明显的规格描述而非用户数量
    const nameLower = entityName.toLowerCase();
    
    // 如果实体名称包含范围描述（如"26-32t"），则数量可能是错误提取的
    if (nameLower.includes('-') && nameLower.includes('t')) {
      // 检查是否是范围的一部分
      const rangeMatch = nameLower.match(/(\d+)-(\d+)t/);
      if (rangeMatch) {
        const [_, min, max] = rangeMatch;
        if (quantity == parseInt(min) || quantity == parseInt(max)) {
          console.log(`检测到可能错误提取的规格数量: ${quantity} from "${entityName}"`);
          return undefined; // 不提取规格范围作为用户数量
        }
      }
    }

    return quantity;
  }

  /**
   * 验证场景详情
   */
  private validateScenarioDetails(details: any): QueryEntity['scenarioDetails'] {
    if (!details || typeof details !== 'object') return undefined;

    const validated: QueryEntity['scenarioDetails'] = {};

    // 字符串字段验证
    const stringFields: (keyof NonNullable<QueryEntity['scenarioDetails']>)[] = ['vehicleType', 'cargoType', 'fuelType', 'distanceUnit', 'wasteType', 'processingMethod', 'loadStatus', 'liquidType', 'weightRange'];
    stringFields.forEach(field => {
      if (typeof details[field] === 'string' && details[field].trim()) {
        (validated as any)[field] = details[field].trim();
      }
    });

    // 数字字段验证
    if (typeof details.distance === 'number' && details.distance > 0) {
      validated.distance = details.distance;
    }

    return Object.keys(validated).length > 0 ? validated : undefined;
  }

  /**
   * 后处理实体 - 执行最终验证和优化
   */
  private postProcessEntities(entities: QueryEntity[], originalQuery: string): QueryEntity[] {
    // 执行运输实体合并
    let processedEntities = this.mergeTransportEntities(entities, originalQuery);
    
    // 执行废料处理优化
    processedEntities = this.optimizeWasteEntities(processedEntities);
    
    // 执行液体处理优化
    processedEntities = this.optimizeLiquidEntities(processedEntities);
    
    return processedEntities;
  }

  /**
   * 优化废料处理实体
   */
  private optimizeWasteEntities(entities: QueryEntity[]): QueryEntity[] {
    return entities.map(entity => {
      // 如果是废料处理场景，确保名称包含处理方式
      if (entity.entityType === 'waste' && entity.scenarioDetails?.wasteType && entity.scenarioDetails?.processingMethod) {
        const wasteType = entity.scenarioDetails.wasteType;
        const processingMethod = entity.scenarioDetails.processingMethod;
        
        // 智能映射处理方式
        let mappedMethod = processingMethod;
        if (processingMethod.includes('fully recycled') || processingMethod.includes('closed-loop')) {
          mappedMethod = 'closed-loop recycling';
        } else if (processingMethod.includes('recycling')) {
          mappedMethod = 'recycling';
        } else if (processingMethod.includes('disposal')) {
          mappedMethod = 'disposal';
        }

        entity.name = `${entity.quantity || ''} ${entity.unit || ''} ${wasteType} waste ${mappedMethod}`.trim();
        entity.scenarioDetails.processingMethod = mappedMethod;
      }
      
      return entity;
    });
  }

  /**
   * 优化液体处理实体
   */
  private optimizeLiquidEntities(entities: QueryEntity[]): QueryEntity[] {
    return entities.map(entity => {
      // 如果是液体处理场景，确保名称包含处理信息
      if (entity.entityType === 'liquid' && entity.scenarioDetails?.liquidType) {
        const liquidType = entity.scenarioDetails.liquidType;
        const processingMethod = entity.scenarioDetails.processingMethod || 'treatment';
        
        entity.name = `${entity.quantity || ''} ${entity.unit || ''} ${liquidType} ${processingMethod}`.trim();
      }
      
      return entity;
    });
  }

  /**
   * 获取默认意图结果（错误时使用）
   */
  private getDefaultIntentResult(originalQuery: string): IntentDetectionResult {
    return {
      intent: 'general_chat',
      entities: [],
      missingInfo: ['无法理解用户输入'],
      confidence: 0.1,
      originalQuery
    };
  }

  /**
   * 批量处理多个查询
   */
  async analyzeBatchInputs(queries: string[], language: 'zh' | 'en' = 'zh'): Promise<IntentDetectionResult[]> {
    const results = await Promise.allSettled(
      queries.map(query => this.analyzeUserInput(query, language))
    );

    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        console.error(`批量处理第${index}个查询失败:`, result.reason);
        return this.getDefaultIntentResult(queries[index]);
      }
    });
  }

  /**
   * 提取复杂文本中的碳排放相关实体
   */
  async extractCarbonEntitiesFromText(longText: string, language: 'zh' | 'en' = 'zh'): Promise<QueryEntity[]> {
    const prompt = `
请从以下长文本中提取所有与碳排放相关的活动和物品：

文本内容：
"${longText}"

要求：
1. 识别所有可能产生碳排放的活动（交通、饮食、用电等）
2. 提取相关的数量和单位信息
3. 按照以下JSON格式输出：

{
  "entities": [
    {
      "name": "实体名称",
      "quantity": 数量|null,
      "unit": "单位"|null,
      "confidence": 0.0-1.0,
      "originalText": "原文片段"
    }
  ]
}

严格按照JSON格式输出：`;

    try {
      const response = await this.callGemini(prompt);
      const parsed = JSON.parse(response.text.match(/\{[\s\S]*\}/)![0]);
      return this.validateEntities(parsed.entities || []);
    } catch (error) {
      console.error('提取长文本实体失败:', error);
      return [];
    }
  }
}

// 创建全局意图识别引擎实例
export const intentEngine = new IntentDetectionEngine();