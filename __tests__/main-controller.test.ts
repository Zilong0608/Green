/**
 * 主控制器测试
 */

import { mainController } from '@/lib/main-controller';
import { SystemResponse } from '@/types';

// 模拟外部依赖
jest.mock('@/lib/database');
jest.mock('@/lib/intent-detection');
jest.mock('@/lib/rag');
jest.mock('@/lib/reasoning');

describe('MainController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('processUserQuery', () => {
    test('应该处理简单的碳排放查询', async () => {
      const query = '我吃了100g苹果';
      const response = await mainController.processUserQuery(query, 'zh');
      
      expect(response).toBeDefined();
      expect(response.success).toBeDefined();
      expect(response.message).toBeDefined();
      expect(response.language).toBe('zh');
      expect(response.processingTime).toBeGreaterThan(0);
    }, 30000);

    test('应该处理英文查询', async () => {
      const query = 'I ate 100g apple';
      const response = await mainController.processUserQuery(query, 'en');
      
      expect(response).toBeDefined();
      expect(response.language).toBe('en');
    }, 30000);

    test('应该处理空查询', async () => {
      const response = await mainController.processUserQuery('', 'zh');
      
      expect(response).toBeDefined();
      expect(response.success).toBeDefined();
    }, 30000);
  });

  describe('getSystemHealth', () => {
    test('应该返回系统健康状态', async () => {
      const health = await mainController.getSystemHealth();
      
      expect(health).toBeDefined();
      expect(health.database).toBeDefined();
      expect(health.modules).toBeDefined();
      expect(health.performance).toBeDefined();
    });
  });

  describe('getAvailableCategories', () => {
    test('应该返回可用的数据分类', async () => {
      const categories = await mainController.getAvailableCategories();
      
      expect(categories).toBeDefined();
      expect(categories.sectors).toBeDefined();
      expect(categories.sampleActivities).toBeDefined();
    });
  });
});