import i18next from 'i18next';
  import { initReactI18next } from 'react-i18next';

  const zhTranslations = {
    common: {
      loading: '加载中...',
      processing: '处理中...'
    },
    ui: {
      title: 'Green - 智能碳排放评估',
      subtitle: '基于AI的个人碳足迹计算助手',
      inputPlaceholder: '请描述您的活动',
      sendButton: '发送',
      clearButton: '清空对话',
      exampleTitle: '示例查询：',
      examples: [
        '我今天吃了100g苹果',
        '开车去上班，距离15公里',
        '喝了一杯咖啡',
        '用了3小时电脑'
      ]
    },
    responses: {
      welcome: '您好！我是智能碳排放评估系统。',
      total: '总计',
      emissionFactor: '排放因子',
      source: '数据来源',
      classification: '分类路径',
      suggestions: '建议'
    },
    errors: {
      networkError: '网络连接错误，请检查网络后重试'
    }
  };

  const enTranslations = {
    common: {
      loading: 'Loading...',
      processing: 'Processing...'
    },
    ui: {
      title: 'Green - Carbon Assessment',
      subtitle: 'AI-powered Carbon Calculator',
      inputPlaceholder: 'Describe your activities',
      sendButton: 'Send',
      clearButton: 'Clear',
      exampleTitle: 'Examples:',
      examples: [
        'I ate 100g apple',
        'Drove to work 15km',
        'Had a coffee',
        'Used computer 3 hours'
      ]
    },
    responses: {
      welcome: 'Hello! I am a carbon emission assessment system.',
      total: 'Total',
      emissionFactor: 'Emission Factor',
      source: 'Source',
      classification: 'Classification',
      suggestions: 'Suggestions'
    },
    errors: {
      networkError: 'Network error, please retry'
    }
  };

  if (typeof window !== 'undefined' && !i18next.isInitialized) {
    i18next.use(initReactI18next).init({
      resources: {
        zh: { translation: zhTranslations },
        en: { translation: enTranslations }
      },
      lng: 'zh',
      fallbackLng: 'zh',
      interpolation: { escapeValue: false }
    });
  }

  export default i18next;