/**
 * RAG 模块 - 检索增强生成系统
 * 
 * 功能：
 * - 基于三层图数据库结构进行智能搜索
 * - 精确匹配优先，模糊搜索补充
 * - 增强范围匹配（如30吨匹配26-32t）
 * - 语义搜索和层次搜索结合
 * - 返回 Top 10 相关活动及完整路径信息
 * - 支持复杂实体映射（如特斯拉 -> 电动汽车）
 * - 智能场景识别和处理
 */

import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import { dbManager } from './database';
import { EmissionFactor, RAGResult, QueryEntity } from '@/types';
import _ from 'lodash';

export class RAGEngine {
  private genAI: GoogleGenerativeAI;
  private model: GenerativeModel;
  private cache: Map<string, RAGResult[]> = new Map();

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY!;
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
  }

  /**
   * 主要搜索接口 - 为单个实体查找相关活动（增强版）
   */
  async searchActivities(entity: QueryEntity, language: 'zh' | 'en' = 'zh'): Promise<RAGResult[]> {
    const cacheKey = `${entity.name}_${entity.entityType || 'general'}_${language}`;
    
    // 检查缓存
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    try {
      console.log(`🔍 开始搜索实体: "${entity.name}" (类型: ${entity.entityType || 'general'})`);
      
      // 🎯 Step 0: 优先进行完整精确匹配（增强版）
      console.log(`🎯 开始完整匹配搜索: "${entity.name}"`);
      
      // 增强的精确匹配策略 - 确保搜索完整字符串，不截断
      const exactStrategies = [
        entity.name,                                        // 原始查询（最高优先级）
        entity.name.trim(),                                 // 去除首尾空格
        entity.name.replace(/\s+/g, ' ').trim(),            // 标准化空格
        entity.name.replace(/\s*-\s*/g, '-'),               // 移除连字符周围空格
        entity.name.replace(/\s*\/\s*/g, '/'),              // 移除斜杠周围空格
        entity.name.replace(/\s*\(\s*/g, '(').replace(/\s*\)\s*/g, ')'), // 标准化括号
        entity.name.replace(/\s*%\s*/g, '%'),               // 标准化百分号
        entity.name.replace(/(\d+)\s*%/g, '$1%'),           // 确保数字和%之间无空格
        entity.name.replace(/\s*:\s*/g, ':'),               // 标准化冒号
        entity.name.replace(/\s*,\s*/g, ', '),              // 标准化逗号
        entity.name.toLowerCase(),                          // 全小写
        entity.name.toLowerCase().replace(/\s+/g, ' ').trim(), // 小写+标准化空格
        // 特殊处理带特殊字符的查询
        entity.name.replace(/[^\w\s\-\/\(\)%:,]/g, '').trim() // 移除特殊字符但保留重要符号
      ];
        
        for (const strategy of exactStrategies) {
          const exactMatches = await this.exactMatchSearch(strategy);
          
          if (exactMatches.length > 0) {
            console.log(`✅ 精确匹配成功 "${strategy}": ${exactMatches.length} 个结果`);
            
            const exactResults = exactMatches.map(activity => ({
              activity,
              relevanceScore: 1.0,
              matchType: 'exact' as const,
              path: {
                sector: activity.sector,
                subsector: activity.subsector,
                activity: activity.title
              }
            }));
            this.cache.set(cacheKey, exactResults);
            return exactResults;
          }
        }
        
        // 如果精确匹配失败，进行模糊匹配但只返回数据库结果
        console.log(`⚠️ 精确匹配失败，尝试模糊匹配...`);
        const fuzzyMatches = await this.fuzzyMatchSearch(entity.name);
        
        
        if (fuzzyMatches.length > 0) {
          console.log(`✅ 模糊匹配找到 ${fuzzyMatches.length} 个结果`);
          const fuzzyResults = fuzzyMatches.map(activity => ({
            activity,
            relevanceScore: 0.8,
            matchType: 'fuzzy' as const,
            path: {
              sector: activity.sector,
              subsector: activity.subsector,
              activity: activity.title
            }
          }));
          this.cache.set(cacheKey, fuzzyResults);
          return fuzzyResults;
        }
        
        console.log(`⚠️ 数据库精确匹配失败，进入智能推理阶段...`);
        // 继续智能推理流程
      
      // 根据实体类型选择搜索策略
      let results: RAGResult[] = [];
      
      switch (entity.entityType) {
        case 'transport':
          results = await this.searchTransportActivities(entity);
          break;
        case 'waste':
          results = await this.searchWasteActivities(entity);
          break;
        case 'liquid':
          results = await this.searchLiquidActivities(entity);
          break;
                 default:
           results = await this.performTraditionalSearch(entity, language);
           break;
      }

      console.log(`🎯 搜索完成: 找到${results.length}个结果`);
      if (results.length > 0) {
        console.log(`📋 最佳匹配: "${results[0].activity.title}" (评分: ${results[0].relevanceScore})`);
      }

      this.cache.set(cacheKey, results);
      return results;

    } catch (error) {
      console.error(`搜索实体 "${entity.name}" 失败:`, error);
      return [];
    }
  }

  /**
   * 搜索运输活动 - 增强版
   */
  private async searchTransportActivities(entity: QueryEntity): Promise<RAGResult[]> {
    console.log(`🚛 运输搜索: "${entity.name}"`);
    
    const details = entity.scenarioDetails;
    let candidates: EmissionFactor[] = [];
    
    // 1. 优先精确匹配
      const exactMatches = await this.exactMatchSearch(entity.name);
      if (exactMatches.length > 0) {
      return exactMatches.map(activity => ({
          activity,
          relevanceScore: 1.0,
          matchType: 'exact' as const,
          path: {
            sector: activity.sector,
            subsector: activity.subsector,
            activity: activity.title
          }
        }));
    }

    // 2. 基于场景详情的智能搜索
    if (details) {
      candidates = await this.searchByTransportScenario(entity);
    }

    // 3. 如果没有场景详情，使用传统搜索
    if (candidates.length === 0) {
      candidates = await this.getTypeBasedCandidates(entity.name);
    }

    // 4. 执行范围匹配过滤
    if (entity.quantity && entity.unit) {
      candidates = this.applyRangeFiltering(entity.name, candidates, entity.quantity, entity.unit);
    }

    // 5. 评分和排序
    return this.scoreAndRankResults(entity.name, candidates, 'en');
  }

  /**
   * 基于运输场景的搜索
   */
  private async searchByTransportScenario(entity: QueryEntity): Promise<EmissionFactor[]> {
    const details = entity.scenarioDetails!;
    let searchTerms: string[] = [];
    
    // 构建搜索词 - 增强版关键词映射
    if (details.vehicleType) {
      searchTerms.push(details.vehicleType);
      
      // 添加关键词映射
      const vehicleMapping: Record<string, string[]> = {
        'heavy goods vehicle': ['HGV', 'heavy goods vehicle', 'freight'],
        'rigid diesel truck': ['rigid truck', 'rigid', 'truck'],
        'diesel truck': ['diesel truck', 'truck diesel'],
        'refrigerated': ['refrigerated', 'refrigerated vehicle']
      };
      
      const vehicleLower = details.vehicleType.toLowerCase();
      for (const [key, aliases] of Object.entries(vehicleMapping)) {
        if (vehicleLower.includes(key)) {
          searchTerms.push(...aliases);
        }
      }
    }
    
    if (details.cargoType) {
      searchTerms.push(details.cargoType);
    }
    if (details.fuelType) {
      searchTerms.push(details.fuelType);
    }
    if (details.loadStatus) {
      searchTerms.push(details.loadStatus);
      
      // 装载状态映射
      const loadMapping: Record<string, string[]> = {
        'half-loaded': ['50% laden', 'half loaded', '50%'],
        'fully loaded': ['100% laden', 'fully loaded', '100%'],
        'empty': ['0% laden', 'empty']
      };
      
      const loadLower = details.loadStatus.toLowerCase();
      for (const [key, aliases] of Object.entries(loadMapping)) {
        if (loadLower.includes(key)) {
          searchTerms.push(...aliases);
        }
      }
    }

    console.log(`🔎 基于场景搜索: [${searchTerms.join(', ')}]`);

    // 多层搜索策略
    let results: EmissionFactor[] = [];
    
    // 1. 优先搜索完整组合（最高优先级）
    if (searchTerms.length >= 3) {
      const complexSearch = searchTerms.slice(0, 4).join(' ');
      const complexResults = await dbManager.findFuzzyMatch(complexSearch, 20);
      console.log(`🎯 复杂搜索 "${complexSearch}": ${complexResults.length} 个结果`);
      results = [...results, ...complexResults];
    }
    
    // 2. 搜索车辆类型 + 装载状态组合
    const vehicleTerms = searchTerms.filter(term => 
      ['HGV', 'heavy goods vehicle', 'rigid truck', 'truck', 'refrigerated'].some(v => 
        term.toLowerCase().includes(v.toLowerCase())
      )
    );
    const loadTerms = searchTerms.filter(term => 
      ['50% laden', 'half loaded', '100% laden', 'empty'].some(l => 
        term.toLowerCase().includes(l.toLowerCase())
      )
    );
    
    if (vehicleTerms.length > 0 && loadTerms.length > 0) {
      for (const vehicle of vehicleTerms) {
        for (const load of loadTerms) {
          const combo = `${vehicle} ${load}`;
          const comboResults = await dbManager.findFuzzyMatch(combo, 15);
          console.log(`🔗 组合搜索 "${combo}": ${comboResults.length} 个结果`);
          results = [...results, ...comboResults];
        }
      }
    }
    
    // 3. 单独搜索主要关键词
    const priorityTerms = ['HGV refrigerated', 'heavy goods vehicle', 'rigid truck'];
    for (const term of priorityTerms) {
      if (searchTerms.some(st => st.toLowerCase().includes(term.toLowerCase()))) {
        const termResults = await dbManager.findFuzzyMatch(term, 10);
        console.log(`🚛 优先词搜索 "${term}": ${termResults.length} 个结果`);
        results = [...results, ...termResults];
      }
    }
    
    // 4. 如果仍然没有足够结果，搜索各个关键词
    if (results.length < 5) {
      for (const term of searchTerms) {
        const termResults = await dbManager.findFuzzyMatch(term, 10);
        results = [...results, ...termResults];
      }
    }
      
    // 去重并按匹配度排序
    results = _.uniqBy(results, 'id');
    
    // 特殊处理：优先级调整 - 提取重量信息
    let userWeight: number | undefined;
    // 从entity的quantity和unit中提取重量
    if (entity.quantity && entity.unit && this.isWeightUnit(entity.unit)) {
      userWeight = this.convertToTonnes(entity.quantity, entity.unit);
    }
    const enhancedResults = this.prioritizeTransportResults(results, searchTerms, userWeight);
    
    console.log(`📊 搜索完成: 总共找到 ${enhancedResults.length} 个结果`);
    return enhancedResults;
  }

  /**
   * 运输结果优先级调整 - 增强版重量范围匹配
   */
  private prioritizeTransportResults(results: EmissionFactor[], searchTerms: string[], userWeight?: number): EmissionFactor[] {
    const prioritized: Array<{result: EmissionFactor, score: number}> = [];
    
    // 从搜索词中提取重量信息 - 增强版支持范围
    let extractedWeight: number | null = null;
    for (const term of searchTerms) {
      // 1. 尝试匹配范围格式 (如: 26-32t, 3.5-7.5t)
      const rangeMatch = term.match(/(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*(?:ton|tonne|t)\b/i);
      if (rangeMatch) {
        const min = parseFloat(rangeMatch[1]);
        const max = parseFloat(rangeMatch[2]);
        extractedWeight = (min + max) / 2; // 取中间值
        console.log(`🎯 提取重量范围: ${min}-${max}t, 使用中间值: ${extractedWeight}t`);
        break;
      }
      
      // 2. 尝试匹配单个数字格式 (如: 30t, 30ton)
      const singleMatch = term.match(/(\d+(?:\.\d+)?)\s*(?:ton|tonne|t)\b/i);
      if (singleMatch) {
        extractedWeight = parseFloat(singleMatch[1]);
        console.log(`🎯 提取单一重量: ${extractedWeight}t`);
        break;
      }
    }
    
    // 使用提供的用户重量或提取的重量
    const targetWeight = userWeight || extractedWeight;
    console.log(`🎯 目标重量: ${targetWeight ? targetWeight + 't' : '未知'}`);
    
    for (const result of results) {
      let score = 0;
      const titleLower = result.title.toLowerCase();
      
      // 🏆 重量范围匹配加分 (最高优先级)
      if (targetWeight) {
        const weightRanges = this.extractWeightRanges(titleLower);
        let bestRangeMatch = 0;
        
        for (const range of weightRanges) {
          const rangeScore = this.checkRangeInclusion(targetWeight, range.min, range.max);
          if (rangeScore > bestRangeMatch) {
            bestRangeMatch = rangeScore;
          }
        }
        
        if (bestRangeMatch > 0) {
          score += bestRangeMatch * 10; // 重量范围匹配权重最高
          console.log(`  📏 "${result.title}": 重量匹配评分 ${bestRangeMatch * 10}`);
        }
      }
      
      // 精确匹配加分
      if (searchTerms.some(term => titleLower.includes(term.toLowerCase()))) {
        score += 2;
      }
      
      // 运输工具类型匹配加分
      const vehicleKeywords = ['HGV', 'heavy goods vehicle', 'rigid truck', 'refrigerated'];
      const vehicleMatches = vehicleKeywords.filter(keyword => 
        titleLower.includes(keyword.toLowerCase())
      ).length;
      score += vehicleMatches * 3;
      
      // 货物类型匹配加分
      const cargoKeywords = ['container', 'shipping container', 'freight', 'cargo'];
      const cargoMatches = cargoKeywords.filter(keyword => 
        titleLower.includes(keyword.toLowerCase())
      ).length;
      score += cargoMatches * 4; // 容器运输特别匹配
      
      // 装载状态匹配加分
      const loadKeywords = ['50% laden', 'half loaded', '100% laden', 'empty'];
      const loadMatches = loadKeywords.filter(keyword => 
        titleLower.includes(keyword.toLowerCase())
      ).length;
      score += loadMatches * 2;
      
      // 燃料类型匹配加分
      const fuelKeywords = ['diesel', 'petrol', 'electric'];
      const fuelMatches = fuelKeywords.filter(keyword => 
        titleLower.includes(keyword.toLowerCase())
      ).length;
      score += fuelMatches * 1;
      
      // 单位类型优先级
      if (result.unit && result.unit.toLowerCase().includes('km')) {
        score += 2; // 距离相关单位优先
      }
      if (result.unit && result.unit.toLowerCase().includes('tonne-km')) {
        score += 3; // 吨公里单位最优先
      }
      
      // 避免通用燃料数据
      if (titleLower === 'diesel' || titleLower === 'petrol' || titleLower === 'gasoline') {
        score -= 5; // 降低通用燃料的优先级
      }
      
      // 避免不相关的车型
      if (targetWeight && titleLower.includes('truck')) {
        const weightRanges = this.extractWeightRanges(titleLower);
        if (weightRanges.length === 0) {
          // 如果是卡车但没有重量范围信息，降低优先级
          score -= 2;
        }
      }
      
      prioritized.push({ result, score });
    }
    
    // 按评分排序
    prioritized.sort((a, b) => b.score - a.score);
    
    // 输出前几个结果的评分信息
    console.log('🏆 优先级排序结果:');
    prioritized.slice(0, 3).forEach((item, index) => {
      console.log(`  ${index + 1}. "${item.result.title}" (评分: ${item.score})`);
    });
    
    return prioritized.map(item => item.result);
  }

  /**
   * 搜索废料处理活动
   */
  private async searchWasteActivities(entity: QueryEntity): Promise<RAGResult[]> {
    console.log(`♻️ 废料搜索: "${entity.name}"`);
    
    const details = entity.scenarioDetails;
    let candidates: EmissionFactor[] = [];
    
    // 1. 优先精确匹配
    const exactMatches = await this.exactMatchSearch(entity.name);
    if (exactMatches.length > 0) {
      return exactMatches.map(activity => ({
        activity,
        relevanceScore: 1.0,
        matchType: 'exact' as const,
        path: {
          sector: activity.sector,
          subsector: activity.subsector,
          activity: activity.title
        }
      }));
    }

    // 2. 基于废料类型和处理方式搜索  
    if (details?.wasteType && details?.processingMethod) {
      candidates = await this.searchByWasteScenario(details.wasteType, details.processingMethod);
    }

    // 3. 通用废料搜索
    if (candidates.length === 0) {
      candidates = await dbManager.findFuzzyMatch(entity.name, 20);
      // 过滤废料相关结果
      candidates = candidates.filter(c => 
        c.title.toLowerCase().includes('waste') ||
        c.title.toLowerCase().includes('recycl') ||
        c.title.toLowerCase().includes('disposal')
      );
    }

    return this.scoreAndRankResults(entity.name, candidates, 'en');
  }

  /**
   * 基于废料场景的搜索
   */
  private async searchByWasteScenario(wasteType: string, processingMethod: string): Promise<EmissionFactor[]> {
    console.log(`🔍 废料场景搜索: ${wasteType} + ${processingMethod}`);
    
    // 映射处理方式到数据库术语
    let dbProcessingTerm = processingMethod;
    if (processingMethod.includes('closed-loop')) {
      dbProcessingTerm = 'closed-loop recycling';
    } else if (processingMethod.includes('recycling')) {
      dbProcessingTerm = 'recycling';
    }

    // 组合搜索
    const searchTerms = [
      `${wasteType} waste ${dbProcessingTerm}`,
      `${wasteType} ${dbProcessingTerm}`,
      `${wasteType} waste disposal`,
      `${wasteType} disposal`
    ];

    let results: EmissionFactor[] = [];
    for (const term of searchTerms) {
      const termResults = await dbManager.findFuzzyMatch(term, 10);
      results = [...results, ...termResults];
      
      // 如果找到了相关结果，优先使用
      if (termResults.length > 0) {
        console.log(`✅ 找到 ${termResults.length} 个匹配项目于: "${term}"`);
        break;
      }
    }

    return _.uniqBy(results, 'id');
  }

  /**
   * 搜索液体处理活动
   */
  private async searchLiquidActivities(entity: QueryEntity): Promise<RAGResult[]> {
    console.log(`💧 液体搜索: "${entity.name}"`);
    
    const details = entity.scenarioDetails;
    let candidates: EmissionFactor[] = [];
    
    // 1. 优先精确匹配
    const exactMatches = await this.exactMatchSearch(entity.name);
    if (exactMatches.length > 0) {
      return exactMatches.map(activity => ({
        activity,
        relevanceScore: 1.0,
        matchType: 'exact' as const,
        path: {
          sector: activity.sector,
          subsector: activity.subsector,
          activity: activity.title
        }
      }));
    }

    // 2. 基于液体类型和处理方式搜索
    if (details?.liquidType) {
      candidates = await this.searchByLiquidScenario(details.liquidType, details.processingMethod || 'treatment');
    }

    // 3. 通用液体搜索
    if (candidates.length === 0) {
      candidates = await dbManager.findFuzzyMatch(entity.name, 20);
      // 过滤液体相关结果
      candidates = candidates.filter(c => 
        c.title.toLowerCase().includes('water') ||
        c.title.toLowerCase().includes('liquid') ||
        c.title.toLowerCase().includes('treatment')
      );
    }

    return this.scoreAndRankResults(entity.name, candidates, 'en');
  }

  /**
   * 基于液体场景的搜索
   */
  private async searchByLiquidScenario(liquidType: string, processingMethod: string): Promise<EmissionFactor[]> {
    console.log(`🔍 液体场景搜索: ${liquidType} + ${processingMethod}`);
    
    const searchTerms = [
      `${liquidType} ${processingMethod}`,
      `${liquidType} treatment`,
      `${liquidType} processing`,
      liquidType
    ];

    let results: EmissionFactor[] = [];
    for (const term of searchTerms) {
      const termResults = await dbManager.findFuzzyMatch(term, 10);
      results = [...results, ...termResults];
      
      if (termResults.length > 0) {
        console.log(`✅ 找到 ${termResults.length} 个匹配项目于: "${term}"`);
        break;
      }
    }

    return _.uniqBy(results, 'id');
  }

  /**
   * 增强版范围过滤 - 支持用户数量与数据库规格匹配
   */
  private applyRangeFiltering(entityName: string, candidates: EmissionFactor[], userQuantity: number, userUnit: string): EmissionFactor[] {
    console.log(`📏 执行范围匹配: ${userQuantity}${userUnit}`);
    
    const rangeMatches: EmissionFactor[] = [];
    const nonRangeMatches: EmissionFactor[] = [];
    
    for (const candidate of candidates) {
      const rangeScore = this.calculateAdvancedRangeMatch(userQuantity, userUnit, candidate);
      
      if (rangeScore > 0.8) {
        rangeMatches.push(candidate);
        console.log(`✅ 范围匹配: "${candidate.title}" (评分: ${rangeScore})`);
      } else {
        nonRangeMatches.push(candidate);
      }
    }
    
    // 优先返回范围匹配，如果没有则返回所有
    return rangeMatches.length > 0 ? rangeMatches : nonRangeMatches;
  }

  /**
   * 增强版范围匹配计算
   */
  private calculateAdvancedRangeMatch(userQuantity: number, userUnit: string, activity: EmissionFactor): number {
    const title = activity.title.toLowerCase();
    const unit = activity.unit?.toLowerCase() || '';
    
    // 1. 重量范围匹配（如30吨匹配26-32t）
    if (this.isWeightUnit(userUnit)) {
      const weightRanges = this.extractWeightRanges(title);
      for (const range of weightRanges) {
        const userWeightInTonnes = this.convertToTonnes(userQuantity, userUnit);
        const rangeScore = this.checkRangeInclusion(userWeightInTonnes, range.min, range.max);
        if (rangeScore > 0) {
          console.log(`💪 重量范围匹配: ${userWeightInTonnes}t 在 ${range.min}-${range.max}t 范围内 (评分: ${rangeScore})`);
          return rangeScore;
        }
      }
    }

    // 2. 距离范围匹配
    if (this.isDistanceUnit(userUnit)) {
      const distanceRanges = this.extractDistanceRanges(title);
      for (const range of distanceRanges) {
        const userDistanceInKm = this.convertToKm(userQuantity, userUnit);
        const rangeScore = this.checkRangeInclusion(userDistanceInKm, range.min, range.max);
        if (rangeScore > 0) {
          console.log(`🚗 距离范围匹配: ${userDistanceInKm}km 在 ${range.min}-${range.max}km 范围内 (评分: ${rangeScore})`);
          return rangeScore;
        }
      }
    }

    // 3. 体积范围匹配
    if (this.isVolumeUnit(userUnit)) {
      const volumeRanges = this.extractVolumeRanges(title);
      for (const range of volumeRanges) {
        const userVolumeInL = this.convertToLiters(userQuantity, userUnit);
        const rangeScore = this.checkRangeInclusion(userVolumeInL, range.min, range.max);
        if (rangeScore > 0) {
          console.log(`💧 体积范围匹配: ${userVolumeInL}L 在 ${range.min}-${range.max}L 范围内 (评分: ${rangeScore})`);
          return rangeScore;
        }
      }
    }

    return 0;
  }

  /**
   * 提取重量范围（如26-32t）
   */
  private extractWeightRanges(text: string): Array<{min: number, max: number, unit: string}> {
    const ranges: Array<{min: number, max: number, unit: string}> = [];
    
    // 匹配 XX-YYt, XX-YY ton, XX-YY tonnes等格式
    const weightRangePatterns = [
      /(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)t(?:on|ne)?s?\b/g,
      /(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*t(?:on|ne)?s?\b/g,
      /(\d+(?:\.\d+)?)\s*to\s*(\d+(?:\.\d+)?)\s*t(?:on|ne)?s?\b/g
    ];

    for (const pattern of weightRangePatterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        ranges.push({
          min: parseFloat(match[1]),
          max: parseFloat(match[2]),
          unit: 'tonne'
        });
      }
    }

    return ranges;
  }

  /**
   * 提取距离范围
   */
  private extractDistanceRanges(text: string): Array<{min: number, max: number, unit: string}> {
    const ranges: Array<{min: number, max: number, unit: string}> = [];
    
    const distanceRangePatterns = [
      /(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)km\b/g,
      /(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*km\b/g,
      /(\d+(?:\.\d+)?)\s*to\s*(\d+(?:\.\d+)?)\s*km\b/g
    ];

    for (const pattern of distanceRangePatterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        ranges.push({
          min: parseFloat(match[1]),
          max: parseFloat(match[2]),
          unit: 'km'
        });
      }
    }

    return ranges;
  }

  /**
   * 提取体积范围
   */
  private extractVolumeRanges(text: string): Array<{min: number, max: number, unit: string}> {
    const ranges: Array<{min: number, max: number, unit: string}> = [];
    
    const volumeRangePatterns = [
      /(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)l(?:iter)?s?\b/g,
      /(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*l(?:iter)?s?\b/g,
      /(\d+(?:\.\d+)?)\s*to\s*(\d+(?:\.\d+)?)\s*l(?:iter)?s?\b/g
    ];

    for (const pattern of volumeRangePatterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        ranges.push({
          min: parseFloat(match[1]),
          max: parseFloat(match[2]),
          unit: 'liter'
        });
      }
    }

    return ranges;
  }

  /**
   * 检查数值是否在范围内
   */
  private checkRangeInclusion(value: number, min: number, max: number): number {
    if (value >= min && value <= max) {
      // 完全匹配
      return 1.0;
    } else if (value >= min * 0.8 && value <= max * 1.2) {
      // 接近匹配
      return 0.8;
    } else if (value >= min * 0.5 && value <= max * 1.5) {
      // 相关匹配
      return 0.6;
    }
    return 0;
  }

  /**
   * 单位转换方法
   */
  private convertToTonnes(quantity: number, unit: string): number {
    const unitLower = unit.toLowerCase();
    switch (unitLower) {
      case 'kg': case 'kilogram': case 'kilograms':
        return quantity / 1000;
      case 'g': case 'gram': case 'grams':
        return quantity / 1000000;
      case 't': case 'ton': case 'tons': case 'tonne': case 'tonnes':
        return quantity;
      default:
        return quantity; // 假设已经是吨
    }
  }

  private convertToKm(quantity: number, unit: string): number {
    const unitLower = unit.toLowerCase();
    switch (unitLower) {
      case 'm': case 'meter': case 'meters': case 'metre': case 'metres':
        return quantity / 1000;
      case 'km': case 'kilometer': case 'kilometers': case 'kilometre': case 'kilometres':
        return quantity;
      case 'mile': case 'miles':
        return quantity * 1.60934;
      default:
        return quantity; // 假设已经是公里
    }
  }

  private convertToLiters(quantity: number, unit: string): number {
    const unitLower = unit.toLowerCase();
    switch (unitLower) {
      case 'ml': case 'milliliter': case 'milliliters': case 'millilitre': case 'millilitres':
        return quantity / 1000;
      case 'l': case 'liter': case 'liters': case 'litre': case 'litres':
        return quantity;
      case 'gallon': case 'gallons':
        return quantity * 3.78541; // 美制加仑
      default:
        return quantity; // 假设已经是升
    }
  }

  /**
   * 单位类型判断方法
   */
  private isWeightUnit(unit: string): boolean {
    const weightUnits = ['kg', 'g', 'ton', 'tons', 'tonne', 'tonnes', 't', 'kilogram', 'kilograms', 'gram', 'grams'];
    return weightUnits.includes(unit.toLowerCase());
  }

  private isDistanceUnit(unit: string): boolean {
    const distanceUnits = ['km', 'm', 'mile', 'miles', 'kilometer', 'kilometers', 'kilometre', 'kilometres', 'meter', 'meters', 'metre', 'metres'];
    return distanceUnits.includes(unit.toLowerCase());
  }

  private isVolumeUnit(unit: string): boolean {
    const volumeUnits = ['l', 'ml', 'liter', 'liters', 'litre', 'litres', 'milliliter', 'milliliters', 'millilitre', 'millilitres', 'gallon', 'gallons'];
    return volumeUnits.includes(unit.toLowerCase());
  }

  /**
   * 传统搜索方法 - 用于一般实体
   */
  private async performTraditionalSearch(entity: QueryEntity, language: 'zh' | 'en'): Promise<RAGResult[]> {
    // 1. 精确匹配搜索（优先级最高）
    const exactMatches = await this.exactMatchSearch(entity.name);
    if (exactMatches.length > 0) {
      return exactMatches.map(activity => ({
        activity,
        relevanceScore: 1.0,
        matchType: 'exact' as const,
        path: {
          sector: activity.sector,
          subsector: activity.subsector,
          activity: activity.title
        }
      }));
      }

      // 2. 模糊匹配搜索
      const fuzzyMatches = await this.fuzzyMatchSearch(entity.name);
      if (fuzzyMatches.length > 0) {
      return fuzzyMatches.map(activity => ({
          activity,
          relevanceScore: 0.8,
          matchType: 'fuzzy' as const,
          path: {
            sector: activity.sector,
            subsector: activity.subsector,
            activity: activity.title
          }
        }));
      }

      // 3. AI 语义搜索（智能映射）
      const semanticMatches = await this.semanticSearch(entity.name, language);
      return semanticMatches;
  }

  /**
   * 精确匹配搜索
   */
  private async exactMatchSearch(entityName: string): Promise<EmissionFactor[]> {
    return await dbManager.findExactMatch(entityName);
  }

  /**
   * 模糊匹配搜索 - 两阶段搜索策略
   */
  private async fuzzyMatchSearch(entityName: string): Promise<EmissionFactor[]> {
    console.log(`开始两阶段搜索: "${entityName}"`);
    
    // 第一阶段：类型搜索 - 根据关键词获取候选集
    const candidates = await this.getTypeBasedCandidates(entityName);
    console.log(`第一阶段 - 类型搜索: 找到 ${candidates.length} 个候选项`);
    
    if (candidates.length === 0) {
      // 如果没有找到候选项，使用默认模糊搜索
      return await dbManager.findFuzzyMatch(entityName, 10);
    }
    
    // 第二阶段：范围匹配 - 在候选集中进行精确匹配
    const rangeFiltered = this.applyRangeFiltering(entityName, candidates, 0, '');
    console.log(`第二阶段 - 范围匹配: 过滤到 ${rangeFiltered.length} 个精确匹配`);
    
    return rangeFiltered.length > 0 ? rangeFiltered : candidates;
  }

  /**
   * 第一阶段：基于类型的候选项获取
   */
  private async getTypeBasedCandidates(entityName: string): Promise<EmissionFactor[]> {
    const entityLower = entityName.toLowerCase();
    let candidates: EmissionFactor[] = [];
    
    // 识别实体类型并搜索相关类别
    if (entityLower.includes('train') || entityLower.includes('railway') || entityLower.includes('rail') || 
        entityLower.includes('locomotive') || entityLower.includes('freight train')) {
      // 铁路运输类型 - 优先级最高
      candidates = await this.searchRailwayCategory(entityLower);
    } else if (entityLower.includes('truck') || entityLower.includes('rigid') || entityLower.includes('lorry')) {
      // 卡车类型
      candidates = await this.searchTruckCategory(entityLower);
    } else if (entityLower.includes('car') || entityLower.includes('petrol') || entityLower.includes('diesel') && 
               (entityLower.includes('vehicle') || entityLower.includes('passenger'))) {
      // 乘用车类型
      candidates = await this.searchCarCategory(entityLower);
    } else if (entityLower.includes('hgv') || (entityLower.includes('heavy') && entityLower.includes('goods'))) {
      // 重型货运车辆
      candidates = await this.searchHGVCategory(entityLower);
    } else if (entityLower.includes('flight') || entityLower.includes('air') || entityLower.includes('aviation') ||
               entityLower.includes('plane') || entityLower.includes('aircraft')) {
      // 航空运输类型
      candidates = await this.searchAviationCategory(entityLower);
    } else if (entityLower.includes('ship') || entityLower.includes('vessel') || entityLower.includes('marine') ||
               entityLower.includes('cargo ship') || entityLower.includes('ferry')) {
      // 海运类型
      candidates = await this.searchMarineCategory(entityLower);
    } else if (entityLower.includes('waste') && (entityLower.includes('recycl') || entityLower.includes('disposal'))) {
      // 废料处理
      candidates = await this.searchWasteCategory(entityLower);
    } else if (entityLower.includes('transport') || entityLower.includes('delivery') || entityLower.includes('shipping')) {
      // 运输服务
      candidates = await this.searchTransportCategory(entityLower);
    } else if (entityLower.includes('electric') || entityLower.includes('battery') || entityLower.includes('ev')) {
      // 电动设备
      candidates = await this.searchElectricCategory(entityLower);
    } else {
      // 通用搜索
      candidates = await dbManager.findFuzzyMatch(entityName, 20);
    }
    
    return candidates;
  }

  /**
   * 搜索铁路类别 - 智能组合搜索
   */
  private async searchRailwayCategory(entityLower: string): Promise<EmissionFactor[]> {
    let results: EmissionFactor[] = [];
    
    console.log(`🚂 搜索铁路类别: "${entityLower}"`);
    
    // 优先级1：铁路货运（最高优先级，直接匹配运输服务）
    if (entityLower.includes('freight') || entityLower.includes('cargo')) {
      if (entityLower.includes('diesel')) {
        // 直接搜索"rail freight diesel traction"
        results = await dbManager.findFuzzyMatch('rail freight diesel traction', 30);
        if (results.length === 0) {
          results = await dbManager.findFuzzyMatch('rail freight diesel', 30);
        }
        if (results.length === 0) {
          results = await dbManager.findFuzzyMatch('rail freight', 30);
        }
      } else {
        results = await dbManager.findFuzzyMatch('rail freight', 30);
      }
    }
    // 优先级2：机车搜索（仅作为后备）
    else if (entityLower.includes('locomotive')) {
      // 优先搜索铁路货运，然后才是机车燃料
      results = await dbManager.findFuzzyMatch('rail freight diesel traction', 30);
      if (results.length === 0) {
        results = await dbManager.findFuzzyMatch('rail freight', 30);
      }
      if (results.length === 0) {
        results = await dbManager.findFuzzyMatch('locomotive', 30);
      }
    }
    // 优先级3：一般铁路搜索
    else if (entityLower.includes('rail')) {
      results = await dbManager.findFuzzyMatch('rail freight', 30);
      if (results.length === 0) {
        results = await dbManager.findFuzzyMatch('rail', 30);
      }
    }
    // 优先级4：火车搜索
    else if (entityLower.includes('train')) {
      results = await dbManager.findFuzzyMatch('rail freight', 30);
      if (results.length === 0) {
        results = await dbManager.findFuzzyMatch('train', 30);
      }
    }
    
    // 特殊过滤：如果提到了建筑材料，优先返回建筑材料运输相关的结果
    if (entityLower.includes('building materials') || entityLower.includes('construction')) {
      const buildingResults = results.filter(r => 
        r.title.toLowerCase().includes('building materials') ||
        r.title.toLowerCase().includes('construction')
      );
      
      if (buildingResults.length > 0) {
        console.log(`找到${buildingResults.length}个建筑材料运输专用结果`);
        results = buildingResults;
      }
    }
    
    // 过滤铁路运输相关，优先运输操作而非设备制造
    const filtered = results.filter(r => {
      const titleLower = r.title.toLowerCase();
      const sectorLower = r.sector.toLowerCase();
      
      // 排除设备制造/采购相关的排放因子
      if (titleLower.includes('equipment') || titleLower.includes('acquisition') || 
          titleLower.includes('manufacturing') || r.unit.includes('cad') || 
          r.unit.includes('usd') || r.unit.includes('eur')) {
        return false;
      }
      
      // 优先运输操作相关
      return sectorLower.includes('transport') ||
             titleLower.includes('rail') ||
             titleLower.includes('train') ||
             titleLower.includes('locomotive') ||
             titleLower.includes('freight')
    });
    
    console.log(`铁路搜索完成: 找到${filtered.length}个结果`);
    return filtered;
  }

  /**
   * 搜索乘用车类别
   */
  private async searchCarCategory(entityLower: string): Promise<EmissionFactor[]> {
    let results: EmissionFactor[] = [];
    
    console.log(`🚗 搜索乘用车类别: "${entityLower}"`);
    
    // 优先级1：电动/混动车辆
    if (entityLower.includes('phev') || entityLower.includes('plug-in hybrid')) {
      results = await dbManager.findFuzzyMatch('plug-in hybrid car', 30);
      if (results.length === 0) {
        results = await dbManager.findFuzzyMatch('hybrid car', 30);
      }
      if (results.length === 0) {
        results = await dbManager.findFuzzyMatch('electric car', 30);
      }
    } else if (entityLower.includes('hybrid')) {
      results = await dbManager.findFuzzyMatch('hybrid car', 30);
    } else if (entityLower.includes('electric') || entityLower.includes('ev')) {
      results = await dbManager.findFuzzyMatch('electric car', 30);
    }
    // 优先级2：MPV/大型车辆
    else if (entityLower.includes('mpv') || entityLower.includes('minivan')) {
      results = await dbManager.findFuzzyMatch('mpv', 30);
      if (results.length === 0) {
        results = await dbManager.findFuzzyMatch('large car', 30);
      }
      if (results.length === 0) {
        results = await dbManager.findFuzzyMatch('van', 30);
      }
    }
    // 优先级3：按车型大小搜索
    else if (entityLower.includes('large')) {
      results = await dbManager.findFuzzyMatch('petrol car large', 30);
    } else if (entityLower.includes('medium')) {
      results = await dbManager.findFuzzyMatch('petrol car medium', 30);
    } else if (entityLower.includes('small')) {
      results = await dbManager.findFuzzyMatch('petrol car small', 30);
    } else if (entityLower.includes('luxury')) {
      results = await dbManager.findFuzzyMatch('petrol car luxury', 30);
    }
    // 优先级4：按燃料类型搜索
    else if (entityLower.includes('petrol')) {
      results = await dbManager.findFuzzyMatch('petrol car', 30);
    } else if (entityLower.includes('diesel')) {
      results = await dbManager.findFuzzyMatch('diesel car', 30);
    }
    // 优先级5：一般汽车搜索（更严格的过滤）
    else if (entityLower.includes('car') || entityLower.includes('vehicle')) {
      results = await dbManager.findFuzzyMatch('car', 30);
    }
    
    // 特殊过滤：如果提到了乘客，优先返回乘客车辆相关的结果
    if (entityLower.includes('passenger')) {
      const passengerResults = results.filter(r => 
        r.title.toLowerCase().includes('passenger')
      );
      
      if (passengerResults.length > 0) {
        console.log(`找到${passengerResults.length}个乘客车辆专用结果`);
        results = passengerResults;
      }
    }
    
    // 过滤汽车运输相关，严格排除非运输数据
    const filtered = results.filter(r => {
      const titleLower = r.title.toLowerCase();
      const sectorLower = r.sector.toLowerCase();
      
      // 必须是运输行业
      if (!sectorLower.includes('transport')) {
        return false;
      }
      
      // 排除明显的非车辆数据
      if (titleLower.includes('carpet') || titleLower.includes('tile') || 
          titleLower.includes('building') || titleLower.includes('construction') ||
          titleLower.includes('material') || titleLower.includes('steel') ||
          titleLower.includes('iron') || titleLower.includes('concrete')) {
        return false;
      }
      
      // 必须包含车辆相关关键词
      return titleLower.includes('car') ||
             titleLower.includes('vehicle') ||
             titleLower.includes('mpv') ||
             titleLower.includes('hybrid') ||
             titleLower.includes('electric') ||
             titleLower.includes('petrol') ||
             titleLower.includes('diesel')
    });
    
    console.log(`乘用车搜索完成: 找到${filtered.length}个结果`);
    return filtered;
  }

  /**
   * 搜索航空类别
   */
  private async searchAviationCategory(entityLower: string): Promise<EmissionFactor[]> {
    let results: EmissionFactor[] = [];
    
    console.log(`✈️ 搜索航空类别: "${entityLower}"`);
    
    // 优先级1：按航程长度搜索
    if (entityLower.includes('long-haul') || entityLower.includes('international')) {
      results = await dbManager.findFuzzyMatch('international long-haul flight', 30);
    } else if (entityLower.includes('short-haul') || entityLower.includes('domestic')) {
      results = await dbManager.findFuzzyMatch('short-haul flight', 30);
    }
    // 优先级2：一般航空搜索
    else {
      results = await dbManager.findFuzzyMatch('flight', 30);
    }
    
    // 过滤航空运输相关
    const filtered = results.filter(r => 
      r.sector.toLowerCase().includes('transport') ||
      r.title.toLowerCase().includes('flight') ||
      r.title.toLowerCase().includes('air') ||
      r.title.toLowerCase().includes('aviation')
    );
    
    console.log(`航空搜索完成: 找到${filtered.length}个结果`);
    return filtered;
  }

  /**
   * 搜索海运类别
   */
  private async searchMarineCategory(entityLower: string): Promise<EmissionFactor[]> {
    let results: EmissionFactor[] = [];
    
    console.log(`🚢 搜索海运类别: "${entityLower}"`);
    
    // 优先级1：按船舶类型搜索
    if (entityLower.includes('cargo ship')) {
      results = await dbManager.findFuzzyMatch('cargo ship', 30);
    } else if (entityLower.includes('ferry')) {
      results = await dbManager.findFuzzyMatch('ferry', 30);
    }
    // 优先级2：一般海运搜索
    else {
      results = await dbManager.findFuzzyMatch('ship', 30);
    }
    
    // 过滤海运相关
    const filtered = results.filter(r => 
      r.sector.toLowerCase().includes('transport') ||
      r.title.toLowerCase().includes('ship') ||
      r.title.toLowerCase().includes('vessel') ||
      r.title.toLowerCase().includes('marine') ||
      r.title.toLowerCase().includes('ferry')
    );
    
    console.log(`海运搜索完成: 找到${filtered.length}个结果`);
    return filtered;
  }

  /**
   * 搜索卡车类别 - 智能组合搜索
   */
  private async searchTruckCategory(entityLower: string): Promise<EmissionFactor[]> {
    let results: EmissionFactor[] = [];
    
    console.log(`🚛 搜索卡车类别: "${entityLower}"`);
    
    // 优先级1：检查是否有容器运输和刚性卡车的组合
    if (entityLower.includes('rigid') && entityLower.includes('container')) {
      console.log('检测到刚性卡车+容器运输组合，优先搜索...');
      results = await dbManager.findFuzzyMatch('rigid truck container', 30);
      
      if (results.length === 0) {
        results = await dbManager.findFuzzyMatch('rigid truck', 30);
      }
    }
    // 优先级2：一般刚性卡车搜索
    else if (entityLower.includes('rigid')) {
      results = await dbManager.findFuzzyMatch('rigid truck', 30);
      if (results.length === 0) {
        results = await dbManager.findByHierarchy({ sector: 'Transport', activity: 'rigid', limit: 30 });
      }
    }
    // 优先级3：一般卡车搜索
    else {
      results = await dbManager.findFuzzyMatch('truck', 30);
    }
    
    // 特殊过滤：如果提到了容器运输，优先返回容器相关的结果
    if (entityLower.includes('container')) {
      const containerResults = results.filter(r => 
        r.title.toLowerCase().includes('container')
      );
      
      if (containerResults.length > 0) {
        console.log(`找到${containerResults.length}个容器运输专用结果`);
        results = containerResults;
      }
    }
    
    // 过滤运输相关
    const filtered = results.filter(r => 
      r.sector.toLowerCase().includes('transport') ||
      r.title.toLowerCase().includes('truck') ||
      r.title.toLowerCase().includes('vehicle')
    );
    
    console.log(`卡车搜索完成: 找到${filtered.length}个结果`);
    return filtered;
  }

  /**
   * 搜索HGV类别
   */
  private async searchHGVCategory(entityLower: string): Promise<EmissionFactor[]> {
    let results = await dbManager.findFuzzyMatch('hgv', 30);
    
    if (results.length === 0) {
      results = await dbManager.findFuzzyMatch('heavy goods vehicle', 30);
    }
    
    // 特殊处理冷藏车辆
    if (entityLower.includes('refrigerat')) {
      results = results.filter(r => r.title.toLowerCase().includes('refrigerat'));
      
      // 进一步按载重状态筛选
      if (entityLower.includes('half') || entityLower.includes('50%')) {
        const halfLoadedResults = results.filter(r => 
          r.title.toLowerCase().includes('50%') || 
          r.title.toLowerCase().includes('half')
        );
        if (halfLoadedResults.length > 0) {
          results = halfLoadedResults;
        }
      } else if (entityLower.includes('fully') || entityLower.includes('100%')) {
        const fullLoadedResults = results.filter(r => 
          r.title.toLowerCase().includes('100%') || 
          r.title.toLowerCase().includes('full')
        );
        if (fullLoadedResults.length > 0) {
          results = fullLoadedResults;
        }
      } else if (entityLower.includes('empty') || entityLower.includes('0%')) {
        const emptyResults = results.filter(r => 
          r.title.toLowerCase().includes('0%') || 
          r.title.toLowerCase().includes('empty')
        );
        if (emptyResults.length > 0) {
          results = emptyResults;
        }
      }
    }
    
    return results;
  }

  /**
   * 搜索废料处理类别
   */
  private async searchWasteCategory(entityLower: string): Promise<EmissionFactor[]> {
    let results = await dbManager.findFuzzyMatch('waste', 30);
    
    // 按废料类型筛选
    if (entityLower.includes('concrete')) {
      results = results.filter(r => r.title.toLowerCase().includes('concrete'));
    } else if (entityLower.includes('plastic')) {
      results = results.filter(r => r.title.toLowerCase().includes('plastic'));
    }
    
    // 按处理方式筛选 - 优先closed-loop recycling
    if (entityLower.includes('closed-loop') || 
        (entityLower.includes('fully') && entityLower.includes('recycl')) ||
        (entityLower.includes('recycled') && entityLower.includes('into') && entityLower.includes('new'))) {
      // 高优先级：closed-loop recycling
      const closedLoopResults = results.filter(r => 
        r.title.toLowerCase().includes('closed-loop') ||
        r.title.toLowerCase().includes('recycl')
      );
      if (closedLoopResults.length > 0) {
        return closedLoopResults;
      }
    } else if (entityLower.includes('recycl')) {
      // 一般回收
      results = results.filter(r => 
        r.title.toLowerCase().includes('recycl') ||
        r.title.toLowerCase().includes('closed-loop')
      );
    } else if (entityLower.includes('disposal')) {
      // 一般处理
      results = results.filter(r => 
        r.title.toLowerCase().includes('disposal') &&
        !r.title.toLowerCase().includes('recycl')
      );
    }
    
    return results;
  }

  /**
   * 搜索运输类别
   */
  private async searchTransportCategory(entityLower: string): Promise<EmissionFactor[]> {
    return await dbManager.findByHierarchy({ sector: 'Transport', limit: 50 });
  }

  /**
   * 搜索电动设备类别
   */
  private async searchElectricCategory(entityLower: string): Promise<EmissionFactor[]> {
    let results = await dbManager.findFuzzyMatch('electric', 30);
    
    if (entityLower.includes('tesla') || entityLower.includes('model')) {
      const teslaResults = await dbManager.findFuzzyMatch('tesla', 10);
      results = [...results, ...teslaResults];
    }
    
    return results;
  }

  /**
   * 语义搜索 - 使用 AI 理解和映射
   */
  private async semanticSearch(entityName: string, language: 'zh' | 'en'): Promise<RAGResult[]> {
    try {
      // 第一步：AI 分析实体并生成搜索策略
      const searchStrategy = await this.generateSearchStrategy(entityName, language);
      
      // 第二步：基于策略进行层次搜索
      const candidates = await this.hierarchicalSearch(searchStrategy);
      
      // 第三步：AI 评估相关性并排序
      const scoredResults = await this.scoreAndRankResults(entityName, candidates, language);
      
      return scoredResults.slice(0, 10); // 返回 Top 10
    } catch (error) {
      console.error('语义搜索失败:', error);
      return [];
    }
  }

  /**
   * 生成搜索策略
   */
  private async generateSearchStrategy(entityName: string, language: 'zh' | 'en'): Promise<{
    sectors: string[];
    keywords: string[];
    relatedTerms: string[];
  }> {
    const prompt = `
你是一个专业的碳排放数据库搜索专家。用户输入了一个实体："${entityName}"，你需要分析这个实体并生成搜索策略。

## 碳排放数据库结构
数据库包含三层结构：
1. Sector（行业层）：Transportation, Energy, Food & Agriculture, Materials and Manufacturing 等
2. Subsector（子行业层）：具体的子分类
3. Activity（活动层）：具体的物品或活动

## 重要映射关系示例
- 特斯拉/Tesla Model Y/电动汽车 → Transportation → Electric/Battery → Electric vehicle/Battery electric vehicle/EV
- 柴油卡车/diesel truck/货车 → Transportation → Road transport/Freight → Diesel truck/Heavy duty vehicle/Freight transport
- 刚性柴油卡车/rigid diesel truck → Transportation → Road transport → Diesel truck/Rigid truck/Heavy goods vehicle
- 集装箱运输/container transport → Transportation → Freight → Container shipping/Freight transport
- 苹果 → Food & Agriculture → Fruits → Apple
- 咖啡 → Food & Agriculture → Beverages → Coffee
- 用电 → Energy → Electricity → Electricity consumption

## 特别注意
对于交通运输类实体，重点关注：
- Transportation 行业
- Road transport, Freight, Shipping 等子行业
- Diesel, Electric, Battery, Vehicle, Truck, Car 等关键词

## 任务
分析实体"${entityName}"，生成全面的搜索策略：

1. 识别最可能的 Sector（优先Transportation如果是交通工具）
2. 生成核心搜索关键词（包括英文和中文）
3. 提供同义词和相关术语（要全面）

严格按照以下JSON格式输出：
{
  "sectors": ["Transportation", "其他可能行业"],
  "keywords": ["核心关键词1", "核心关键词2", "核心关键词3"],
  "relatedTerms": ["同义词1", "同义词2", "相关术语1", "相关术语2", "相关术语3"]
}

请分析并输出JSON格式的搜索策略：`;

    try {
      const response = await this.callGemini(prompt);
      const jsonMatch = response.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      console.error('生成搜索策略失败:', error);
    }

    // 默认策略 - 基于常见模式的智能推断
    const lowerName = entityName.toLowerCase();
    let defaultStrategy = {
      sectors: [] as string[],
      keywords: [entityName],
      relatedTerms: [] as string[]
    };

    // 交通运输相关 - 更详细的关键词映射
    if (lowerName.includes('truck') || lowerName.includes('car') || lowerName.includes('vehicle') || 
        lowerName.includes('transport') || lowerName.includes('diesel') || lowerName.includes('electric') ||
        lowerName.includes('tesla') || lowerName.includes('model') || lowerName.includes('卡车') || 
        lowerName.includes('汽车') || lowerName.includes('运输') || lowerName.includes('rigid') ||
        lowerName.includes('shipping') || lowerName.includes('container') || lowerName.includes('freight')) {
      
      // 特殊映射
      const keywords = [entityName];
      const relatedTerms = [];
      
      // 卡车相关 - 更精确的关键词映射
      if (lowerName.includes('truck') || lowerName.includes('diesel') || lowerName.includes('rigid')) {
        keywords.push('truck', 'diesel', 'vehicle', 'heavy', 'freight', 'rigid', 'lorry', 'HGV', 'rigids', 'hgv');
        relatedTerms.push('diesel truck', 'heavy goods vehicle', 'freight transport', 'road freight', 
                         'truck transport', 'diesel vehicle', 'commercial vehicle', 'cargo truck',
                         'diesel rigids', 'rigids HGV', 'HGV diesel', 'all rigids', 'rigid truck',
                         'heavy duty', 'freight truck', 'HGV all diesel', 'road freight diesel');
      }
      
      // 特斯拉/电动车相关
      if (lowerName.includes('tesla') || lowerName.includes('model') || lowerName.includes('electric')) {
        keywords.push('electric', 'battery', 'EV', 'tesla', 'model', 'vehicle');
        relatedTerms.push('electric vehicle', 'battery electric vehicle', 'EV', 'electric car',
                         'battery electric', 'zero emission', 'BEV', 'plug-in');
      }
      
      // 运输/集装箱相关
      if (lowerName.includes('transport') || lowerName.includes('shipping') || lowerName.includes('container')) {
        keywords.push('transport', 'shipping', 'container', 'freight', 'cargo');
        relatedTerms.push('container transport', 'freight transport', 'cargo transport', 
                         'shipping container', 'logistics', 'goods transport');
      }
      
      defaultStrategy = {
        sectors: ['Transportation'],
        keywords,
        relatedTerms
      };
    }
    
    // 食物相关
    else if (lowerName.includes('food') || lowerName.includes('eat') || lowerName.includes('fruit') ||
             lowerName.includes('apple') || lowerName.includes('banana') || lowerName.includes('吃') ||
             lowerName.includes('食物') || lowerName.includes('苹果') || lowerName.includes('香蕉')) {
      defaultStrategy = {
        sectors: ['Food & Agriculture'],
        keywords: [entityName, 'food', 'agriculture', 'fruit'],
        relatedTerms: ['organic', 'local', 'imported', 'fresh', 'processed']
      };
    }
    
    // 能源相关
    else if (lowerName.includes('energy') || lowerName.includes('electricity') || lowerName.includes('power') ||
             lowerName.includes('electric') || lowerName.includes('用电') || lowerName.includes('电力')) {
      defaultStrategy = {
        sectors: ['Energy'],
        keywords: [entityName, 'electricity', 'energy', 'power'],
        relatedTerms: ['renewable', 'grid', 'consumption', 'generation']
      };
    }

    return defaultStrategy;
  }

  /**
   * 层次搜索
   */
  private async hierarchicalSearch(strategy: {
    sectors: string[];
    keywords: string[];
    relatedTerms: string[];
  }): Promise<EmissionFactor[]> {
    const allResults: EmissionFactor[] = [];
    const searchTerms = [...strategy.keywords, ...strategy.relatedTerms];

    // 按行业搜索
    for (const sector of strategy.sectors) {
      try {
        const sectorResults = await dbManager.findByHierarchy({ sector, limit: 20 });
        console.log(`Sector search for "${sector}": found ${sectorResults.length} results`);
        allResults.push(...sectorResults);
      } catch (error) {
        console.error(`Sector search failed for "${sector}":`, error);
      }
    }

    // 按关键词搜索
    for (const term of searchTerms) {
      try {
        const termResults = await dbManager.findFuzzyMatch(term, 15);
        console.log(`Keyword search for "${term}": found ${termResults.length} results`);
        allResults.push(...termResults);
      } catch (error) {
        console.error(`Keyword search failed for "${term}":`, error);
      }
    }

    // 如果还是没有结果，尝试更宽泛的搜索
    if (allResults.length === 0) {
      console.log('No results found, trying broader search...');
      try {
        // 先尝试搜索所有Transportation相关的
        const broadResults = await dbManager.findByHierarchy({ sector: 'Transportation', limit: 50 });
        console.log(`Broad Transportation search: found ${broadResults.length} results`);
        allResults.push(...broadResults);
        
        // 如果Transportation没有结果，尝试其他可能的sector
        if (broadResults.length === 0) {
          const materialResults = await dbManager.findByHierarchy({ sector: 'Materials and Manufacturing', limit: 30 });
          console.log(`Materials search: found ${materialResults.length} results`);
          allResults.push(...materialResults);
          
          const energyResults = await dbManager.findByHierarchy({ sector: 'Energy', limit: 30 });
          console.log(`Energy search: found ${energyResults.length} results`);
          allResults.push(...energyResults);
        }
      } catch (error) {
        console.error('Broad search failed:', error);
      }
    }

    // 去重
    const uniqueResults = _.uniqBy(allResults, 'id');
    return uniqueResults;
  }

  /**
   * 评估相关性并排序
   */
  private async scoreAndRankResults(
    originalEntity: string,
    candidates: EmissionFactor[],
    language: 'zh' | 'en'
  ): Promise<RAGResult[]> {
    if (candidates.length === 0) return [];

    console.log(`Scoring ${candidates.length} candidates for entity: ${originalEntity}`);

    // 使用简单的基于关键词的评分，避免AI解析失败
    const results: RAGResult[] = candidates.map(activity => {
      let score = 0.3; // 基础分数
      const entityLower = originalEntity.toLowerCase();
      const titleLower = (activity.title || '').toLowerCase();
      const sectorLower = (activity.sector || '').toLowerCase();
      const subsectorLower = (activity.subsector || '').toLowerCase();
      
      console.log(`评分候选项: "${activity.title}" (因子: ${activity.factor} ${activity.unit})`);

      // 首先检查范围匹配 - 这是最高优先级
      const userValues = this.extractNumericValues(entityLower);
      let rangeMatchScore = 0;
      
      if (userValues.length > 0) {
        for (const userValue of userValues) {
          // 使用新的范围匹配逻辑
         const checkScore = this.calculateAdvancedRangeMatch(userValue.value, userValue.unit, activity);
          if (checkScore > rangeMatchScore) {
            rangeMatchScore = checkScore;
          }
        }
        
        if (rangeMatchScore > 0) {
          score = rangeMatchScore; // 范围匹配优先级最高
          console.log(`🎯 范围匹配评分: ${rangeMatchScore.toFixed(3)} for "${activity.title}"`);
        }
      }

      // 如果没有范围匹配，使用关键词匹配评分
      if (rangeMatchScore === 0) {
        // 关键词匹配评分 - 更精确的匹配逻辑
        if (titleLower.includes(entityLower)) {
          score = 0.9; // 包含原始实体名称
        } else {
        // 特殊匹配逻辑：冷藏重型货运车辆
        if ((entityLower.includes('refrigerated') || entityLower.includes('refrigerat')) && 
            (entityLower.includes('heavy') && entityLower.includes('goods') || entityLower.includes('hgv'))) {
          
          if (titleLower.includes('hgv') && titleLower.includes('refrigerat')) {
            // 首先检查是否有明确的载重状态匹配
            let hasExactLoadMatch = false;
            
            // 50%载重匹配 (half-loaded, 50% laden)
            if (entityLower.includes('half') || entityLower.includes('50%') || 
                entityLower.includes('laden') || entityLower.includes('loaded')) {
              if (titleLower.includes('50%') && titleLower.includes('laden')) {
                score = 1.0; // 完美匹配：HGV refrigerated 50% Laden
                hasExactLoadMatch = true;
                console.log(`🎯 完美匹配50%载重: "${activity.title}"`);
              }
            }
            // 100%载重匹配
            else if (entityLower.includes('fully') || entityLower.includes('100%') || 
                     entityLower.includes('full')) {
              if (titleLower.includes('100%') && titleLower.includes('laden')) {
                score = 1.0; // 完美匹配：HGV refrigerated 100% Laden
                hasExactLoadMatch = true;
                console.log(`🎯 完美匹配100%载重: "${activity.title}"`);
              }
            }
            // 0%载重匹配
            else if (entityLower.includes('empty') || entityLower.includes('0%')) {
              if (titleLower.includes('0%') && titleLower.includes('laden')) {
                score = 1.0; // 完美匹配：HGV refrigerated 0% Laden
                hasExactLoadMatch = true;
                console.log(`🎯 完美匹配0%载重: "${activity.title}"`);
              }
            }
            
            // 如果没有精确载重匹配，给一般HGV更低的分数
            if (!hasExactLoadMatch) {
              if (titleLower.includes('50%') || titleLower.includes('100%') || titleLower.includes('0%')) {
                score = 0.75; // 有载重状态但不匹配用户需求
                console.log(`⚠️ 载重状态不匹配: "${activity.title}"`);
              } else {
                score = 0.85; // 一般HGV refrigerated（无明确载重状态）
                console.log(`📊 一般HGV匹配: "${activity.title}"`);
              }
            }
            
            // 额外的车辆类型匹配
            if (titleLower.includes('delivery') && entityLower.includes('deliver')) {
              score += 0.02;
            }
            
            score = Math.min(1.0, score);
          } else if (titleLower.includes('refrigerat') || titleLower.includes('hgv')) {
            score = 0.70; // 部分匹配
          }
        }
        
        // 特殊匹配逻辑：废料回收
        else if (entityLower.includes('waste') && (entityLower.includes('recycl') || entityLower.includes('recycle'))) {
          if (titleLower.includes('waste') && (titleLower.includes('recycl') || titleLower.includes('closed-loop'))) {
            // 基础回收匹配
            score = 0.85;
            
            // 检查具体废料类型
            if (entityLower.includes('concrete') && titleLower.includes('concrete')) {
              score = 0.92; // 具体材料匹配
            }
            
            // 检查回收类型 - closed-loop 优先级最高
            if (titleLower.includes('closed-loop')) {
              score += 0.06; // closed-loop额外加分
              if (entityLower.includes('fully') || entityLower.includes('specialized') || 
                  (entityLower.includes('recycled') && entityLower.includes('into') && entityLower.includes('new'))) {
                score += 0.03; // 完全回收的额外加分
              }
            }
            
            score = Math.min(1.0, score); // 确保不超过1.0
          } else if (titleLower.includes('waste')) {
            score = 0.7; // 一般废料匹配
          }
        }
        
        // 检查关键词匹配 - 更精确的卡车匹配（但只在没有范围匹配时使用）
        else if (entityLower.includes('truck') || entityLower.includes('diesel') || entityLower.includes('rigid')) {
          // 刚性卡车的基础匹配逻辑
          if (titleLower.includes('diesel') && titleLower.includes('rigid')) {
            score = 0.85;
          } else if (titleLower.includes('hgv') && titleLower.includes('diesel')) {
            score = 0.9;
          } else if (titleLower.includes('rigid') && titleLower.includes('truck')) {
            score = 0.8;
          } else if (titleLower.includes('road') && titleLower.includes('freight') && titleLower.includes('diesel')) {
            score = 0.82;
          } else {
            const truckKeywords = ['truck', 'vehicle', 'diesel', 'rigid', 'heavy', 'freight', 'lorry', 'hgv', 'rigids'];
            if (truckKeywords.some(keyword => titleLower.includes(keyword))) {
              score = 0.75;
            }
          }
        }

        // 运输相关匹配
        else if (entityLower.includes('transport') || entityLower.includes('shipping') || entityLower.includes('container')) {
          const transportKeywords = ['transport', 'shipping', 'freight', 'cargo', 'logistics'];
          if (transportKeywords.some(keyword => titleLower.includes(keyword))) {
            score = Math.max(score, 0.7);
          }
        }

        // 电动车匹配
        else if (entityLower.includes('tesla') || entityLower.includes('model') || entityLower.includes('electric')) {
          const electricKeywords = ['electric', 'battery', 'ev', 'tesla', 'model'];
          if (electricKeywords.some(keyword => titleLower.includes(keyword))) {
            score = 0.8;
          }
        }

        // 行业匹配加分
        if (sectorLower.includes('transport')) {
          score += 0.05;
        }

        // 集装箱运输匹配
        if (entityLower.includes('container') || entityLower.includes('shipping')) {
          if (titleLower.includes('container') || subsectorLower.includes('container')) {
            score = Math.max(score, 0.85);
          }
        }
        } // 关闭 if (rangeMatchScore === 0) 代码块
      }

      console.log(`最终评分: "${activity.title}" -> ${score} (因子: ${activity.factor}${activity.unit}, 分类: ${activity.sector})`);

      return {
        activity,
        relevanceScore: Math.min(1.0, score),
        matchType: 'semantic' as const,
        path: {
          sector: activity.sector,
          subsector: activity.subsector,
          activity: activity.title
        }
      };
    });

    // 按相关性评分排序，取前10个
    const sortedResults = results.sort((a, b) => b.relevanceScore - a.relevanceScore).slice(0, 10);
    console.log(`Top result: "${sortedResults[0]?.activity.title}" with score ${sortedResults[0]?.relevanceScore}`);
    
    return sortedResults;
  }

  /**
   * 智能范围匹配评分系统
   */
  private calculateRangeMatchScore(userInput: string, activity: EmissionFactor): number {
    const inputLower = userInput.toLowerCase();
    const titleLower = activity.title.toLowerCase();
    
    // 提取用户输入中的数值
    const userValues = this.extractNumericValues(inputLower);
    console.log(`用户输入数值: ${JSON.stringify(userValues)} 来自 "${userInput}"`);
    
    // 提取数据库条目中的范围
    const dbRanges = this.extractRanges(titleLower);
    console.log(`数据库范围: ${JSON.stringify(dbRanges)} 来自 "${activity.title}"`);
    
    let bestScore = 0;
    
    // 检查每个用户数值是否落在数据库范围内
    for (const userValue of userValues) {
      for (const range of dbRanges) {
        const matchScore = this.checkOldRangeMatch(userValue, range, inputLower, titleLower);
        if (matchScore > bestScore) {
          bestScore = matchScore;
          console.log(`范围匹配: ${userValue.value}${userValue.unit} 在 ${range.min}-${range.max}${range.unit} 中，评分: ${matchScore}`);
        }
      }
    }
    
    return bestScore;
  }

  /**
   * 从文本中提取数值和单位
   */
  private extractNumericValues(text: string): Array<{value: number, unit: string, type: string}> {
    const values: Array<{value: number, unit: string, type: string}> = [];
    
    // 排除数据库字段中的百分比标识符，避免误识别
    // 例如："50% Laden", "100% Laden"等是载重状态，不是用户输入的数量
    const excludePatterns = [
      /\d+%\s*laden/gi,     // "50% Laden" 
      /\d+%\s*loaded/gi,    // "50% Loaded"
      /\d+%\s*load/gi,      // "50% Load"
      /all\s*hgvs/gi,       // "All HGVs"
      /\d+-\d+\s*t\b/gi     // "26-32t" (范围，不是具体重量)
    ];
    
    // 检查是否包含应该排除的模式
    let filteredText = text;
    for (const excludePattern of excludePatterns) {
      if (excludePattern.test(text)) {
        console.log(`🚫 排除数据库字段模式: ${text.match(excludePattern)?.[0]}`);
        filteredText = text.replace(excludePattern, ''); // 移除这些模式
      }
    }
    
    // 匹配各种数值+单位模式
    const patterns = [
      // 重量: 30吨, 30-ton, 30t - 修复中文单位识别
      {regex: /(\d+(?:\.\d+)?)[- ]?(?:ton|tonne|t|吨|公吨)(?:s?)\b/g, type: 'weight', unit: 't'},
      // 距离: 75km, 75公里, 75 kilometers - 修复中文单位识别
      {regex: /(\d+(?:\.\d+)?)[- ]?(?:km|kilometers?|公里|千米)/g, type: 'distance', unit: 'km'},
      // 功率: 100kW, 100千瓦
      {regex: /(\d+(?:\.\d+)?)[- ]?(?:kw|kva|kilowatt|千瓦)/gi, type: 'power', unit: 'kW'},
      // 容量: 20m3, 20立方米
      {regex: /(\d+(?:\.\d+)?)[- ]?(?:m3|cubic|立方米|立方)/gi, type: 'volume', unit: 'm3'},
      // 年份: 2020年, 2020-model
      {regex: /(\d{4})[- ]?(?:年|year|model)?/g, type: 'year', unit: 'year'}
    ];
    
    for (const pattern of patterns) {
      let match;
      pattern.regex.lastIndex = 0; // 重置regex
      while ((match = pattern.regex.exec(filteredText)) !== null) {
        const value = parseFloat(match[1]);
        console.log(`✅ 提取数值: ${value} ${pattern.unit} (${pattern.type}) 从 "${match[0]}"`);
        values.push({
          value: value,
          unit: pattern.unit,
          type: pattern.type
        });
      }
    }
    
    return values;
  }

  /**
   * 从文本中提取范围
   */
  private extractRanges(text: string): Array<{min: number, max: number, unit: string, type: string}> {
    const ranges: Array<{min: number, max: number, unit: string, type: string}> = [];
    
    // 匹配范围模式
    const patterns = [
      // 重量范围: 26-32t, 12-20 tonnes
      {regex: /(\d+(?:\.\d+)?)[- ]?(?:to|-)[ ]?(\d+(?:\.\d+)?)[- ]?(?:ton|tonne|t|吨)(?:s?)\b/g, type: 'weight', unit: 't'},
      // 距离范围: 50-200km
      {regex: /(\d+(?:\.\d+)?)[- ]?(?:to|-)[ ]?(\d+(?:\.\d+)?)[- ]?(?:km|kilometers?|公里)\b/g, type: 'distance', unit: 'km'},
      // 功率范围: 10-100kW
      {regex: /(\d+(?:\.\d+)?)[- ]?(?:to|-)[ ]?(\d+(?:\.\d+)?)[- ]?(?:kw|kilowatt|千瓦)\b/gi, type: 'power', unit: 'kW'},
      // 年份范围: 2015-2020
      {regex: /(\d{4})[- ]?(?:to|-)[ ]?(\d{4})\b/g, type: 'year', unit: 'year'}
    ];
    
    for (const pattern of patterns) {
      let match;
      pattern.regex.lastIndex = 0; // 重置regex
      while ((match = pattern.regex.exec(text)) !== null) {
        ranges.push({
          min: parseFloat(match[1]),
          max: parseFloat(match[2]),
          unit: pattern.unit,
          type: pattern.type
        });
      }
    }
    
    return ranges;
  }

  /**
   * 检查数值是否在范围内并计算匹配分数（旧版本，保留用于向后兼容）
   */
  private checkOldRangeMatch(
    userValue: {value: number, unit: string, type: string},
    range: {min: number, max: number, unit: string, type: string},
    inputText: string,
    titleText: string
  ): number {
    // 类型必须匹配
    if (userValue.type !== range.type) return 0;
    
    // 单位必须匹配
    if (userValue.unit !== range.unit) return 0;
    
    // 检查数值是否在范围内
    if (userValue.value >= range.min && userValue.value <= range.max) {
      let score = 0.95; // 基础范围匹配分数
      
      // 额外的关键词匹配加分
      if (userValue.type === 'weight') {
        if (inputText.includes('rigid') && titleText.includes('rigid')) score += 0.03;
        if (inputText.includes('diesel') && titleText.includes('diesel')) score += 0.02;
        if (inputText.includes('container') && titleText.includes('container')) score += 0.02;
        if (titleText.includes('average') || titleText.includes('mixed')) score += 0.01;
      }
      
      return Math.min(1.0, score);
    }
    
    return 0;
  }

  /**
   * 批量搜索多个实体
   */
  async batchSearchActivities(entities: QueryEntity[], language: 'zh' | 'en' = 'zh'): Promise<Map<string, RAGResult[]>> {
    const results = new Map<string, RAGResult[]>();
    
    // 并行搜索所有实体
    const searchPromises = entities.map(async (entity) => {
      const entityResults = await this.searchActivities(entity, language);
      return { entityName: entity.name, results: entityResults };
    });

    const searchResults = await Promise.allSettled(searchPromises);
    
    searchResults.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        results.set(result.value.entityName, result.value.results);
      } else {
        console.error(`搜索实体 "${entities[index].name}" 失败:`, result.reason);
        results.set(entities[index].name, []);
      }
    });

    return results;
  }

  /**
   * 获取相似活动推荐
   */
  async getSimilarActivities(activity: EmissionFactor, limit: number = 5): Promise<RAGResult[]> {
    try {
      // 基于同一子行业搜索相似活动
      const similarActivities = await dbManager.findByHierarchy({
        sector: activity.sector,
        subsector: activity.subsector,
        limit: Math.floor(limit) + 1 // +1 因为会包含原活动
      });

      // 过滤掉原活动
      const filtered = similarActivities.filter(a => a.id !== activity.id);

      return filtered.slice(0, Math.floor(limit)).map(a => ({
        activity: a,
        relevanceScore: 0.7,
        matchType: 'fuzzy' as const,
        path: {
          sector: a.sector,
          subsector: a.subsector,
          activity: a.title
        }
      }));
    } catch (error) {
      console.error('获取相似活动失败:', error);
      return [];
    }
  }

  /**
   * 调用 Gemini API
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
   * 清空缓存
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * 获取缓存统计
   */
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }
}

// 创建全局 RAG 引擎实例
export const ragEngine = new RAGEngine();