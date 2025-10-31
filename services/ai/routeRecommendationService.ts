// KIMI AI智能路线推荐服务
import { KimiClient } from './kimiClient';
import type { AIRequest, AIResponse } from '../../types/ai';

export interface RoutePreferences {
  distance?: number; // 期望距离（公里）
  difficulty?: 'easy' | 'medium' | 'hard';
  terrain?: 'flat' | 'hills' | 'mixed';
  scenery?: 'urban' | 'park' | 'waterfront' | 'mixed';
  safetyLevel?: 'high' | 'medium' | 'low';
  timeOfDay?: 'morning' | 'afternoon' | 'evening' | 'night';
  weather?: string;
  userLevel?: 'beginner' | 'intermediate' | 'advanced';
}

export interface LocationData {
  latitude: number;
  longitude: number;
  address?: string;
}

export interface RouteRecommendation {
  id: string;
  name: string;
  description: string;
  distance: number;
  difficulty: string;
  estimatedTime: number;
  safetyScore: number;
  highlights: string[];
  startPoint: LocationData;
  endPoint: LocationData;
  waypoints?: LocationData[];
  reasons: string[];
  warnings?: string[];
}

export class RouteRecommendationService {
  private kimiClient: KimiClient;

  constructor() {
    this.kimiClient = new KimiClient();
  }

  /**
   * 获取智能路线推荐
   */
  async getRouteRecommendations(
    currentLocation: LocationData,
    preferences: RoutePreferences,
    userContext?: any
  ): Promise<RouteRecommendation[]> {
    try {
      const prompt = this.buildRoutePrompt(currentLocation, preferences, userContext);
      
      const request: AIRequest = {
        message: prompt,
        conversationType: 'general',
        context: {
          locationData: {
            latitude: currentLocation.latitude,
            longitude: currentLocation.longitude,
            address: currentLocation.address,
          },
          userContext: userContext || {},
        },
      };

      console.log('发送路线推荐请求到KIMI:', { prompt: prompt.substring(0, 200) + '...' });

      const response = await this.kimiClient.sendMessage(request);
      
      console.log('KIMI路线推荐响应:', response.message.substring(0, 200) + '...');

      return this.parseRouteRecommendations(response, currentLocation, preferences);
    } catch (error) {
      console.error('获取路线推荐失败:', error);
      return this.getFallbackRecommendations(currentLocation, preferences);
    }
  }

  /**
   * 构建路线推荐提示词
   */
  private buildRoutePrompt(
    location: LocationData,
    preferences: RoutePreferences,
    userContext?: any
  ): string {
    const basePrompt = `作为上海城市跑步应用的AI路线规划师，请为用户推荐3-5条个性化的跑步路线。

用户当前位置：
- 纬度: ${location.latitude}
- 经度: ${location.longitude}
- 地址: ${location.address || '未知'}

用户偏好：
- 距离: ${preferences.distance ? `${preferences.distance}公里` : '不限'}
- 难度: ${preferences.difficulty || '不限'}
- 地形: ${preferences.terrain || '不限'}
- 风景类型: ${preferences.scenery || '不限'}
- 安全要求: ${preferences.safetyLevel || '高'}
- 跑步时间: ${preferences.timeOfDay || '不限'}
- 天气条件: ${preferences.weather || '晴朗'}
- 用户水平: ${preferences.userLevel || '中级'}

请为每条路线提供以下信息（使用JSON格式）：
{
  "routes": [
    {
      "name": "路线名称",
      "description": "详细描述",
      "distance": 距离（数字，单位公里）,
      "difficulty": "easy/medium/hard",
      "estimatedTime": 预计时间（分钟）,
      "safetyScore": 安全分数（1-10）,
      "highlights": ["特色1", "特色2", "特色3"],
      "startPoint": {
        "latitude": 起点纬度,
        "longitude": 起点经度,
        "address": "起点地址"
      },
      "endPoint": {
        "latitude": 终点纬度,
        "longitude": 终点经度,
        "address": "终点地址"
      },
      "reasons": ["推荐理由1", "推荐理由2"],
      "warnings": ["注意事项1", "注意事项2"]
    }
  ]
}

请确保：
1. 路线真实存在于上海市
2. 考虑用户的安全性，特别是女性跑步者
3. 根据时间和天气条件调整推荐
4. 提供具体的地理坐标
5. 包含实用的建议和注意事项`;

    // 添加特殊情况的额外提示
    if (preferences.timeOfDay === 'night') {
      return basePrompt + `

特别注意：用户计划夜间跑步，请：
- 优先推荐照明良好的路线
- 强调安全性和人流密度
- 提供夜间跑步的安全建议`;
    }

    if (preferences.safetyLevel === 'high') {
      return basePrompt + `

特别注意：用户要求高安全性，请：
- 优先推荐监控覆盖良好的区域
- 选择人流适中的路线
- 避免偏僻或高风险区域`;
    }

    return basePrompt;
  }

