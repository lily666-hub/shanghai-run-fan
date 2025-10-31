import { RealtimeLocation, TimeSlot, RiskFactor, EnvironmentalData, RiskAnalysis } from '../types';
import { SafetyScore } from '../utils/safetyAlgorithm';

export interface SafetyAnalysisConfig {
  timeSlotWeights: Record<TimeSlot, number>;
  riskFactorWeights: Record<RiskFactor, number>;
  locationHistoryDays: number;
  minimumDataPoints: number;
}

export interface TimeSlotSafetyData {
  timeSlot: TimeSlot;
  safetyScore: number;
  riskFactors: RiskFactor[];
  incidentCount: number;
  totalRuns: number;
  averageSpeed: number;
  environmentalRisk: number;
}

export interface RouteSafetyAnalysis {
  routeId: string;
  overallSafetyScore: number;
  timeSlotAnalysis: TimeSlotSafetyData[];
  riskHotspots: Array<{
    location: RealtimeLocation;
    riskLevel: 'low' | 'medium' | 'high';
    riskFactors: RiskFactor[];
    description: string;
  }>;
  recommendations: string[];
}

const defaultConfig: SafetyAnalysisConfig = {
  timeSlotWeights: {
    'early_morning': 0.7,    // 5-7点，较安全但光线不足
    'morning': 0.9,          // 7-10点，最安全
    'late_morning': 0.85,    // 10-12点，安全
    'afternoon': 0.8,        // 12-17点，较安全
    'evening': 0.6,          // 17-20点，人流多但光线渐暗
    'night': 0.3,            // 20-23点，风险较高
    'late_night': 0.1        // 23-5点，风险最高
  },
  riskFactorWeights: {
    'poor_lighting': 0.8,
    'isolated_area': 0.9,
    'high_crime_rate': 0.95,
    'heavy_traffic': 0.7,
    'construction_zone': 0.6,
    'weather_conditions': 0.5,
    'crowd_density': 0.4
  },
  locationHistoryDays: 30,
  minimumDataPoints: 5
};

class SafetyAnalysisService {
  private config: SafetyAnalysisConfig;

  constructor(config: Partial<SafetyAnalysisConfig> = {}) {
    this.config = { ...defaultConfig, ...config };
  }

  /**
   * 获取时间段
   */
  getTimeSlot(date: Date): TimeSlot {
    const hour = date.getHours();
    
    if (hour >= 5 && hour < 7) return 'early_morning';
    if (hour >= 7 && hour < 10) return 'morning';
    if (hour >= 10 && hour < 12) return 'late_morning';
    if (hour >= 12 && hour < 17) return 'afternoon';
    if (hour >= 17 && hour < 20) return 'evening';
    if (hour >= 20 && hour < 23) return 'night';
    return 'late_night';
  }

  /**
   * 计算基础时间段安全分数
   */
  calculateTimeSlotBaseSafety(timeSlot: TimeSlot): number {
    return this.config.timeSlotWeights[timeSlot] * 100;
  }

  /**
   * 分析环境风险因素
   */
  analyzeEnvironmentalRisk(location: RealtimeLocation, environmentalData?: EnvironmentalData): RiskAnalysis {
    const riskFactors: RiskFactor[] = [];
    let riskScore = 0;

    // 基于时间的风险分析
    const timeSlot = this.getTimeSlot(new Date());
    const timeRisk = 1 - this.config.timeSlotWeights[timeSlot];
    riskScore += timeRisk * 40;

    if (timeSlot === 'night' || timeSlot === 'late_night') {
      riskFactors.push('poor_lighting');
    }

    // 基于环境数据的风险分析
    if (environmentalData) {
      // 天气条件
      if (environmentalData.weather_condition === 'rain' || 
          environmentalData.weather_condition === 'storm') {
        riskFactors.push('weather_conditions');
        riskScore += this.config.riskFactorWeights.weather_conditions * 20;
      }

      // 人群密度
      if (environmentalData.crowd_density < 20) {
        riskFactors.push('isolated_area');
        riskScore += this.config.riskFactorWeights.isolated_area * 25;
      } else if (environmentalData.crowd_density > 80) {
        riskFactors.push('crowd_density');
        riskScore += this.config.riskFactorWeights.crowd_density * 15;
      }

      // 能见度低时增加风险
      if (environmentalData.visibility < 40) {
        riskFactors.push('weather_conditions');
        riskScore += this.config.riskFactorWeights.weather_conditions * 15;
      }

      // 照明条件
      if (environmentalData.lighting_level < 40) {
        riskFactors.push('poor_lighting');
        riskScore += this.config.riskFactorWeights.poor_lighting * 25;
      }
    }

    // 基于位置的历史风险分析（模拟数据）
    const historicalRisk = this.getHistoricalLocationRisk(location);
    riskScore += historicalRisk * 30;

    if (historicalRisk > 0.7) {
      riskFactors.push('high_crime_rate');
    }

    return {
      overall_risk: Math.min(riskScore, 100),
      risk_factors: riskFactors,
      recommendations: [],
      safe_alternatives: []
    };
  }

