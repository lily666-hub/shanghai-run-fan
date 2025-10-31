import { supabase } from '../lib/supabase';
import { RealtimeLocation, LocationHistory, SafetyAssessment } from '../types';

export class LocationService {
  private static instance: LocationService;
  private locationBuffer: LocationHistory[] = [];
  private batchSize = 10;
  private batchTimeout = 30000; // 30秒
  private batchTimer: NodeJS.Timeout | null = null;

  static getInstance(): LocationService {
    if (!LocationService.instance) {
      LocationService.instance = new LocationService();
    }
    return LocationService.instance;
  }

  /**
   * 保存单个位置记录
   */
  async saveLocation(location: RealtimeLocation, userId: string): Promise<void> {
    try {
      const locationData: Omit<LocationHistory, 'id'> = {
        user_id: userId,
        latitude: location.latitude,
        longitude: location.longitude,
        altitude: location.altitude,
        accuracy: location.accuracy,
        speed: location.speed,
        heading: location.heading,
        recorded_at: location.timestamp.toISOString(),
        battery_level: await this.getBatteryLevel(),
        network_type: this.getNetworkType()
      };

      const { error } = await supabase
        .from('location_history')
        .insert([locationData]);

      if (error) {
        console.error('保存位置失败:', error);
        throw error;
      }
    } catch (error) {
      console.error('位置保存服务错误:', error);
      throw error;
    }
  }

  /**
   * 批量保存位置记录（用于性能优化）
   */
  async batchSaveLocation(location: RealtimeLocation, userId: string): Promise<void> {
    const locationData: Omit<LocationHistory, 'id'> = {
      user_id: userId,
      latitude: location.latitude,
      longitude: location.longitude,
      altitude: location.altitude,
      accuracy: location.accuracy,
      speed: location.speed,
      heading: location.heading,
      recorded_at: location.timestamp.toISOString(),
      battery_level: await this.getBatteryLevel(),
      network_type: this.getNetworkType()
    };

    this.locationBuffer.push(locationData as LocationHistory);

    // 如果缓冲区达到批量大小，立即保存
    if (this.locationBuffer.length >= this.batchSize) {
      await this.flushLocationBuffer();
    } else {
      // 设置定时器，确保数据不会丢失
      this.resetBatchTimer();
    }
  }

  /**
   * 刷新位置缓冲区
   */
  private async flushLocationBuffer(): Promise<void> {
    if (this.locationBuffer.length === 0) return;

    try {
      const { error } = await supabase
        .from('location_history')
        .insert(this.locationBuffer);

      if (error) {
        console.error('批量保存位置失败:', error);
        throw error;
      }

      this.locationBuffer = [];
      this.clearBatchTimer();
    } catch (error) {
      console.error('批量位置保存服务错误:', error);
      throw error;
    }
  }

  /**
   * 重置批量定时器
   */
  private resetBatchTimer(): void {
    this.clearBatchTimer();
    this.batchTimer = setTimeout(() => {
      this.flushLocationBuffer();
    }, this.batchTimeout);
  }

  /**
   * 清除批量定时器
   */
  private clearBatchTimer(): void {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
  }

  /**
   * 获取用户位置历史
   */
  async getLocationHistory(
    userId: string,
    limit: number = 100,
    startDate?: Date,
    endDate?: Date
  ): Promise<LocationHistory[]> {
    try {
      let query = supabase
        .from('location_history')
        .select('*')
        .eq('user_id', userId)
        .order('recorded_at', { ascending: false })
        .limit(limit);

      if (startDate) {
        query = query.gte('recorded_at', startDate.toISOString());
      }

      if (endDate) {
        query = query.lte('recorded_at', endDate.toISOString());
      }

      const { data, error } = await query;

      if (error) {
        console.error('获取位置历史失败:', error);
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('位置历史服务错误:', error);
      throw error;
    }
  }

  /**
   * 计算两点之间的距离（使用Haversine公式）
   */
  calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371; // 地球半径（公里）
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) *
        Math.cos(this.toRadians(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * 角度转弧度
   */
  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
   * 计算移动速度
   */
  calculateSpeed(
    location1: RealtimeLocation,
    location2: RealtimeLocation
  ): number {
    const distance = this.calculateDistance(
      location1.latitude,
      location1.longitude,
      location2.latitude,
      location2.longitude
    );
    const timeDiff = (location2.timestamp.getTime() - location1.timestamp.getTime()) / 1000; // 秒
    return distance / (timeDiff / 3600); // 公里/小时
  }

  /**
   * 检查位置是否在安全区域内
   */
  async isLocationSafe(latitude: number, longitude: number): Promise<boolean> {
    try {
      // 查询附近的安全评分
      const { data, error } = await supabase
        .from('route_safety_scores')
        .select('safety_score')
        .gte('latitude', latitude - 0.001) // 约100米范围
        .lte('latitude', latitude + 0.001)
        .gte('longitude', longitude - 0.001)
        .lte('longitude', longitude + 0.001)
        .order('safety_score', { ascending: false })
        .limit(1);

      if (error) {
        console.error('查询安全区域失败:', error);
        return false;
      }

      if (data && data.length > 0) {
        return data[0].safety_score >= 7.0; // 安全分数7分以上认为安全
      }

      return false; // 没有数据默认不安全
    } catch (error) {
      console.error('安全区域检查错误:', error);
      return false;
    }
  }

  /**
   * 获取当前时间段的安全评分
   */
  async getTimeSlotSafety(
    latitude: number,
    longitude: number,
    date: Date = new Date()
  ): Promise<number> {
    try {
      const { data, error } = await supabase
        .rpc('get_time_slot_safety', {
          lat: latitude,
          lng: longitude,
          check_date: date.toISOString().split('T')[0]
        });

      if (error) {
        console.error('获取时间段安全评分失败:', error);
        return 5.0; // 默认中等安全
      }

      return data || 5.0;
    } catch (error) {
      console.error('时间段安全评分服务错误:', error);
      return 5.0;
    }
  }

  /**
   * 获取电池电量
   */
  private async getBatteryLevel(): Promise<number | null> {
    try {
      if ('getBattery' in navigator) {
        const battery = await (navigator as any).getBattery();
        return Math.round(battery.level * 100);
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * 获取网络类型
   */
  private getNetworkType(): string | null {
    try {
      const connection = (navigator as any).connection || 
                        (navigator as any).mozConnection || 
                        (navigator as any).webkitConnection;
      
      if (connection) {
        return connection.effectiveType || connection.type || null;
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * 清理旧的位置数据
   */
  async cleanupOldLocations(userId: string, daysToKeep: number = 30): Promise<void> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      const { error } = await supabase
        .from('location_history')
        .delete()
        .eq('user_id', userId)
        .lt('recorded_at', cutoffDate.toISOString());

      if (error) {
        console.error('清理旧位置数据失败:', error);
        throw error;
      }
    } catch (error) {
      console.error('位置数据清理服务错误:', error);
      throw error;
    }
  }

  /**
   * 强制刷新缓冲区（在应用关闭前调用）
   */
  async forceFlush(): Promise<void> {
    await this.flushLocationBuffer();
  }
}