/**
 * 调试 API - 查看数据库内容
 */

import { NextRequest, NextResponse } from 'next/server';
import { dbManager } from '@/lib/database';

export async function GET(request: NextRequest) {
  try {
    // 获取示例数据
    const sampleData = await dbManager.getSampleData(50);
    
    // 获取统计信息
    const stats = await dbManager.getDatabaseStats();
    
    return NextResponse.json({
      success: true,
      stats,
      sampleData,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('调试 API 失败:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch debug info',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}