  /**
   * 获取历史位置风险（模拟实现）
   */
  private getHistoricalLocationRisk(location: RealtimeLocation): number {
    // 模拟基于经纬度的风险计算
    // 实际实现中应该查询历史事件数据库
    const lat = location.latitude;
    const lng = location.longitude;
    
    // 简单的风险模拟：某些区域风险较高
    if (lat > 31.2 && lat < 31.25 && lng > 121.45 && lng < 121.5) {
      return 0.8; // 高风险区域
    } else if (lat > 31.15 && lat < 31.3 && lng > 121.4 && lng < 121.55) {
      return 0.4; // 中等风险区域
    }
    
    return 0.2; // 低风险区域
  }

  /**
   * 计算置信度
   */
  private calculateConfidence(riskFactorCount: number): number {
    // 基于风险因素数量和数据完整性计算置信度
    const baseConfidence = 0.6;
    const factorBonus = Math.min(riskFactorCount * 0.1, 0.3);
    return Math.min(baseConfidence + factorBonus, 0.95);
  }

  /**
   * 分析时间段安全性
   */
  analyzeTimeSlotSafety(
    timeSlot: TimeSlot, 
    locationHistory: RealtimeLocation[],
    incidentData?: Array<{ timeSlot: TimeSlot; location: RealtimeLocation; type: string }>
  ): TimeSlotSafetyData {
    const baseSafety = this.calculateTimeSlotBaseSafety(timeSlot);
    
    // 过滤该时间段的历史数据
    const timeSlotHistory = locationHistory.filter(loc => 
      this.getTimeSlot(new Date(loc.timestamp)) === timeSlot
    );

    // 计算该时间段的事件数量
    const incidents = incidentData?.filter(incident => incident.timeSlot === timeSlot) || [];
    const incidentCount = incidents.length;
    const totalRuns = timeSlotHistory.length;

    // 计算平均速度
    const averageSpeed = timeSlotHistory.reduce((sum, loc) => 
      sum + (loc.speed || 0), 0) / Math.max(timeSlotHistory.length, 1);

    // 分析环境风险
    const environmentalRisk = timeSlotHistory.length > 0 
      ? this.analyzeEnvironmentalRisk(timeSlotHistory[0]).overall_risk 
      : 50;

    // 基于事件率调整安全分数
    const incidentRate = totalRuns > 0 ? incidentCount / totalRuns : 0;
    const adjustedSafety = baseSafety * (1 - incidentRate * 0.5);

    // 识别主要风险因素
    const riskFactors: RiskFactor[] = [];
    if (timeSlot === 'night' || timeSlot === 'late_night') {
      riskFactors.push('poor_lighting');
    }
    if (incidentRate > 0.1) {
      riskFactors.push('high_crime_rate');
    }

    return {
      timeSlot,
      safetyScore: Math.max(adjustedSafety, 0),
      riskFactors,
      incidentCount,
      totalRuns,
      averageSpeed,
      environmentalRisk
    };
  }

