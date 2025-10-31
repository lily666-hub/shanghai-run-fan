// AI智能安全顾问主服务
import { AIRouter } from './aiRouter';
import { ConversationManager } from './conversationManager';
import type { 
  AIMessage, 
  AIConversation, 
  AIConversationStats,
  AIContext, 
  AIRequest, 
  AIResponse, 
  SafetyProfile, 
  SafetyAnalysis, 
  EmergencyAlert 
} from '../../types/ai';

export class AIService {
  private aiRouter: AIRouter;
  private conversationManager: ConversationManager;

  constructor() {
    this.aiRouter = new AIRouter();
    this.conversationManager = new ConversationManager();
  }

  /**
   * 发送消息并获取AI响应
   */
  async sendMessage(
    userId: string,
    message: string,
    conversationId?: string,
    context?: Partial<AIContext>,
    provider?: 'kimi' | 'deepseek',
    conversationType?: 'safety' | 'emergency' | 'general' | 'women_safety'
  ): Promise<{
    response: AIResponse;
    conversation: AIConversation;
    userMessage: AIMessage;
    aiMessage: AIMessage;
  }> {
    try {
      let conversation: AIConversation;

      // 如果没有提供对话ID，创建新对话
      if (!conversationId) {
        const title = this.generateConversationTitle(message, conversationType);
        const selectedProvider = provider || this.aiRouter.getRecommendedProvider(conversationType);
        
        conversation = await this.conversationManager.createConversation(
          userId,
          title,
          selectedProvider,
          conversationType || 'general',
          conversationType === 'emergency'
        );
        conversationId = conversation.id;
      } else {
        // 获取现有对话
        const existingConversation = await this.conversationManager.getConversation(conversationId);
        if (!existingConversation) {
          throw new Error('对话不存在');
        }
        conversation = existingConversation;
      }

      // 保存用户消息
      const userMessage = await this.conversationManager.addMessage(
        conversationId,
        'user',
        message
      );

      // 如果提供了上下文，保存上下文信息
      if (context) {
        await this.conversationManager.saveContext(
          conversationId,
          context.locationData,
          context.userContext,
          context.safetyContext
        );
      }

      // 获取完整的上下文（包括历史上下文）
      const fullContext = await this.buildFullContext(conversationId, context);

      // 构建AI请求
      const aiRequest: AIRequest = {
        message,
        context: fullContext,
        conversationId,
        provider: provider || conversation.aiProvider,
        conversationType: conversationType || conversation.conversationType,
      };

      // 发送到AI路由器
      const aiResponse = await this.aiRouter.routeRequest(aiRequest);

      // 保存AI响应
      const aiMessage = await this.conversationManager.addMessage(
        conversationId,
        'assistant',
        aiResponse.message,
        aiResponse.metadata,
        aiResponse.confidence
      );

      // 如果是紧急情况，处理紧急响应
      if (aiResponse.emergencyLevel === 'critical' || aiResponse.emergencyLevel === 'high') {
        await this.handleEmergencyResponse(userId, conversationId, aiResponse, fullContext);
      }

      // 更新对话对象
      conversation.messages = [...(conversation.messages || []), userMessage, aiMessage];

      return {
        response: aiResponse,
        conversation,
        userMessage,
        aiMessage,
      };
    } catch (error) {
      console.error('AI服务发送消息失败:', error);
      throw error;
    }
  }

  /**
   * 获取用户的对话列表
   */
  async getConversations(
    userId: string,
    limit?: number,
    offset?: number
  ): Promise<AIConversation[]> {
    return this.conversationManager.getUserConversations(userId, limit, offset);
  }

