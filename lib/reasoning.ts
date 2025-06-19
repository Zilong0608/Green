/**
 * Reasoning 模块 - 智能推理和计算引擎
 * 
 * 功能：
 * - 接收 RAG 搜索结果并进行智能推理
 * - 处理各种复杂场景（缺失信息、多实体、模糊分配）
 * - 增强的单位转换和数值计算
 * - 多场景支持：运输、废料处理、液体处理
 * - 生成自然语言解释和建议
 * - 自适应处理不完整信息
 */

import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import { 
  IntentDetectionResult, 
  RAGResult, 
  CalculationResult, 
  SystemResponse, 
  QueryEntity,
  EmissionFactor
} from '@/types';
import _ from 'lodash';

export class ReasoningEngine {
  private genAI: GoogleGenerativeAI;
  private model: GenerativeModel;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY!;
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
  }

  /**
   * 主要推理接口 - 处理完整的用户请求（增强版）
   */
  async processUserRequest(
    intentResult: IntentDetectionResult,
    ragResults: Map<string, RAGResult[]>,
    language: 'zh' | 'en' = 'zh'
  ): Promise<SystemResponse> {
    const startTime = Date.now();

    try {
      // 根据意图类型选择处理策略
      switch (intentResult.intent) {
        case 'carbon_calculation':
          return await this.handleAdvancedCarbonCalculation(intentResult, ragResults, language, startTime);
        
        case 'information_query':
          return await this.handleInformationQuery(intentResult, ragResults, language, startTime);
        
        case 'general_chat':
          return await this.handleGeneralChat(intentResult, language, startTime);
        
        default:
          return this.createErrorResponse('未知的意图类型', language, startTime);
      }
    } catch (error) {
      console.error('推理处理失败:', error);
      return this.createErrorResponse('系统处理出错，请稍后重试', language, startTime);
    }
  }

  /**
   * 处理增强版碳排放计算请求
   */
  private async handleAdvancedCarbonCalculation(
    intentResult: IntentDetectionResult,
    ragResults: Map<string, RAGResult[]>,
    language: 'zh' | 'en',
    startTime: number
  ): Promise<SystemResponse> {
    const calculationResults: CalculationResult[] = [];
    const suggestions: string[] = [];
    let totalEmission = 0;

    console.log(`🧮 开始增强计算处理，实体数量: ${intentResult.entities.length}`);
    
    // 按实体类型分组处理
    const entitiesByType = _.groupBy(intentResult.entities, 'entityType');
    console.log(`📊 实体分组: ${JSON.stringify(Object.keys(entitiesByType))}`);
    
    // 处理运输场景
    if (entitiesByType.transport) {
      const transportResults = await this.processTransportEntities(entitiesByType.transport, ragResults, language);
      calculationResults.push(...transportResults);
      totalEmission += transportResults.reduce((sum, r) => sum + r.totalEmission, 0);
    }
    
    // 处理废料场景
    if (entitiesByType.waste) {
      const wasteResults = await this.processWasteEntities(entitiesByType.waste, ragResults, language);
      calculationResults.push(...wasteResults);
      totalEmission += wasteResults.reduce((sum, r) => sum + r.totalEmission, 0);
      }

    // 处理液体场景
    if (entitiesByType.liquid) {
      const liquidResults = await this.processLiquidEntities(entitiesByType.liquid, ragResults, language);
      calculationResults.push(...liquidResults);
      totalEmission += liquidResults.reduce((sum, r) => sum + r.totalEmission, 0);
    }

    // 处理一般实体（食物、能源等）
    const generalEntities = [
      ...(entitiesByType.food || []),
      ...(entitiesByType.energy || []),
      ...(entitiesByType.undefined || [])
    ];

    if (generalEntities.length > 0) {
      const generalResults = await this.processGeneralEntities(generalEntities, ragResults, language);
      calculationResults.push(...generalResults);
      totalEmission += generalResults.reduce((sum, r) => sum + r.totalEmission, 0);
    }

    // 处理缺失信息
    if (intentResult.missingInfo.length > 0) {
      const missingSuggestions = await this.generateMissingInfoSuggestions(intentResult.missingInfo, language);
      suggestions.push(...missingSuggestions);
    }

    // 生成额外建议
    if (calculationResults.length > 0) {
      const additionalSuggestions = await this.generateAdditionalSuggestions(calculationResults, language);
      suggestions.push(...additionalSuggestions);
    }

    // 生成响应消息
    const message = await this.generateCalculationSummary(calculationResults, totalEmission, suggestions, language);

    const processingTime = Date.now() - startTime;
    console.log(`🎯 计算完成: 总排放量=${totalEmission.toFixed(3)}kg CO2, 处理时间=${processingTime}ms`);

    return {
      success: calculationResults.length > 0 || suggestions.length > 0,
      message,
      results: calculationResults,
      totalEmission: parseFloat(totalEmission.toFixed(6)),
      suggestions,
      language,
      processingTime
    };
  }

  /**
   * 处理运输实体
   */
  private async processTransportEntities(
    entities: QueryEntity[],
    ragResults: Map<string, RAGResult[]>,
    language: 'zh' | 'en'
  ): Promise<CalculationResult[]> {
    console.log(`🚛 处理运输实体: ${entities.length}个`);
    
    const results: CalculationResult[] = [];

    for (const entity of entities) {
            const entityRagResults = ragResults.get(entity.name) || [];
            
            if (entityRagResults.length === 0) {
        console.log(`❌ 未找到运输实体"${entity.name}"的排放数据`);
              continue;
            }

            const bestMatch = entityRagResults[0];
      console.log(`🎯 运输匹配: "${bestMatch.activity.title}" (评分: ${bestMatch.relevanceScore})`);

      // 检查是否是运输场景的复合计算
      const calculation = await this.calculateTransportEmission(entity, bestMatch, language);
            if (calculation) {
        results.push(calculation);
      }
    }

    return results;
            }

  /**
   * 处理废料实体
   */
  private async processWasteEntities(
    entities: QueryEntity[],
    ragResults: Map<string, RAGResult[]>,
    language: 'zh' | 'en'
  ): Promise<CalculationResult[]> {
    console.log(`♻️ 处理废料实体: ${entities.length}个`);
    
    const results: CalculationResult[] = [];

    for (const entity of entities) {
      const entityRagResults = ragResults.get(entity.name) || [];
      
      if (entityRagResults.length === 0) {
        console.log(`❌ 未找到废料实体"${entity.name}"的排放数据`);
        continue;
      }

      const bestMatch = entityRagResults[0];
      console.log(`🎯 废料匹配: "${bestMatch.activity.title}" (评分: ${bestMatch.relevanceScore})`);

      const calculation = await this.calculateWasteEmission(entity, bestMatch, language);
      if (calculation) {
        results.push(calculation);
      }
    }

    return results;
      }

  /**
   * 处理液体实体
   */
  private async processLiquidEntities(
    entities: QueryEntity[],
    ragResults: Map<string, RAGResult[]>,
    language: 'zh' | 'en'
  ): Promise<CalculationResult[]> {
    console.log(`💧 处理液体实体: ${entities.length}个`);
    
    const results: CalculationResult[] = [];

    for (const entity of entities) {
      const entityRagResults = ragResults.get(entity.name) || [];
      
      if (entityRagResults.length === 0) {
        console.log(`❌ 未找到液体实体"${entity.name}"的排放数据`);
        continue;
    }

      const bestMatch = entityRagResults[0];
      console.log(`🎯 液体匹配: "${bestMatch.activity.title}" (评分: ${bestMatch.relevanceScore})`);

      const calculation = await this.calculateLiquidEmission(entity, bestMatch, language);
      if (calculation) {
        results.push(calculation);
      }
    }

    return results;
  }

  /**
   * 处理一般实体
   */
  private async processGeneralEntities(
    entities: QueryEntity[],
    ragResults: Map<string, RAGResult[]>,
    language: 'zh' | 'en'
  ): Promise<CalculationResult[]> {
    console.log(`🔗 处理一般实体: ${entities.length}个`);
    
    const results: CalculationResult[] = [];
    
    for (const entity of entities) {
      const entityRagResults = ragResults.get(entity.name) || [];
      
      if (entityRagResults.length === 0) {
        console.log(`❌ 未找到一般实体"${entity.name}"的排放数据`);
        continue;
      }

      const bestMatch = entityRagResults[0];
      const calculation = await this.calculateEmission(entity, bestMatch, language);
      if (calculation) {
        results.push(calculation);
      }
    }
    
    return results;
  }

  /**
   * 计算运输排放 - 增强版
   */
  private async calculateTransportEmission(
    entity: QueryEntity,
    ragResult: RAGResult,
    language: 'zh' | 'en'
  ): Promise<CalculationResult | null> {
    const emissionFactor = ragResult.activity;
    const details = entity.scenarioDetails;

    console.log(`🔢 运输计算: "${entity.name}", 单位: ${emissionFactor.unit}`);

    // 检查是否是 tonne-km 类型的运输计算
    if (emissionFactor.unit && emissionFactor.unit.toLowerCase().includes('tonne-km')) {
      return await this.calculateTonneKmEmission(entity, emissionFactor, language);
    }
    
    // 检查是否是距离相关的运输
    if (emissionFactor.unit && emissionFactor.unit.toLowerCase().includes('km')) {
      return await this.calculateDistanceEmission(entity, emissionFactor, language);
    }

    // 一般运输计算
    return await this.calculateWithCompleteInfo(entity, emissionFactor, language);
  }

  /**
   * 吨公里计算 - 专门处理运输场景
   */
  private async calculateTonneKmEmission(
    entity: QueryEntity,
    emissionFactor: EmissionFactor,
    language: 'zh' | 'en'
  ): Promise<CalculationResult | null> {
    const details = entity.scenarioDetails;
    
    // 提取重量和距离
    let weight = entity.quantity || 0;
    let distance = details?.distance || 0;
    
    console.log(`🚚 吨公里计算: 重量=${weight}${entity.unit}, 距离=${distance}${details?.distanceUnit}`);

    if (weight <= 0 || distance <= 0) {
      // 如果缺少重量或距离，提供参考信息
      return {
        entity,
        emissionFactor,
        totalEmission: 0,
        calculation: {
          quantity: 0,
          unit: 'tonne-km',
          factor: emissionFactor.factor,
          formula: language === 'zh' 
            ? `需要重量和距离信息进行计算：重量(吨) × 距离(公里) × ${emissionFactor.factor} ${emissionFactor.unit}`
            : `Need weight and distance for calculation: weight(tonnes) × distance(km) × ${emissionFactor.factor} ${emissionFactor.unit}`
        },
        confidence: entity.confidence * 0.5,
        notes: [
          language === 'zh' 
            ? '请提供具体的运输重量和距离以进行精确计算'
            : 'Please provide specific transport weight and distance for accurate calculation'
        ]
      };
    }

    // 单位转换
    const weightInTonnes = this.convertToStandardUnit(weight, entity.unit || 'tonne', 'tonne');
    const distanceInKm = this.convertToStandardUnit(distance, details?.distanceUnit || 'km', 'km');
    
    const tonneKm = weightInTonnes * distanceInKm;
    const totalEmission = tonneKm * emissionFactor.factor;

    console.log(`📊 计算结果: ${weightInTonnes}t × ${distanceInKm}km × ${emissionFactor.factor} = ${totalEmission.toFixed(3)}kg CO2`);

    return {
      entity,
      emissionFactor,
      totalEmission,
      calculation: {
        quantity: tonneKm,
        unit: 'tonne-km',
        factor: emissionFactor.factor,
        formula: language === 'zh'
          ? `${weightInTonnes}吨 × ${distanceInKm}公里 × ${emissionFactor.factor} ${emissionFactor.unit} = ${totalEmission.toFixed(3)}kg CO2`
          : `${weightInTonnes}t × ${distanceInKm}km × ${emissionFactor.factor} ${emissionFactor.unit} = ${totalEmission.toFixed(3)}kg CO2`
      },
      confidence: entity.confidence,
      notes: [
        language === 'zh' 
          ? `运输计算：载重量 × 运输距离 × 排放因子`
          : `Transport calculation: load weight × transport distance × emission factor`
      ]
    };
  }

  /**
   * 距离计算 - 处理距离相关的运输
   */
  private async calculateDistanceEmission(
    entity: QueryEntity,
    emissionFactor: EmissionFactor,
    language: 'zh' | 'en'
  ): Promise<CalculationResult | null> {
    const details = entity.scenarioDetails;
    let distance = details?.distance || entity.quantity || 0;
    
    if (distance <= 0) {
      return await this.provideEmissionFactor(entity, emissionFactor, language);
    }

    const distanceInKm = this.convertToStandardUnit(distance, details?.distanceUnit || entity.unit || 'km', 'km');
    const totalEmission = distanceInKm * emissionFactor.factor;

    return {
      entity,
      emissionFactor,
      totalEmission,
      calculation: {
        quantity: distanceInKm,
        unit: 'km',
        factor: emissionFactor.factor,
        formula: language === 'zh'
          ? `${distanceInKm}公里 × ${emissionFactor.factor} ${emissionFactor.unit} = ${totalEmission.toFixed(3)}kg CO2`
          : `${distanceInKm}km × ${emissionFactor.factor} ${emissionFactor.unit} = ${totalEmission.toFixed(3)}kg CO2`
      },
      confidence: entity.confidence,
      notes: []
    };
  }

  /**
   * 计算废料排放
   */
  private async calculateWasteEmission(
    entity: QueryEntity,
    ragResult: RAGResult,
    language: 'zh' | 'en'
  ): Promise<CalculationResult | null> {
    const emissionFactor = ragResult.activity;
    
    console.log(`♻️ 废料计算: "${entity.name}", 单位: ${emissionFactor.unit}`);

    // 检查是否有数量信息
    if (!entity.quantity || entity.quantity <= 0) {
      return await this.provideEmissionFactor(entity, emissionFactor, language);
    }

    // 执行基础计算
    return await this.calculateWithCompleteInfo(entity, emissionFactor, language);
  }

  /**
   * 计算液体排放
   */
  private async calculateLiquidEmission(
    entity: QueryEntity,
    ragResult: RAGResult,
    language: 'zh' | 'en'
  ): Promise<CalculationResult | null> {
    const emissionFactor = ragResult.activity;
    
    console.log(`💧 液体计算: "${entity.name}", 单位: ${emissionFactor.unit}`);

    // 检查是否有体积信息
    if (!entity.quantity || entity.quantity <= 0) {
      return await this.provideEmissionFactor(entity, emissionFactor, language);
    }

    // 执行基础计算
    return await this.calculateWithCompleteInfo(entity, emissionFactor, language);
  }

  /**
   * 计算单个实体的碳排放
   */
  private async calculateEmission(
    entity: QueryEntity,
    ragResult: RAGResult,
    language: 'zh' | 'en'
  ): Promise<CalculationResult | null> {
    const emissionFactor = ragResult.activity;
    
    // 处理不同的计算场景
    if (entity.quantity !== null && entity.unit !== null) {
      // 场景1：有完整的数量和单位信息
      return await this.calculateWithCompleteInfo(entity, emissionFactor, language);
    } else if (entity.quantity !== null) {
      // 场景2：有数量但单位不明确
      return await this.calculateWithQuantityOnly(entity, emissionFactor, language);
    } else {
      // 场景3：只有实体名称，缺少数量信息
      return await this.provideEmissionFactor(entity, emissionFactor, language);
    }
  }

  /**
   * 完整信息计算
   */
  private async calculateWithCompleteInfo(
    entity: QueryEntity,
    emissionFactor: EmissionFactor,
    language: 'zh' | 'en'
  ): Promise<CalculationResult> {
    // 特殊处理：如果排放因子单位包含tonne-km，说明需要重量×距离
    if (emissionFactor.unit && emissionFactor.unit.includes('tonne-km')) {
      // 这个实体应该只提供重量，距离需要从其他实体获取
      // 暂时直接使用实体的数量作为吨数
      let weightInTonnes = entity.quantity!;
      
      // 转换重量单位到吨 - 使用标准化的转换函数
      weightInTonnes = this.convertToStandardUnit(entity.quantity!, entity.unit!, 'tonne');

      // 注意：这里需要乘以距离，但当前实体只有重量信息
      // 实际的计算应该是：重量(吨) × 距离(km) × 排放因子(kg/tonne-km)
      
      const notes = [
        language === 'zh' 
          ? `需要距离信息来完成计算。当前只有重量：${weightInTonnes}吨`
          : `Distance information needed for calculation. Current weight: ${weightInTonnes} tonnes`
      ];

      return {
        entity,
        emissionFactor,
        totalEmission: 0, // 无法计算，因为缺少距离
        calculation: {
          quantity: weightInTonnes,
          unit: 'tonne',
          factor: emissionFactor.factor,
          formula: language === 'zh' 
            ? `${weightInTonnes}吨 × 距离(km) × ${emissionFactor.factor}${emissionFactor.unit} = 需要距离信息`
            : `${weightInTonnes}t × distance(km) × ${emissionFactor.factor}${emissionFactor.unit} = need distance`
        },
        confidence: entity.confidence * 0.7,
        notes
      };
    }

    // 常规单位转换
    const standardizedQuantity = this.convertToStandardUnit(
      entity.quantity!,
      entity.unit!,
      emissionFactor.unit
    );

    // 计算总排放量
    const totalEmission = standardizedQuantity * emissionFactor.factor;

    const formula = language === 'zh'
      ? `${standardizedQuantity}${this.extractUnit(emissionFactor.unit)} × ${emissionFactor.factor}${emissionFactor.unit} = ${totalEmission.toFixed(3)}kg CO2`
      : `${standardizedQuantity}${this.extractUnit(emissionFactor.unit)} × ${emissionFactor.factor}${emissionFactor.unit} = ${totalEmission.toFixed(3)}kg CO2`;

    return {
      entity,
      emissionFactor,
      totalEmission,
      calculation: {
        quantity: standardizedQuantity,
        unit: this.extractUnit(emissionFactor.unit),
        factor: emissionFactor.factor,
        formula
      },
      confidence: entity.confidence * 0.9,
      notes: []
    };
  }

  /**
   * 只有数量的计算
   */
  private async calculateWithQuantityOnly(
    entity: QueryEntity,
    emissionFactor: EmissionFactor,
    language: 'zh' | 'en'
  ): Promise<CalculationResult> {
    // 假设使用标准单位
    const assumedUnit = this.extractUnit(emissionFactor.unit);
    const totalEmission = entity.quantity! * emissionFactor.factor;

    const notes = [
      language === 'zh'
        ? `假设单位为${assumedUnit}，如需精确计算请提供准确单位`
        : `Assumed unit is ${assumedUnit}, please provide accurate unit for precise calculation`
    ];

    return {
      entity,
      emissionFactor,
      totalEmission,
      calculation: {
        quantity: entity.quantity!,
        unit: assumedUnit,
        factor: emissionFactor.factor,
        formula: `${entity.quantity!}${assumedUnit} × ${emissionFactor.factor}${emissionFactor.unit} = ${totalEmission.toFixed(3)}kg CO2`
      },
      confidence: entity.confidence * 0.7, // 降低置信度因为单位不确定
      notes
    };
  }

  /**
   * 只提供排放因子信息
   */
  private async provideEmissionFactor(
    entity: QueryEntity,
    emissionFactor: EmissionFactor,
    language: 'zh' | 'en'
  ): Promise<CalculationResult> {
    const notes = [
      language === 'zh'
        ? `${entity.name}的排放因子为${emissionFactor.factor}${emissionFactor.unit}，请提供数量信息以计算总排放量`
        : `Emission factor for ${entity.name} is ${emissionFactor.factor}${emissionFactor.unit}, please provide quantity for total emission calculation`
    ];

    return {
      entity,
      emissionFactor,
      totalEmission: 0,
      calculation: {
        quantity: 0,
        unit: this.extractUnit(emissionFactor.unit),
        factor: emissionFactor.factor,
        formula: language === 'zh' ? '需要数量信息' : 'Quantity needed'
      },
      confidence: entity.confidence * 0.8,
      notes
    };
  }

  /**
   * 单位转换
   */
  private convertToStandardUnit(quantity: number, fromUnit: string, toUnitExpression: string): number {
    // 处理空值情况
    if (!fromUnit || !toUnitExpression) {
      return quantity;
    }
    
    const toUnit = this.extractUnit(toUnitExpression);
    
    console.log(`单位转换: ${quantity} ${fromUnit} -> ${toUnit} (从 ${toUnitExpression})`);
    
    // 重量单位转换
    if (this.isWeightUnit(fromUnit) && this.isWeightUnit(toUnit)) {
      const converted = this.convertWeight(quantity, fromUnit, toUnit);
      console.log(`重量转换结果: ${quantity} ${fromUnit} = ${converted} ${toUnit}`);
      return converted;
    }
    
    // 体积单位转换
    if (this.isVolumeUnit(fromUnit) && this.isVolumeUnit(toUnit)) {
      const converted = this.convertVolume(quantity, fromUnit, toUnit);
      console.log(`体积转换结果: ${quantity} ${fromUnit} = ${converted} ${toUnit}`);
      return converted;
    }
    
    // 距离单位转换
    if (this.isDistanceUnit(fromUnit) && this.isDistanceUnit(toUnit)) {
      const converted = this.convertDistance(quantity, fromUnit, toUnit);
      console.log(`距离转换结果: ${quantity} ${fromUnit} = ${converted} ${toUnit}`);
      return converted;
    }
    
    // 如果单位相同或无法转换，直接返回
    console.log(`无需转换或无法转换: ${quantity} ${fromUnit} -> ${toUnit}`);
    return quantity;
  }

  /**
   * 重量单位转换
   */
  private convertWeight(quantity: number, fromUnit: string, toUnit: string): number {
    const weights: { [key: string]: number } = {
      'g': 0.001,
      'kg': 1,
      'ton': 1000,        // 吨 = 1000kg
      'tonne': 1000,      // 公吨 = 1000kg
      't': 1000,          // 简写的吨
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
    
    return (quantity * fromKg) / toKg;
  }

  /**
   * 体积单位转换
   */
  private convertVolume(quantity: number, fromUnit: string, toUnit: string): number {
    const volumes: { [key: string]: number } = {
      'ml': 0.001,
      'l': 1,
      '升': 1,
      '毫升': 0.001,
      'cup': 0.237,
      'gallon': 3.785
    };
    
    const fromL = volumes[fromUnit.toLowerCase()] || 1;
    const toL = volumes[toUnit.toLowerCase()] || 1;
    
    return (quantity * fromL) / toL;
  }

  /**
   * 距离单位转换
   */
  private convertDistance(quantity: number, fromUnit: string, toUnit: string): number {
    const distances: { [key: string]: number } = {
      'm': 0.001,
      'km': 1,
      '公里': 1,
      '千米': 1,
      '米': 0.001,
      'mile': 1.609,
      'mi': 1.609
    };
    
    const fromKm = distances[fromUnit.toLowerCase()] || 1;
    const toKm = distances[toUnit.toLowerCase()] || 1;
    
    return (quantity * fromKm) / toKm;
  }

  /**
   * 判断是否为重量单位
   */
  private isWeightUnit(unit: string): boolean {
    const weightUnits = ['g', 'kg', 'ton', 'tonne', 't', '吨', '公吨', '公斤', '千克', '克', 'pound', 'lb'];
    const unitLower = unit.toLowerCase().trim();
    return weightUnits.includes(unitLower);
  }

  /**
   * 判断是否为体积单位
   */
  private isVolumeUnit(unit: string): boolean {
    const volumeUnits = ['ml', 'l', '升', '毫升', 'cup', 'gallon'];
    return volumeUnits.includes(unit.toLowerCase());
  }

  /**
   * 判断是否为距离单位
   */
  private isDistanceUnit(unit: string): boolean {
    const distanceUnits = ['m', 'km', '公里', '千米', '米', 'mile', 'mi'];
    return distanceUnits.includes(unit.toLowerCase());
  }

  /**
   * 从排放因子单位表达式中提取基础单位
   */
  private extractUnit(unitExpression: string): string {
    // 处理 null 或 undefined 情况
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

  /**
   * 处理信息查询请求
   */
  private async handleInformationQuery(
    intentResult: IntentDetectionResult,
    ragResults: Map<string, RAGResult[]>,
    language: 'zh' | 'en',
    startTime: number
  ): Promise<SystemResponse> {
    const informationResults: string[] = [];

    for (const entity of intentResult.entities) {
      const entityRagResults = ragResults.get(entity.name) || [];
      
      if (entityRagResults.length > 0) {
        const topResults = entityRagResults.slice(0, 5); // 显示前5个结果
        const info = await this.formatInformationResponse(entity.name, topResults, language);
        informationResults.push(info);
      } else {
        informationResults.push(
          language === 'zh'
            ? `未找到"${entity.name}"的相关信息`
            : `No information found for "${entity.name}"`
        );
      }
    }

    const message = informationResults.join('\n\n');

    return {
      success: true,
      message,
      results: [],
      totalEmission: 0,
      suggestions: [],
      language,
      processingTime: Date.now() - startTime
    };
  }

  /**
   * 格式化信息查询响应
   */
  private async formatInformationResponse(
    entityName: string,
    ragResults: RAGResult[],
    language: 'zh' | 'en'
  ): Promise<string> {
    const header = language === 'zh'
      ? `关于"${entityName}"的碳排放信息：`
      : `Carbon emission information for "${entityName}":`;

    const items = ragResults.map((result, index) => {
      const activity = result.activity;
      const path = `${activity.sector} > ${activity.subsector || 'N/A'} > ${activity.title}`;
      
      return language === 'zh'
        ? `${index + 1}. ${activity.title}\n   排放因子：${activity.factor}${activity.unit}\n   分类路径：${path}\n   数据来源：${activity.source}`
        : `${index + 1}. ${activity.title}\n   Emission Factor: ${activity.factor}${activity.unit}\n   Classification: ${path}\n   Source: ${activity.source}`;
    }).join('\n\n');

    return `${header}\n\n${items}`;
  }

  /**
   * 处理普通对话
   */
  private async handleGeneralChat(
    intentResult: IntentDetectionResult,
    language: 'zh' | 'en',
    startTime: number
  ): Promise<SystemResponse> {
    const message = language === 'zh'
      ? '您好！我是智能碳排放评估系统。您可以告诉我您的活动或消费情况，我来帮您计算碳排放量。例如："我今天吃了100g苹果"或"我开车去了公司，距离10公里"。'
      : 'Hello! I\'m an intelligent carbon emission assessment system. You can tell me about your activities or consumption, and I\'ll help calculate carbon emissions. For example: "I ate 100g apple today" or "I drove to work, 10 kilometers".';

    return {
      success: true,
      message,
      results: [],
      totalEmission: 0,
      suggestions: [
        language === 'zh' ? '尝试输入您的日常活动或消费情况' : 'Try entering your daily activities or consumption'
      ],
      language,
      processingTime: Date.now() - startTime
    };
  }

  /**
   * 生成缺失信息建议
   */
  private async generateMissingInfoSuggestions(
    missingInfo: string[],
    language: 'zh' | 'en'
  ): Promise<string[]> {
    return missingInfo.map(info => 
      language === 'zh'
        ? `提示：${info}`
        : `Tip: ${info}`
    );
  }

  /**
   * 生成额外建议
   */
  private async generateAdditionalSuggestions(
    results: CalculationResult[],
    language: 'zh' | 'en'
  ): Promise<string[]> {
    const suggestions: string[] = [];

    // 基于结果类型生成建议
    const foodItems = results.filter(r => 
      r.emissionFactor.sector.toLowerCase().includes('food') || 
      r.emissionFactor.sector.toLowerCase().includes('agriculture')
    );

    const transportItems = results.filter(r =>
      r.emissionFactor.sector.toLowerCase().includes('transport')
    );

    if (foodItems.length > 0) {
      suggestions.push(
        language === 'zh'
          ? '建议选择本地和季节性食物以减少碳排放'
          : 'Consider choosing local and seasonal foods to reduce carbon emissions'
      );
    }

    if (transportItems.length > 0) {
      suggestions.push(
        language === 'zh'
          ? '考虑使用公共交通或骑行来降低交通碳排放'
          : 'Consider using public transport or cycling to reduce transportation emissions'
      );
    }

    return suggestions;
  }

  /**
   * 生成计算结果摘要
   */
  private async generateCalculationSummary(
    results: CalculationResult[],
    totalEmission: number,
    suggestions: string[],
    language: 'zh' | 'en'
  ): Promise<string> {
    if (results.length === 0) {
      return language === 'zh'
        ? '未能计算出碳排放量，请提供更详细的信息。'
        : 'Unable to calculate carbon emissions, please provide more detailed information.';
    }

    const itemSummaries = results.map(result => {
      const entity = result.entity;
      const emission = result.totalEmission;
      
      if (emission > 0) {
        return language === 'zh'
          ? `${entity.name}：${emission.toFixed(3)}kg CO2`
          : `${entity.name}: ${emission.toFixed(3)}kg CO2`;
      } else {
        return language === 'zh'
          ? `${entity.name}：排放因子 ${result.emissionFactor.factor}${result.emissionFactor.unit}`
          : `${entity.name}: Emission factor ${result.emissionFactor.factor}${result.emissionFactor.unit}`;
      }
    }).join('\n');

    const totalSummary = totalEmission > 0
      ? (language === 'zh' ? `\n总计：${totalEmission.toFixed(3)}kg CO2` : `\nTotal: ${totalEmission.toFixed(3)}kg CO2`)
      : '';

    return `${itemSummaries}${totalSummary}`;
  }

  /**
   * 创建错误响应
   */
  private createErrorResponse(
    errorMessage: string,
    language: 'zh' | 'en',
    startTime: number
  ): SystemResponse {
    return {
      success: false,
      message: errorMessage,
      results: [],
      totalEmission: 0,
      suggestions: [
        language === 'zh' ? '请重新描述您的问题' : 'Please rephrase your question'
      ],
      language,
      processingTime: Date.now() - startTime
    };
  }

  /**
   * 调用 Gemini API（用于复杂推理任务）
   */
  private async callGemini(prompt: string): Promise<{ text: string }> {
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
      return { text: response.text() };
    } catch (error) {
      console.error('Gemini API 调用失败:', error);
      throw error;
    }
  }
}

// 创建全局推理引擎实例
export const reasoningEngine = new ReasoningEngine();