import { supabase } from '../lib/supabase';
import { FeedbackData } from '../components/RouteFeedback';

export interface RouteFeedbackRecord {
  id: string;
  route_id: string;
  user_id: string;
  rating: number;
  difficulty_rating: number;
  safety_rating: number;
  scenery_rating: number;
  tags: string[];
  comment: string;
  would_recommend: boolean;
  created_at: string;
  updated_at: string;
}

export interface FeedbackStats {
  routeId: string;
  averageRating: number;
  totalFeedbacks: number;
  difficultyRating: number;
  safetyRating: number;
  sceneryRating: number;
  recommendationRate: number;
  popularTags: { tag: string; count: number }[];
  recentComments: { comment: string; rating: number; createdAt: string }[];
}

export class FeedbackService {
  // 提交路线反馈
  static async submitFeedback(feedback: FeedbackData, userId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('route_feedback')
        .insert({
          route_id: feedback.routeId,
          user_id: userId,
          rating: feedback.rating,
          difficulty_rating: feedback.difficulty,
          safety_rating: feedback.safety,
          scenery_rating: feedback.scenery,
          tags: feedback.tags,
          feedback_text: feedback.comment, // 使用现有表的字段名
          // would_recommend 字段在现有表中不存在，暂时注释掉
        });

      if (error) {
        throw new Error(`提交反馈失败: ${error.message}`);
      }

      // 更新推荐引擎的学习数据
      await this.updateRecommendationLearning(feedback, userId);
    } catch (error) {
      console.error('提交反馈失败:', error);
      throw error;
    }
  }

  // 获取路线反馈统计
  static async getRouteFeedbackStats(routeId: string): Promise<FeedbackStats> {
    try {
      const { data: feedbacks, error } = await supabase
        .from('route_feedback')
        .select('*')
        .eq('route_id', routeId);

      if (error) {
        throw new Error(`获取反馈数据失败: ${error.message}`);
      }

      if (!feedbacks || feedbacks.length === 0) {
        return {
          routeId,
          averageRating: 0,
          totalFeedbacks: 0,
          difficultyRating: 0,
          safetyRating: 0,
          sceneryRating: 0,
          recommendationRate: 0,
          popularTags: [],
          recentComments: []
        };
      }

      // 计算统计数据
      const totalFeedbacks = feedbacks.length;
      const averageRating = feedbacks.reduce((sum, f) => sum + f.rating, 0) / totalFeedbacks;
      const difficultyRating = feedbacks.reduce((sum, f) => sum + (f.difficulty_rating || 0), 0) / totalFeedbacks;
      const safetyRating = feedbacks.reduce((sum, f) => sum + (f.safety_rating || 0), 0) / totalFeedbacks;
      const sceneryRating = feedbacks.reduce((sum, f) => sum + (f.scenery_rating || 0), 0) / totalFeedbacks;
      // 由于现有表中没有 would_recommend 字段，使用评分 >= 4 作为推荐的标准
      const recommendationRate = feedbacks.filter(f => f.rating >= 4).length / totalFeedbacks;

      // 统计标签
      const tagCounts: Record<string, number> = {};
      feedbacks.forEach(feedback => {
        if (feedback.tags) {
          feedback.tags.forEach((tag: string) => {
            tagCounts[tag] = (tagCounts[tag] || 0) + 1;
          });
        }
      });

      const popularTags = Object.entries(tagCounts)
        .map(([tag, count]) => ({ tag, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      // 获取最近评论
      const recentComments = feedbacks
        .filter(f => f.feedback_text && f.feedback_text.trim())
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 5)
        .map(f => ({
          comment: f.feedback_text,
          rating: f.rating,
          createdAt: f.created_at
        }));

      return {
        routeId,
        averageRating: Math.round(averageRating * 10) / 10,
        totalFeedbacks,
        difficultyRating: Math.round(difficultyRating * 10) / 10,
        safetyRating: Math.round(safetyRating * 10) / 10,
        sceneryRating: Math.round(sceneryRating * 10) / 10,
        recommendationRate: Math.round(recommendationRate * 100) / 100,
        popularTags,
        recentComments
      };
    } catch (error) {
      console.error('获取反馈统计失败:', error);
      throw error;
    }
  }

  // 获取用户的反馈历史
  static async getUserFeedbacks(userId: string): Promise<RouteFeedbackRecord[]> {
    try {
      const { data: feedbacks, error } = await supabase
        .from('route_feedback')
        .select(`
          *,
          routes (
            name,
            distance,
            difficulty_level
          )
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error(`获取用户反馈失败: ${error.message}`);
      }

      return feedbacks || [];
    } catch (error) {
      console.error('获取用户反馈失败:', error);
      throw error;
    }
  }

  // 检查用户是否已对路线进行反馈
  static async hasUserFeedback(routeId: string, userId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('route_feedback')
        .select('id')
        .eq('route_id', routeId)
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 是没有找到记录的错误
        throw new Error(`检查反馈状态失败: ${error.message}`);
      }

      return !!data;
    } catch (error) {
      console.error('检查反馈状态失败:', error);
      return false;
    }
  }

  // 更新推荐引擎的学习数据
  private static async updateRecommendationLearning(feedback: FeedbackData, userId: string): Promise<void> {
    try {
      // 记录用户偏好学习数据
      const learningData = {
        user_id: userId,
        route_id: feedback.routeId,
        action_type: 'feedback',
        rating: feedback.rating,
        difficulty_preference: feedback.difficulty,
        safety_importance: feedback.safety,
        scenery_preference: feedback.scenery,
        would_recommend: feedback.wouldRecommend || false,
        tags: feedback.tags,
        timestamp: new Date().toISOString()
      };

      // 这里可以将学习数据发送到推荐引擎进行模型更新
      // 暂时存储到本地或发送到分析服务
      console.log('推荐引擎学习数据:', learningData);

      // 更新用户偏好表
      await this.updateUserPreferences(userId, feedback);
    } catch (error) {
      console.error('更新推荐学习数据失败:', error);
      // 不抛出错误，避免影响主要的反馈提交流程
    }
  }

  // 更新用户偏好
  private static async updateUserPreferences(userId: string, feedback: FeedbackData): Promise<void> {
    try {
      // 获取现有偏好
      const { data: existingPrefs, error: fetchError } = await supabase
        .from('user_preferences')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        throw new Error(`获取用户偏好失败: ${fetchError.message}`);
      }

      // 计算新的偏好权重
      const updateData = {
        user_id: userId,
        difficulty_preference: this.calculateNewPreference(
          existingPrefs?.difficulty_preference || 5,
          feedback.difficulty,
          feedback.rating
        ),
        safety_importance: this.calculateNewPreference(
          existingPrefs?.safety_importance || 5,
          feedback.safety,
          feedback.rating
        ),
        scenery_importance: this.calculateNewPreference(
          existingPrefs?.scenery_importance || 5,
          feedback.scenery,
          feedback.rating
        ),
        updated_at: new Date().toISOString()
      };

      // 插入或更新偏好
      const { error: upsertError } = await supabase
        .from('user_preferences')
        .upsert(updateData);

      if (upsertError) {
        throw new Error(`更新用户偏好失败: ${upsertError.message}`);
      }
    } catch (error) {
      console.error('更新用户偏好失败:', error);
    }
  }

  // 计算新的偏好值（使用加权平均）
  private static calculateNewPreference(
    currentPreference: number,
    newRating: number,
    overallRating: number
  ): number {
    if (newRating === 0) return currentPreference;
    
    // 根据总体评分调整权重
    const weight = overallRating / 5; // 评分越高，权重越大
    const newPreference = currentPreference * 0.8 + newRating * weight * 0.2;
    
    return Math.max(1, Math.min(10, Math.round(newPreference * 10) / 10));
  }

  // 获取路线的平均评分
  static async getRouteAverageRating(routeId: string): Promise<number> {
    try {
      const { data, error } = await supabase
        .from('route_feedback')
        .select('rating')
        .eq('route_id', routeId);

      if (error) {
        throw new Error(`获取路线评分失败: ${error.message}`);
      }

      if (!data || data.length === 0) {
        return 0;
      }

      const average = data.reduce((sum, feedback) => sum + feedback.rating, 0) / data.length;
      return Math.round(average * 10) / 10;
    } catch (error) {
      console.error('获取路线评分失败:', error);
      return 0;
    }
  }

  // 获取热门标签
  static async getPopularTags(limit: number = 20): Promise<{ tag: string; count: number }[]> {
    try {
      const { data: feedbacks, error } = await supabase
        .from('route_feedback')
        .select('tags');

      if (error) {
        throw new Error(`获取标签数据失败: ${error.message}`);
      }

      if (!feedbacks) {
        return [];
      }

      const tagCounts: Record<string, number> = {};
      feedbacks.forEach(feedback => {
        if (feedback.tags) {
          feedback.tags.forEach((tag: string) => {
            tagCounts[tag] = (tagCounts[tag] || 0) + 1;
          });
        }
      });

      return Object.entries(tagCounts)
        .map(([tag, count]) => ({ tag, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, limit);
    } catch (error) {
      console.error('获取热门标签失败:', error);
      return [];
    }
  }
}