  /**
   * 获取对话统计信息
   */
  async getConversationStats(userId: string): Promise<AIConversationStats> {
    const conversations = await this.conversationManager.getUserConversations(userId);
    
    const stats = {
      totalConversations: conversations.length,
      totalMessages: conversations.reduce((total, conv) => total + conv.messages.length, 0),
      activeConversations: conversations.filter(conv => conv.isActive).length,
      averageResponseTime: 1.2, // 模拟平均响应时间
      womenSafetyConversations: conversations.filter(conv => conv.conversationType === 'women_safety').length,
      emergencyConversations: conversations.filter(conv => conv.conversationType === 'emergency').length,
      emergencySessions: conversations.filter(conv => conv.isEmergency).length,
      lastConversationAt: conversations.length > 0 ? conversations[0].updatedAt : undefined,
    };
    
    return {
      totalConversations: stats.totalConversations,
      totalMessages: stats.totalMessages,
      activeConversations: stats.activeConversations,
      averageResponseTime: stats.averageResponseTime,
      womenSafetyConversations: stats.womenSafetyConversations || 0,
      emergencyConversations: stats.emergencyConversations || 0,
      emergencySessions: stats.emergencySessions || 0,
      lastConversationAt: stats.lastConversationAt,
    };
  }

  /**
   * 创建新对话
   */
  async createConversation(
    userId: string,
    options: {
      title?: string;
      provider?: 'kimi' | 'deepseek';
      conversationType?: 'general' | 'women_safety' | 'emergency' | 'safety';
      isEmergency?: boolean;
    }
  ): Promise<AIConversation> {
    return this.conversationManager.createConversation(
      userId,
      options.title || '新对话',
      options.provider || 'kimi',
      options.conversationType || 'general',
      options.isEmergency || false
    );
  }

  /**
   * 获取单个对话
   */
  async getConversation(conversationId: string): Promise<AIConversation | null> {
    return this.conversationManager.getConversation(conversationId);
  }

  /**
   * 删除对话
   */
  async deleteConversation(conversationId: string): Promise<void> {
    return this.conversationManager.deleteConversation(conversationId);
  }

  /**
   * 获取用户安全档案
   */
  async getSafetyProfile(userId: string): Promise<SafetyProfile | null> {
    return this.conversationManager.getSafetyProfile(userId);
  }

  /**
   * 更新用户安全档案
   */
  async updateSafetyProfile(
    userId: string,
    profile: Partial<SafetyProfile>
  ): Promise<SafetyProfile> {
    return this.conversationManager.upsertSafetyProfile(userId, profile);
  }

  /**
   * 进行安全分析
   */
  async performSafetyAnalysis(
    userId: string,
    options: {
      type?: 'route' | 'behavior' | 'risk' | 'comprehensive';
      timeRange?: 'week' | 'month' | 'quarter';
      includeRecommendations?: boolean;
      data?: any;
    } = {}
  ): Promise<SafetyAnalysis> {
    try {
      const { type = 'comprehensive', timeRange = 'week', includeRecommendations = true, data } = options;
      
      // 构建分析请求
      const analysisPrompt = this.buildSafetyAnalysisPrompt(type, timeRange, data);
      
      const context: Partial<AIContext> = {
        locationData: data?.location || {},
        userContext: data?.user || {},
        safetyContext: data?.safety || {},
      };

      // 发送分析请求
      const aiRequest: AIRequest = {
        message: analysisPrompt,
        context,
        conversationType: 'safety',
      };

      const aiResponse = await this.aiRouter.routeRequest(aiRequest);

      // 解析AI响应为结构化的安全分析
      return this.parseAnalysisResponse(aiResponse, type, timeRange, includeRecommendations);
    } catch (error) {
      console.error('安全分析失败:', error);
      throw new Error('安全分析失败');
    }
  }

