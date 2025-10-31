import { supabase } from '../lib/supabase';
import { WeatherData, getWeatherSuitabilityScore } from './weatherService';

// 类型定义
export interface UserProfile {
  id: string;
  fitness_level: number;
  difficulty_preference: string;
  distance_range: { min: number; max: number };
  terrain_preferences: string[];
  time_preferences: string[];
  weather_preferences: any;
  running_goals: string[];
}

export interface Route {
  id: string;
  name: string;
  description: string;
  distance: number;
  difficulty_level: number;
  terrain_type: string;
  features: any;
  avg_rating: number;
  total_ratings: number;
  elevation_gain: number;
  estimated_duration: number;
  safety_rating: number;
  lighting_quality: string;
  weather_suitability: any;
  time_suitability: any;
  gps_coordinates: any;
}

export interface UserActivity {
  total_runs: number;
  total_distance: number;
  avg_pace: number;
  favorite_terrain: string;
  favorite_time: string;
  fitness_improvement_score: number;
  consistency_score: number;
  exploration_score: number;
}

export interface RunningHistory {
  id: string;
  route_id: string;
  distance: number;
  duration: number;
  avg_pace: number;
  user_rating: number;
  effort_level: number;
  weather_condition: string;
  completed_at: string;
}

export interface Recommendation {
  route: Route;
  score: number; // 添加score字段，与confidence_score保持一致
  confidence_score: number;
  reasoning: {
    factors: string[];
    weather_match: boolean;
    time_match: boolean;
    difficulty_match: boolean;
    preference_match: boolean;
    novelty_factor: boolean;
    safety_factor: boolean;
  };
  recommendation_type: string;
  weather_factor?: any;
  time_factor?: string;
  difficulty_match_score: number;
  preference_match_score: number;
  novelty_score: number;
  reason: string; // 添加reason属性
}

// AI推荐引擎类
export class RecommendationEngine {
  private userId: string;
  private userProfile: UserProfile | null = null;
  private userActivity: UserActivity | null = null;
  private runningHistory: RunningHistory[] = [];

  constructor(userId: string) {
    this.userId = userId;
  }

  // 加载用户数据
  async loadUserData(): Promise<void> {
    try {
      // 加载用户偏好
      const { data: preferences } = await supabase
        .from('user_preferences')
        .select('*')
        .eq('user_id', this.userId)
        .single();

      this.userProfile = preferences;

      // 加载用户活动统计
      const { data: activity } = await supabase
        .from('user_activity_stats')
        .select('*')
        .eq('user_id', this.userId)
        .single();

      this.userActivity = activity;

      // 加载跑步历史（最近30次）
      const { data: history } = await supabase
        .from('running_history')
        .select('*')
        .eq('user_id', this.userId)
        .order('completed_at', { ascending: false })
        .limit(30);

      this.runningHistory = history || [];
    } catch (error) {
      console.error('加载用户数据失败:', error);
    }
  }

  // 获取所有路线
  async getAllRoutes(): Promise<Route[]> {
    try {
      const { data, error } = await supabase
        .from('routes')
        .select('*')
        .order('avg_rating', { ascending: false });

      if (error) throw error;
      
      // 如果数据库中有数据，返回数据库数据
      if (data && data.length > 0) {
        return data;
      }
      
      // 如果数据库中没有数据，返回模拟数据
      return this.getFallbackRoutes();
    } catch (error) {
      console.error('获取路线数据失败:', error);
      // 出错时返回模拟数据
      return this.getFallbackRoutes();
    }
  }

