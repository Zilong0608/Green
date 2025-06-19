/**
 * 聊天界面组件 - 主要的用户交互界面
 */

'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import styled from 'styled-components';
import { SystemResponse } from '@/types';

interface Message {
  id: string;
  type: 'user' | 'system';
  content: string;
  timestamp: Date;
  response?: SystemResponse;
}

const ChatInterface: React.FC = () => {
  const { t, i18n } = useTranslation();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // 检测客户端渲染
  useEffect(() => {
    setIsClient(true);
  }, []);

  // 自动滚动到底部
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // 发送欢迎消息
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
  }, [t, messages.length]);

  // 发送消息
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
          language: i18n.language
        })
      });

      if (!response.ok) {
        throw new Error('Network response was not ok');
      }

      const data: SystemResponse = await response.json();

      const systemMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'system',
        content: data.message,
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

  // 清空对话
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

  // 切换语言
  const handleLanguageSwitch = () => {
    const newLang = i18n.language === 'zh' ? 'en' : 'zh';
    i18n.changeLanguage(newLang);
  };

  // 键盘事件处理
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // 示例查询点击
  const handleExampleClick = (example: string) => {
    setInputText(example);
    inputRef.current?.focus();
  };

  return (
    <Container>
      <Header>
        <Title>{t('ui.title')}</Title>
        <Subtitle>{t('ui.subtitle')}</Subtitle>
        <Controls>
          <LanguageButton onClick={handleLanguageSwitch}>
            {/* 防止水合错误：只在客户端显示动态语言内容 */}
            {isClient ? (i18n.language === 'zh' ? 'EN' : '中文') : '中文/EN'}
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
              {message.response && message.response.results.length > 0 && (
                <ResultsDisplay response={message.response} />
              )}
            </MessageContent>
            <MessageTime>
              {message.timestamp.toLocaleTimeString()}
            </MessageTime>
          </MessageBubble>
        ))}
        {isLoading && (
          <MessageBubble type="system">
            <LoadingIndicator>
              <LoadingDot />
              <LoadingDot />
              <LoadingDot />
            </LoadingIndicator>
          </MessageBubble>
        )}
        <div ref={messagesEndRef} />
      </MessagesContainer>

      <InputContainer>
        <ExampleQueries>
          <ExampleTitle>{t('ui.exampleTitle')}</ExampleTitle>
          <ExampleList>
            {(t('ui.examples', { returnObjects: true }) as string[]).map((example, index) => (
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

// 安全显示数值的辅助函数
const safeToFixed = (value: number | null | undefined, digits: number = 3): string => {
  if (value === null || value === undefined || isNaN(value)) {
    return '0.' + '0'.repeat(digits);
  }
  return value.toFixed(digits);
};

// 结果显示组件
const ResultsDisplay: React.FC<{ response: SystemResponse }> = ({ response }) => {
  const { t } = useTranslation();

  // 安全检查：确保response和results存在
  if (!response || !response.results || !Array.isArray(response.results)) {
    return (
      <ResultsContainer>
        <ResultItem>
          <ResultHeader>无法显示结果数据</ResultHeader>
        </ResultItem>
      </ResultsContainer>
    );
  }

  return (
    <ResultsContainer>
      {response.results.map((result, index) => (
        <ResultItem key={index}>
          <ResultHeader>
            {result.entity?.name || '未知实体'}: {safeToFixed(result.totalEmission)}kg CO2
          </ResultHeader>
          {result.calculation?.formula && (
            <ResultFormula>{result.calculation.formula}</ResultFormula>
          )}
          <ResultDetails>
            <DetailItem>
              {t('responses.emissionFactor')}: {result.emissionFactor?.factor || 'N/A'}{result.emissionFactor?.unit || ''}
            </DetailItem>
            <DetailItem>
              {t('responses.source')}: {result.emissionFactor?.source || 'N/A'}
            </DetailItem>
            <DetailItem>
              {t('responses.classification')}: {result.emissionFactor?.sector || 'N/A'}
              {result.emissionFactor?.subsector && ` > ${result.emissionFactor.subsector}`}
            </DetailItem>
          </ResultDetails>
          {result.notes && result.notes.length > 0 && (
            <ResultNotes>
              {result.notes.map((note, noteIndex) => (
                <NoteItem key={noteIndex}>{note}</NoteItem>
              ))}
            </ResultNotes>
          )}
        </ResultItem>
      ))}
      
      {response.totalEmission && response.totalEmission > 0 && (
        <TotalEmission>
          {t('responses.total')}: {safeToFixed(response.totalEmission)}kg CO2
        </TotalEmission>
      )}
      
      {response.suggestions && response.suggestions.length > 0 && (
        <SuggestionsContainer>
          <SuggestionTitle>{t('responses.suggestions')}:</SuggestionTitle>
          {response.suggestions.map((suggestion, index) => (
            <SuggestionItem key={index}>{suggestion}</SuggestionItem>
          ))}
        </SuggestionsContainer>
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
  position: relative;
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

const LoadingDot = styled.div`
  width: 8px;
  height: 8px;
  background: #4CAF50;
  border-radius: 50%;
  animation: pulse 1.5s infinite;

  &:nth-child(2) {
    animation-delay: 0.2s;
  }

  &:nth-child(3) {
    animation-delay: 0.4s;
  }

  @keyframes pulse {
    0%, 80%, 100% {
      opacity: 0.3;
    }
    40% {
      opacity: 1;
    }
  }
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
`;

const ResultItem = styled.div`
  margin-bottom: 1rem;
  padding: 0.75rem;
  background: rgba(255, 255, 255, 0.7);
  border-radius: 0.5rem;
  border-left: 4px solid #4CAF50;
`;

const ResultHeader = styled.div`
  font-weight: 600;
  color: #2d5a27;
  margin-bottom: 0.5rem;
`;

const ResultFormula = styled.div`
  font-family: monospace;
  background: rgba(0, 0, 0, 0.1);
  padding: 0.5rem;
  border-radius: 0.25rem;
  margin-bottom: 0.5rem;
`;

const ResultDetails = styled.div`
  font-size: 0.9rem;
  color: #666;
`;

const DetailItem = styled.div`
  margin-bottom: 0.25rem;
`;

const ResultNotes = styled.div`
  margin-top: 0.5rem;
`;

const NoteItem = styled.div`
  font-size: 0.85rem;
  color: #888;
  font-style: italic;
  margin-bottom: 0.25rem;
`;

const TotalEmission = styled.div`
  font-size: 1.2rem;
  font-weight: 700;
  color: #2d5a27;
  text-align: center;
  padding: 1rem;
  background: rgba(76, 175, 80, 0.1);
  border-radius: 0.5rem;
  margin: 1rem 0;
`;

const SuggestionsContainer = styled.div`
  margin-top: 1rem;
`;

const SuggestionTitle = styled.div`
  font-weight: 600;
  color: #333;
  margin-bottom: 0.5rem;
`;

const SuggestionItem = styled.div`
  padding: 0.5rem;
  background: rgba(255, 193, 7, 0.1);
  border-left: 3px solid #FFC107;
  margin-bottom: 0.5rem;
  border-radius: 0.25rem;
  font-size: 0.9rem;
`;

export default ChatInterface;