  /**
   * 分析路线安全性
   */
  analyzeRouteSafety(
    routeLocations: RealtimeLocation[],
    historicalData?: RealtimeLocation[],
    incidentData?: Array<{ timeSlot: TimeSlot; location: RealtimeLocation; type: string }>
  ): RouteSafetyAnalysis {
    if (routeLocations.length === 0) {
      throw new Error('路线数据不能为空');
    }

    // 分析每个时间段的安全性
    const timeSlots: TimeSlot[] = ['early_morning', 'morning', 'late_morning', 'afternoon', 'evening', 'night', 'late_night'];
    const timeSlotAnalysis = timeSlots.map(timeSlot => 
      this.analyzeTimeSlotSafety(timeSlot, historicalData || [], incidentData)
    );

    // 识别风险热点
    const riskHotspots = this.identifyRiskHotspots(routeLocations);

    // 计算整体安全分数
    const overallSafetyScore = this.calculateOverallSafety(timeSlotAnalysis, riskHotspots);

    // 生成安全建议
    const recommendations = this.generateSafetyRecommendations(timeSlotAnalysis, riskHotspots);

    return {
      routeId: this.generateRouteId(routeLocations),
      overallSafetyScore,
      timeSlotAnalysis,
      riskHotspots,
      recommendations
    };
  }

  /**
   * 识别风险热点
   */
  private identifyRiskHotspots(locations: RealtimeLocation[]) {
    const hotspots: RouteSafetyAnalysis['riskHotspots'] = [];

    for (let i = 0; i < locations.length; i += Math.floor(locations.length / 10)) {
      const location = locations[i];
      const riskAnalysis = this.analyzeEnvironmentalRisk(location);
      
      if (riskAnalysis.overall_risk > 60) {
        const riskLevel = riskAnalysis.overall_risk > 80 ? 'high' : riskAnalysis.overall_risk > 40 ? 'medium' : 'low';
        hotspots.push({
          location,
          riskLevel: riskLevel as 'low' | 'medium' | 'high',
          riskFactors: riskAnalysis.risk_factors,
          description: this.generateRiskDescription(riskAnalysis.risk_factors)
        });
      }
    }

    return hotspots;
  }

  /**
   * 计算整体安全分数
   */
  private calculateOverallSafety(
    timeSlotAnalysis: TimeSlotSafetyData[], 
    riskHotspots: RouteSafetyAnalysis['riskHotspots']
  ): number {
    // 基于时间段分析的平均安全分数
    const timeSlotAverage = timeSlotAnalysis.reduce((sum, data) => 
      sum + data.safetyScore, 0) / timeSlotAnalysis.length;

    // 基于风险热点的扣分
    const hotspotPenalty = riskHotspots.length * 5;

    return Math.max(timeSlotAverage - hotspotPenalty, 0);
  }

  /**
   * 生成安全建议
   */
  private generateSafetyRecommendations(
    timeSlotAnalysis: TimeSlotSafetyData[], 
    riskHotspots: RouteSafetyAnalysis['riskHotspots']
  ): string[] {
    const recommendations: string[] = [];

    // 基于时间段分析的建议
    const safestTimeSlot = timeSlotAnalysis.reduce((safest, current) => 
      current.safetyScore > safest.safetyScore ? current : safest
    );
    
    const riskiestTimeSlot = timeSlotAnalysis.reduce((riskiest, current) => 
      current.safetyScore < riskiest.safetyScore ? current : riskiest
    );

    recommendations.push(`建议在${this.getTimeSlotName(safestTimeSlot.timeSlot)}跑步，安全分数最高（${safestTimeSlot.safetyScore.toFixed(1)}分）`);
    
    if (riskiestTimeSlot.safetyScore < 50) {
      recommendations.push(`避免在${this.getTimeSlotName(riskiestTimeSlot.timeSlot)}跑步，风险较高`);
    }

    // 基于风险热点的建议
    if (riskHotspots.length > 0) {
      recommendations.push(`路线中发现${riskHotspots.length}个风险点，建议调整路线或提高警惕`);
      
      const commonRiskFactors = this.getCommonRiskFactors(riskHotspots);
      if (commonRiskFactors.includes('poor_lighting')) {
        recommendations.push('携带照明设备，选择光线充足的路段');
      }
      if (commonRiskFactors.includes('isolated_area')) {
        recommendations.push('避免独自在偏僻区域跑步，建议结伴或选择人流较多的路线');
      }
      if (commonRiskFactors.includes('heavy_traffic')) {
        recommendations.push('注意交通安全，选择有人行道或专用跑道的路线');
      }
    }

    // 通用安全建议
    recommendations.push('随身携带手机并确保电量充足');
    recommendations.push('告知他人您的跑步路线和预计返回时间');
    recommendations.push('穿着反光或亮色服装提高可见性');

    return recommendations;
  }

