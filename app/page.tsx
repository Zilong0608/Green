 /**
   * 主页面组件
   */

  'use client';

  import React, { useEffect, useState } from 'react';
  import dynamic from 'next/dynamic';

  // 动态导入ChatInterface，禁用SSR
  const ChatInterface = dynamic(() => import('@/components/ChatInterface'), {
    ssr: false,
    loading: () => <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh',
      fontSize: '18px'
    }}>Loading...</div>
  });

  export default function HomePage() {
    const [isClient, setIsClient] = useState(false);

    useEffect(() => {
      setIsClient(true);
      console.log('Green Carbon Assessment System Loaded');

      if (typeof window !== 'undefined') {
        document.title = 'Green - 智能碳排放评估系统';

        const metaDescription = document.querySelector('meta[name="description"]');
        if (metaDescription) {
          metaDescription.setAttribute('content',
  '基于AI的个人碳足迹计算助手，帮助您理解和减少日常活动的碳排放量');
        }
      }
    }, []);

    if (!isClient) {
      return <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        fontSize: '18px'
      }}>Loading...</div>;
    }

    return (
      <main style={{ height: '100vh' }}>
        <ChatInterface />
      </main>
    );
  }