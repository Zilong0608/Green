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
import fs from 'fs/promises';
import path from 'path';

export class ReasoningEngine {
  private genAI: GoogleGenerativeAI;
  private model: GenerativeModel;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY!;
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
  }

  /**
   * 获取特定行业分类的期望单位类型
   */
  private async getExpectedUnitsForSector(sector?: string, subsector?: string): Promise<string[]> {
    try {
      if (!sector) {
        console.log('⚠️ 未提供行业信息，返回通用单位类型');
        return [];
      }

      // 读取单位分类文件
      const unitTypesPath = path.join(process.cwd(), 'unit-types-by-sector-subsector.json');
      const unitTypesData = await fs.readFile(unitTypesPath, 'utf-8');
      const unitTypesBySector = JSON.parse(unitTypesData);

      // 格式化行业名称以匹配JSON键（替换空格为下划线等）
      const formattedSector = sector.replace(/\s+/g, '_').replace(/[&]/g, 'and');
      
      console.log(`🔍 查找行业单位类型: Sector="${formattedSector}", Subsector="${subsector}"`);

      // 查找匹配的行业
      const sectorData = unitTypesBySector[formattedSector];
      if (!sectorData) {
        console.log(`❌ 未找到行业 "${formattedSector}" 的单位类型信息`);
        return [];
      }

      // 如果有子行业，尝试匹配子行业
      if (subsector) {
        const subsectorUnits = sectorData[subsector];
        if (subsectorUnits && Array.isArray(subsectorUnits)) {
          console.log(`✅ 找到子行业 "${subsector}" 的单位类型:`, subsectorUnits);
          return subsectorUnits;
        }
        
        // 如果子行业不匹配，尝试模糊匹配
        for (const [key, units] of Object.entries(sectorData)) {
          if (key.toLowerCase().includes(subsector.toLowerCase()) || 
              subsector.toLowerCase().includes(key.toLowerCase())) {
            console.log(`✅ 模糊匹配找到子行业 "${key}" 的单位类型:`, units);
            return units as string[];
          }
        }
      }

      // 如果没有找到特定子行业，返回该行业下所有子行业的单位类型合集
      const allUnitsInSector = Object.values(sectorData).flat() as string[];
      const uniqueUnits = [...new Set(allUnitsInSector)];
      console.log(`✅ 返回行业 "${formattedSector}" 下所有单位类型:`, uniqueUnits);
      
      return uniqueUnits;

    } catch (error) {
      console.error('🚨 加载行业单位类型失败:', error);
      return [];
    }
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
    
    console.log(`🚚 吨公里计算: 重量=${weight}${entity.unit || ''}, 距离=${distance}${details?.distanceUnit || 'km'}`);

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
   * 完整信息计算 - 增强版 with Sector-based Unit Intelligence
   */
  private async calculateWithCompleteInfo(
    entity: QueryEntity,
    emissionFactor: EmissionFactor,
    language: 'zh' | 'en'
  ): Promise<CalculationResult> {
    console.log(`🔢 开始智能计算: 实体="${entity.name}", 数量=${entity.quantity}, 单位="${entity.unit}", 排放因子单位="${emissionFactor.unit}"`);
    
    // 🌟 加载按行业分类的单位信息
    const expectedUnits = await this.getExpectedUnitsForSector(emissionFactor.sector, emissionFactor.subsector);
    console.log(`🎯 Sector "${emissionFactor.sector}" → Subsector "${emissionFactor.subsector}" 期望单位:`, expectedUnits);
    
    // 检查排放因子单位类型
    const factorUnit = emissionFactor.unit?.toLowerCase() || '';
    
    // 🚨 核心修复：基于行业的智能单位匹配和计算逻辑
    
    // 🔍 首先验证单位匹配的合理性
    const isUnitMatchValid = this.validateUnitMatchBySector(entity.unit!, factorUnit, expectedUnits);
    if (!isUnitMatchValid) {
      console.log(`⚠️ 单位匹配不符合行业期望，尝试智能推断...`);
      const suggestedCalculation = await this.suggestBetterCalculation(entity, emissionFactor, expectedUnits, language);
      if (suggestedCalculation) {
        return suggestedCalculation;
      }
    }
    
    // 1. 处理运输相关的复合单位 (如 kg/km, kg/tonne-km)
    if (factorUnit.includes('km') && entity.scenarioDetails?.distance) {
      return await this.calculateTransportEmissionSmart(entity, emissionFactor, language);
    }
    
    // 2. 处理能源单位 (如 kWh -> kg/kWh)
    if (entity.unit === 'kWh' && (factorUnit.includes('kwh') || factorUnit.includes('mj'))) {
      return await this.calculateEnergyEmissionSmart(entity, emissionFactor, language);
    }
    
    // 3. 处理重量单位匹配
    if (this.isWeightUnit(entity.unit!) && this.isWeightRelatedFactor(factorUnit)) {
      return await this.calculateWeightBasedEmission(entity, emissionFactor, language);
    }
    
    // 4. 处理体积单位匹配
    if (this.isVolumeUnit(entity.unit!) && this.isVolumeRelatedFactor(factorUnit)) {
      return await this.calculateVolumeBasedEmission(entity, emissionFactor, language);
    }
    
    // 5. 🌟 处理智能设备/载具计算 (任何设备或载具的数量×使用量模式)
    if (this.hasMultiplicationScenario(entity, factorUnit)) {
      return await this.calculateSmartMultiplicationEmission(entity, emissionFactor, language);
    }
    
    // 6. 处理车辆数量 (vehicles -> kg/km per vehicle) 
    if (entity.unit === 'vehicles' && factorUnit.includes('km')) {
      return await this.calculateVehicleFleetEmission(entity, emissionFactor, language);
    }
    
    // 7. 处理通用数量单位 (number -> kg/number)
    if ((entity.unit === 'number' || factorUnit.includes('number')) && entity.quantity) {
      return await this.calculateNumberBasedEmission(entity, emissionFactor, language);
    }
    
    // 8. 传统计算方法 (向后兼容)
    return await this.calculateTraditionalMethod(entity, emissionFactor, language);
  }

  /**
   * 智能运输排放计算
   */
  private async calculateTransportEmissionSmart(
    entity: QueryEntity,
    emissionFactor: EmissionFactor,
    language: 'zh' | 'en'
  ): Promise<CalculationResult> {
    const details = entity.scenarioDetails!;
    const distance = details.distance || 0;
    const distanceUnit = details.distanceUnit || 'km';
    const vehicleCount = details.vehicleCount || entity.quantity || 1;
    
    console.log(`🚛 智能运输计算: ${vehicleCount}辆车 × ${distance}${distanceUnit}, 排放因子: ${emissionFactor.factor} ${emissionFactor.unit}`);
    
    // 标准化距离到公里
    const distanceInKm = this.convertDistanceSmart(distance, distanceUnit, 'km');
    
    // 计算排放：车辆数量 × 距离 × 单车排放因子
    const totalEmission = vehicleCount * distanceInKm * emissionFactor.factor;
    
    const formula = language === 'zh'
      ? `${vehicleCount}辆 × ${distanceInKm}km × ${emissionFactor.factor}${emissionFactor.unit} = ${totalEmission.toFixed(3)}kg CO2`
      : `${vehicleCount} vehicles × ${distanceInKm}km × ${emissionFactor.factor}${emissionFactor.unit} = ${totalEmission.toFixed(3)}kg CO2`;
    
    return {
      entity,
      emissionFactor,
      totalEmission,
      calculation: {
        quantity: vehicleCount,
        unit: 'vehicles',
        factor: emissionFactor.factor,
        formula
      },
      confidence: entity.confidence * 0.95,
      notes: [
        language === 'zh' 
          ? `运输计算：${vehicleCount}辆车行驶${distanceInKm}公里`
          : `Transport calculation: ${vehicleCount} vehicles traveling ${distanceInKm}km`
      ]
    };
  }

  /**
   * 智能能源排放计算 
   */
  private async calculateEnergyEmissionSmart(
    entity: QueryEntity,
    emissionFactor: EmissionFactor,
    language: 'zh' | 'en'
  ): Promise<CalculationResult> {
    console.log(`⚡ 智能能源计算: ${entity.quantity}${entity.unit}, 排放因子: ${emissionFactor.factor} ${emissionFactor.unit}`);
    
    // 确保单位匹配 - kWh 输入应该匹配 kg/kWh 排放因子
    const energyQuantity = entity.quantity!;
    const energyUnit = entity.unit!;
    
    // 计算排放：能源消耗量 × 排放因子
    const totalEmission = energyQuantity * emissionFactor.factor;
    
    const formula = language === 'zh'
      ? `${energyQuantity}${energyUnit} × ${emissionFactor.factor}${emissionFactor.unit} = ${totalEmission.toFixed(3)}kg CO2`
      : `${energyQuantity}${energyUnit} × ${emissionFactor.factor}${emissionFactor.unit} = ${totalEmission.toFixed(3)}kg CO2`;
    
    return {
      entity,
      emissionFactor,
      totalEmission,
      calculation: {
        quantity: energyQuantity,
        unit: energyUnit,
        factor: emissionFactor.factor,
        formula
      },
      confidence: entity.confidence * 0.95,
      notes: [
        language === 'zh' 
          ? `能源消耗计算：${energyQuantity}${energyUnit}的电力消耗`
          : `Energy consumption calculation: ${energyQuantity}${energyUnit} electricity usage`
      ]
    };
  }

  /**
   * 车辆车队排放计算
   */
  private async calculateVehicleFleetEmission(
    entity: QueryEntity,
    emissionFactor: EmissionFactor,
    language: 'zh' | 'en'
  ): Promise<CalculationResult> {
    const vehicleCount = entity.quantity!;
    const distance = entity.scenarioDetails?.distance || 0;
    
    if (distance <= 0) {
      return await this.provideEmissionFactor(entity, emissionFactor, language);
    }
    
    const totalEmission = vehicleCount * distance * emissionFactor.factor;
    
    const formula = language === 'zh'
      ? `${vehicleCount}辆 × ${distance}km × ${emissionFactor.factor}${emissionFactor.unit} = ${totalEmission.toFixed(3)}kg CO2`
      : `${vehicleCount} vehicles × ${distance}km × ${emissionFactor.factor}${emissionFactor.unit} = ${totalEmission.toFixed(3)}kg CO2`;
    
    return {
      entity,
      emissionFactor,
      totalEmission,
      calculation: {
        quantity: vehicleCount,
        unit: 'vehicles',
        factor: emissionFactor.factor,
        formula
      },
      confidence: entity.confidence * 0.9,
      notes: []
    };
  }

  /**
   * 基于数量的排放计算
   */
  private async calculateNumberBasedEmission(
    entity: QueryEntity,
    emissionFactor: EmissionFactor,
    language: 'zh' | 'en'
  ): Promise<CalculationResult> {
    const quantity = entity.quantity!;
    const totalEmission = quantity * emissionFactor.factor;
    
    const formula = language === 'zh'
      ? `${quantity}个 × ${emissionFactor.factor}${emissionFactor.unit} = ${totalEmission.toFixed(3)}kg CO2`
      : `${quantity} items × ${emissionFactor.factor}${emissionFactor.unit} = ${totalEmission.toFixed(3)}kg CO2`;
    
    return {
      entity,
      emissionFactor,
      totalEmission,
      calculation: {
        quantity,
        unit: 'number',
        factor: emissionFactor.factor,
        formula
      },
      confidence: entity.confidence * 0.85,
      notes: []
    };
  }

  /**
   * 传统计算方法（向后兼容）
   */
  private async calculateTraditionalMethod(
    entity: QueryEntity,
    emissionFactor: EmissionFactor,
    language: 'zh' | 'en'
  ): Promise<CalculationResult> {
    // 尝试智能单位转换
    const standardizedQuantity = this.convertToStandardUnit(
      entity.quantity!,
      entity.unit!,
      emissionFactor.unit || 'kg'
    );

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
      confidence: entity.confidence * 0.8,
      notes: [
        language === 'zh' 
          ? '使用传统计算方法'
          : 'Using traditional calculation method'
      ]
    };
  }

  /**
   * 检查是否为重量相关的排放因子
   */
  private isWeightRelatedFactor(factorUnit: string): boolean {
    const weightPatterns = [
      'kg', 'tonne', 'ton', 'gram', 'pound'
    ];
    return weightPatterns.some(pattern => factorUnit.includes(pattern));
  }

  /**
   * 检查是否为体积相关的排放因子
   */
  private isVolumeRelatedFactor(factorUnit: string): boolean {
    const volumePatterns = [
      'liter', 'litre', 'gallon', 'm3', 'ml'
    ];
    return volumePatterns.some(pattern => factorUnit.includes(pattern));
  }

  /**
   * 重量基础排放计算
   */
  private async calculateWeightBasedEmission(
    entity: QueryEntity,
    emissionFactor: EmissionFactor,
    language: 'zh' | 'en'
  ): Promise<CalculationResult> {
    const standardizedQuantity = this.convertToStandardUnit(
      entity.quantity!,
      entity.unit!,
      this.extractUnit(emissionFactor.unit!)
    );

    const totalEmission = standardizedQuantity * emissionFactor.factor;

    const formula = language === 'zh'
      ? `${standardizedQuantity}${this.extractUnit(emissionFactor.unit!)} × ${emissionFactor.factor}${emissionFactor.unit} = ${totalEmission.toFixed(3)}kg CO2`
      : `${standardizedQuantity}${this.extractUnit(emissionFactor.unit!)} × ${emissionFactor.factor}${emissionFactor.unit} = ${totalEmission.toFixed(3)}kg CO2`;

    return {
      entity,
      emissionFactor,
      totalEmission,
      calculation: {
        quantity: standardizedQuantity,
        unit: this.extractUnit(emissionFactor.unit!),
        factor: emissionFactor.factor,
        formula
      },
      confidence: entity.confidence * 0.9,
      notes: []
    };
  }

  /**
   * 体积基础排放计算
   */
  private async calculateVolumeBasedEmission(
    entity: QueryEntity,
    emissionFactor: EmissionFactor,
    language: 'zh' | 'en'
  ): Promise<CalculationResult> {
    const standardizedQuantity = this.convertToStandardUnit(
      entity.quantity!,
      entity.unit!,
      this.extractUnit(emissionFactor.unit!)
    );

    const totalEmission = standardizedQuantity * emissionFactor.factor;

    const formula = language === 'zh'
      ? `${standardizedQuantity}${this.extractUnit(emissionFactor.unit!)} × ${emissionFactor.factor}${emissionFactor.unit} = ${totalEmission.toFixed(3)}kg CO2`
      : `${standardizedQuantity}${this.extractUnit(emissionFactor.unit!)} × ${emissionFactor.factor}${emissionFactor.unit} = ${totalEmission.toFixed(3)}kg CO2`;

    return {
      entity,
      emissionFactor,
      totalEmission,
      calculation: {
        quantity: standardizedQuantity,
        unit: this.extractUnit(emissionFactor.unit!),
        factor: emissionFactor.factor,
        formula
      },
      confidence: entity.confidence * 0.9,
      notes: []
    };
  }

  /**
   * 🌟 智能乘法场景排放计算 - 通用模式
   * 处理任何 "数量 × 使用量" 的场景
   */
  private async calculateSmartMultiplicationEmission(
    entity: QueryEntity,
    emissionFactor: EmissionFactor,
    language: 'zh' | 'en'
  ): Promise<CalculationResult> {
    const details = entity.scenarioDetails;
    const factorUnit = emissionFactor.unit?.toLowerCase() || '';
    
    console.log(`🧠 智能乘法计算: "${entity.name}", 详情:`, details);
    
    // 确定设备数量
    const deviceCount = entity.quantity || details?.deviceCount || details?.vehicleCount || 1;
    
    // 智能提取使用量
    let usageValue = 0;
    let usageUnit = '';
    let calculationNote = '';
    
    // 1. 距离相关的计算 (飞机、汽车等)
    if (details?.distance && (factorUnit.includes('km') || factorUnit.includes('mile'))) {
      usageValue = details.distance;
      usageUnit = details.distanceUnit || 'km';
      calculationNote = language === 'zh' ? '运输距离计算' : 'Transport distance calculation';
    }
    // 2. 时间相关的计算 (电脑、空调等)
    else if (details?.operationTime && (factorUnit.includes('hour') || factorUnit.includes('kwh'))) {
      usageValue = details.operationTime;
      usageUnit = details.timeUnit || 'hours';
      calculationNote = language === 'zh' ? '设备运行时间计算' : 'Device operation time calculation';
    }
    // 3. 能源相关的计算
    else if (details?.energyConsumption) {
      usageValue = details.energyConsumption;
      usageUnit = details.energyUnit || 'kWh';
      calculationNote = language === 'zh' ? '能源消耗计算' : 'Energy consumption calculation';
    }
    
    // 如果没有使用量信息，提供排放因子信息
    if (usageValue <= 0) {
      return await this.provideSmartEmissionFactor(entity, emissionFactor, language);
    }
    
    // 标准化使用量单位
    const standardUsage = this.convertToAppropriateUnit(usageValue, usageUnit, factorUnit);
    
    // 计算总排放：设备数量 × 使用量 × 单位排放因子
    const totalEmission = deviceCount * standardUsage * emissionFactor.factor;
    
    const formula = language === 'zh'
      ? `${deviceCount}个 × ${standardUsage}${this.extractUsageUnit(factorUnit)} × ${emissionFactor.factor}${emissionFactor.unit} = ${totalEmission.toFixed(3)}kg CO2`
      : `${deviceCount} × ${standardUsage}${this.extractUsageUnit(factorUnit)} × ${emissionFactor.factor}${emissionFactor.unit} = ${totalEmission.toFixed(3)}kg CO2`;
    
    return {
      entity,
      emissionFactor,
      totalEmission,
      calculation: {
        quantity: deviceCount,
        unit: entity.unit || 'devices',
        factor: emissionFactor.factor,
        formula
      },
      confidence: entity.confidence * 0.9,
      notes: [
        calculationNote,
        language === 'zh' 
          ? `智能识别: ${entity.scenarioDetails?.deviceType || entity.scenarioDetails?.vehicleType || '设备'}`
          : `Smart recognition: ${entity.scenarioDetails?.deviceType || entity.scenarioDetails?.vehicleType || 'device'}`
      ]
    };
  }

  /**
   * 检查是否为乘法场景
   */
  private hasMultiplicationScenario(entity: QueryEntity, factorUnit: string): boolean {
    const details = entity.scenarioDetails;
    if (!details) return false;
    
    // 有设备数量且有使用量的情况
    const hasDeviceCount = entity.quantity || details.deviceCount || details.vehicleCount;
    const hasUsage = details.distance || details.operationTime || details.energyConsumption;
    
    // 排放因子是复合单位（需要乘法的）
    const isCompoundFactor = factorUnit.includes('/') || 
                            factorUnit.includes('km') || 
                            factorUnit.includes('hour') || 
                            factorUnit.includes('kwh');
    
    return Boolean(hasDeviceCount && hasUsage && isCompoundFactor);
  }

  /**
   * 提供智能排放因子信息（当缺少使用量时）
   */
  private async provideSmartEmissionFactor(
    entity: QueryEntity,
    emissionFactor: EmissionFactor,
    language: 'zh' | 'en'
  ): Promise<CalculationResult> {
    const deviceType = entity.scenarioDetails?.deviceType || 
                      entity.scenarioDetails?.vehicleType || 
                      entity.name;
    
    const deviceCount = entity.quantity || 1;
    
    const missingInfo = this.identifyMissingUsageInfo(emissionFactor.unit!, language);
    
    const notes = [
      language === 'zh'
        ? `${deviceType}的排放因子为${emissionFactor.factor}${emissionFactor.unit}`
        : `Emission factor for ${deviceType} is ${emissionFactor.factor}${emissionFactor.unit}`,
      missingInfo
    ];

    return {
      entity,
      emissionFactor,
      totalEmission: 0,
      calculation: {
        quantity: deviceCount,
        unit: entity.unit || 'devices',
        factor: emissionFactor.factor,
        formula: language === 'zh' ? '需要使用量信息进行计算' : 'Usage information needed for calculation'
      },
      confidence: entity.confidence * 0.8,
      notes
    };
  }

  /**
   * 识别缺失的使用量信息
   */
  private identifyMissingUsageInfo(factorUnit: string, language: 'zh' | 'en'): string {
    const unit = factorUnit.toLowerCase();
    
    if (unit.includes('km')) {
      return language === 'zh' ? '需要行驶距离信息' : 'Distance information needed';
    } else if (unit.includes('hour')) {
      return language === 'zh' ? '需要运行时间信息' : 'Operation time information needed';
    } else if (unit.includes('kwh')) {
      return language === 'zh' ? '需要能源消耗信息' : 'Energy consumption information needed';
    }
    
    return language === 'zh' ? '需要使用量信息' : 'Usage information needed';
  }

  /**
   * 转换到合适的单位
   */
  private convertToAppropriateUnit(value: number, fromUnit: string, factorUnit: string): number {
    // 智能匹配目标单位
    if (factorUnit.includes('km') && this.isDistanceUnit(fromUnit)) {
      return this.convertDistanceSmart(value, fromUnit, 'km');
    } else if (factorUnit.includes('hour') && this.isTimeUnit(fromUnit)) {
      return this.convertTimeSmart(value, fromUnit, 'hour');
    } else if (factorUnit.includes('kwh') && this.isEnergyUnit(fromUnit)) {
      return this.convertEnergySmart(value, fromUnit, 'kwh');
    }
    
    return value; // 如果无法匹配，返回原值
  }

  /**
   * 从排放因子单位中提取使用量单位
   */
  private extractUsageUnit(factorUnit: string): string {
    if (factorUnit.includes('km')) return 'km';
    if (factorUnit.includes('hour')) return 'hours';
    if (factorUnit.includes('kwh')) return 'kWh';
    if (factorUnit.includes('mile')) return 'miles';
    return '';
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
   * 智能单位转换 - 增强版，支持更多单位类型和智能匹配
   */
  private convertToStandardUnit(quantity: number, fromUnit: string, toUnitExpression: string): number {
    // 处理空值情况
    if (!fromUnit || !toUnitExpression) {
      return quantity;
    }
    
    const toUnit = this.extractUnit(toUnitExpression);
    
    console.log(`🔄 智能单位转换: ${quantity} ${fromUnit} -> ${toUnit} (从排放因子单位: ${toUnitExpression})`);
    
    // 智能单位识别和转换
    const conversionResult = this.performSmartUnitConversion(quantity, fromUnit, toUnit, toUnitExpression);
    
    if (conversionResult.converted) {
      console.log(`✅ 转换成功: ${quantity} ${fromUnit} = ${conversionResult.value} ${toUnit} (${conversionResult.method})`);
      return conversionResult.value;
    }
    
    // 如果智能转换失败，使用传统转换方法
    return this.performTraditionalConversion(quantity, fromUnit, toUnit);
  }

  /**
   * 执行智能单位转换
   */
  private performSmartUnitConversion(
    quantity: number, 
    fromUnit: string, 
    toUnit: string, 
    fullUnitExpression: string
  ): { converted: boolean; value: number; method: string } {
    
    // 标准化单位字符串
    const normalizedFromUnit = this.normalizeUnit(fromUnit);
    const normalizedToUnit = this.normalizeUnit(toUnit);
    const normalizedFullExpression = this.normalizeUnit(fullUnitExpression);
    
    console.log(`🧠 智能转换分析: ${normalizedFromUnit} -> ${normalizedToUnit} (完整表达式: ${normalizedFullExpression})`);
    
    // 1. 重量单位智能转换 (支持 ton, tonne, t, kg, g, lb 等)
    if (this.isWeightUnit(normalizedFromUnit) && this.isWeightUnit(normalizedToUnit)) {
      const converted = this.convertWeightSmart(quantity, normalizedFromUnit, normalizedToUnit);
      return { converted: true, value: converted, method: 'Smart Weight Conversion' };
    }
    
    // 2. 体积单位智能转换 (支持 L, ml, gallon, m³ 等)
    if (this.isVolumeUnit(normalizedFromUnit) && this.isVolumeUnit(normalizedToUnit)) {
      const converted = this.convertVolumeSmart(quantity, normalizedFromUnit, normalizedToUnit);
      return { converted: true, value: converted, method: 'Smart Volume Conversion' };
    }
    
    // 3. 距离单位智能转换 (支持 km, m, mile, ft 等)
    if (this.isDistanceUnit(normalizedFromUnit) && this.isDistanceUnit(normalizedToUnit)) {
      const converted = this.convertDistanceSmart(quantity, normalizedFromUnit, normalizedToUnit);
      return { converted: true, value: converted, method: 'Smart Distance Conversion' };
    }
    
    // 4. 能量单位转换 (支持 kWh, MJ, BTU 等)
    if (this.isEnergyUnit(normalizedFromUnit) && this.isEnergyUnit(normalizedToUnit)) {
      const converted = this.convertEnergySmart(quantity, normalizedFromUnit, normalizedToUnit);
      return { converted: true, value: converted, method: 'Smart Energy Conversion' };
    }
    
    // 5. 时间单位转换 (支持 hour, day, year 等)
    if (this.isTimeUnit(normalizedFromUnit) && this.isTimeUnit(normalizedToUnit)) {
      const converted = this.convertTimeSmart(quantity, normalizedFromUnit, normalizedToUnit);
      return { converted: true, value: converted, method: 'Smart Time Conversion' };
    }
    
    // 6. 金钱单位转换 (支持 USD, EUR, GBP, CNY 等)
    if (this.isCurrencyUnit(normalizedFromUnit) && this.isCurrencyUnit(normalizedToUnit)) {
      const converted = this.convertCurrencySmart(quantity, normalizedFromUnit, normalizedToUnit);
      return { converted: true, value: converted, method: 'Smart Currency Conversion' };
    }
    
    // 7. 面积单位转换 (支持 m², km², acres 等)
    if (this.isAreaUnit(normalizedFromUnit) && this.isAreaUnit(normalizedToUnit)) {
      const converted = this.convertAreaSmart(quantity, normalizedFromUnit, normalizedToUnit);
      return { converted: true, value: converted, method: 'Smart Area Conversion' };
    }
    
    // 8. 温度单位转换 (支持 °C, °F, K 等)
    if (this.isTemperatureUnit(normalizedFromUnit) && this.isTemperatureUnit(normalizedToUnit)) {
      const converted = this.convertTemperatureSmart(quantity, normalizedFromUnit, normalizedToUnit);
      return { converted: true, value: converted, method: 'Smart Temperature Conversion' };
    }
    
    // 9. 功率单位转换 (支持 W, kW, HP 等)
    if (this.isPowerUnit(normalizedFromUnit) && this.isPowerUnit(normalizedToUnit)) {
      const converted = this.convertPowerSmart(quantity, normalizedFromUnit, normalizedToUnit);
      return { converted: true, value: converted, method: 'Smart Power Conversion' };
    }
    
    // 10. 压力单位转换 (支持 Pa, bar, psi 等)
    if (this.isPressureUnit(normalizedFromUnit) && this.isPressureUnit(normalizedToUnit)) {
      const converted = this.convertPressureSmart(quantity, normalizedFromUnit, normalizedToUnit);
      return { converted: true, value: converted, method: 'Smart Pressure Conversion' };
    }
    
    // 11. 复合单位处理 (如 tonne-km, kg/m³ 等)
    if (this.isCompoundUnit(normalizedFullExpression)) {
      const converted = this.handleCompoundUnit(quantity, normalizedFromUnit, normalizedFullExpression);
      if (converted !== null) {
        return { converted: true, value: converted, method: 'Compound Unit Conversion' };
      }
    }
    
    // 12. 直接匹配检查（考虑同义词）
    if (this.areUnitsEquivalent(normalizedFromUnit, normalizedToUnit)) {
      return { converted: true, value: quantity, method: 'Direct Unit Match' };
    }
    
    return { converted: false, value: quantity, method: 'No Conversion Available' };
  }

  /**
   * 标准化单位字符串
   */
  private normalizeUnit(unit: string): string {
    if (!unit) return '';
    
    return unit
      .toLowerCase()
      .trim()
      .replace(/s$/, '') // 移除复数后缀
      .replace(/[-_\s]/g, '') // 移除连字符、下划线、空格
      .replace(/gramme/g, 'gram') // 英式拼写
      .replace(/litre/g, 'liter') // 英式拼写
      .replace(/metre/g, 'meter'); // 英式拼写
  }

  /**
   * 智能重量转换
   */
  private convertWeightSmart(quantity: number, fromUnit: string, toUnit: string): number {
    const weightFactors: { [key: string]: number } = {
      // 基本单位：千克 (kg)
      'g': 0.001,
      'gram': 0.001,
      'kg': 1,
      'kilogram': 1,
      'kilo': 1,
      't': 1000,
      'ton': 1000,
      'tonne': 1000,
      'metric ton': 1000,
      'mt': 1000,
      // 英制单位
      'lb': 0.453592,
      'pound': 0.453592,
      'lbs': 0.453592,
      'oz': 0.0283495,
      'ounce': 0.0283495,
      'stone': 6.35029,
      // 中文单位
      '克': 0.001,
      '公斤': 1,
      '千克': 1,
      '吨': 1000,
      '公吨': 1000
    };
    
    const fromFactor = weightFactors[fromUnit] || 1;
    const toFactor = weightFactors[toUnit] || 1;
    
    return (quantity * fromFactor) / toFactor;
  }

  /**
   * 智能体积转换
   */
  private convertVolumeSmart(quantity: number, fromUnit: string, toUnit: string): number {
    const volumeFactors: { [key: string]: number } = {
      // 基本单位：升 (L)
      'ml': 0.001,
      'milliliter': 0.001,
      'l': 1,
      'liter': 1,
      'litre': 1,
      // 立方米
      'm3': 1000,
      'cubic meter': 1000,
      'cubic metre': 1000,
      'cubicmeter': 1000,
      // 美制单位
      'gallon': 3.78541,
      'gal': 3.78541,
      'quart': 0.946353,
      'pint': 0.473176,
      'cup': 0.236588,
      'fl oz': 0.0295735,
      'fluid ounce': 0.0295735,
      // 英制单位
      'imperial gallon': 4.54609,
      'imperial pint': 0.568261,
      // 中文单位
      '毫升': 0.001,
      '升': 1,
      '立方米': 1000
    };
    
    const fromFactor = volumeFactors[fromUnit] || 1;
    const toFactor = volumeFactors[toUnit] || 1;
    
    return (quantity * fromFactor) / toFactor;
  }

  /**
   * 智能距离转换
   */
  private convertDistanceSmart(quantity: number, fromUnit: string, toUnit: string): number {
    const distanceFactors: { [key: string]: number } = {
      // 基本单位：千米 (km)
      'mm': 0.000001,
      'millimeter': 0.000001,
      'cm': 0.00001,
      'centimeter': 0.00001,
      'm': 0.001,
      'meter': 0.001,
      'metre': 0.001,
      'km': 1,
      'kilometer': 1,
      'kilometre': 1,
      // 英制单位
      'in': 0.0000254,
      'inch': 0.0000254,
      'ft': 0.0003048,
      'foot': 0.0003048,
      'feet': 0.0003048,
      'yd': 0.0009144,
      'yard': 0.0009144,
      'mile': 1.60934,
      'mi': 1.60934,
      // 海里
      'nautical mile': 1.852,
      'nmi': 1.852,
      // 中文单位
      '毫米': 0.000001,
      '厘米': 0.00001,
      '米': 0.001,
      '公里': 1,
      '千米': 1,
      '英里': 1.60934
    };
    
    const fromFactor = distanceFactors[fromUnit] || 1;
    const toFactor = distanceFactors[toUnit] || 1;
    
    return (quantity * fromFactor) / toFactor;
  }

  /**
   * 智能能量转换
   */
  private convertEnergySmart(quantity: number, fromUnit: string, toUnit: string): number {
    const energyFactors: { [key: string]: number } = {
      // 基本单位：千瓦时 (kWh)
      'j': 2.77778e-7,
      'joule': 2.77778e-7,
      'kj': 0.000277778,
      'kilojoule': 0.000277778,
      'mj': 0.277778,
      'megajoule': 0.277778,
      'gj': 277.778,
      'gigajoule': 277.778,
      'wh': 0.001,
      'watt hour': 0.001,
      'kwh': 1,
      'kilowatt hour': 1,
      'mwh': 1000,
      'megawatt hour': 1000,
      'gwh': 1000000,
      'gigawatt hour': 1000000,
      // 热量单位
      'cal': 1.163e-6,
      'calorie': 1.163e-6,
      'kcal': 0.001163,
      'kilocalorie': 0.001163,
      'btu': 0.000293071,
      'british thermal unit': 0.000293071,
      'therm': 29.3071
    };
    
    const fromFactor = energyFactors[fromUnit] || 1;
    const toFactor = energyFactors[toUnit] || 1;
    
    return (quantity * fromFactor) / toFactor;
  }

  /**
   * 智能时间转换
   */
  private convertTimeSmart(quantity: number, fromUnit: string, toUnit: string): number {
    const timeFactors: { [key: string]: number } = {
      // 基本单位：小时 (hour)
      'second': 1/3600,
      'sec': 1/3600,
      's': 1/3600,
      'minute': 1/60,
      'min': 1/60,
      'm': 1/60, // 注意：可能与米冲突，需要上下文判断
      'hour': 1,
      'hr': 1,
      'h': 1,
      'day': 24,
      'week': 168,
      'month': 730.5, // 平均值
      'year': 8766, // 平均值，考虑闰年
      'yr': 8766,
      // 中文单位
      '秒': 1/3600,
      '分钟': 1/60,
      '小时': 1,
      '天': 24,
      '周': 168,
      '月': 730.5,
      '年': 8766
    };
    
    const fromFactor = timeFactors[fromUnit] || 1;
    const toFactor = timeFactors[toUnit] || 1;
    
    return (quantity * fromFactor) / toFactor;
  }

  /**
   * 智能金钱单位转换
   */
  private convertCurrencySmart(quantity: number, fromUnit: string, toUnit: string): number {
    // 注意：实际应用中应该从外汇API获取实时汇率
    // 这里使用近似汇率作为示例
    const currencyFactors: { [key: string]: number } = {
      // 基本单位：美元 (USD)
      'usd': 1,
      'dollar': 1,
      'dollars': 1,
      '$': 1,
      'us$': 1,
      // 欧元
      'eur': 1.08,
      'euro': 1.08,
      'euros': 1.08,
      '€': 1.08,
      // 英镑
      'gbp': 1.27,
      'pound sterling': 1.27,
      '£': 1.27,
      // 人民币
      'cny': 0.14,
      'yuan': 0.14,
      'rmb': 0.14,
      '¥': 0.14,
      '元': 0.14,
      // 日元
      'jpy': 0.0067,
      'yen': 0.0067,
      // 加拿大元
      'cad': 0.74,
      'canadian dollar': 0.74,
      // 澳大利亚元
      'aud': 0.66,
      'australian dollar': 0.66,
      // 瑞士法郎
      'chf': 1.11,
      'swiss franc': 1.11
    };
    
    const fromFactor = currencyFactors[fromUnit] || 1;
    const toFactor = currencyFactors[toUnit] || 1;
    
    return (quantity * fromFactor) / toFactor;
  }

  /**
   * 智能面积转换
   */
  private convertAreaSmart(quantity: number, fromUnit: string, toUnit: string): number {
    const areaFactors: { [key: string]: number } = {
      // 基本单位：平方米 (m²)
      'mm2': 0.000001,
      'square millimeter': 0.000001,
      'cm2': 0.0001,
      'square centimeter': 0.0001,
      'm2': 1,
      'square meter': 1,
      'square metre': 1,
      'sqm': 1,
      'km2': 1000000,
      'square kilometer': 1000000,
      'square kilometre': 1000000,
      'sqkm': 1000000,
      // 英制单位
      'sqin': 0.00064516,
      'square inch': 0.00064516,
      'sqft': 0.092903,
      'square foot': 0.092903,
      'square feet': 0.092903,
      'sqyd': 0.836127,
      'square yard': 0.836127,
      'acre': 4046.86,
      'acres': 4046.86,
      'sqmi': 2589988,
      'square mile': 2589988,
      // 公制农业单位
      'hectare': 10000,
      'hectares': 10000,
      'ha': 10000,
      // 中文单位
      '平方米': 1,
      '平方公里': 1000000,
      '公顷': 10000,
      '亩': 666.67
    };
    
    const fromFactor = areaFactors[fromUnit] || 1;
    const toFactor = areaFactors[toUnit] || 1;
    
    return (quantity * fromFactor) / toFactor;
  }

  /**
   * 智能温度转换
   */
  private convertTemperatureSmart(quantity: number, fromUnit: string, toUnit: string): number {
    // 温度转换需要特殊处理，因为不是简单的比例关系
    
    // 首先转换为开尔文
    let kelvin: number;
    switch (fromUnit) {
      case 'c':
      case 'celsius':
      case '°c':
      case '摄氏度':
        kelvin = quantity + 273.15;
        break;
      case 'f':
      case 'fahrenheit':
      case '°f':
      case '华氏度':
        kelvin = (quantity - 32) * 5/9 + 273.15;
        break;
      case 'k':
      case 'kelvin':
      case '开尔文':
        kelvin = quantity;
        break;
      case 'r':
      case 'rankine':
        kelvin = quantity * 5/9;
        break;
      default:
        kelvin = quantity; // 默认开尔文
    }
    
    // 从开尔文转换为目标单位
    switch (toUnit) {
      case 'c':
      case 'celsius':
      case '°c':
      case '摄氏度':
        return kelvin - 273.15;
      case 'f':
      case 'fahrenheit':
      case '°f':
      case '华氏度':
        return (kelvin - 273.15) * 9/5 + 32;
      case 'k':
      case 'kelvin':
      case '开尔文':
        return kelvin;
      case 'r':
      case 'rankine':
        return kelvin * 9/5;
      default:
        return kelvin;
    }
  }

  /**
   * 智能功率转换
   */
  private convertPowerSmart(quantity: number, fromUnit: string, toUnit: string): number {
    const powerFactors: { [key: string]: number } = {
      // 基本单位：瓦特 (W)
      'w': 1,
      'watt': 1,
      'watts': 1,
      'kw': 1000,
      'kilowatt': 1000,
      'kilowatts': 1000,
      'mw': 1000000,
      'megawatt': 1000000,
      'megawatts': 1000000,
      'gw': 1000000000,
      'gigawatt': 1000000000,
      'gigawatts': 1000000000,
      // 马力
      'hp': 745.7,
      'horsepower': 745.7,
      'metric hp': 735.5,
      'ps': 735.5,
      // BTU/hr
      'btu/h': 0.293071,
      'btu/hr': 0.293071,
      'btu per hour': 0.293071,
      // 中文单位
      '瓦': 1,
      '千瓦': 1000,
      '兆瓦': 1000000,
      '马力': 735.5
    };
    
    const fromFactor = powerFactors[fromUnit] || 1;
    const toFactor = powerFactors[toUnit] || 1;
    
    return (quantity * fromFactor) / toFactor;
  }

  /**
   * 智能压力转换
   */
  private convertPressureSmart(quantity: number, fromUnit: string, toUnit: string): number {
    const pressureFactors: { [key: string]: number } = {
      // 基本单位：帕斯卡 (Pa)
      'pa': 1,
      'pascal': 1,
      'pascals': 1,
      'kpa': 1000,
      'kilopascal': 1000,
      'kilopascals': 1000,
      'mpa': 1000000,
      'megapascal': 1000000,
      'megapascals': 1000000,
      'gpa': 1000000000,
      'gigapascal': 1000000000,
      'gigapascals': 1000000000,
      // Bar
      'bar': 100000,
      'bars': 100000,
      'mbar': 100,
      'millibar': 100,
      'millibars': 100,
      // 大气压
      'atm': 101325,
      'atmosphere': 101325,
      'atmospheres': 101325,
      // PSI
      'psi': 6894.76,
      'pound per square inch': 6894.76,
      'pounds per square inch': 6894.76,
      'psig': 6894.76,
      'psia': 6894.76,
      // Torr/mmHg
      'torr': 133.322,
      'mmhg': 133.322,
      'millimeter of mercury': 133.322,
      'mmh2o': 9.80665,
      'millimeter of water': 9.80665,
      // 中文单位
      '帕': 1,
      '千帕': 1000,
      '兆帕': 1000000,
      '大气压': 101325,
      '毫米汞柱': 133.322
    };
    
    const fromFactor = pressureFactors[fromUnit] || 1;
    const toFactor = pressureFactors[toUnit] || 1;
    
    return (quantity * fromFactor) / toFactor;
  }

  /**
   * 处理复合单位
   */
  private handleCompoundUnit(quantity: number, fromUnit: string, fullUnitExpression: string): number | null {
    // 处理 tonne-km 类型的单位
    if (fullUnitExpression.includes('tonne-km') || fullUnitExpression.includes('t-km')) {
      // 用户输入可能是重量，需要乘以距离才能得到 tonne-km
      if (this.isWeightUnit(fromUnit)) {
        const weightInTonnes = this.convertWeightSmart(quantity, fromUnit, 'tonne');
        // 这里需要距离信息，返回重量值但标记需要距离
        return weightInTonnes;
      }
    }
    
    // 处理其他复合单位...
    return null;
  }

  /**
   * 检查单位是否等效 - 增强版
   */
  private areUnitsEquivalent(unit1: string, unit2: string): boolean {
    if (unit1 === unit2) return true;
    
    // 定义等效单位组
    const equivalentGroups = [
      // 重量单位
      ['t', 'ton', 'tonne', 'metric ton', 'mt'],
      ['kg', 'kilogram', 'kilo'],
      ['g', 'gram'],
      ['lb', 'pound', 'lbs', 'pounds'],
      ['oz', 'ounce', 'ounces'],
      
      // 体积单位
      ['l', 'liter', 'litre'],
      ['ml', 'milliliter', 'millilitre'],
      ['m3', 'cubic meter', 'cubic metre', 'cubicmeter'],
      ['gallon', 'gal'],
      
      // 距离单位
      ['km', 'kilometer', 'kilometre'],
      ['m', 'meter', 'metre'],
      ['cm', 'centimeter', 'centimetre'],
      ['mm', 'millimeter', 'millimetre'],
      ['mile', 'mi'],
      ['ft', 'foot', 'feet'],
      ['in', 'inch'],
      
      // 能量单位
      ['kwh', 'kilowatt hour', 'kw-h'],
      ['mj', 'megajoule', 'mega joule'],
      ['j', 'joule'],
      ['cal', 'calorie'],
      ['btu', 'british thermal unit'],
      
      // 时间单位
      ['h', 'hour', 'hr'],
      ['min', 'minute'],
      ['s', 'sec', 'second'],
      ['yr', 'year'],
      
      // 功率单位
      ['w', 'watt'],
      ['kw', 'kilowatt'],
      ['hp', 'horsepower'],
      
      // 压力单位
      ['pa', 'pascal'],
      ['bar'],
      ['psi', 'pound per square inch'],
      ['atm', 'atmosphere'],
      
      // 面积单位
      ['m2', 'square meter', 'square metre', 'sqm'],
      ['km2', 'square kilometer', 'square kilometre', 'sqkm'],
      ['ha', 'hectare'],
      ['acre'],
      
      // 温度单位
      ['c', 'celsius', '°c'],
      ['f', 'fahrenheit', '°f'],
      ['k', 'kelvin'],
      
      // 货币单位
      ['usd', 'dollar', '$', 'us$'],
      ['eur', 'euro', '€'],
      ['gbp', 'pound sterling', '£'],
      ['cny', 'yuan', 'rmb', '¥'],
      ['jpy', 'yen']
    ];
    
    for (const group of equivalentGroups) {
      if (group.includes(unit1) && group.includes(unit2)) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * 检查是否为复合单位
   */
  private isCompoundUnit(unit: string): boolean {
    const compoundPatterns = [
      /tonne-km/i,
      /t-km/i,
      /kg\/m/i,
      /g\/km/i,
      /l\/100km/i,
      /kwh\/km/i,
      /mj\/km/i
    ];
    
    return compoundPatterns.some(pattern => pattern.test(unit));
  }

  /**
   * 传统转换方法（保持向后兼容）
   */
  private performTraditionalConversion(quantity: number, fromUnit: string, toUnit: string): number {
    // 重量单位转换
    if (this.isWeightUnit(fromUnit) && this.isWeightUnit(toUnit)) {
      return this.convertWeight(quantity, fromUnit, toUnit);
    }
    
    // 体积单位转换
    if (this.isVolumeUnit(fromUnit) && this.isVolumeUnit(toUnit)) {
      return this.convertVolume(quantity, fromUnit, toUnit);
    }
    
    // 距离单位转换
    if (this.isDistanceUnit(fromUnit) && this.isDistanceUnit(toUnit)) {
      return this.convertDistance(quantity, fromUnit, toUnit);
    }
    
    console.log(`⚠️ 无法转换: ${quantity} ${fromUnit} -> ${toUnit}`);
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
   * 判断是否为重量单位 - 增强版
   */
  private isWeightUnit(unit: string): boolean {
    const weightUnits = [
      'g', 'gram', 'grams', 'kg', 'kilogram', 'kilograms', 'kilo',
      'ton', 'tons', 'tonne', 'tonnes', 't', 'mt', 'metric ton',
      'lb', 'lbs', 'pound', 'pounds', 'oz', 'ounce', 'ounces', 'stone',
      '吨', '公吨', '公斤', '千克', '克'
    ];
    const normalizedUnit = this.normalizeUnit(unit);
    return weightUnits.includes(normalizedUnit);
  }

  /**
   * 判断是否为体积单位 - 增强版
   */
  private isVolumeUnit(unit: string): boolean {
    const volumeUnits = [
      'ml', 'milliliter', 'milliliters', 'millilitre', 'millilitres',
      'l', 'liter', 'liters', 'litre', 'litres',
      'm3', 'cubic meter', 'cubic metre', 'cubicmeter',
      'gallon', 'gallons', 'gal', 'quart', 'quarts', 'pint', 'pints',
      'cup', 'cups', 'fl oz', 'fluid ounce', 'fluid ounces',
      'imperial gallon', 'imperial pint',
      '升', '毫升', '立方米'
    ];
    const normalizedUnit = this.normalizeUnit(unit);
    return volumeUnits.includes(normalizedUnit);
  }

  /**
   * 判断是否为距离单位 - 增强版
   */
  private isDistanceUnit(unit: string): boolean {
    const distanceUnits = [
      'mm', 'millimeter', 'millimeters', 'millimetre', 'millimetres',
      'cm', 'centimeter', 'centimeters', 'centimetre', 'centimetres',
      'm', 'meter', 'meters', 'metre', 'metres',
      'km', 'kilometer', 'kilometers', 'kilometre', 'kilometres',
      'in', 'inch', 'inches', 'ft', 'foot', 'feet',
      'yd', 'yard', 'yards', 'mile', 'miles', 'mi',
      'nautical mile', 'nmi',
      '公里', '千米', '米', '毫米', '厘米', '英里'
    ];
    const normalizedUnit = this.normalizeUnit(unit);
    return distanceUnits.includes(normalizedUnit);
  }

  /**
   * 判断是否为能量单位
   */
  private isEnergyUnit(unit: string): boolean {
    const energyUnits = [
      'j', 'joule', 'joules', 'kj', 'kilojoule', 'kilojoules',
      'mj', 'megajoule', 'megajoules', 'gj', 'gigajoule', 'gigajoules',
      'wh', 'watt hour', 'watt hours', 'kwh', 'kilowatt hour', 'kilowatt hours',
      'mwh', 'megawatt hour', 'megawatt hours', 'gwh', 'gigawatt hour', 'gigawatt hours',
      'cal', 'calorie', 'calories', 'kcal', 'kilocalorie', 'kilocalories',
      'btu', 'british thermal unit', 'therm', 'therms'
    ];
    const normalizedUnit = this.normalizeUnit(unit);
    return energyUnits.includes(normalizedUnit);
  }

  /**
   * 判断是否为时间单位
   */
  private isTimeUnit(unit: string): boolean {
    const timeUnits = [
      'second', 'seconds', 'sec', 's',
      'minute', 'minutes', 'min',
      'hour', 'hours', 'hr', 'h',
      'day', 'days', 'week', 'weeks',
      'month', 'months', 'year', 'years', 'yr',
      '秒', '分钟', '小时', '天', '周', '月', '年'
    ];
    const normalizedUnit = this.normalizeUnit(unit);
    return timeUnits.includes(normalizedUnit);
  }

  /**
   * 判断是否为金钱单位
   */
  private isCurrencyUnit(unit: string): boolean {
    const currencyUnits = [
      'usd', 'dollar', 'dollars', '$', 'us$',
      'eur', 'euro', 'euros', '€',
      'gbp', 'pound sterling', '£',
      'cny', 'yuan', 'rmb', '¥', '元',
      'jpy', 'yen',
      'cad', 'canadian dollar',
      'aud', 'australian dollar',
      'chf', 'swiss franc',
      'krw', 'korean won',
      'inr', 'indian rupee',
      'brl', 'brazilian real',
      'rub', 'russian ruble'
    ];
    const normalizedUnit = this.normalizeUnit(unit);
    return currencyUnits.includes(normalizedUnit);
  }

  /**
   * 判断是否为面积单位
   */
  private isAreaUnit(unit: string): boolean {
    const areaUnits = [
      'mm2', 'square millimeter', 'square millimetre',
      'cm2', 'square centimeter', 'square centimetre',
      'm2', 'square meter', 'square metre', 'sqm',
      'km2', 'square kilometer', 'square kilometre', 'sqkm',
      'sqin', 'square inch',
      'sqft', 'square foot', 'square feet',
      'sqyd', 'square yard',
      'acre', 'acres',
      'sqmi', 'square mile',
      'hectare', 'hectares', 'ha',
      '平方米', '平方公里', '公顷', '亩'
    ];
    const normalizedUnit = this.normalizeUnit(unit);
    return areaUnits.includes(normalizedUnit);
  }

  /**
   * 判断是否为温度单位
   */
  private isTemperatureUnit(unit: string): boolean {
    const temperatureUnits = [
      'c', 'celsius', '°c',
      'f', 'fahrenheit', '°f',
      'k', 'kelvin',
      'r', 'rankine',
      '摄氏度', '华氏度', '开尔文'
    ];
    const normalizedUnit = this.normalizeUnit(unit);
    return temperatureUnits.includes(normalizedUnit);
  }

  /**
   * 判断是否为功率单位
   */
  private isPowerUnit(unit: string): boolean {
    const powerUnits = [
      'w', 'watt', 'watts',
      'kw', 'kilowatt', 'kilowatts',
      'mw', 'megawatt', 'megawatts',
      'gw', 'gigawatt', 'gigawatts',
      'hp', 'horsepower',
      'metric hp', 'ps',
      'btu/h', 'btu/hr', 'btu per hour',
      '瓦', '千瓦', '兆瓦', '马力'
    ];
    const normalizedUnit = this.normalizeUnit(unit);
    return powerUnits.includes(normalizedUnit);
  }

  /**
   * 判断是否为压力单位
   */
  private isPressureUnit(unit: string): boolean {
    const pressureUnits = [
      'pa', 'pascal', 'pascals',
      'kpa', 'kilopascal', 'kilopascals',
      'mpa', 'megapascal', 'megapascals',
      'gpa', 'gigapascal', 'gigapascals',
      'bar', 'bars',
      'mbar', 'millibar', 'millibars',
      'atm', 'atmosphere', 'atmospheres',
      'psi', 'pound per square inch', 'pounds per square inch', 'psig', 'psia',
      'torr', 'mmhg', 'millimeter of mercury',
      'mmh2o', 'millimeter of water',
      '帕', '千帕', '兆帕', '大气压', '毫米汞柱'
    ];
    const normalizedUnit = this.normalizeUnit(unit);
    return pressureUnits.includes(normalizedUnit);
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

  /**
   * 基于行业期望验证单位匹配的合理性
   */
  private validateUnitMatchBySector(userUnit: string, factorUnit: string, expectedUnits: string[]): boolean {
    if (expectedUnits.length === 0) {
      return true; // 如果没有期望单位信息，则认为匹配有效
    }

    // 检查输入参数是否为null或undefined
    if (!userUnit || !factorUnit) {
      console.log(`⚠️ 单位验证跳过: 用户单位="${userUnit}", 排放因子单位="${factorUnit}"`);
      return true; // 如果单位信息缺失，则跳过验证
    }

    // 检查用户单位是否符合期望的排放因子单位格式
    const userUnitLower = userUnit.toLowerCase();
    const factorUnitLower = factorUnit.toLowerCase();
    
    console.log(`🔍 验证单位匹配: 用户单位="${userUnitLower}", 排放因子单位="${factorUnitLower}"`);
    console.log(`🎯 期望的排放因子单位格式:`, expectedUnits);

    // 检查当前排放因子的单位是否在期望列表中
    const isFactorUnitExpected = expectedUnits.some(expectedUnit => 
      expectedUnit.toLowerCase() === factorUnitLower ||
      factorUnitLower.includes(expectedUnit.toLowerCase()) ||
      expectedUnit.toLowerCase().includes(factorUnitLower)
    );

    if (!isFactorUnitExpected) {
      console.log(`⚠️ 排放因子单位 "${factorUnitLower}" 不在期望列表中`);
      return false;
    }

    // 检查用户单位是否能与排放因子单位进行合理的匹配
    // 例如：用户提供 "kWh"，排放因子为 "kg/kWh" 是合理的
    if (factorUnitLower.includes(userUnitLower) || userUnitLower.includes(factorUnitLower)) {
      console.log(`✅ 单位匹配合理: "${userUnitLower}" ↔ "${factorUnitLower}"`);
      return true;
    }

    // 检查是否是合理的单位组合（如重量单位 vs kg/kg）
    if (this.isWeightUnit(userUnit) && factorUnitLower.includes('kg')) {
      return true;
    }
    
    if (this.isVolumeUnit(userUnit) && (factorUnitLower.includes('l') || factorUnitLower.includes('m3'))) {
      return true;
    }

    console.log(`❌ 单位匹配不合理: "${userUnitLower}" ↔ "${factorUnitLower}"`);
    return false;
  }

  /**
   * 当单位匹配不合理时，建议更好的计算方式
   */
  private async suggestBetterCalculation(
    entity: QueryEntity,
    emissionFactor: EmissionFactor,
    expectedUnits: string[],
    language: 'zh' | 'en'
  ): Promise<CalculationResult | null> {
    console.log(`🔧 尝试智能修复单位匹配问题...`);

    // 分析期望单位，找到最合适的计算方式
    const factorUnit = emissionFactor.unit?.toLowerCase() || '';
    
    // 检查是否需要额外信息来进行计算
    const missingInfo = this.identifyMissingInfoForBetterCalculation(entity, factorUnit, expectedUnits, language);
    
    if (missingInfo.length > 0) {
      // 返回一个说明需要更多信息的结果
      return {
        entity,
        emissionFactor,
        totalEmission: 0,
        calculation: {
          quantity: entity.quantity || 0,
          unit: entity.unit || 'unknown',
          factor: emissionFactor.factor,
          formula: language === 'zh' ? '需要补充信息进行计算' : 'Additional information needed for calculation'
        },
        confidence: entity.confidence * 0.6,
        notes: [
          language === 'zh' 
            ? `基于行业 "${emissionFactor.sector}" 的分析，建议提供以下信息：${missingInfo.join('、')}` 
            : `Based on sector "${emissionFactor.sector}" analysis, please provide: ${missingInfo.join(', ')}`
        ]
      };
    }

    // 如果无法修复，返回 null
    return null;
  }

  /**
   * 识别进行更好计算所需的缺失信息
   */
  private identifyMissingInfoForBetterCalculation(
    entity: QueryEntity,
    factorUnit: string,
    expectedUnits: string[],
    language: 'zh' | 'en'
  ): string[] {
    const missingInfo: string[] = [];
    
    // 分析期望单位，确定需要什么类型的信息
    for (const expectedUnit of expectedUnits) {
      const unitLower = expectedUnit.toLowerCase();
      
      if (unitLower.includes('km') && !entity.scenarioDetails?.distance) {
        missingInfo.push(language === 'zh' ? '距离信息' : 'distance information');
      }
      
      if (unitLower.includes('hour') && !entity.scenarioDetails?.operationTime) {
        missingInfo.push(language === 'zh' ? '运行时间' : 'operation time');
      }
      
      if (unitLower.includes('kwh') && entity.unit !== 'kWh') {
        missingInfo.push(language === 'zh' ? '能源消耗量(kWh)' : 'energy consumption (kWh)');
      }
      
      if (unitLower.includes('tonne') && !this.isWeightUnit(entity.unit!)) {
        missingInfo.push(language === 'zh' ? '重量信息' : 'weight information');
      }
    }
    
    // 去重
    return [...new Set(missingInfo)];
  }
}

// 创建全局推理引擎实例
export const reasoningEngine = new ReasoningEngine();