  // 获取fallback路线数据
  private getFallbackRoutes(): Route[] {
    return [
      {
        id: 'route-1',
        name: '外滩滨江步道',
        description: '沿着黄浦江畔的经典跑步路线，可以欣赏到外滩万国建筑群和陆家嘴天际线的美景。',
        distance: 5.2,
        difficulty_level: 3,
        terrain_type: '平路',
        features: ['江景', '夜景', '平坦', '安全'],
        avg_rating: 4.6,
        total_ratings: 128,
        elevation_gain: 15,
        estimated_duration: 35,
        safety_rating: 9,
        lighting_quality: 'excellent',
        weather_suitability: { rain: 0.3, sun: 0.9, wind: 0.7 },
        time_suitability: { morning: 0.9, afternoon: 0.8, evening: 0.95, night: 0.85 },
        gps_coordinates: { start: [121.4737, 31.2304], end: [121.5057, 31.2396] }
      },
      {
        id: 'route-2',
        name: '世纪公园环湖跑道',
        description: '世纪公园内的环湖跑道，绿树成荫，空气清新，是市区内难得的天然氧吧。',
        distance: 3.8,
        difficulty_level: 2,
        terrain_type: '平路',
        features: ['绿化', '湖景', '空气好', '安静'],
        avg_rating: 4.4,
        total_ratings: 95,
        elevation_gain: 8,
        estimated_duration: 25,
        safety_rating: 8,
        lighting_quality: 'good',
        weather_suitability: { rain: 0.6, sun: 0.8, wind: 0.9 },
        time_suitability: { morning: 0.95, afternoon: 0.7, evening: 0.8, night: 0.4 },
        gps_coordinates: { start: [121.5569, 31.2196], end: [121.5569, 31.2196] }
      },
      {
        id: 'route-3',
        name: '徐家汇公园慢跑径',
        description: '市中心的绿色慢跑径，路线短小精悍，适合初学者和时间紧张的跑者。',
        distance: 2.5,
        difficulty_level: 1,
        terrain_type: '平路',
        features: ['便民', '短距离', '初学者友好', '交通便利'],
        avg_rating: 4.2,
        total_ratings: 67,
        elevation_gain: 5,
        estimated_duration: 18,
        safety_rating: 9,
        lighting_quality: 'excellent',
        weather_suitability: { rain: 0.7, sun: 0.8, wind: 0.8 },
        time_suitability: { morning: 0.8, afternoon: 0.9, evening: 0.85, night: 0.7 },
        gps_coordinates: { start: [121.4352, 31.1993], end: [121.4352, 31.1993] }
      },
      {
        id: 'route-4',
        name: '静安雕塑公园跑道',
        description: '静安区的艺术公园，跑道设计精美，周围雕塑作品丰富，是艺术与运动的完美结合。',
        distance: 2.8,
        difficulty_level: 2,
        terrain_type: '平路',
        features: ['艺术', '文化', '精致', '城市绿洲'],
        avg_rating: 4.3,
        total_ratings: 82,
        elevation_gain: 6,
        estimated_duration: 20,
        safety_rating: 8,
        lighting_quality: 'good',
        weather_suitability: { rain: 0.5, sun: 0.9, wind: 0.7 },
        time_suitability: { morning: 0.8, afternoon: 0.8, evening: 0.9, night: 0.6 },
        gps_coordinates: { start: [121.4458, 31.2288], end: [121.4458, 31.2288] }
      },
      {
        id: 'route-5',
        name: '复兴公园晨跑路线',
        description: '历史悠久的法式公园，古树参天，环境优雅，是晨跑的绝佳选择。',
        distance: 1.8,
        difficulty_level: 1,
        terrain_type: '平路',
        features: ['历史', '法式', '古树', '优雅'],
        avg_rating: 4.1,
        total_ratings: 54,
        elevation_gain: 3,
        estimated_duration: 15,
        safety_rating: 7,
        lighting_quality: 'fair',
        weather_suitability: { rain: 0.4, sun: 0.8, wind: 0.9 },
        time_suitability: { morning: 0.95, afternoon: 0.6, evening: 0.7, night: 0.3 },
        gps_coordinates: { start: [121.4737, 31.2304], end: [121.4737, 31.2304] }
      },
      {
        id: 'route-6',
        name: '陆家嘴滨江大道',
        description: '现代化金融区的滨江跑道，高楼林立，江景壮观，体验都市跑步的魅力。',
        distance: 4.5,
        difficulty_level: 3,
        terrain_type: '平路',
        features: ['现代', '金融区', '高楼', '都市'],
        avg_rating: 4.5,
        total_ratings: 156,
        elevation_gain: 12,
        estimated_duration: 30,
        safety_rating: 9,
        lighting_quality: 'excellent',
        weather_suitability: { rain: 0.3, sun: 0.9, wind: 0.6 },
        time_suitability: { morning: 0.8, afternoon: 0.8, evening: 0.95, night: 0.9 },
        gps_coordinates: { start: [121.5057, 31.2396], end: [121.5057, 31.2396] }
      },
      {
        id: 'route-7',
        name: '中山公园环形跑道',
        description: '传统的市民公园，跑道宽敞，设施完善，适合各个年龄段的跑者。',
        distance: 3.2,
        difficulty_level: 2,
        terrain_type: '平路',
        features: ['传统', '宽敞', '设施完善', '全年龄'],
        avg_rating: 4.0,
        total_ratings: 73,
        elevation_gain: 7,
        estimated_duration: 22,
        safety_rating: 8,
        lighting_quality: 'good',
        weather_suitability: { rain: 0.6, sun: 0.8, wind: 0.8 },
        time_suitability: { morning: 0.9, afternoon: 0.7, evening: 0.8, night: 0.5 },
        gps_coordinates: { start: [121.4220, 31.2196], end: [121.4220, 31.2196] }
      },
      {
        id: 'route-8',
        name: '黄浦江两岸贯通道',
        description: '横跨浦东浦西的长距离跑道，挑战性强，风景变化丰富，适合有经验的跑者。',
        distance: 8.5,
        difficulty_level: 5,
        terrain_type: '平路',
        features: ['长距离', '挑战', '跨江', '风景丰富'],
        avg_rating: 4.7,
        total_ratings: 89,
        elevation_gain: 25,
        estimated_duration: 55,
        safety_rating: 8,
        lighting_quality: 'good',
        weather_suitability: { rain: 0.2, sun: 0.9, wind: 0.5 },
        time_suitability: { morning: 0.9, afternoon: 0.7, evening: 0.8, night: 0.6 },
        gps_coordinates: { start: [121.4737, 31.2304], end: [121.5057, 31.2396] }
      }
    ];
  }

