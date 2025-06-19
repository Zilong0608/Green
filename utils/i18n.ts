/**
   * 国际化配置 - 中英文支持
   */

  import i18next from 'i18next';
  import { initReactI18next } from 'react-i18next';

  const resources = {
    zh: {
      translation: {
        common: {
          loading: '加载中...',
          processing: '处理中...'
        },
        ui: {
          title: 'Green - 智能碳排放评估',
          subtitle: '基于AI的个人碳足迹计算助手',
          inputPlaceholder: '请描述您的活动，如：我今天吃了100g苹果...',
          sendButton: '发送',
          clearButton: '清空对话',
          exampleTitle: '示例查询：',
          examples: [
            '我今天吃了100g苹果',
            '开车去上班，距离15公里',
            '喝了一杯咖啡和一个面包',
            '用了3小时电脑'
          ]
        },
        responses: {
          welcome: '您好！我是智能碳排放评估系统。您可以告诉我您的活动，我来帮您计算碳排放量。',
          total: '总计',
          emissionFactor: '排放因子',
          source: '数据来源',
          classification: '分类路径',
          suggestions: '建议'
        },
        errors: {
          networkError: '网络连接错误，请检查网络后重试'
        }
      }
    },
    en: {
      translation: {
        common: {
          loading: 'Loading...',
          processing: 'Processing...'
        },
        ui: {
          title: 'Green - Intelligent Carbon Emission Assessment',
          subtitle: 'AI-powered Personal Carbon Footprint Calculator',
          inputPlaceholder: 'Describe your activities, e.g.: I ate 100g apple today...',
          sendButton: 'Send',
          clearButton: 'Clear Conversation',
          exampleTitle: 'Example Queries:',
          examples: [
            'I ate 100g apple today',
            'Drove to work, 15 kilometers',
            'Had a cup of coffee and a bread',
            'Used computer for 3 hours'
          ]
        },
        responses: {
          welcome: 'Hello! I am an intelligent carbon emission assessment system. You can tell me about your
  activities and I will help calculate carbon emissions.',
          total: 'Total',
          emissionFactor: 'Emission Factor',
          source: 'Source',
          classification: 'Classification',
          suggestions: 'Suggestions'
        },
        errors: {
          networkError: 'Network connection error, please check and retry'
        }
      }
    }
  };

  // 只在客户端初始化
  if (typeof window !== 'undefined' && !i18next.isInitialized) {
    i18next
      .use(initReactI18next)
      .init({
        resources,
        lng: 'zh',
        fallbackLng: 'zh',
        debug: false,
        interpolation: {
          escapeValue: false
        }
      });
  }

  export default i18next;