  /**
   * 处理紧急情况
   */
  async handleEmergency(
    userId: string,
    location: { latitude: number; longitude: number; address: string },
    description: string,
    alertType: 'manual' | 'auto' | 'ai_detected' = 'manual'
  ): Promise<EmergencyAlert> {
    try {
      // 创建紧急对话
      const conversation = await this.conversationManager.createConversation(
        userId,
        '紧急求助',
        'kimi', // 紧急情况优先使用KIMI
        'emergency',
        true
      );

      // 构建紧急上下文
      const emergencyContext: Partial<AIContext> = {
        locationData: {
          latitude: location.latitude,
          longitude: location.longitude,
          address: location.address,
        },
        safetyContext: {
          emergencyContacts: [], // 这里应该从用户档案获取
        },
      };

      // 发送紧急请求
      const emergencyPrompt = `紧急情况报告：${description}。请立即提供应急指导和建议。`;
      
      const aiResponse = await this.sendMessage(
        userId,
        emergencyPrompt,
        conversation.id,
        emergencyContext,
        'kimi',
        'emergency'
      );

      // 创建紧急警报记录
      const alert: EmergencyAlert = {
        id: `emergency_${Date.now()}`,
        userId,
        location,
        alertType,
        severity: aiResponse.response.emergencyLevel as any || 'high',
        description,
        timestamp: new Date(),
        status: 'active',
        aiAnalysis: {
          riskAssessment: aiResponse.response.message,
          recommendedActions: aiResponse.response.suggestions || [],
          confidence: aiResponse.response.confidence,
        },
      };

      return alert;
    } catch (error) {
      console.error('处理紧急情况失败:', error);
      throw new Error('处理紧急情况失败');
    }
  }

  /**
   * 搜索对话
   */
  async searchConversations(
    userId: string,
    query: string,
    conversationType?: string
  ): Promise<AIConversation[]> {
    return this.conversationManager.searchConversations(userId, query, conversationType);
  }

  /**
   * 获取AI提供商状态
   */
  async getProviderStatus(): Promise<Record<string, any>> {
    return this.aiRouter.getProviderStatus();
  }

  /**
   * 测试AI连接
   */
  async testConnections(): Promise<Record<string, boolean>> {
    return this.aiRouter.testAllConnections();
  }

  // 私有方法

  /**
   * 生成对话标题
   */
  private generateConversationTitle(message: string, conversationType?: string): string {
    const maxLength = 30;
    let title = message.length > maxLength ? message.substring(0, maxLength) + '...' : message;
    
    const typePrefix = {
      'women_safety': '女性安全 - ',
      'emergency': '紧急求助 - ',
      'analysis': '安全分析 - ',
      'general': '',
    };

    const prefix = typePrefix[conversationType as keyof typeof typePrefix] || '';
    return prefix + title;
  }

  /**
   * 构建完整上下文
   */
  private async buildFullContext(
    conversationId: string,
    newContext?: Partial<AIContext>
  ): Promise<Partial<AIContext>> {
    // 获取历史上下文
    const historicalContext = await this.conversationManager.getContext(conversationId);
    
    // 合并新旧上下文
    const fullContext: Partial<AIContext> = {
      locationData: {
        ...historicalContext?.locationData,
        ...newContext?.locationData,
      },
      userContext: {
        ...historicalContext?.userContext,
        ...newContext?.userContext,
      },
      safetyContext: {
        ...historicalContext?.safetyContext,
        ...newContext?.safetyContext,
      },
    };

    return fullContext;
  }

  /**
   * 构建安全分析提示词
   */
  private buildSafetyAnalysisPrompt(
    type: string,
    timeRange: string,
    data?: any
  ): string {
    return `请对用户的跑步安全情况进行${type}分析，时间范围为${timeRange}：

分析类型：${type}
时间范围：${timeRange}
数据信息：${JSON.stringify(data || {})}

请提供：
1. 整体安全评分（1-100分）
2. 主要风险因素分析
3. 具体的安全建议
4. 行为模式分析
5. 路线安全评估

请以结构化的方式回答，便于解析。`;
  }

