// 核心数据类型定义

/**
 * 碳排放因子数据结构
 */
export interface EmissionFactor {
  id: string;
  title: string;
  sector: string;
  subsector?: string;
  unit: string;
  factor: number;
  source: string;
  description?: string;
}

/**
 * 用户查询实体 - 增强版
 */
export interface QueryEntity {
  name: string;          // 实体名称（如"苹果"）
  quantity?: number;     // 数量
  unit?: string;         // 单位（如"kg", "g"）
  confidence: number;    // 识别置信度 (0-1)
  originalText: string;  // 原始文本
  entityType?: 'transport' | 'waste' | 'liquid' | 'food' | 'energy';  // 实体类型
  scenarioDetails?: {    // 场景详情
    vehicleType?: string;       // 车辆类型
    cargoType?: string;         // 货物类型
    fuelType?: string;          // 燃料类型  
    distance?: number;          // 距离数值
    distanceUnit?: string;      // 距离单位
    weight?: number;            // 重量数值
    weightUnit?: string;        // 重量单位
    vehicleCount?: number;      // 车辆数量
    deviceCount?: number;       // 设备数量
    deviceType?: string;        // 设备类型
    operationTime?: number;     // 运行时间
    timeUnit?: string;          // 时间单位
    energyConsumption?: number; // 能源消耗
    energyUnit?: string;        // 能源单位
    wasteType?: string;         // 废料类型
    processingMethod?: string;  // 处理方式
    loadStatus?: string;        // 装载状态
    liquidType?: string;        // 液体类型
    weightRange?: string;       // 重量范围（用于信息查询）
  };
}

/**
 * 意图识别结果
 */
export interface IntentDetectionResult {
  intent: 'carbon_calculation' | 'information_query' | 'general_chat';
  entities: QueryEntity[];
  missingInfo: string[];  // 缺失信息列表
  confidence: number;
  originalQuery: string;
}

/**
 * RAG 搜索结果
 */
export interface RAGResult {
  activity: EmissionFactor;
  relevanceScore: number;  // 相关性评分 (0-1)
  matchType: 'exact' | 'fuzzy' | 'semantic';  // 匹配类型
  path: {
    sector: string;
    subsector?: string;
    activity: string;
  };
}

/**
 * 推理计算结果
 */
export interface CalculationResult {
  entity: QueryEntity;
  emissionFactor: EmissionFactor;
  totalEmission: number;  // 总排放量 (kg CO2)
  calculation: {
    quantity: number;
    unit: string;
    factor: number;
    formula: string;
  };
  confidence: number;
  notes?: string[];
}

/**
 * 系统最终响应
 */
export interface SystemResponse {
  success: boolean;
  message: string;
  results: CalculationResult[];
  totalEmission: number;
  suggestions: string[];
  language: 'zh' | 'en';
  processingTime: number;  // 处理时间 (ms)
}

/**
 * Neo4j 查询参数
 */
export interface Neo4jQueryParams {
  query: string;
  entity?: string;
  sector?: string;
  subsector?: string;
  limit?: number;
}

/**
 * Gemini API 请求/响应
 */
export interface GeminiRequest {
  prompt: string;
  context?: any;
  temperature?: number;
  maxTokens?: number;
}

export interface GeminiResponse {
  text: string;
  confidence?: number;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

/**
 * 系统配置
 */
export interface SystemConfig {
  neo4j: {
    uri: string;
    username: string;
    password: string;
    database: string;
  };
  gemini: {
    apiKey: string;
    model: string;
  };
  search: {
    maxResults: number;
    minConfidence: number;
    enableFuzzySearch: boolean;
  };
}

/**
 * 错误类型
 */
export interface SystemError {
  code: string;
  message: string;
  details?: any;
  timestamp: Date;
}

/**
 * 模块状态跟踪
 */
export interface ModuleStatus {
  intentDetection: 'idle' | 'processing' | 'completed' | 'error';
  rag: 'idle' | 'processing' | 'completed' | 'error';
  reasoning: 'idle' | 'processing' | 'completed' | 'error';
  errors: SystemError[];
}