  // 计算用户-路线匹配度
  private calculateUserRouteMatch(route: Route): number {
    if (!this.userProfile) return 0.5;

    let score = 0;
    let factors = 0;

    // 距离偏好匹配
    if (this.userProfile.distance_range) {
      const { min, max } = this.userProfile.distance_range;
      if (route.distance >= min && route.distance <= max) {
        score += 0.25;
      } else if (route.distance < min) {
        score += Math.max(0, 0.25 * (route.distance / min));
      } else {
        score += Math.max(0, 0.25 * (max / route.distance));
      }
      factors++;
    }

    // 地形偏好匹配
    if (this.userProfile.terrain_preferences?.includes(route.terrain_type)) {
      score += 0.2;
    }
    factors++;

    // 难度偏好匹配
    const difficultyMap: Record<string, number[]> = {
      'easy': [1, 2, 3],
      'moderate': [4, 5, 6],
      'hard': [7, 8, 9, 10]
    };
    
    const preferredLevels = difficultyMap[this.userProfile.difficulty_preference] || [4, 5, 6];
    if (preferredLevels.includes(route.difficulty_level)) {
      score += 0.2;
    }
    factors++;

    // 健身水平匹配
    const levelDiff = Math.abs(this.userProfile.fitness_level - route.difficulty_level);
    if (levelDiff <= 1) {
      score += 0.15;
    } else if (levelDiff <= 2) {
      score += 0.1;
    } else if (levelDiff <= 3) {
      score += 0.05;
    }
    factors++;

    return factors > 0 ? score / factors : 0.5;
  }

