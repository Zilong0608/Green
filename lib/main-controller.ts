/**
 * 主控制器 - 整合所有模块的核心接口
 * 
 * 功能：
 * - 协调 Intent Detection、RAG、Reasoning 三大模块
 * - 提供统一的 API 接口
 * - 错误处理和性能监控
 * - 会话状态管理
 */

import { intentEngine } from './intent-detection';
import { ragEngine } from './rag';
import { reasoningEngine } from './reasoning';
import { dbManager } from './database';
import { SystemResponse, ModuleStatus } from '@/types';

export class MainController {
  private moduleStatus: ModuleStatus = {
    intentDetection: 'idle',
    rag: 'idle',
    reasoning: 'idle',
    errors: []
  };

  /**
   * 主要处理接口 - 处理用户输入并返回完整响应
   */
  async processUserQuery(
    userQuery: string,
    language: 'zh' | 'en' = 'zh'
  ): Promise<SystemResponse> {
    const startTime = Date.now();
    console.log(`开始处理用户查询: "${userQuery}"`);

    try {
      // 重置模块状态
      this.resetModuleStatus();

      // 步骤0: 优先用原始查询直接搜索数据库
      console.log('步骤0: 原始查询直接搜索数据库...');
      
      // 增强的数量提取（提取重量和距离）
      let extractedQuantity = null;
      let extractedUnit = null;
      let extractedWeight = null;
      let extractedDistance = null;
      
      // 提取重量信息
      const weightMatch = userQuery.match(/(\d+(?:\.\d+)?)\s*(ton|tons|tonne|tonnes|kg)/i);
      if (weightMatch) {
        extractedWeight = parseFloat(weightMatch[1]);
        const weightUnit = weightMatch[2].toLowerCase();
        console.log(`📊 提取重量信息: ${extractedWeight} ${weightUnit}`);
        // 主要数量使用重量
        extractedQuantity = extractedWeight;
        extractedUnit = weightUnit;
      }
      
      // 提取距离信息
      const distanceMatch = userQuery.match(/(\d+(?:\.\d+)?)\s*(km|kilometers|kilometres|miles)/i);
      if (distanceMatch) {
        extractedDistance = parseFloat(distanceMatch[1]);
        const distanceUnit = distanceMatch[2].toLowerCase();
        console.log(`📊 提取距离信息: ${extractedDistance} ${distanceUnit}`);
        // 如果没有重量，使用距离作为主要数量
        if (!extractedWeight) {
          extractedQuantity = extractedDistance;
          extractedUnit = distanceUnit;
        }
      }
      
      const originalEntity = {
        name: userQuery,
        quantity: extractedQuantity ?? undefined,
        unit: extractedUnit ?? undefined,
        confidence: 1.0,
        originalText: userQuery,
        entityType: 'transport' as const,  // 默认为transport类型，确保推理引擎正确处理
        scenarioDetails: {
          distance: extractedDistance ?? undefined,
          distanceUnit: distanceMatch?.[2]?.toLowerCase(),
          weight: extractedWeight ?? undefined,
          weightUnit: weightMatch?.[2]?.toLowerCase()
        }
      };
      
      const directSearchResults = await ragEngine.searchActivities(originalEntity, language);
      
      if (directSearchResults.length > 0) {
        console.log(`✅ 原始查询直接命中: 找到${directSearchResults.length}个结果，跳过AI分析`);
        
        // 构造简化的意图结果，直接使用原始查询结果
        const directIntentResult = {
          intent: 'carbon_calculation' as const,
          entities: [originalEntity],
          missingInfo: [],
          confidence: 1.0,
          originalQuery: userQuery
        };
        
        const directRagResults = new Map();
        directRagResults.set(originalEntity.name, directSearchResults);
        
        // 直接进入推理计算
        console.log('步骤3: 推理和计算 (使用直接搜索结果)...');
        this.moduleStatus.reasoning = 'processing';
        
        const finalResponse = await reasoningEngine.processUserRequest(
          directIntentResult,
          directRagResults,
          language
        );
        
        this.moduleStatus.reasoning = 'completed';
        console.log(`推理完成: 总排放量=${finalResponse.totalEmission}kg CO2`);

        const processingTime = Date.now() - startTime;
        console.log(`查询处理完成，总耗时: ${processingTime}ms`);

        return {
          ...finalResponse,
          processingTime
        };
      }

      console.log('❌ 原始查询未找到结果，进入AI智能分析...');

      // 步骤1: 意图识别和实体提取
      console.log('步骤1: 意图识别和实体提取...');
      this.moduleStatus.intentDetection = 'processing';
      
      const intentResult = await intentEngine.analyzeUserInput(userQuery, language);
      
      this.moduleStatus.intentDetection = 'completed';
      console.log(`意图识别完成: 意图=${intentResult.intent}, 实体数量=${intentResult.entities.length}`);

      // 如果是普通对话或没有实体，直接返回
      if (intentResult.intent === 'general_chat' || intentResult.entities.length === 0) {
        this.moduleStatus.reasoning = 'processing';
        const response = await reasoningEngine.processUserRequest(
          intentResult,
          new Map(),
          language
        );
        this.moduleStatus.reasoning = 'completed';
        return response;
      }

      // 步骤2: RAG 搜索相关活动 (使用AI处理后的实体)
      console.log('步骤2: RAG 搜索相关活动 (AI处理后实体)...');
      this.moduleStatus.rag = 'processing';
      
      const ragResults = await ragEngine.batchSearchActivities(intentResult.entities, language);
      
      this.moduleStatus.rag = 'completed';
      console.log(`RAG 搜索完成: 找到 ${ragResults.size} 个实体的搜索结果`);

      // 步骤3: 推理和计算
      console.log('步骤3: 推理和计算...');
      this.moduleStatus.reasoning = 'processing';
      
      const finalResponse = await reasoningEngine.processUserRequest(
        intentResult,
        ragResults,
        language
      );
      
      this.moduleStatus.reasoning = 'completed';
      console.log(`推理完成: 总排放量=${finalResponse.totalEmission}kg CO2`);

      const processingTime = Date.now() - startTime;
      console.log(`查询处理完成，总耗时: ${processingTime}ms`);

      return {
        ...finalResponse,
        processingTime
      };

    } catch (error) {
      console.error('处理用户查询失败:', error);
      
      // 更新错误状态
      this.moduleStatus.errors.push({
        code: 'PROCESSING_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
        details: error,
        timestamp: new Date()
      });

      return {
        success: false,
        message: language === 'zh' 
          ? '系统处理出错，请稍后重试或联系技术支持'
          : 'System error occurred, please try again later or contact support',
        results: [],
        totalEmission: 0,
        suggestions: [
          language === 'zh' ? '请重新描述您的问题' : 'Please rephrase your question'
        ],
        language,
        processingTime: Date.now() - startTime
      };
    }
  }