  /**
   * 解析KIMI返回的路线推荐
   */
  private parseRouteRecommendations(
    response: AIResponse,
    currentLocation: LocationData,
    preferences: RoutePreferences
  ): RouteRecommendation[] {
    try {
      // 尝试从响应中提取JSON
      const jsonMatch = response.message.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const data = JSON.parse(jsonMatch[0]);
        if (data.routes && Array.isArray(data.routes)) {
          return data.routes.map((route: any, index: number) => ({
            id: `kimi_route_${Date.now()}_${index}`,
            name: route.name || `推荐路线 ${index + 1}`,
            description: route.description || '暂无描述',
            distance: route.distance || 3,
            difficulty: route.difficulty || 'medium',
            estimatedTime: route.estimatedTime || 30,
            safetyScore: route.safetyScore || 8,
            highlights: route.highlights || ['AI推荐'],
            startPoint: route.startPoint || currentLocation,
            endPoint: route.endPoint || currentLocation,
            waypoints: route.waypoints || [],
            reasons: route.reasons || ['AI智能分析推荐'],
            warnings: route.warnings || [],
          }));
        }
      }

      // 如果无法解析JSON，尝试从文本中提取信息
      return this.parseTextRecommendations(response.message, currentLocation);
    } catch (error) {
      console.error('解析路线推荐失败:', error);
      return this.getFallbackRecommendations(currentLocation, preferences);
    }
  }

  /**
   * 从文本中解析路线推荐
   */
  private parseTextRecommendations(
    text: string,
    currentLocation: LocationData
  ): RouteRecommendation[] {
    const routes: RouteRecommendation[] = [];
    
    // 简单的文本解析逻辑
    const lines = text.split('\n');
    let currentRoute: Partial<RouteRecommendation> = {};
    
    for (const line of lines) {
      if (line.includes('路线') && line.includes('：')) {
        if (currentRoute.name) {
          routes.push(this.completeRoute(currentRoute, currentLocation));
        }
        currentRoute = {
          id: `text_route_${Date.now()}_${routes.length}`,
          name: line.split('：')[1] || `路线 ${routes.length + 1}`,
        };
      } else if (line.includes('距离') && currentRoute.name) {
        const distanceMatch = line.match(/(\d+\.?\d*)/);
        if (distanceMatch) {
          currentRoute.distance = parseFloat(distanceMatch[1]);
        }
      } else if (line.includes('描述') && currentRoute.name) {
        currentRoute.description = line.split('：')[1] || line;
      }
    }
    
    if (currentRoute.name) {
      routes.push(this.completeRoute(currentRoute, currentLocation));
    }

    return routes.length > 0 ? routes : this.getFallbackRecommendations(currentLocation, {});
  }

  /**
   * 完善路线信息
   */
  private completeRoute(
    partialRoute: Partial<RouteRecommendation>,
    currentLocation: LocationData
  ): RouteRecommendation {
    return {
      id: partialRoute.id || `route_${Date.now()}`,
      name: partialRoute.name || '推荐路线',
      description: partialRoute.description || 'KIMI AI智能推荐的跑步路线',
      distance: partialRoute.distance || 3,
      difficulty: partialRoute.difficulty || 'medium',
      estimatedTime: partialRoute.estimatedTime || Math.round((partialRoute.distance || 3) * 8),
      safetyScore: partialRoute.safetyScore || 8,
      highlights: partialRoute.highlights || ['AI推荐', '个性化'],
      startPoint: partialRoute.startPoint || currentLocation,
      endPoint: partialRoute.endPoint || currentLocation,
      waypoints: partialRoute.waypoints || [],
      reasons: partialRoute.reasons || ['基于AI智能分析', '符合用户偏好'],
      warnings: partialRoute.warnings || ['注意交通安全', '保持通讯畅通'],
    };
  }

  /**
   * 获取备用路线推荐
   */
  private getFallbackRecommendations(
    currentLocation: LocationData,
    preferences: RoutePreferences
  ): RouteRecommendation[] {
    const fallbackRoutes = [
      {
        id: 'fallback_1',
        name: '外滩滨江步道',
        description: '沿着黄浦江的经典跑步路线，可欣赏外滩万国建筑群和陆家嘴天际线',
        distance: 5.2,
        difficulty: 'medium',
        estimatedTime: 35,
        safetyScore: 9,
        highlights: ['江景', '夜景', '平坦', '安全'],
        startPoint: { latitude: 31.2304, longitude: 121.4737, address: '外滩' },
        endPoint: { latitude: 31.2396, longitude: 121.5057, address: '陆家嘴' },
        reasons: ['风景优美', '安全性高', '设施完善'],
        warnings: ['注意人流密集', '避免恶劣天气'],
      },
      {
        id: 'fallback_2',
        name: '世纪公园环湖跑道',
        description: '世纪公园内的环湖跑道，绿树成荫，空气清新',
        distance: 3.8,
        difficulty: 'easy',
        estimatedTime: 25,
        safetyScore: 8,
        highlights: ['绿化', '湖景', '空气好', '安静'],
        startPoint: { latitude: 31.2288, longitude: 121.5515, address: '世纪公园' },
        endPoint: { latitude: 31.2288, longitude: 121.5515, address: '世纪公园' },
        reasons: ['环境优美', '空气质量好', '适合晨跑'],
        warnings: ['注意开放时间', '雨天路滑'],
      },
      {
        id: 'fallback_3',
        name: '人民广场周边',
        description: '市中心的便民跑步路线，交通便利，设施齐全',
        distance: 2.5,
        difficulty: 'easy',
        estimatedTime: 20,
        safetyScore: 7,
        highlights: ['交通便利', '设施齐全', '人流适中'],
        startPoint: { latitude: 31.2317, longitude: 121.4751, address: '人民广场' },
        endPoint: { latitude: 31.2317, longitude: 121.4751, address: '人民广场' },
        reasons: ['位置便利', '适合初学者', '安全可靠'],
        warnings: ['避开高峰时段', '注意车辆'],
      },
    ];

    // 根据偏好过滤和调整
    return fallbackRoutes
      .filter(route => {
        if (preferences.difficulty && route.difficulty !== preferences.difficulty) {
          return false;
        }
        if (preferences.distance && Math.abs(route.distance - preferences.distance) > 2) {
          return false;
        }
        return true;
      })
      .slice(0, 3);
  }
}

// 导出单例
export const routeRecommendationService = new RouteRecommendationService();