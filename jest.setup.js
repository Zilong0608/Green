/**
 * Jest 测试环境设置
 */

import '@testing-library/jest-dom'

// 模拟环境变量
process.env.NEO4J_URI = 'neo4j+s://test.databases.neo4j.io'
process.env.NEO4J_USERNAME = 'test'
process.env.NEO4J_PASSWORD = 'test'
process.env.NEO4J_DATABASE = 'test'
process.env.GEMINI_API_KEY = 'test_key'

// 模拟 window 对象的方法
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
})

// 模拟 IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
}

// 模拟 ResizeObserver
global.ResizeObserver = class ResizeObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
}