  /**
   * 批量处理多个查询
   */
  async processBatchQueries(
    queries: string[],
    language: 'zh' | 'en' = 'zh'
  ): Promise<SystemResponse[]> {
    console.log(`开始批量处理 ${queries.length} 个查询`);
    
    const results = await Promise.allSettled(
      queries.map(query => this.processUserQuery(query, language))
    );

    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        console.error(`批量处理第${index}个查询失败:`, result.reason);
        return {
          success: false,
          message: language === 'zh' ? '查询处理失败' : 'Query processing failed',
          results: [],
          totalEmission: 0,
          suggestions: [],
          language,
          processingTime: 0
        };
      }
    });
  }

  /**
   * 获取系统健康状态
   */
  async getSystemHealth(): Promise<{
    database: boolean;
    modules: ModuleStatus;
    performance: {
      cacheStats: any;
      dbStats: any;
    };
  }> {
    try {
      // 检查数据库连接
      const dbHealthy = dbManager.isConnectionHealthy();
      
      // 获取数据库统计信息
      const dbStats = dbHealthy ? await dbManager.getDatabaseStats() : null;
      
      // 获取缓存统计信息
      const cacheStats = ragEngine.getCacheStats();

      return {
        database: dbHealthy,
        modules: this.moduleStatus,
        performance: {
          cacheStats,
          dbStats
        }
      };
    } catch (error) {
      console.error('获取系统健康状态失败:', error);
      return {
        database: false,
        modules: this.moduleStatus,
        performance: {
          cacheStats: null,
          dbStats: null
        }
      };
    }
  }

  /**
   * 获取可用的数据分类
   */
  async getAvailableCategories(): Promise<{
    sectors: string[];
    sampleActivities: { [sector: string]: string[] };
  }> {
    try {
      const sectors = await dbManager.getAllSectors();
      const sampleActivities: { [sector: string]: string[] } = {};

      // 为每个 sector 获取一些示例活动
      for (const sector of sectors.slice(0, 5)) { // 限制前5个，避免过多请求
        const subsectors = await dbManager.getSubsectorsBySector(sector);
        sampleActivities[sector] = subsectors.slice(0, 3); // 每个 sector 取前3个 subsector
      }

      return {
        sectors,
        sampleActivities
      };
    } catch (error) {
      console.error('获取可用分类失败:', error);
      return {
        sectors: [],
        sampleActivities: {}
      };
    }
  }

  /**
   * 清空所有缓存
   */
  clearAllCaches(): void {
    ragEngine.clearCache();
    console.log('所有缓存已清空');
  }

  /**
   * 重置模块状态
   */
  private resetModuleStatus(): void {
    this.moduleStatus = {
      intentDetection: 'idle',
      rag: 'idle',
      reasoning: 'idle',
      errors: []
    };
  }

  /**
   * 获取模块状态
   */
  getModuleStatus(): ModuleStatus {
    return { ...this.moduleStatus };
  }

  /**
   * 优雅关闭系统
   */
  async shutdown(): Promise<void> {
    console.log('开始关闭系统...');
    
    try {
      // 清空缓存
      this.clearAllCaches();
      
      // 关闭数据库连接
      await dbManager.close();
      
      console.log('系统已安全关闭');
    } catch (error) {
      console.error('系统关闭过程中出现错误:', error);
    }
  }
}

// 创建全局主控制器实例
export const mainController = new MainController();

// 导出处理函数供测试使用
export async function handleUserQuery(query: string, language: 'zh' | 'en' = 'zh') {
  return await mainController.processUserQuery(query, language);
}

// 进程退出时的清理工作
process.on('SIGINT', async () => {
  console.log('\n收到退出信号，正在安全关闭系统...');
  await mainController.shutdown();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n收到终止信号，正在安全关闭系统...');
  await mainController.shutdown();
  process.exit(0);
});