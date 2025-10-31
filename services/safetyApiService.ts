// 安全评估API服务
export interface SafetyApiConfig {
  baseUrl: string;
  apiKey?: string;
  timeout: number;
}

export interface LocationData {
  lng: number;
  lat: number;
  accuracy?: number;
  timestamp: number;
}

export interface SafetyAssessmentRequest {
  location: LocationData;
  timeSlot: string; // 'morning' | 'afternoon' | 'evening' | 'night'
  routePoints?: LocationData[];
  userProfile?: {
    gender: 'male' | 'female' | 'other';
    age: number;
    experience: 'beginner' | 'intermediate' | 'advanced';
  };
}

export interface SafetyAssessmentResponse {
  overallScore: number;
  riskFactors: {
    lighting: number;
    crowdDensity: number;
    crimeRate: number;
    trafficSafety: number;
    weatherConditions: number;
  };
  recommendations: string[];
  riskHotspots: RiskHotspot[];
  alternativeRoutes?: RouteRecommendation[];
  emergencyContacts: EmergencyContact[];
}

export interface RiskHotspot {
  location: LocationData;
  type: 'crime' | 'accident' | 'lighting' | 'crowd' | 'weather';
  level: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  radius: number; // 影响半径（米）
  reportedAt: string;
  verifiedAt?: string;
}

export interface RouteRecommendation {
  id: string;
  name: string;
  points: LocationData[];
  distance: number;
  estimatedTime: number;
  safetyScore: number;
  features: string[];
  difficulty: 'easy' | 'medium' | 'hard';
}

export interface EmergencyContact {
  id: string;
  name: string;
  phone: string;
  type: 'police' | 'medical' | 'fire' | 'personal';
  location?: LocationData;
  distance?: number;
}

export interface EmergencyReportRequest {
  type: 'sos' | 'medical' | 'accident' | 'harassment' | 'suspicious';
  location: LocationData;
  description?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  userId: string;
  timestamp: number;
}

export interface EmergencyReportResponse {
  reportId: string;
  status: 'received' | 'processing' | 'dispatched' | 'resolved';
  estimatedResponseTime?: number;
  assignedContacts: EmergencyContact[];
  instructions: string[];
}

export interface HistoricalSafetyData {
  location: LocationData;
  timeRange: {
    start: string;
    end: string;
  };
  incidents: SafetyIncident[];
  statistics: {
    totalIncidents: number;
    incidentsByType: Record<string, number>;
    averageSafetyScore: number;
    trendDirection: 'improving' | 'stable' | 'declining';
  };
}

export interface SafetyIncident {
  id: string;
  type: string;
  location: LocationData;
  timestamp: string;
  severity: string;
  description: string;
  resolved: boolean;
  reportedBy: string;
}

export class SafetyApiService {
  private config: SafetyApiConfig;

  constructor(config: SafetyApiConfig) {
    this.config = config;
  }

  // 获取安全评估
  async getSafetyAssessment(request: SafetyAssessmentRequest): Promise<SafetyAssessmentResponse> {
    try {
      const response = await this.makeRequest('/api/safety/assessment', {
        method: 'POST',
        body: JSON.stringify(request)
      });

      return response as SafetyAssessmentResponse;
    } catch (error) {
      console.error('Safety assessment failed:', error);
      // 返回模拟数据作为后备
      return this.getMockSafetyAssessment(request);
    }
  }

  // 获取实时安全评分
  async getRealTimeSafetyScore(location: LocationData): Promise<number> {
    try {
      const response = await this.makeRequest('/api/safety/realtime-score', {
        method: 'POST',
        body: JSON.stringify({ location })
      });

      return response.score;
    } catch (error) {
      console.error('Real-time safety score failed:', error);
      // 返回基于时间和位置的模拟评分
      return this.calculateMockSafetyScore(location);
    }
  }

  // 报告紧急情况
  async reportEmergency(request: EmergencyReportRequest): Promise<EmergencyReportResponse> {
    try {
      const response = await this.makeRequest('/api/emergency/report', {
        method: 'POST',
        body: JSON.stringify(request)
      });

      return response as EmergencyReportResponse;
    } catch (error) {
      console.error('Emergency report failed:', error);
      // 返回模拟响应
      return this.getMockEmergencyResponse(request);
    }
  }