  /**
   * 获取时间段名称
   */
  private getTimeSlotName(timeSlot: TimeSlot): string {
    const names = {
      'early_morning': '清晨（5-7点）',
      'morning': '上午（7-10点）',
      'late_morning': '上午晚些（10-12点）',
      'afternoon': '下午（12-17点）',
      'evening': '傍晚（17-20点）',
      'night': '夜晚（20-23点）',
      'late_night': '深夜（23-5点）'
    };
    return names[timeSlot];
  }

  /**
   * 获取常见风险因素
   */
  private getCommonRiskFactors(hotspots: RouteSafetyAnalysis['riskHotspots']): RiskFactor[] {
    const factorCounts: Record<RiskFactor, number> = {} as Record<RiskFactor, number>;
    
    hotspots.forEach(hotspot => {
      hotspot.riskFactors.forEach(factor => {
        factorCounts[factor] = (factorCounts[factor] || 0) + 1;
      });
    });

    return Object.entries(factorCounts)
      .filter(([_, count]) => count >= Math.ceil(hotspots.length * 0.3))
      .map(([factor, _]) => factor as RiskFactor);
  }

  /**
   * 生成风险描述
   */
  private generateRiskDescription(riskFactors: RiskFactor[]): string {
    const descriptions = {
      'poor_lighting': '照明不足',
      'isolated_area': '偏僻区域',
      'high_crime_rate': '治安风险',
      'heavy_traffic': '交通繁忙',
      'construction_zone': '施工区域',
      'weather_conditions': '天气不佳',
      'crowd_density': '人群拥挤'
    };

    return riskFactors.map(factor => descriptions[factor]).join('、');
  }

  /**
   * 生成路线ID
   */
  private generateRouteId(locations: RealtimeLocation[]): string {
    if (locations.length === 0) return 'empty-route';
    
    const start = locations[0];
    const end = locations[locations.length - 1];
    const hash = Math.abs(
      start.latitude * 1000000 + 
      start.longitude * 1000000 + 
      end.latitude * 1000000 + 
      end.longitude * 1000000
    ).toString(36);
    
    return `route-${hash}`;
  }

  /**
   * 获取实时安全评估
   */
  getRealTimeSafetyAssessment(
    currentLocation: RealtimeLocation,
    environmentalData?: EnvironmentalData
  ): SafetyScore {
    const riskAnalysis = this.analyzeEnvironmentalRisk(currentLocation, environmentalData);
    const timeSlot = this.getTimeSlot(new Date());
    const baseSafety = this.calculateTimeSlotBaseSafety(timeSlot);
    
    // 综合计算安全分数
    const safetyScore = Math.max(baseSafety - riskAnalysis.overall_risk, 0);
    
    const level = safetyScore >= 80 ? 'very_safe' : 
                  safetyScore >= 70 ? 'safe' : 
                  safetyScore >= 55 ? 'moderate' : 
                  safetyScore >= 40 ? 'risky' : 'dangerous';

    const factors = {
      lighting: baseSafety,
      crowdDensity: environmentalData ? environmentalData.crowd_density : 75,
      crimeRate: 100 - this.getHistoricalLocationRisk(currentLocation) * 100,
      emergencyAccess: 85,
      roadCondition: 90,
      weatherCondition: environmentalData ? (100 - (environmentalData.weather_condition === 'rain' ? 30 : 0)) : 85,
      timeOfDay: baseSafety,
      historicalIncidents: 100 - this.getHistoricalLocationRisk(currentLocation) * 100
    };

    return {
      overall: safetyScore,
      level,
      factors,
      recommendations: this.generateSafetyRecommendations(
        [this.analyzeTimeSlotSafety(timeSlot, [currentLocation])],
        riskAnalysis.overall_risk > 7 ? [{
          location: currentLocation,
          riskLevel: riskAnalysis.overall_risk > 7 ? 'high' : 'medium',
          riskFactors: riskAnalysis.risk_factors,
          description: this.generateRiskDescription(riskAnalysis.risk_factors)
        }] : []
      ),
      alerts: riskAnalysis.overall_risk > 7 ? [{
        type: 'warning' as const,
        message: '当前区域存在安全风险，请提高警惕',
        priority: 'high' as const
      }] : []
    };
  }
}

export const safetyAnalysisService = new SafetyAnalysisService();