  // 计算历史偏好匹配度
  private calculateHistoryMatch(route: Route): number {
    if (this.runningHistory.length === 0) return 0.5;

    // 分析用户历史跑步数据
    const avgDistance = this.runningHistory.reduce((sum, run) => sum + run.distance, 0) / this.runningHistory.length;
    const avgEffort = this.runningHistory.reduce((sum, run) => sum + (run.effort_level || 5), 0) / this.runningHistory.length;
    const avgRating = this.runningHistory.reduce((sum, run) => sum + (run.user_rating || 3), 0) / this.runningHistory.length;

    let score = 0;

    // 距离匹配
    const distanceDiff = Math.abs(route.distance - avgDistance);
    if (distanceDiff <= 1) {
      score += 0.3;
    } else if (distanceDiff <= 2) {
      score += 0.2;
    } else if (distanceDiff <= 3) {
      score += 0.1;
    }

    // 难度匹配（基于历史努力程度）
    const expectedDifficulty = Math.round(avgEffort);
    const difficultyDiff = Math.abs(route.difficulty_level - expectedDifficulty);
    if (difficultyDiff <= 1) {
      score += 0.3;
    } else if (difficultyDiff <= 2) {
      score += 0.2;
    }

    // 如果用户历史评分较高，倾向于推荐类似的路线
    if (avgRating >= 4) {
      score += 0.2;
    }

    return Math.min(1, score);
  }

  // 计算新颖度分数
  private calculateNoveltyScore(route: Route): number {
    // 检查用户是否跑过这条路线
    const hasRun = this.runningHistory.some(run => run.route_id === route.id);
    if (hasRun) {
      return 0.2; // 跑过的路线新颖度较低
    }

    // 检查是否跑过类似的路线（相同地形类型）
    const similarRuns = this.runningHistory.filter(run => {
      // 这里需要查询路线信息，简化处理
      return false; // 暂时返回false
    });

    if (similarRuns.length === 0) {
      return 1.0; // 完全新的地形类型
    } else if (similarRuns.length <= 2) {
      return 0.8; // 较少尝试的地形类型
    } else {
      return 0.6; // 经常尝试的地形类型
    }
  }

  // 计算天气匹配度
  private calculateWeatherMatch(route: Route, weather: WeatherData): number {
    if (!route.weather_suitability) return 0.5;

    const weatherSuitability = getWeatherSuitabilityScore(weather);
    let routeWeatherScore = 0;

    // 检查路线的天气适应性
    switch (weather.condition) {
      case 'clear':
      case 'sunny':
        routeWeatherScore = route.weather_suitability.sunny ? 1.0 : 0.3;
        break;
      case 'rain':
      case 'heavy-rain':
        routeWeatherScore = route.weather_suitability.rainy ? 0.8 : 0.1;
        break;
      case 'cloudy':
      case 'partly-cloudy':
        routeWeatherScore = 0.9;
        break;
      default:
        routeWeatherScore = 0.7;
    }

    // 考虑温度适应性
    if (weather.temperature > 30 && route.features?.shade) {
      routeWeatherScore += 0.2;
    }
    if (weather.temperature < 10 && route.features?.indoor) {
      routeWeatherScore += 0.3;
    }

    return Math.min(1, routeWeatherScore * weatherSuitability);
  }

  // 计算时间匹配度
  private calculateTimeMatch(route: Route, timeOfDay: string): number {
    if (!route.time_suitability) return 0.5;

    const isTimeMatch = route.time_suitability[timeOfDay];
    if (isTimeMatch) {
      return 1.0;
    }

    // 考虑安全性和照明
    if (timeOfDay === 'night') {
      if (route.lighting_quality === 'excellent') {
        return 0.8;
      } else if (route.lighting_quality === 'good') {
        return 0.6;
      } else {
        return 0.2;
      }
    }

    return 0.5;
  }

