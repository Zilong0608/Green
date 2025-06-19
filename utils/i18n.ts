/**
 * 国际化配置 - 中英文支持
 */

import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// 中文翻译
const zhTranslations = {
  // 通用
  common: {
    loading: '加载中...',
    error: '错误',
    success: '成功',
    retry: '重试',
    cancel: '取消',
    confirm: '确认',
    clear: '清空',
    send: '发送',
    processing: '处理中...'
  },
  
  // 界面元素
  ui: {
    title: 'Green - 智能碳排放评估',
    subtitle: '基于AI的个人碳足迹计算助手',
    inputPlaceholder: '请描述您的活动，如：我今天吃了100g苹果...',
    sendButton: '发送',
    clearButton: '清空对话',
    languageSwitch: '切换语言',
    exampleTitle: '示例查询：',
    examples: [
      '我今天吃了100g苹果',
      '开车去上班，距离15公里',
      '喝了一杯咖啡和一个面包',
      '用了3小时电脑'
    ]
  },

  // 响应消息
  responses: {
    welcome: '您好！我是智能碳排放评估系统。您可以告诉我您的活动，我来帮您计算碳排放量。',
    noData: '未找到相关数据',
    calculating: '正在计算碳排放量...',
    analysing: '正在分析您的输入...',
    searching: '正在搜索相关活动...',
    total: '总计',
    emissionFactor: '排放因子',
    unit: '单位',
    source: '数据来源',
    classification: '分类路径',
    suggestions: '建议',
    missingInfo: '缺失信息',
    needMoreInfo: '需要更多信息以进行精确计算'
  },

  // 错误消息
  errors: {
    networkError: '网络连接错误，请检查网络后重试',
    serverError: '服务器错误，请稍后重试',
    parseError: '数据解析错误',
    unknownError: '未知错误，请稍后重试',
    databaseError: '数据库连接错误',
    noResults: '没有找到相关结果'
  },

  // 单位和计量
  units: {
    kg: '千克',
    g: '克',
    l: '升',
    ml: '毫升',
    km: '公里',
    m: '米',
    hour: '小时',
    piece: '个',
    cup: '杯'
  },

  // 建议消息
  suggestions: {
    localFood: '建议选择本地和季节性食物以减少碳排放',
    publicTransport: '考虑使用公共交通或骑行来降低交通碳排放',
    energySaving: '节约用电可以有效减少碳排放',
    provideWeight: '请提供重量信息以计算精确排放量',
    provideDistance: '请提供距离信息以计算交通排放',
    provideQuantity: '请提供数量信息以计算总排放量'
  }
};

// 英文翻译
const enTranslations = {
  common: {
    loading: 'Loading...',
    error: 'Error',
    success: 'Success',
    retry: 'Retry',
    cancel: 'Cancel',
    confirm: 'Confirm',
    clear: 'Clear',
    send: 'Send',
    processing: 'Processing...'
  },
  
  ui: {
    title: 'Green - Intelligent Carbon Emission Assessment',
    subtitle: 'AI-powered Personal Carbon Footprint Calculator',
    inputPlaceholder: 'Describe your activities, e.g.: I ate 100g apple today...',
    sendButton: 'Send',
    clearButton: 'Clear Conversation',
    languageSwitch: 'Switch Language',
    exampleTitle: 'Example Queries:',
    examples: [
      'I ate 100g apple today',
      'Drove to work, 15 kilometers',
      'Had a cup of coffee and a bread',
      'Used computer for 3 hours'
    ]
  },

  responses: {
    welcome: 'Hello! I\'m an intelligent carbon emission assessment system. You can tell me about your activities and I\'ll help calculate carbon emissions.',
    noData: 'No relevant data found',
    calculating: 'Calculating carbon emissions...',
    analysing: 'Analyzing your input...',
    searching: 'Searching for relevant activities...',
    total: 'Total',
    emissionFactor: 'Emission Factor',
    unit: 'Unit',
    source: 'Source',
    classification: 'Classification',
    suggestions: 'Suggestions',
    missingInfo: 'Missing Information',
    needMoreInfo: 'Need more information for precise calculation'
  },

  errors: {
    networkError: 'Network connection error, please check and retry',
    serverError: 'Server error, please try again later',
    parseError: 'Data parsing error',
    unknownError: 'Unknown error, please try again later',
    databaseError: 'Database connection error',
    noResults: 'No results found'
  },

  units: {
    kg: 'kg',
    g: 'g',
    l: 'L',
    ml: 'ml',
    km: 'km',
    m: 'm',
    hour: 'hour',
    piece: 'piece',
    cup: 'cup'
  },

  suggestions: {
    localFood: 'Consider choosing local and seasonal foods to reduce carbon emissions',
    publicTransport: 'Consider using public transport or cycling to reduce transportation emissions',
    energySaving: 'Energy conservation can effectively reduce carbon emissions',
    provideWeight: 'Please provide weight information for accurate emission calculation',
    provideDistance: 'Please provide distance information for transportation emission calculation',
    provideQuantity: 'Please provide quantity information for total emission calculation'
  }
};

// 初始化 i18next
i18next
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: 'zh',
    debug: process.env.NODE_ENV === 'development',
    
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage']
    },

    resources: {
      zh: {
        translation: zhTranslations
      },
      en: {
        translation: enTranslations
      }
    },

    interpolation: {
      escapeValue: false
    }
  });

export default i18next;