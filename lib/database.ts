/**
 * Neo4j 数据库连接和查询模块
 * 
 * 功能：
 * - 建立和管理 Neo4j 数据库连接
 * - 提供图数据库查询接口
 * - 支持三层结构搜索 (Sector -> Subsector -> Activity)
 * - 连接池管理和错误处理
 */

import neo4j, { Driver, Session, QueryResult, Record, RecordShape } from 'neo4j-driver';
import { EmissionFactor, Neo4jQueryParams, SystemError } from '@/types';

export class DatabaseManager {
  private driver: Driver | null = null;
  private isConnected: boolean = false;
  private connectionPromise: Promise<void> | null = null;

  constructor() {
    this.connectionPromise = this.initializeConnection();
  }

  /**
   * 初始化数据库连接
   */
  private async initializeConnection(): Promise<void> {
    try {
      const uri = process.env.NEO4J_URI!;
      const username = process.env.NEO4J_USERNAME!;
      const password = process.env.NEO4J_PASSWORD!;

      this.driver = neo4j.driver(
        uri,
        neo4j.auth.basic(username, password),
        {
          // 连接池配置
          maxConnectionLifetime: 3 * 60 * 60 * 1000, // 3小时
          maxConnectionPoolSize: 50,
          connectionAcquisitionTimeout: 2 * 60 * 1000 // 2分钟
          // 注意：加密配置已在 URI 中指定 (neo4j+s://), 不需要在这里重复配置
        }
      );

      // 测试连接
      await this.testConnection();
      this.isConnected = true;
      console.log('Neo4j 数据库连接成功');
    } catch (error) {
      console.error('Neo4j 连接失败:', error);
      throw new Error(`数据库连接失败: ${error}`);
    }
  }

  /**
   * 测试数据库连接
   */
  private async testConnection(): Promise<void> {
    if (!this.driver) throw new Error('数据库驱动未初始化');
    
    const session = this.driver.session({ database: process.env.NEO4J_DATABASE });
    try {
      await session.run('RETURN 1 as test');
    } finally {
      await session.close();
    }
  }

  /**
   * 获取数据库会话
   */
  private async getSession(): Promise<Session> {
    // 确保连接已建立
    if (this.connectionPromise) {
      await this.connectionPromise;
    }
    
    if (!this.driver || !this.isConnected) {
      throw new Error('数据库连接未建立');
    }
    return this.driver.session({ database: process.env.NEO4J_DATABASE });
  }

  /**
   * 精确匹配查询 - 优先级最高
   * 直接匹配用户输入的实体名称
   */
  async findExactMatch(entityName: string): Promise<EmissionFactor[]> {
    const session = await this.getSession();
    try {
      console.log(`🔍 精确匹配搜索: "${entityName}"`);
      
      // 使用正确的字段名 name 进行查询
      const query = `
        MATCH (a)
        WHERE a.type = 'Activity' AND toLower(a.name) = toLower($entityName)
        RETURN a.name as title,
               a.emission_factor as factor,
               a.unit_type as unit,
               a.source as source,
               a.sector as sector,
               a.subcategory as subsector,
               elementId(a) as id
        ORDER BY a.emission_factor DESC
        LIMIT 10
      `;

      const result = await session.run(query, { entityName });
      const factors = this.parseEmissionFactors(result);
      
      if (factors.length > 0) {
        console.log(`✅ 精确匹配成功，找到${factors.length}个结果`);
      } else {
        console.log(`❌ 精确匹配未找到结果`);
      }
      
      return factors;
    } finally {
      await session.close();
    }
  }

