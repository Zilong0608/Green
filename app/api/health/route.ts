/**
 * 系统健康检查 API
 */

import { NextRequest, NextResponse } from 'next/server';
import { mainController } from '@/lib/main-controller';

export async function GET(request: NextRequest) {
  try {
    const health = await mainController.getSystemHealth();
    
    const status = health.database ? 200 : 503;
    
    return NextResponse.json({
      status: health.database ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      components: {
        database: health.database ? 'ok' : 'error',
        modules: health.modules,
        performance: health.performance
      }
    }, { status });

  } catch (error) {
    console.error('健康检查失败:', error);
    
    return NextResponse.json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: 'Health check failed'
    }, { status: 500 });
  }
}