  // 生成推荐
  async generateRecommendations(
    weather: WeatherData,
    timeOfDay: string,
    limit: number = 6
  ): Promise<Recommendation[]> {
    await this.loadUserData();
    const routes = await this.getAllRoutes();
    const recommendations: Recommendation[] = [];

    for (const route of routes) {
      // 计算各项匹配分数
      const userMatch = this.calculateUserRouteMatch(route);
      const historyMatch = this.calculateHistoryMatch(route);
      const noveltyScore = this.calculateNoveltyScore(route);
      const weatherMatch = this.calculateWeatherMatch(route, weather);
      const timeMatch = this.calculateTimeMatch(route, timeOfDay);

      // 安全性分数
      const safetyScore = route.safety_rating / 5;

      // 受欢迎程度分数
      const popularityScore = Math.min(1, route.avg_rating / 5);

      // 综合置信度计算（加权平均）
      const confidenceScore = (
        userMatch * 0.25 +
        historyMatch * 0.2 +
        weatherMatch * 0.2 +
        timeMatch * 0.15 +
        safetyScore * 0.1 +
        popularityScore * 0.05 +
        noveltyScore * 0.05
      );

      // 生成推荐理由
      const reasoning = {
        factors: [],
        weather_match: weatherMatch > 0.7,
        time_match: timeMatch > 0.7,
        difficulty_match: userMatch > 0.6,
        preference_match: userMatch > 0.5,
        novelty_factor: noveltyScore > 0.8,
        safety_factor: safetyScore > 0.8
      };

      // 添加推荐理由
      if (reasoning.weather_match) reasoning.factors.push('天气条件适宜');
      if (reasoning.time_match) reasoning.factors.push('时间安排合适');
      if (reasoning.difficulty_match) reasoning.factors.push('难度匹配');
      if (reasoning.preference_match) reasoning.factors.push('符合偏好');
      if (reasoning.novelty_factor) reasoning.factors.push('新路线探索');
      if (reasoning.safety_factor) reasoning.factors.push('安全性高');
      if (popularityScore > 0.8) reasoning.factors.push('用户评价高');
      if (route.features?.scenic) reasoning.factors.push('风景优美');
      if (route.features?.facilities) reasoning.factors.push('设施完善');

      // 确定推荐类型
      let recommendationType = 'general';
      if (reasoning.weather_match && reasoning.time_match && reasoning.difficulty_match) {
        recommendationType = 'perfect_match';
      } else if (popularityScore > 0.9) {
        recommendationType = 'popular';
      } else if (route.difficulty_level >= 7) {
        recommendationType = 'challenge';
      } else if (reasoning.novelty_factor) {
        recommendationType = 'exploration';
      } else if (reasoning.safety_factor && timeOfDay === 'night') {
        recommendationType = 'safe_night';
      }

      recommendations.push({
        route,
        score: confidenceScore, // 添加score字段
        confidence_score: confidenceScore,
        reasoning,
        recommendation_type: recommendationType,
        weather_factor: weather,
        time_factor: timeOfDay,
        difficulty_match_score: userMatch,
        preference_match_score: userMatch,
        novelty_score: noveltyScore,
        reason: reasoning.factors.join('，') // 添加reason字段
      });
    }

    // 按置信度排序并返回指定数量
    return recommendations
      .sort((a, b) => b.confidence_score - a.confidence_score)
      .slice(0, limit);
  }

  // 记录用户反馈
  async recordUserFeedback(
    routeId: string,
    recommendationType: string,
    action: 'clicked' | 'completed' | 'rated',
    rating?: number
  ): Promise<void> {
    try {
      const updateData: any = {};
      
      if (action === 'clicked') {
        updateData.user_clicked = true;
      } else if (action === 'completed') {
        updateData.user_completed = true;
      } else if (action === 'rated' && rating) {
        updateData.user_rating = rating;
      }

      await supabase
        .from('route_recommendations')
        .update(updateData)
        .eq('user_id', this.userId)
        .eq('route_id', routeId)
        .eq('recommendation_type', recommendationType);
    } catch (error) {
      console.error('记录用户反馈失败:', error);
    }
  }

  // 学习用户偏好
  async learnFromUserBehavior(): Promise<void> {
    try {
      // 分析用户的点击和完成行为
      const { data: recommendations } = await supabase
        .from('route_recommendations')
        .select('*')
        .eq('user_id', this.userId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (!recommendations || recommendations.length === 0) return;

      // 分析用户偏好模式
      const clickedRecs = recommendations.filter(r => r.user_clicked);
      const completedRecs = recommendations.filter(r => r.user_completed);
      const ratedRecs = recommendations.filter(r => r.user_rating);

      // 更新用户偏好（这里可以实现更复杂的机器学习算法）
      // 简化版本：基于用户行为调整偏好权重
      
      console.log('用户行为学习完成', {
        clicked: clickedRecs.length,
        completed: completedRecs.length,
        rated: ratedRecs.length
      });
    } catch (error) {
      console.error('学习用户行为失败:', error);
    }
  }
}

// 创建推荐引擎实例
export const createRecommendationEngine = (userId: string): RecommendationEngine => {
  return new RecommendationEngine(userId);
};