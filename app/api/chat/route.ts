/**
 * 聊天 API 路由
 */

import { NextRequest, NextResponse } from 'next/server';
import { mainController } from '@/lib/main-controller';
import { SystemResponse } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, language = 'zh' } = body;

    // 验证输入
    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { 
          success: false, 
          message: language === 'zh' ? '请提供有效的查询内容' : 'Please provide valid query content',
          results: [],
          totalEmission: 0,
          suggestions: [],
          language,
          processingTime: 0
        },
        { status: 400 }
      );
    }

    // 限制查询长度
    if (query.length > 2000) {
      return NextResponse.json(
        {
          success: false,
          message: language === 'zh' ? '查询内容过长，请控制在2000字符内' : 'Query too long, please limit to 2000 characters',
          results: [],
          totalEmission: 0,
          suggestions: [],
          language,
          processingTime: 0
        },
        { status: 400 }
      );
    }

    console.log(`收到聊天请求: ${query.substring(0, 100)}${query.length > 100 ? '...' : ''}`);

    // 调用主控制器处理请求
    const response: SystemResponse = await mainController.processUserQuery(query, language);

    console.log(`处理完成: 成功=${response.success}, 处理时间=${response.processingTime}ms`);

    return NextResponse.json(response);

  } catch (error) {
    console.error('API 处理错误:', error);

    const errorResponse: SystemResponse = {
      success: false,
      message: '服务器内部错误，请稍后重试',
      results: [],
      totalEmission: 0,
      suggestions: ['请检查网络连接后重试'],
      language: 'zh',
      processingTime: 0
    };

    return NextResponse.json(errorResponse, { status: 500 });
  }
}

// 处理 OPTIONS 请求（CORS 预检）
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}