  // 获取附近紧急联系人
  async getNearbyEmergencyContacts(location: LocationData, radius: number = 5000): Promise<EmergencyContact[]> {
    try {
      const response = await this.makeRequest('/api/emergency/contacts', {
        method: 'POST',
        body: JSON.stringify({ location, radius })
      });

      return response.contacts;
    } catch (error) {
      console.error('Get emergency contacts failed:', error);
      return this.getMockEmergencyContacts(location);
    }
  }

  // 获取历史安全数据
  async getHistoricalSafetyData(location: LocationData, days: number = 30): Promise<HistoricalSafetyData> {
    try {
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);

      const response = await this.makeRequest('/api/safety/historical', {
        method: 'POST',
        body: JSON.stringify({
          location,
          timeRange: {
            start: startDate.toISOString(),
            end: endDate.toISOString()
          }
        })
      });

      return response as HistoricalSafetyData;
    } catch (error) {
      console.error('Get historical safety data failed:', error);
      return this.getMockHistoricalData(location, days);
    }
  }

  // 获取路线安全分析
  async getRouteSafetyAnalysis(routePoints: LocationData[]): Promise<RouteRecommendation[]> {
    try {
      const response = await this.makeRequest('/api/safety/route-analysis', {
        method: 'POST',
        body: JSON.stringify({ routePoints })
      });

      return response.routes;
    } catch (error) {
      console.error('Route safety analysis failed:', error);
      return this.getMockRouteRecommendations(routePoints);
    }
  }

  // 通用请求方法
  private async makeRequest(endpoint: string, options: RequestInit = {}): Promise<any> {
    const url = `${this.config.baseUrl}${endpoint}`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    const defaultOptions: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...(this.config.apiKey && { 'Authorization': `Bearer ${this.config.apiKey}` })
      },
      signal: controller.signal
    };

    try {
      const response = await fetch(url, { ...defaultOptions, ...options });
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }
      
      return response.json();
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  // 模拟数据方法
  private getMockSafetyAssessment(request: SafetyAssessmentRequest): SafetyAssessmentResponse {
    const baseScore = 75;
    const timeMultiplier = this.getTimeMultiplier(request.timeSlot);
    const overallScore = Math.max(0, Math.min(100, baseScore * timeMultiplier + Math.random() * 10 - 5));

    return {
      overallScore: Math.round(overallScore),
      riskFactors: {
        lighting: this.calculateLightingScore(request.timeSlot),
        crowdDensity: 70 + Math.random() * 20,
        crimeRate: 80 + Math.random() * 15,
        trafficSafety: 75 + Math.random() * 20,
        weatherConditions: 85 + Math.random() * 10
      },
      recommendations: this.generateRecommendations(request),
      riskHotspots: this.generateMockRiskHotspots(request.location),
      emergencyContacts: this.getMockEmergencyContacts(request.location)
    };
  }

  private calculateMockSafetyScore(location: LocationData): number {
    const hour = new Date().getHours();
    let score = 75;

    // 基于时间调整
    if (hour >= 6 && hour <= 18) score += 15;
    else if (hour >= 19 && hour <= 22) score += 5;
    else score -= 20;

    // 添加随机变化
    score += Math.random() * 10 - 5;

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  private getMockEmergencyResponse(request: EmergencyReportRequest): EmergencyReportResponse {
    return {
      reportId: `EMG-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      status: 'received',
      estimatedResponseTime: request.severity === 'critical' ? 300 : 600, // 5-10分钟
      assignedContacts: this.getMockEmergencyContacts(request.location).slice(0, 2),
      instructions: [
        '保持冷静，确保自身安全',
        '如果可能，移动到安全区域',
        '保持手机畅通，等待救援人员联系',
        '记录周围环境和可疑人员信息'
      ]
    };
  }

  private getMockEmergencyContacts(location: LocationData): EmergencyContact[] {
    return [
      {
        id: 'police-001',
        name: '黄浦区派出所',
        phone: '021-23456789',
        type: 'police',
        location: {
          lng: location.lng + 0.001,
          lat: location.lat + 0.001,
          timestamp: Date.now()
        },
        distance: 500
      },
      {
        id: 'medical-001',
        name: '瑞金医院急诊科',
        phone: '021-34567890',
        type: 'medical',
        location: {
          lng: location.lng + 0.002,
          lat: location.lat - 0.001,
          timestamp: Date.now()
        },
        distance: 800
      },
      {
        id: 'fire-001',
        name: '消防救援站',
        phone: '119',
        type: 'fire',
        location: {
          lng: location.lng - 0.001,
          lat: location.lat + 0.002,
          timestamp: Date.now()
        },
        distance: 1200
      }
    ];
  }

  private getMockHistoricalData(location: LocationData, days: number): HistoricalSafetyData {
    const incidents: SafetyIncident[] = [];
    const incidentTypes = ['theft', 'harassment', 'accident', 'suspicious'];
    
    // 生成模拟历史事件
    for (let i = 0; i < Math.floor(Math.random() * 10); i++) {
      const daysAgo = Math.floor(Math.random() * days);
      const timestamp = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
      
      incidents.push({
        id: `INC-${timestamp.getTime()}-${i}`,
        type: incidentTypes[Math.floor(Math.random() * incidentTypes.length)],
        location: {
          lng: location.lng + (Math.random() - 0.5) * 0.01,
          lat: location.lat + (Math.random() - 0.5) * 0.01,
          timestamp: timestamp.getTime()
        },
        timestamp: timestamp.toISOString(),
        severity: ['low', 'medium', 'high'][Math.floor(Math.random() * 3)],
        description: '模拟安全事件描述',
        resolved: Math.random() > 0.3,
        reportedBy: 'anonymous'
      });
    }

    const incidentsByType = incidents.reduce((acc, incident) => {
      acc[incident.type] = (acc[incident.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      location,
      timeRange: {
        start: new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString(),
        end: new Date().toISOString()
      },
      incidents,
      statistics: {
        totalIncidents: incidents.length,
        incidentsByType,
        averageSafetyScore: 75 + Math.random() * 20,
        trendDirection: ['improving', 'stable', 'declining'][Math.floor(Math.random() * 3)] as any
      }
    };
  }

  private getMockRouteRecommendations(routePoints: LocationData[]): RouteRecommendation[] {
    return [
      {
        id: 'route-001',
        name: '外滩安全跑道',
        points: routePoints,
        distance: 3200,
        estimatedTime: 20,
        safetyScore: 92,
        features: ['良好照明', '监控覆盖', '人流密集', '紧急电话'],
        difficulty: 'easy'
      },
      {
        id: 'route-002',
        name: '人民公园环线',
        points: routePoints.map(p => ({
          ...p,
          lng: p.lng + 0.001,
          lat: p.lat + 0.001
        })),
        distance: 2800,
        estimatedTime: 18,
        safetyScore: 88,
        features: ['公园环境', '定期巡逻', '应急设施'],
        difficulty: 'easy'
      }
    ];
  }

  private getTimeMultiplier(timeSlot: string): number {
    switch (timeSlot) {
      case 'morning': return 1.1;
      case 'afternoon': return 1.0;
      case 'evening': return 0.9;
      case 'night': return 0.7;
      default: return 1.0;
    }
  }

  private calculateLightingScore(timeSlot: string): number {
    switch (timeSlot) {
      case 'morning': return 85;
      case 'afternoon': return 95;
      case 'evening': return 70;
      case 'night': return 45;
      default: return 75;
    }
  }

  private generateRecommendations(request: SafetyAssessmentRequest): string[] {
    const recommendations: string[] = [];
    
    if (request.timeSlot === 'night') {
      recommendations.push('夜间跑步建议结伴进行');
      recommendations.push('选择照明良好的路段');
    }
    
    if (request.userProfile?.gender === 'female') {
      recommendations.push('建议使用女性专用跑步路线');
      recommendations.push('携带个人安全设备');
    }
    
    recommendations.push('保持手机电量充足');
    recommendations.push('告知家人或朋友跑步路线');
    
    return recommendations;
  }

  private generateMockRiskHotspots(location: LocationData): RiskHotspot[] {
    return [
      {
        location: {
          lng: location.lng + 0.001,
          lat: location.lat + 0.001,
          timestamp: Date.now()
        },
        type: 'lighting',
        level: 'medium',
        description: '照明不足区域',
        radius: 100,
        reportedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      },
      {
        location: {
          lng: location.lng - 0.002,
          lat: location.lat + 0.001,
          timestamp: Date.now()
        },
        type: 'crime',
        level: 'high',
        description: '近期有盗窃案件报告',
        radius: 200,
        reportedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        verifiedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
      }
    ];
  }
}

// 默认配置
export const defaultSafetyApiConfig: SafetyApiConfig = {
  baseUrl: process.env.REACT_APP_API_URL || 'http://localhost:3001',
  apiKey: process.env.REACT_APP_API_KEY,
  timeout: 10000
};

// 创建默认实例
export const safetyApiService = new SafetyApiService(defaultSafetyApiConfig);