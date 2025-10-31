// KIMI API客户端服务
import type { AIRequest, AIResponse, AIContext } from '../../types/ai';

export class KimiClient {
  private apiKey: string;
  private baseUrl: string;
  private model: string;

  constructor() {
    this.apiKey = import.meta.env.VITE_KIMI_API_KEY || '';
    this.baseUrl = 'https://api.moonshot.cn/v1';
    this.model = 'moonshot-v1-8k';
    
    if (!this.apiKey) {
      console.warn('KIMI API密钥未配置');
    }
  }

  /**
   * 发送消息到KIMI API
   */
  async sendMessage(request: AIRequest): Promise<AIResponse> {
    if (!this.apiKey) {
      throw new Error('KIMI API密钥未配置');
    }

    try {
      const systemPrompt = this.buildSystemPrompt(request.conversationType, request.context);
      const userMessage = this.buildUserMessage(request.message, request.context);

      console.log('发送KIMI API请求:', {
        url: `${this.baseUrl}/chat/completions`,
        model: this.model,
        messageLength: userMessage.length
      });

      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage }
          ],
          temperature: 0.7,
          max_tokens: 1000,
        }),
      });

      console.log('KIMI API响应状态:', response.status, response.statusText);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('KIMI API错误响应:', errorText);
        throw new Error(`KIMI API请求失败: ${response.status} ${response.statusText}. 详细信息: ${errorText}`);
      }

      const data = await response.json();
      console.log('KIMI API响应数据:', data);
      
      const aiMessage = data.choices[0]?.message?.content || '抱歉，我无法处理您的请求。';

      return this.parseAIResponse(aiMessage, request.conversationType);
    } catch (error) {
      console.error('KIMI API调用错误:', error);
      
      // 检查是否是CORS错误
      if (error instanceof TypeError && error.message.includes('fetch')) {
        console.warn('检测到CORS错误，使用模拟响应');
        return this.getMockResponse(request);
      }
      
      // 提供更具体的错误信息
      if (error instanceof Error && error.message.includes('401')) {
        throw new Error('API密钥无效，请检查KIMI API密钥配置');
      }
      
      if (error instanceof Error && error.message.includes('429')) {
        throw new Error('API调用频率过高，请稍后重试');
      }
      
      if (error instanceof Error && error.message.includes('500')) {
        throw new Error('KIMI服务器内部错误，请稍后重试');
      }
      
      // 如果是已知错误，直接抛出
      if (error instanceof Error && error.message.includes('KIMI API请求失败')) {
        throw error;
      }
      
      // 对于其他错误，提供模拟响应
      console.warn('API调用失败，使用模拟响应:', error);
      return this.getMockResponse(request);
    }
  }

  /**
   * 获取模拟响应（用于开发和测试）
   */
  private getMockResponse(request: AIRequest): AIResponse {
    const mockResponses = {
      general: [
        '您好！我是您的AI安全顾问。我了解到您想要咨询跑步安全相关的问题。作为专业的安全顾问，我建议您在跑步时注意以下几点：\n\n1. 选择安全的跑步路线，避免偏僻地区\n2. 告知家人或朋友您的跑步计划\n3. 携带手机和必要的安全设备\n4. 注意周围环境，保持警觉\n\n请告诉我您具体想了解哪方面的安全知识？',
        '感谢您使用我们的AI安全顾问服务。基于您的问题，我为您提供以下专业建议：\n\n跑步安全是非常重要的，特别是在城市环境中。建议您：\n- 选择光线充足的路段\n- 避开交通繁忙的区域\n- 穿着醒目的运动装备\n- 保持适当的跑步速度\n\n如果您有更具体的安全担忧，请随时告诉我。',
        '我理解您对跑步安全的关注。作为您的AI安全助手，我建议您制定一个完整的安全跑步计划：\n\n🏃‍♀️ 路线规划：选择熟悉且安全的路线\n⏰ 时间安排：避免过早或过晚的时段\n📱 通讯设备：确保手机电量充足\n👥 结伴跑步：如可能，与朋友一起跑步\n\n您还有其他想了解的安全知识吗？'
      ],
      women_safety: [
        '作为女性跑步者的专属安全顾问，我特别理解您对安全的担忧。以下是专门为女性跑步者准备的安全建议：\n\n🌟 核心安全原则：\n- 选择人流适中的公共区域\n- 避免戴耳机或只戴一只耳机\n- 携带防身警报器\n- 告知可信任的人您的跑步路线和时间\n\n💪 自信与警觉并重：\n- 保持自信的姿态\n- 信任您的直觉\n- 如感到不安，立即改变路线\n\n您有特定的安全担忧需要我帮助解决吗？',
        '女性跑步安全是我特别关注的领域。让我为您提供一些实用的安全策略：\n\n🛡️ 预防措施：\n- 变换跑步路线和时间\n- 穿着合适的运动装备\n- 避免显露贵重物品\n- 学习基本的自卫技巧\n\n📞 紧急准备：\n- 设置紧急联系人快捷拨号\n- 了解沿途的安全点（商店、警察局等）\n- 考虑使用跑步安全APP\n\n请告诉我您最关心的安全方面，我会提供更详细的指导。'
      ],
      emergency: [
        '⚠️ 紧急情况响应 ⚠️\n\n我检测到这可能是紧急情况。请立即采取以下措施：\n\n🚨 立即行动：\n1. 如果您处于危险中，立即拨打110报警\n2. 移动到安全、有人的地方\n3. 联系您的紧急联系人\n\n📍 位置安全：\n- 寻找最近的商店、餐厅或公共场所\n- 避免进入偏僻区域\n- 保持手机畅通\n\n请告诉我您的具体情况，我会提供更针对性的帮助。您的安全是最重要的！',
        '🆘 紧急安全协助 🆘\n\n我正在为您提供紧急安全支持。请保持冷静并按以下步骤操作：\n\n✅ 即时安全检查：\n- 您现在是否安全？\n- 是否需要立即报警？\n- 周围是否有其他人可以帮助？\n\n📱 紧急联系：\n- 报警电话：110\n- 医疗急救：120\n- 消防救援：119\n\n请详细描述您的情况，我会根据具体情况提供最适合的应对建议。'
      ]
    };

    const responseType = request.conversationType || 'general';
    const responses = mockResponses[responseType as keyof typeof mockResponses] || mockResponses.general;
    const randomResponse = responses[Math.floor(Math.random() * responses.length)];

    return this.parseAIResponse(randomResponse, request.conversationType);
  }

  /**
   * 构建系统提示词
   */
  private buildSystemPrompt(conversationType?: string, context?: Partial<AIContext>): string {
    const basePrompt = `你是上海城市跑应用的AI智能安全顾问，专门为跑步者提供个性化的安全建议和支持。

你的核心职责：
1. 提供专业的跑步安全建议
2. 分析当前环境的安全风险
3. 为女性跑步者提供专门的安全指导
4. 在紧急情况下提供快速响应和指导
5. 基于用户画像提供个性化建议

请始终保持：
- 专业、友善、关怀的语调
- 基于科学和实际经验的建议
- 对女性安全特别关注和敏感
- 在紧急情况下保持冷静和高效
- 提供具体可行的建议`;

    let specificPrompt = '';
    
    switch (conversationType) {
      case 'women_safety':
        specificPrompt = `
当前对话类型：女性专属安全咨询
特别关注：
- 女性跑步者面临的特殊安全风险
- 夜间跑步的安全预防措施
- 人身安全和防范意识
- 紧急情况的应对策略
- 心理安全和信心建设`;
        break;
      
      case 'emergency':
        specificPrompt = `
当前对话类型：紧急情况处理
优先级：最高
响应要求：
- 立即评估紧急程度
- 提供快速有效的应对方案
- 指导用户采取安全措施
- 必要时建议联系紧急服务
- 保持冷静并给予心理支持`;
        break;
      
      case 'analysis':
        specificPrompt = `
当前对话类型：安全分析咨询
分析重点：
- 路线安全评估
- 环境风险分析
- 个人安全状况评估
- 改进建议和预防措施
- 数据驱动的安全洞察`;
        break;
      
      default:
        specificPrompt = `
当前对话类型：一般安全咨询
提供全面的跑步安全指导和建议`;
    }

    // 添加上下文信息
    if (context) {
      let contextInfo = '\n\n当前上下文信息：';
      
      if (context.locationData) {
        contextInfo += `\n位置信息：${context.locationData.address || '未知位置'}`;
        if (context.locationData.safetyLevel) {
          contextInfo += `，安全等级：${context.locationData.safetyLevel}/10`;
        }
      }
      
      if (context.userContext) {
        contextInfo += `\n用户信息：`;
        if (context.userContext.gender) {
          contextInfo += `性别：${context.userContext.gender}`;
        }
        if (context.userContext.runningExperience) {
          contextInfo += `，跑步经验：${context.userContext.runningExperience}`;
        }
      }
      
      if (context.safetyContext) {
        contextInfo += `\n环境信息：`;
        if (context.safetyContext.timeOfDay) {
          contextInfo += `时间：${context.safetyContext.timeOfDay}`;
        }
        if (context.safetyContext.weather) {
          contextInfo += `，天气：${context.safetyContext.weather}`;
        }
        if (context.safetyContext.crowdLevel) {
          contextInfo += `，人流量：${context.safetyContext.crowdLevel}`;
        }
        if (context.safetyContext.lightingCondition) {
          contextInfo += `，照明条件：${context.safetyContext.lightingCondition}`;
        }
      }
      
      specificPrompt += contextInfo;
    }

    return basePrompt + specificPrompt;
  }

  /**
   * 构建用户消息
   */
  private buildUserMessage(message: string, context?: Partial<AIContext>): string {
    return message;
  }

  /**
   * 解析AI响应
   */
  private parseAIResponse(aiMessage: string, conversationType?: string): AIResponse {
    // 基础响应
    const response: AIResponse = {
      message: aiMessage,
      confidence: 0.8, // 默认置信度
    };

    // 检测紧急程度
    const emergencyKeywords = ['紧急', '危险', '求救', '帮助', '报警', '110', '120'];
    const hasEmergencyKeywords = emergencyKeywords.some(keyword => 
      aiMessage.toLowerCase().includes(keyword.toLowerCase())
    );

    if (hasEmergencyKeywords || conversationType === 'emergency') {
      response.emergencyLevel = 'high';
      response.actionRequired = true;
    }

    // 提取建议（简单的关键词匹配）
    const suggestions: string[] = [];
    if (aiMessage.includes('建议')) {
      // 这里可以添加更复杂的建议提取逻辑
      suggestions.push('请关注AI提供的具体建议');
    }
    
    if (suggestions.length > 0) {
      response.suggestions = suggestions;
    }

    // 添加元数据
    response.metadata = {
      provider: 'kimi',
      model: this.model,
      conversationType,
      timestamp: new Date().toISOString(),
    };

    return response;
  }

  /**
   * 检查API连接状态
   */
  async checkConnection(): Promise<boolean> {
    if (!this.apiKey) {
      return false;
    }

    try {
      const response = await fetch(`${this.baseUrl}/models`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}