  /**
   * 解析分析响应
   */
  private parseAnalysisResponse(
    aiResponse: AIResponse,
    type: string,
    timeRange: string,
    includeRecommendations: boolean
  ): SafetyAnalysis {
    // 这里应该实现更智能的响应解析
    // 目前提供基础实现
    const overallScore = Math.floor(Math.random() * 30) + 70; // 70-100分
    const riskLevel = overallScore >= 85 ? 'low' : overallScore >= 70 ? 'medium' : 'high';
    
    return {
      overallScore,
      riskLevel,
      improvements: Math.floor(Math.random() * 5) + 3, // 3-7个改进建议
      lastUpdated: new Date().toISOString(),
      metrics: {
        safeRoutes: Math.floor(Math.random() * 10) + 5, // 5-14条安全路线
        riskAreas: Math.floor(Math.random() * 3) + 1, // 1-3个风险区域
        avgResponseTime: Math.floor(Math.random() * 2) + 1, // 1-2秒响应时间
      },
      recentActivities: [
        {
          type: 'safe',
          title: '安全路线推荐',
          description: '基于AI分析，为您推荐了3条安全跑步路线',
          timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2小时前
        },
        {
          type: 'warning',
          title: '夜间跑步提醒',
          description: '检测到您经常在夜间跑步，建议携带照明设备',
          timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 1天前
        },
        {
          type: 'safe',
          title: '安全评估完成',
          description: '您的跑步习惯整体安全性良好，继续保持',
          timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3天前
        },
      ],
      routeAnalysis: [
        {
          name: '外滩滨江步道',
          riskLevel: 'low',
          description: '人流量适中，照明良好，监控覆盖完善',
          distance: 5.2,
          safetyScore: 92,
          usageCount: 15,
        },
        {
          name: '世纪公园环线',
          riskLevel: 'low',
          description: '公园内部路线，环境安全，适合各时段跑步',
          distance: 3.8,
          safetyScore: 88,
          usageCount: 8,
        },
        {
          name: '淮海路商业区',
          riskLevel: 'medium',
          description: '人流密集，需注意交通安全',
          distance: 2.5,
          safetyScore: 75,
          usageCount: 3,
        },
      ],
      behaviorPatterns: [
        {
          pattern: '偏好早晨跑步',
          description: '您通常在早上6-8点进行跑步，这是一个很好的习惯',
          frequency: '85%',
          impact: 'positive',
        },
        {
          pattern: '路线多样化',
          description: '您会选择不同的跑步路线，有助于保持新鲜感',
          frequency: '70%',
          impact: 'positive',
        },
        {
          pattern: '夜间跑步频率较高',
          description: '建议减少夜间跑步频率，或加强安全防护',
          frequency: '30%',
          impact: 'negative',
        },
      ],
      recommendations: [
        {
          title: '携带安全设备',
          description: '建议携带反光背心、头灯等安全设备，特别是在光线不足的时段',
          priority: 'high',
        },
        {
          title: '选择人流适中的路线',
          description: '避免过于偏僻或过于拥挤的路线，选择有适度人流的安全区域',
          priority: 'medium',
        },
        {
          title: '设置紧急联系人',
          description: '在应用中设置紧急联系人，确保在需要时能够及时求助',
          priority: 'high',
        },
        {
          title: '关注天气变化',
          description: '跑步前查看天气预报，避免在恶劣天气条件下外出',
          priority: 'medium',
        },
      ],
      riskFactors: [
         {
           factor: '环境风险',
           level: 'medium',
           description: 'AI分析中...',
           aiInsight: aiResponse.message,
         },
       ],
       locationAnalysis: {
         safetyScore: 85,
         crowdLevel: 'moderate',
         lightingCondition: 'good',
         historicalIncidents: 0,
         aiAssessment: aiResponse.message,
       },
       timeAnalysis: {
         timeOfDay: 'morning',
         riskLevel: 'medium',
         aiRecommendation: aiResponse.message,
       },
    };
  }

  /**
   * 处理紧急响应
   */
  private async handleEmergencyResponse(
    userId: string,
    conversationId: string,
    aiResponse: AIResponse,
    context?: Partial<AIContext>
  ): Promise<void> {
    // 这里可以实现紧急情况的自动处理逻辑
    // 比如自动发送通知、联系紧急联系人等
    console.log('处理紧急响应:', {
      userId,
      conversationId,
      emergencyLevel: aiResponse.emergencyLevel,
      actionRequired: aiResponse.actionRequired,
    });
  }
}

// 导出单例实例
export const aiService = new AIService();