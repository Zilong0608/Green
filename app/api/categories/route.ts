/**
 * 数据分类 API - 获取可用的行业和活动分类
 */

import { NextRequest, NextResponse } from 'next/server';
import { mainController } from '@/lib/main-controller';

export async function GET(request: NextRequest) {
  try {
    const categories = await mainController.getAvailableCategories();
    
    return NextResponse.json({
      success: true,
      data: categories,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('获取分类数据失败:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch categories',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}