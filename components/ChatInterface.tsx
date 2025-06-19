'use client';

  import React, { useState, useRef, useEffect } from 'react';
  import styled from 'styled-components';

  interface Message {
    id: string;
    type: 'user' | 'system';
    content: string;
    timestamp: Date;
  }

  const ChatInterface: React.FC = () => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputText, setInputText] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isClient, setIsClient] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
      setIsClient(true);
    }, []);

    useEffect(() => {
      if (messages.length === 0) {
        const welcomeMessage: Message = {
          id: 'welcome',
          type: 'system',
          content: '您好！我是智能碳排放评估系统。您可以告诉我您的活动，我来帮您计算碳排放量。',
          timestamp: new Date()
        };
        setMessages([welcomeMessage]);
      }
    }, [messages.length]);

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
            language: 'zh'
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
          timestamp: new Date()
        };

        setMessages(prev => [...prev, systemMessage]);
      } catch (error) {
        console.error('发送消息失败:', error);
        const errorMessage: Message = {
          id: (Date.now() + 1).toString(),
          type: 'system',
          content: '网络连接错误，请检查网络后重试',
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
          content: '您好！我是智能碳排放评估系统。您可以告诉我您的活动，我来帮您计算碳排放量。',
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
          <Title>Green - 智能碳排放评估</Title>
          <Subtitle>基于AI的个人碳足迹计算助手</Subtitle>
          <Controls>
            <ClearButton onClick={handleClearMessages}>
              清空对话
            </ClearButton>
          </Controls>
        </Header>

        <MessagesContainer>
          {messages.map((message) => (
            <MessageBubble key={message.id} type={message.type}>
              <MessageContent>{message.content}</MessageContent>
              <MessageTime>
                {message.timestamp.toLocaleTimeString()}
              </MessageTime>
            </MessageBubble>
          ))}
          {isLoading && (
            <MessageBubble type="system">
              <LoadingIndicator>处理中...</LoadingIndicator>
            </MessageBubble>
          )}
          <div ref={messagesEndRef} />
        </MessagesContainer>

        <InputContainer>
          <ExampleQueries>
            <ExampleTitle>示例查询：</ExampleTitle>
            <ExampleList>
              {['我今天吃了100g苹果', '开车去上班，距离15公里', '喝了一杯咖啡和一个面包',
  '用了3小时电脑'].map((example, index) => (
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
              placeholder="请描述您的活动，如：我今天吃了100g苹果..."
              disabled={isLoading}
              rows={3}
            />
            <SendButton
              onClick={handleSendMessage}
              disabled={!inputText.trim() || isLoading}
            >
              {isLoading ? '处理中...' : '发送'}
            </SendButton>
          </InputArea>
        </InputContainer>
      </Container>
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

  export default ChatInterface;