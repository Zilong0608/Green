/**
 * 主页面组件
 */

'use client';

import React, { useEffect } from 'react';
import ChatInterface from '@/components/ChatInterface';
import '@/utils/i18n'; // 初始化国际化

export default function HomePage() {
  useEffect(() => {
    // 页面加载时的初始化逻辑
    console.log('Green Carbon Assessment System Loaded');
    
    // 可以在这里添加页面访问统计、性能监控等
    if (typeof window !== 'undefined') {
      // 设置页面标题
      document.title = 'Green - 智能碳排放评估系统';
      
      // 添加页面描述
      const metaDescription = document.querySelector('meta[name="description"]');
      if (metaDescription) {
        metaDescription.setAttribute('content', '基于AI的个人碳足迹计算助手，帮助您理解和减少日常活动的碳排放量');
      }
    }
  }, []);

  return (
    <main style={{ height: '100vh' }}>
      <ChatInterface />
    </main>
  );
}