  /**
   * 模糊搜索 - 基于文本相似度
   * 使用 CONTAINS 和 STARTS WITH 进行模糊匹配
   */
  async findFuzzyMatch(entityName: string, limit: number = 10): Promise<EmissionFactor[]> {
    limit = Math.floor(limit);
    const session = await this.getSession();
    try {
      console.log(`🔍 模糊匹配搜索: "${entityName}"`);
      
      // 使用正确的字段名 name 进行模糊搜索
      const query = `
        MATCH (a)
        WHERE a.type = 'Activity' AND toLower(a.name) CONTAINS toLower($entityName)
        RETURN a.name as title,
               a.emission_factor as factor,
               a.unit_type as unit,
               a.source as source,
               a.sector as sector,
               a.subcategory as subsector,
               elementId(a) as id,
               CASE 
                 WHEN toLower(a.name) = toLower($entityName) THEN 1.0
                 WHEN toLower(a.name) STARTS WITH toLower($entityName) THEN 0.9
                 WHEN toLower(a.name) CONTAINS toLower($entityName) THEN 0.8
                 ELSE 0.5
               END as relevance
        ORDER BY relevance DESC, a.emission_factor DESC
        LIMIT $limit
      `;

      const result = await session.run(query, { 
        entityName, 
        limit: neo4j.int(Math.floor(limit))
      });
      const factors = this.parseEmissionFactors(result);
      
      if (factors.length > 0) {
        console.log(`✅ 模糊匹配成功，找到${factors.length}个结果`);
      } else {
        console.log(`❌ 模糊匹配未找到结果`);
      }
      
      return factors;
    } finally {
      await session.close();
    }
  }

  /**
   * 按行业层次搜索
   * 支持从 Sector -> Subsector -> Activity 的层次搜索
   */
  async findByHierarchy(params: {
    sector?: string;
    subsector?: string;
    activity?: string;
    limit?: number;
  }): Promise<EmissionFactor[]> {
    // 确保 limit 是整数
    if (params.limit) {
      params.limit = Math.floor(params.limit);
    }
    const session = await this.getSession();
    try {
      let whereConditions: string[] = [];
      let queryParams: any = { limit: neo4j.int(Math.floor(params.limit || 10)) };

      if (params.sector) {
        whereConditions.push('toLower(a.sector) CONTAINS toLower($sector)');
        queryParams.sector = params.sector;
      }

      if (params.subsector) {
        whereConditions.push('toLower(a.subcategory) CONTAINS toLower($subsector)');
        queryParams.subsector = params.subsector;
      }

      if (params.activity) {
        whereConditions.push('toLower(a.name) CONTAINS toLower($activity)');
        queryParams.activity = params.activity;
      }

      const whereClause = whereConditions.length > 0 
        ? 'WHERE ' + whereConditions.join(' AND ')
        : '';

      const query = `
        MATCH (a)
        ${whereClause}
        RETURN a.name as title,
               a.emission_factor as factor,
               a.unit_type as unit,
               a.source as source,
               a.subcategory as subsector,
               a.sector as sector,
               elementId(a) as id
        ORDER BY a.sector, a.subcategory, a.name
        LIMIT $limit
      `;

      const result = await session.run(query, queryParams);
      return this.parseEmissionFactors(result);
    } finally {
      await session.close();
    }
  }

  /**
   * 获取所有可用的 Sector 列表
   */
  async getAllSectors(): Promise<string[]> {
    const session = await this.getSession();
    try {
      const query = `
        MATCH (a)
        RETURN DISTINCT a.sector as name
        ORDER BY a.sector
      `;

      const result = await session.run(query);
      return result.records.map(record => record.get('name'));
    } finally {
      await session.close();
    }
  }

  /**
   * 根据 Sector 获取 Subsector 列表
   */
  async getSubsectorsBySector(sectorName: string): Promise<string[]> {
    const session = await this.getSession();
    try {
      const query = `
        MATCH (a {sector: $sectorName})
        RETURN DISTINCT a.subcategory as name
        ORDER BY a.subcategory
      `;

      const result = await session.run(query, { sectorName });
      return result.records.map(record => record.get('name'));
    } finally {
      await session.close();
    }
  }

  /**
   * 获取数据库中的示例数据 - 用于调试
   */
  async getSampleData(limit: number = 20): Promise<{
    sectors: string[];
    activities: EmissionFactor[];
  }> {
    const session = await this.getSession();
    try {
      // 获取所有 sectors
      const sectorQuery = `
        MATCH (a)
        RETURN DISTINCT a.sector as name
        ORDER BY a.sector
        LIMIT 10
      `;
      const sectorResult = await session.run(sectorQuery);
      const sectors = sectorResult.records.map(record => record.get('name'));

      // 获取示例活动
      const activityQuery = `
        MATCH (a)
        RETURN a.name as title,
               a.emission_factor as factor,
               a.unit_type as unit,
               a.source as source,
               a.subcategory as subsector,
               a.sector as sector,
               elementId(a) as id
        ORDER BY a.sector, a.subcategory, a.name
        LIMIT $limit
      `;
      const activityResult = await session.run(activityQuery, { limit: neo4j.int(limit) });
      const activities = this.parseEmissionFactors(activityResult);

      return { sectors, activities };
    } finally {
      await session.close();
    }
  }

