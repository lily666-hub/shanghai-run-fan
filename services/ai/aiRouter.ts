// AI路由器服务 - 智能选择最适合的AI提供商
import { KimiClient } from './kimiClient';
import { DeepSeekClient } from './deepseekClient';
import type { AIRequest, AIResponse, AIProvider } from '../../types/ai';

export class AIRouter {
  private kimiClient: KimiClient;
  private deepseekClient: DeepSeekClient;
  private providerStatus: Map<string, boolean> = new Map();
  private lastHealthCheck: Date = new Date(0);
  private healthCheckInterval = 5 * 60 * 1000; // 5分钟

  constructor() {
    this.kimiClient = new KimiClient();
    this.deepseekClient = new DeepSeekClient();
  }

  /**
   * 智能路由AI请求到最适合的提供商
   */
  async routeRequest(request: AIRequest): Promise<AIResponse> {
    // 检查提供商健康状态
    await this.checkProviderHealth();

    // 如果用户指定了提供商，优先使用
    if (request.provider) {
      return this.sendToProvider(request, request.provider);
    }

    // 根据对话类型智能选择提供商
    const preferredProvider = this.selectProviderByType(request.conversationType);
    
    try {
      return await this.sendToProvider(request, preferredProvider);
    } catch (error) {
      console.warn(`主要提供商 ${preferredProvider} 失败，尝试备用提供商`);
      
      // 如果主要提供商失败，尝试备用提供商
      const fallbackProvider = preferredProvider === 'kimi' ? 'deepseek' : 'kimi';
      
      try {
        return await this.sendToProvider(request, fallbackProvider);
      } catch (fallbackError) {
        console.error('所有AI提供商都不可用:', fallbackError);
        throw new Error('AI服务暂时不可用，请稍后重试');
      }
    }
  }

  /**
   * 根据对话类型选择最适合的AI提供商
   * 优先使用KIMI API
   */
  private selectProviderByType(conversationType?: string): 'kimi' | 'deepseek' {
    // 优先使用KIMI API，所有对话类型都使用KIMI
    return this.isProviderAvailable('kimi') ? 'kimi' : 'kimi'; // 始终返回KIMI
  }

  /**
   * 发送请求到指定提供商
   * 仅使用KIMI API
   */
  private async sendToProvider(request: AIRequest, provider: 'kimi' | 'deepseek'): Promise<AIResponse> {
    const startTime = Date.now();
    
    try {
      // 仅使用KIMI API
      const response = await this.kimiClient.sendMessage(request);

      // 记录响应时间
      const responseTime = Date.now() - startTime;
      this.updateProviderMetrics('kimi', responseTime, true);

      return response;
    } catch (error) {
      // 记录失败
      this.updateProviderMetrics('kimi', Date.now() - startTime, false);
      throw error;
    }
  }

  /**
   * 检查提供商健康状态
   * 仅检查KIMI API
   */
  private async checkProviderHealth(): Promise<void> {
    const now = new Date();
    
    // 如果距离上次检查时间不足间隔，跳过检查
    if (now.getTime() - this.lastHealthCheck.getTime() < this.healthCheckInterval) {
      return;
    }

    this.lastHealthCheck = now;

    try {
      // 仅检查KIMI提供商
      const kimiStatus = await this.kimiClient.checkConnection();

      this.providerStatus.set('kimi', kimiStatus);
      // this.providerStatus.set('deepseek', false); // 已禁用DeepSeek

      console.log('KIMI API健康检查完成:', { kimi: kimiStatus });
    } catch (error) {
      console.error('KIMI健康检查失败:', error);
      this.providerStatus.set('kimi', false);
    }
  }

  /**
   * 检查提供商是否可用
   */
  private isProviderAvailable(provider: string): boolean {
    return this.providerStatus.get(provider) ?? true; // 默认认为可用
  }

  /**
   * 获取响应最快的提供商
   * 优先使用KIMI API
   */
  private getFastestProvider(): 'kimi' | 'deepseek' {
    // 优先使用KIMI API
    return 'kimi';
  }

  /**
   * 获取负载均衡的提供商
   * 优先使用KIMI API
   */
  private getBalancedProvider(): 'kimi' | 'deepseek' {
    // 优先使用KIMI API
    return 'kimi';
  }

  /**
   * 更新提供商性能指标
   */
  private updateProviderMetrics(provider: string, responseTime: number, success: boolean): void {
    // 这里可以实现更复杂的性能指标收集
    // 目前只是简单记录
    console.log(`提供商 ${provider} 性能指标:`, {
      responseTime: `${responseTime}ms`,
      success,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * 获取所有提供商状态
   */
  async getProviderStatus(): Promise<Record<string, any>> {
    await this.checkProviderHealth();
    
    return {
      kimi: {
        available: this.isProviderAvailable('kimi'),
        lastCheck: this.lastHealthCheck.toISOString(),
      },
      deepseek: {
        available: this.isProviderAvailable('deepseek'),
        lastCheck: this.lastHealthCheck.toISOString(),
      },
    };
  }

  /**
   * 强制刷新提供商状态
   */
  async refreshProviderStatus(): Promise<void> {
    this.lastHealthCheck = new Date(0); // 重置检查时间
    await this.checkProviderHealth();
  }

  /**
   * 获取推荐的提供商
   */
  getRecommendedProvider(conversationType?: string): 'kimi' | 'deepseek' {
    return this.selectProviderByType(conversationType);
  }

  /**
   * 测试所有提供商连接
   * 仅测试KIMI API连接
   */
  async testAllConnections(): Promise<Record<string, boolean>> {
    try {
      const kimiResult = await this.kimiClient.checkConnection();

      return {
        kimi: kimiResult,
        // deepseek: false, // 已禁用DeepSeek API
      };
    } catch (error) {
      console.error('测试KIMI连接失败:', error);
      return {
        kimi: false,
        // deepseek: false,
      };
    }
  }
}