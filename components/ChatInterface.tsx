'use client';

  import React, { useState, useRef, useEffect } from 'react';
  import styled from 'styled-components';

  interface Message {
    id: string;
    type: 'user' | 'system';
    content: string;
    timestamp: Date;
    response?: any;
  }

  const ChatInterface: React.FC = () => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputText, setInputText] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isClient, setIsClient] = useState(false);
    const [language, setLanguage] = useState('zh');
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    // 语言配置
    const translations = {
      zh: {
        'ui.title': 'Green - 智能碳排放评估',
        'ui.subtitle': '基于AI的个人碳足迹计算助手',
        'ui.inputPlaceholder': '请描述您的活动，如：我今天吃了100g苹果...',
        'ui.sendButton': '发送',
        'ui.clearButton': '清空对话',
        'ui.exampleTitle': '示例查询：',
        'ui.languageSwitch': 'English',
        'responses.welcome': '您好！我是智能碳排放评估系统。您可以告诉我您的活动，我来帮您计算碳排放量。',
        'common.processing': '处理中...',
        'errors.networkError': '网络连接错误，请检查网络后重试',
        'responses.total': '总计',
        'responses.emissionFactor': '排放因子',
        'responses.source': '数据来源',
        'responses.classification': '分类路径',
        'responses.suggestions': '建议',
        'examples': [
          '我今天吃了100g苹果',
          '开车去上班，距离15公里',
          '喝了一杯咖啡和一个面包',
          '用了3小时电脑'
        ]
      },
      en: {
        'ui.title': 'Green - Intelligent Carbon Emission Assessment',
        'ui.subtitle': 'AI-powered Personal Carbon Footprint Calculator',
        'ui.inputPlaceholder': 'Describe your activities, e.g.: I ate 100g apple today...',
        'ui.sendButton': 'Send',
        'ui.clearButton': 'Clear Conversation',
        'ui.exampleTitle': 'Example Queries:',
        'ui.languageSwitch': '中文',
        'responses.welcome': 'Hello! I am an intelligent carbon emission assessment system. You can tell me about
  your activities and I will help calculate carbon emissions.',
        'common.processing': 'Processing...',
        'errors.networkError': 'Network connection error, please check and retry',
        'responses.total': 'Total',
        'responses.emissionFactor': 'Emission Factor',
        'responses.source': 'Source',
        'responses.classification': 'Classification',
        'responses.suggestions': 'Suggestions',
        'examples': [
          'I ate 100g apple today',
          'Drove to work, 15 kilometers',
          'Had a cup of coffee and a bread',
          'Used computer for 3 hours'
        ]
      }
    };

    // 翻译函数
    const t = (key: string) => {
      return translations[language as keyof typeof translations]?.[key as keyof typeof translations.zh] || key;
    };

    // 语言切换函数
    const toggleLanguage = () => {
      const newLang = language === 'zh' ? 'en' : 'zh';
      setLanguage(newLang);
      if (typeof window !== 'undefined') {
        localStorage.setItem('preferred-language', newLang);
      }
    };

    useEffect(() => {
      setIsClient(true);
    }, []);

    // 初始化语言
    useEffect(() => {
      if (typeof window !== 'undefined') {
        const savedLang = localStorage.getItem('preferred-language') || 'zh';
        setLanguage(savedLang);
      }
    }, []);

    useEffect(() => {
      if (messages.length === 0) {
        const welcomeMessage: Message = {
          id: 'welcome',
          type: 'system',
          content: t('responses.welcome'),
          timestamp: new Date()
        };
        setMessages([welcomeMessage]);
      }
    }, [language]);

    const handleSendMessage = async () => {
      if (!inputText.trim() || isLoading) return;

      const userMessage: Message = {
        id: Date.now().toString(),
        type: 'user',
        content: inputText,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, userMessage]);
      setInputText('');
      setIsLoading(true);

      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query: inputText,
            language: language
          })
        });

        if (!response.ok) {
          throw new Error('Network response was not ok');
        }

        const data = await response.json();

        const systemMessage: Message = {
          id: (Date.now() + 1).toString(),
          type: 'system',
          content: data.message || '处理完成',
          timestamp: new Date(),
          response: data
        };

        setMessages(prev => [...prev, systemMessage]);
      } catch (error) {
        console.error('发送消息失败:', error);
        const errorMessage: Message = {
          id: (Date.now() + 1).toString(),
          type: 'system',
          content: t('errors.networkError'),
          timestamp: new Date()
        };
        setMessages(prev => [...prev, errorMessage]);
      } finally {
        setIsLoading(false);
      }
    };

    const handleClearMessages = () => {
      setMessages([]);
      setTimeout(() => {
        const welcomeMessage: Message = {
          id: 'welcome-new',
          type: 'system',
          content: t('responses.welcome'),
          timestamp: new Date()
        };
        setMessages([welcomeMessage]);
      }, 100);
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSendMessage();
      }
    };

    const handleExampleClick = (example: string) => {
      setInputText(example);
      inputRef.current?.focus();
    };

    if (!isClient) {
      return <div>Loading...</div>;
    }

    return (
      <Container>
        <Header>
          <Title>{t('ui.title')}</Title>
          <Subtitle>{t('ui.subtitle')}</Subtitle>
          <Controls>
            <LanguageButton onClick={toggleLanguage}>
              {t('ui.languageSwitch')}
            </LanguageButton>
            <ClearButton onClick={handleClearMessages}>
              {t('ui.clearButton')}
            </ClearButton>
          </Controls>
        </Header>

        <MessagesContainer>
          {messages.map((message) => (
            <MessageBubble key={message.id} type={message.type}>
              <MessageContent>
                {message.content}
                {message.response && message.response.results && message.response.results.length > 0 && (
                  <ResultsDisplay response={message.response} language={language} />
                )}
              </MessageContent>
              <MessageTime>
                {message.timestamp.toLocaleTimeString()}
              </MessageTime>
            </MessageBubble>
          ))}
          {isLoading && (
            <MessageBubble type="system">
              <LoadingIndicator>{t('common.processing')}</LoadingIndicator>
            </MessageBubble>
          )}
          <div ref={messagesEndRef} />
        </MessagesContainer>

        <InputContainer>
          <ExampleQueries>
            <ExampleTitle>{t('ui.exampleTitle')}</ExampleTitle>
            <ExampleList>
              {(translations[language as keyof typeof translations]?.examples || []).map((example, index) => (
                <ExampleItem
                  key={index}
                  onClick={() => handleExampleClick(example)}
                >
                  {example}
                </ExampleItem>
              ))}
            </ExampleList>
          </ExampleQueries>

          <InputArea>
            <TextArea
              ref={inputRef}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={t('ui.inputPlaceholder')}
              disabled={isLoading}
              rows={3}
            />
            <SendButton
              onClick={handleSendMessage}
              disabled={!inputText.trim() || isLoading}
            >
              {isLoading ? t('common.processing') : t('ui.sendButton')}
            </SendButton>
          </InputArea>
        </InputContainer>
      </Container>
    );
  };

  // 结果显示组件
  const ResultsDisplay: React.FC<{ response: any; language: string }> = ({ response, language }) => {
    const translations = {
      zh: {
        'responses.total': '总计',
        'responses.emissionFactor': '排放因子',
        'responses.source': '数据来源',
        'responses.classification': '分类路径',
        'responses.suggestions': '建议'
      },
      en: {
        'responses.total': 'Total',
        'responses.emissionFactor': 'Emission Factor',
        'responses.source': 'Source',
        'responses.classification': 'Classification',
        'responses.suggestions': 'Suggestions'
      }
    };

    const t = (key: string) => {
      return translations[language as keyof typeof translations]?.[key as keyof typeof translations.zh] || key;
    };

    // 安全显示数值
    const safeToFixed = (value: number | null | undefined, digits: number = 3): string => {
      if (value === null || value === undefined || isNaN(value)) {
        return '0.' + '0'.repeat(digits);
      }
      return value.toFixed(digits);
    };

    if (!response || !response.results || !Array.isArray(response.results)) {
      return null;
    }

    return (
      <ResultsContainer>
        {response.results.map((result: any, index: number) => (
          <ResultItem key={index}>
            <ResultHeader>
              🔍 {result.entity?.name || 'Unknown'}: {safeToFixed(result.totalEmission)} kg CO2
            </ResultHeader>

            {/* 计算公式 */}
            {result.calculation?.formula && (
              <ResultFormula>
                📊 {language === 'zh' ? '计算公式' : 'Formula'}: {result.calculation.formula}
              </ResultFormula>
            )}

            {/* 排放因子详情 */}
            <ResultDetails>
              <DetailItem>
                🏭 {t('responses.emissionFactor')}: {result.emissionFactor?.factor || 'N/A'}
  {result.emissionFactor?.unit || ''}
              </DetailItem>
              <DetailItem>
                📚 {t('responses.source')}: {result.emissionFactor?.source || 'N/A'}
              </DetailItem>
              <DetailItem>
                🏷️ {t('responses.classification')}: {result.emissionFactor?.sector || 'N/A'}
                {result.emissionFactor?.subsector && ` > ${result.emissionFactor.subsector}`}
              </DetailItem>
            </ResultDetails>

            {/* 计算步骤 */}
            {result.calculation?.steps && result.calculation.steps.length > 0 && (
              <CalculationSteps>
                <StepsTitle>📋 {language === 'zh' ? '计算步骤' : 'Calculation Steps'}:</StepsTitle>
                {result.calculation.steps.map((step: string, stepIndex: number) => (
                  <StepItem key={stepIndex}>{stepIndex + 1}. {step}</StepItem>
                ))}
              </CalculationSteps>
            )}

            {/* 备注 */}
            {result.notes && result.notes.length > 0 && (
              <ResultNotes>
                <NotesTitle>💡 {language === 'zh' ? '备注' : 'Notes'}:</NotesTitle>
                {result.notes.map((note: string, noteIndex: number) => (
                  <NoteItem key={noteIndex}>• {note}</NoteItem>
                ))}
              </ResultNotes>
            )}
          </ResultItem>
        ))}

        {/* 总计 */}
        {response.totalEmission && response.totalEmission > 0 && (
          <TotalEmission>
            🌍 {t('responses.total')}: {safeToFixed(response.totalEmission)} kg CO2
          </TotalEmission>
        )}

        {/* 建议 */}
        {response.suggestions && response.suggestions.length > 0 && (
          <SuggestionsContainer>
            <SuggestionTitle>💚 {t('responses.suggestions')}:</SuggestionTitle>
            {response.suggestions.map((suggestion: string, index: number) => (
              <SuggestionItem key={index}>• {suggestion}</SuggestionItem>
            ))}
          </SuggestionsContainer>
        )}

        {/* 处理时间 */}
        {response.processingTime && (
          <ProcessingTime>
            ⏱️ {language === 'zh' ? '处理时间' : 'Processing Time'}: {response.processingTime}ms
          </ProcessingTime>
        )}
      </ResultsContainer>
    );
  };

  // 样式组件
  const Container = styled.div`
    display: flex;
    flex-direction: column;
    height: 100vh;
    max-width: 1200px;
    margin: 0 auto;
    background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
  `;

  const Header = styled.header`
    padding: 2rem;
    text-align: center;
    background: rgba(255, 255, 255, 0.9);
    backdrop-filter: blur(10px);
    border-bottom: 1px solid rgba(0, 0, 0, 0.1);
  `;

  const Title = styled.h1`
    font-size: 2.5rem;
    font-weight: 700;
    color: #2d5a27;
    margin: 0 0 0.5rem 0;
  `;

  const Subtitle = styled.p`
    font-size: 1.1rem;
    color: #666;
    margin: 0 0 1rem 0;
  `;

  const Controls = styled.div`
    display: flex;
    justify-content: center;
    gap: 1rem;
  `;

  const LanguageButton = styled.button`
    padding: 0.5rem 1rem;
    background: #4CAF50;
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-weight: 500;
    transition: background 0.2s;

    &:hover {
      background: #45a049;
    }
  `;

  const ClearButton = styled.button`
    padding: 0.5rem 1rem;
    background: #f44336;
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-weight: 500;
    transition: background 0.2s;

    &:hover {
      background: #da190b;
    }
  `;

  const MessagesContainer = styled.div`
    flex: 1;
    overflow-y: auto;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  `;

  const MessageBubble = styled.div<{ type: 'user' | 'system' }>`
    align-self: ${props => props.type === 'user' ? 'flex-end' : 'flex-start'};
    max-width: 80%;
    background: ${props => props.type === 'user' ? '#4CAF50' : 'white'};
    color: ${props => props.type === 'user' ? 'white' : '#333'};
    padding: 1rem;
    border-radius: 1rem;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  `;

  const MessageContent = styled.div`
    white-space: pre-wrap;
    line-height: 1.5;
  `;

  const MessageTime = styled.div`
    font-size: 0.75rem;
    opacity: 0.7;
    margin-top: 0.5rem;
  `;

  const LoadingIndicator = styled.div`
    display: flex;
    gap: 0.3rem;
    align-items: center;
  `;

  const InputContainer = styled.div`
    padding: 1rem;
    background: rgba(255, 255, 255, 0.9);
    backdrop-filter: blur(10px);
    border-top: 1px solid rgba(0, 0, 0, 0.1);
  `;

  const ExampleQueries = styled.div`
    margin-bottom: 1rem;
  `;

  const ExampleTitle = styled.div`
    font-weight: 600;
    color: #333;
    margin-bottom: 0.5rem;
  `;

  const ExampleList = styled.div`
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  `;

  const ExampleItem = styled.button`
    padding: 0.5rem 1rem;
    background: #e8f5e8;
    border: 1px solid #4CAF50;
    border-radius: 20px;
    color: #2d5a27;
    cursor: pointer;
    font-size: 0.9rem;
    transition: all 0.2s;

    &:hover {
      background: #4CAF50;
      color: white;
    }
  `;

  const InputArea = styled.div`
    display: flex;
    gap: 1rem;
    align-items: flex-end;
  `;

  const TextArea = styled.textarea`
    flex: 1;
    padding: 1rem;
    border: 2px solid #e0e0e0;
    border-radius: 1rem;
    font-size: 1rem;
    font-family: inherit;
    resize: vertical;
    min-height: 60px;
    max-height: 150px;
    outline: none;
    transition: border-color 0.2s;

    &:focus {
      border-color: #4CAF50;
    }

    &:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
  `;

  const SendButton = styled.button`
    padding: 1rem 2rem;
    background: #4CAF50;
    color: white;
    border: none;
    border-radius: 1rem;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    min-width: 100px;

    &:hover:not(:disabled) {
      background: #45a049;
      transform: translateY(-1px);
    }

    &:disabled {
      opacity: 0.6;
      cursor: not-allowed;
      transform: none;
    }
  `;

  // 结果显示样式
  const ResultsContainer = styled.div`
    margin-top: 1rem;
    padding: 1rem;
    background: rgba(0, 0, 0, 0.05);
    border-radius: 0.5rem;
    border: 1px solid rgba(76, 175, 80, 0.2);
  `;

  const ResultItem = styled.div`
    margin-bottom: 1rem;
    padding: 1rem;
    background: rgba(255, 255, 255, 0.8);
    border-radius: 0.5rem;
    border-left: 4px solid #4CAF50;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  `;

  const ResultHeader = styled.div`
    font-weight: 700;
    color: #2d5a27;
    margin-bottom: 0.5rem;
    font-size: 1.1rem;
  `;

  const ResultFormula = styled.div`
    font-family: 'Courier New', monospace;
    background: rgba(76, 175, 80, 0.1);
    padding: 0.75rem;
    border-radius: 0.25rem;
    margin: 0.5rem 0;
    border: 1px solid rgba(76, 175, 80, 0.3);
    font-size: 0.9rem;
  `;

  const ResultDetails = styled.div`
    font-size: 0.9rem;
    color: #555;
    margin: 0.5rem 0;
  `;

  const DetailItem = styled.div`
    margin-bottom: 0.25rem;
    padding: 0.25rem 0;
  `;

  const CalculationSteps = styled.div`
    margin: 0.75rem 0;
    padding: 0.75rem;
    background: rgba(33, 150, 243, 0.1);
    border-radius: 0.25rem;
    border: 1px solid rgba(33, 150, 243, 0.3);
  `;

  const StepsTitle = styled.div`
    font-weight: 600;
    color: #1976d2;
    margin-bottom: 0.5rem;
  `;

  const StepItem = styled.div`
    margin-bottom: 0.25rem;
    font-size: 0.9rem;
    color: #333;
  `;

  const ResultNotes = styled.div`
    margin: 0.75rem 0;
    padding: 0.75rem;
    background: rgba(255, 193, 7, 0.1);
    border-radius: 0.25rem;
    border: 1px solid rgba(255, 193, 7, 0.3);
  `;

  const NotesTitle = styled.div`
    font-weight: 600;
    color: #f57c00;
    margin-bottom: 0.5rem;
  `;

  const NoteItem = styled.div`
    font-size: 0.85rem;
    color: #666;
    margin-bottom: 0.25rem;
    font-style: italic;
  `;

  const TotalEmission = styled.div`
    font-size: 1.3rem;
    font-weight: 700;
    color: #2d5a27;
    text-align: center;
    padding: 1rem;
    background: rgba(76, 175, 80, 0.15);
    border-radius: 0.5rem;
    margin: 1rem 0;
    border: 2px solid rgba(76, 175, 80, 0.3);
  `;

  const SuggestionsContainer = styled.div`
    margin-top: 1rem;
    padding: 0.75rem;
    background: rgba(76, 175, 80, 0.1);
    border-radius: 0.25rem;
    border: 1px solid rgba(76, 175, 80, 0.3);
  `;

  const SuggestionTitle = styled.div`
    font-weight: 600;
    color: #2d5a27;
    margin-bottom: 0.5rem;
  `;

  const SuggestionItem = styled.div`
    padding: 0.25rem 0;
    color: #2d5a27;
    font-size: 0.9rem;
  `;

  const ProcessingTime = styled.div`
    text-align: center;
    font-size: 0.8rem;
    color: #888;
    margin-top: 0.5rem;
    padding: 0.25rem;
    border-top: 1px solid rgba(0, 0, 0, 0.1);
  `;

  export default ChatInterface;