  /**
   * 调试函数：查看数据库中节点的实际字段结构
   */
  async debugDatabaseStructure(): Promise<any[]> {
    const session = await this.getSession();
    try {
      // 查询少量节点，查看实际的字段名称
      const query = `
        MATCH (a)
        RETURN keys(a) as allKeys, a as fullNode
        LIMIT 5
      `;

      const result = await session.run(query);
      return result.records.map(record => ({
        allKeys: record.get('allKeys'),
        fullNode: record.get('fullNode').properties
      }));
    } finally {
      await session.close();
    }
  }

  /**
   * 调试函数：查找包含特定关键词的所有数据
   */
  async debugSearchByKeyword(keyword: string): Promise<any[]> {
    const session = await this.getSession();
    try {
      // 先检查数据库结构
      console.log('🔍 正在检查数据库字段结构...');
      const structureInfo = await this.debugDatabaseStructure();
      console.log('📋 数据库字段结构:', structureInfo);

      // 查询所有包含关键词的节点，返回所有属性
      const query = `
        MATCH (a)
        WHERE ANY(prop IN keys(a) WHERE toLower(toString(a[prop])) CONTAINS toLower($keyword))
        RETURN keys(a) as allKeys,
               a as fullNode
        LIMIT 10
      `;

      const result = await session.run(query, { keyword });
      return result.records.map(record => ({
        allKeys: record.get('allKeys'),
        fullNode: record.get('fullNode').properties
      }));
    } finally {
      await session.close();
    }
  }

  /**
   * 获取数据库统计信息
   */
  async getDatabaseStats(): Promise<{
    sectors: number;
    subsectors: number;
    activities: number;
    totalNodes: number;
  }> {
    const session = await this.getSession();
    try {
      const query = `
        MATCH (a)
        WITH count(DISTINCT a.sector) as sectorCount, 
             count(DISTINCT a.subcategory) as subsectorCount,
             count(a) as activityCount
        MATCH (n) 
        WITH sectorCount, subsectorCount, activityCount, count(n) as totalCount
        RETURN sectorCount, subsectorCount, activityCount, totalCount
      `;

      const result = await session.run(query);
      const record = result.records[0];
      
      return {
        sectors: record.get('sectorCount').toNumber(),
        subsectors: record.get('subsectorCount').toNumber(),
        activities: record.get('activityCount').toNumber(),
        totalNodes: record.get('totalCount').toNumber()
      };
    } finally {
      await session.close();
    }
  }

  /**
   * 解析查询结果为 EmissionFactor 对象
   */
  private parseEmissionFactors(result: QueryResult<RecordShape>): EmissionFactor[] {
    return result.records.map(record => ({
      id: record.get('id'),
      title: record.get('title'),
      sector: record.get('sector') || 'Unknown',
      subsector: record.get('subsector') || undefined,
      unit: record.get('unit'),
      factor: parseFloat(record.get('factor')) || 0,
      source: record.get('source'),
      description: undefined // 数据库中没有description字段
    }));
  }

  /**
   * 关闭数据库连接
   */
  async close(): Promise<void> {
    if (this.driver) {
      await this.driver.close();
      this.isConnected = false;
      console.log('Neo4j 连接已关闭');
    }
  }

  /**
   * 检查连接状态
   */
  isConnectionHealthy(): boolean {
    return this.isConnected && this.driver !== null;
  }
}

// 创建全局数据库管理器实例
export const dbManager = new DatabaseManager();

// 辅助函数：安全执行数据库操作
export async function safeDatabaseOperation<T>(
  operation: () => Promise<T>,
  fallbackValue: T,
  errorMessage: string
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    console.error(`${errorMessage}:`, error);
    return fallbackValue;
  }
}