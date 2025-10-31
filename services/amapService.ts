// 高德地图API服务
export interface AmapConfig {
  key: string;
  version: string;
  plugins: string[];
}

export interface LocationPoint {
  lng: number;
  lat: number;
}

export interface RoutePoint extends LocationPoint {
  name?: string;
  address?: string;
}

export interface RouteResult {
  distance: number;
  duration: number;
  paths: LocationPoint[][];
  safetyScore?: number;
  riskPoints?: RiskPoint[];
}

export interface RiskPoint extends LocationPoint {
  type: 'crime' | 'accident' | 'lighting' | 'crowd';
  level: 'low' | 'medium' | 'high';
  description: string;
  timestamp?: string;
}

export interface SafetyAnalysis {
  overallScore: number;
  riskFactors: {
    lighting: number;
    crowdDensity: number;
    crimeRate: number;
    trafficSafety: number;
  };
  recommendations: string[];
  alternativeRoutes?: RouteResult[];
}

export class AmapService {
  private config: AmapConfig;
  private map: any = null;
  private isLoaded = false;
  private driving: any = null;
  private geolocation: any = null;
  private currentWatchId: number | null = null;
  private navSteps: any[] = [];
  private currentStep = 0;

  constructor(config: AmapConfig) {
    this.config = config;
  }

  // 初始化高德地图
  async initialize(): Promise<void> {
    if (this.isLoaded) return;

    return new Promise((resolve, reject) => {
      if (window.AMap) {
        this.isLoaded = true;
        resolve();
        return;
      }

      const script = document.createElement('script');
      const securityJsCode = import.meta.env.VITE_AMAP_SECURITY_JS_CODE;
      script.src = `https://webapi.amap.com/maps?v=${this.config.version}&key=${this.config.key}&plugin=${this.config.plugins.join(',')}${securityJsCode ? `&jscode=${securityJsCode}` : ''}`;
      script.async = true;
      
      script.onload = () => {
        this.isLoaded = true;
        resolve();
      };
      
      script.onerror = () => {
        reject(new Error('Failed to load Amap API'));
      };
      
      document.head.appendChild(script);
    });
  }

  // 创建地图实例
  createMap(container: string | HTMLElement, options: any = {}): any {
    if (!this.isLoaded) {
      throw new Error('Amap not initialized');
    }

    const defaultOptions = {
      zoom: 15,
      center: [121.4737, 31.2304], // 上海市中心
      mapStyle: 'amap://styles/normal',
      ...options
    };

    this.map = new window.AMap.Map(container, defaultOptions);
    return this.map;
  }

  // 获取当前位置
  async getCurrentPosition(): Promise<LocationPoint> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation not supported'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            lng: position.coords.longitude,
            lat: position.coords.latitude
          });
        },
        (error) => {
          reject(error);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000
        }
      );
    });
  }

  // 路径规划
  async planRoute(start: RoutePoint, end: RoutePoint, options: any = {}): Promise<RouteResult> {
    if (!this.isLoaded) {
      await this.initialize();
    }

    return new Promise((resolve, reject) => {
      const walking = new window.AMap.Walking({
        map: this.map,
        ...options
      });

      walking.search(
        [start.lng, start.lat],
        [end.lng, end.lat],
        (status: string, result: any) => {
          if (status === 'complete') {
            const route = result.routes[0];
            const paths = route.steps.map((step: any) => 
              step.path.map((point: any) => ({
                lng: point.lng,
                lat: point.lat
              }))
            );

            resolve({
              distance: route.distance,
              duration: route.time,
              paths,
              safetyScore: this.calculateRouteSafety(paths[0])
            });
          } else {
            reject(new Error('Route planning failed'));
          }
        }
      );
    });
  }

  // 计算路线安全评分
  private calculateRouteSafety(path: LocationPoint[]): number {
    // 基础安全评分算法
    let score = 80; // 基础分数

    // 根据路径长度调整（较短路径相对安全）
    const distance = this.calculateDistance(path);
    if (distance < 1000) score += 10;
    else if (distance > 5000) score -= 10;

    // 模拟基于历史数据的安全评分
    const timeOfDay = new Date().getHours();
    if (timeOfDay >= 6 && timeOfDay <= 18) {
      score += 15; // 白天更安全
    } else if (timeOfDay >= 19 && timeOfDay <= 22) {
      score += 5; // 傍晚稍安全
    } else {
      score -= 20; // 深夜较危险
    }

    return Math.max(0, Math.min(100, score));
  }

  // 计算路径距离
  private calculateDistance(path: LocationPoint[]): number {
    let distance = 0;
    for (let i = 1; i < path.length; i++) {
      distance += this.getDistanceBetweenPoints(path[i-1], path[i]);
    }
    return distance;
  }

  // 计算两点间距离
  private getDistanceBetweenPoints(point1: LocationPoint, point2: LocationPoint): number {
    const R = 6371000; // 地球半径（米）
    const dLat = (point2.lat - point1.lat) * Math.PI / 180;
    const dLng = (point2.lng - point1.lng) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(point1.lat * Math.PI / 180) * Math.cos(point2.lat * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  // 搜索周边安全设施
  async searchNearbyFacilities(center: LocationPoint, radius: number = 1000): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const placeSearch = new window.AMap.PlaceSearch({
        map: this.map,
        pageSize: 20,
        pageIndex: 1
      });

      // 搜索安全相关设施
      const keywords = ['派出所', '医院', '监控', '路灯', '公园'];
      const facilities: any[] = [];

      let searchCount = 0;
      keywords.forEach(keyword => {
        placeSearch.searchNearBy(
          keyword,
          [center.lng, center.lat],
          radius,
          (status: string, result: any) => {
            searchCount++;
            if (status === 'complete') {
              facilities.push(...result.poiList.pois);
            }
            
            if (searchCount === keywords.length) {
              resolve(facilities);
            }
          }
        );
      });
    });
  }

  // 分析路线安全性
  async analyzeRouteSafety(route: LocationPoint[]): Promise<SafetyAnalysis> {
    const facilities = await this.searchNearbyFacilities(route[0]);
    
    // 计算各项安全因子
    const lighting = this.calculateLightingScore(route);
    const crowdDensity = this.calculateCrowdDensity(route);
    const crimeRate = this.calculateCrimeRate(route);
    const trafficSafety = this.calculateTrafficSafety(route);

    const overallScore = (lighting + crowdDensity + crimeRate + trafficSafety) / 4;

    const recommendations = this.generateSafetyRecommendations({
      lighting,
      crowdDensity,
      crimeRate,
      trafficSafety
    });

    return {
      overallScore,
      riskFactors: {
        lighting,
        crowdDensity,
        crimeRate,
        trafficSafety
      },
      recommendations
    };
  }

  // 计算照明评分
  private calculateLightingScore(route: LocationPoint[]): number {
    const hour = new Date().getHours();
    if (hour >= 6 && hour <= 18) return 90; // 白天
    if (hour >= 19 && hour <= 22) return 70; // 傍晚
    return 40; // 夜间
  }

  // 计算人群密度评分
  private calculateCrowdDensity(route: LocationPoint[]): number {
    const hour = new Date().getHours();
    if (hour >= 7 && hour <= 9 || hour >= 17 && hour <= 19) return 85; // 高峰期
    if (hour >= 10 && hour <= 16) return 75; // 白天
    return 45; // 夜间
  }

  // 计算犯罪率评分
  private calculateCrimeRate(route: LocationPoint[]): number {
    // 基于历史数据的模拟评分
    return 75 + Math.random() * 20; // 75-95分
  }

  // 计算交通安全评分
  private calculateTrafficSafety(route: LocationPoint[]): number {
    // 基于路段类型的模拟评分
    return 70 + Math.random() * 25; // 70-95分
  }

  // 生成安全建议
  private generateSafetyRecommendations(factors: any): string[] {
    const recommendations: string[] = [];

    if (factors.lighting < 60) {
      recommendations.push('建议携带手电筒或选择照明良好的路段');
    }

    if (factors.crowdDensity < 50) {
      recommendations.push('人流较少，建议结伴跑步或选择人多的路段');
    }

    if (factors.crimeRate < 70) {
      recommendations.push('该区域安全系数较低，建议避开或加强防护');
    }

    if (factors.trafficSafety < 70) {
      recommendations.push('注意交通安全，遵守交通规则');
    }

    const hour = new Date().getHours();
    if (hour < 6 || hour > 22) {
      recommendations.push('夜间跑步风险较高，建议选择白天时段');
    }

    return recommendations;
  }

  // 添加安全标记
  addSafetyMarkers(riskPoints: RiskPoint[]): void {
    if (!this.map) return;

    riskPoints.forEach(point => {
      const marker = new window.AMap.Marker({
        position: [point.lng, point.lat],
        title: point.description,
        icon: this.getSafetyIcon(point.type, point.level)
      });

      marker.setMap(this.map);
    });
  }

  // 获取安全图标
  private getSafetyIcon(type: string, level: string): string {
    const colors = {
      low: '#52c41a',
      medium: '#faad14',
      high: '#f5222d'
    };

    const icons = {
      crime: '🚨',
      accident: '⚠️',
      lighting: '💡',
      crowd: '👥'
    };

    return `data:image/svg+xml,${encodeURIComponent(`
      <svg width="24" height="24" viewBox="0 0 24 24" fill="${colors[level as keyof typeof colors]}" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="10"/>
        <text x="12" y="16" text-anchor="middle" font-size="12">${icons[type as keyof typeof icons]}</text>
      </svg>
    `)}`;
  }

  // 多层定位功能 - 参考3.0.html实现
  async getUserLocation(): Promise<LocationPoint> {
    return new Promise((resolve) => {
      if (!window.AMap) {
        console.error('高德地图API未加载');
        resolve(this.getDefaultPosition());
        return;
      }

      window.AMap.plugin("AMap.Geolocation", () => {
        const geo = new window.AMap.Geolocation({
          enableHighAccuracy: true,
          timeout: 10000,
          showButton: false,
          showMarker: true,
          panToLocation: true
        });

        if (this.map) {
          this.map.addControl(geo);
        }

        geo.getCurrentPosition((status: string, result: any) => {
          if (status === "complete") {
            console.log("✅ 高德定位成功");
            resolve({
              lat: result.position.lat,
              lng: result.position.lng
            });
          } else if (navigator.geolocation) {
            console.warn("⚠️ 高德定位失败，尝试浏览器定位...");
            navigator.geolocation.getCurrentPosition(
              (pos) => resolve({ 
                lat: pos.coords.latitude, 
                lng: pos.coords.longitude 
              }),
              () => resolve(this.getDefaultPosition()),
              { enableHighAccuracy: true, timeout: 8000 }
            );
          } else {
            resolve(this.getDefaultPosition());
          }
        });
      });
    });
  }

  // 获取默认位置（复旦大学文科图书馆）
  private getDefaultPosition(): LocationPoint {
    return { lat: 31.2973, lng: 121.5035 };
  }

  // 路线规划功能 - 参考3.0.html实现
  async planRouteWithNavigation(start: RoutePoint, end: RoutePoint, waypoints: RoutePoint[] = []): Promise<RouteResult> {
    if (!this.map || !window.AMap) {
      throw new Error('地图未初始化');
    }

    return new Promise((resolve, reject) => {
      window.AMap.plugin(["AMap.Driving"], () => {
        this.driving = new window.AMap.Driving({
          map: this.map,
          policy: window.AMap.DrivingPolicy.LEAST_TIME
        });

        const startLngLat = new window.AMap.LngLat(start.lng, start.lat);
        const endLngLat = new window.AMap.LngLat(end.lng, end.lat);
        const waypointLngLats = waypoints.map(wp => new window.AMap.LngLat(wp.lng, wp.lat));

        this.driving.search(
          startLngLat,
          endLngLat,
          { waypoints: waypointLngLats, extensions: "all" },
          (status: string, result: any) => {
            if (status === "complete" && result.routes && result.routes.length) {
              const route = result.routes[0];
              this.navSteps = route.steps;
              
              const routeResult: RouteResult = {
                distance: route.distance,
                duration: route.duration,
                paths: [route.path.map((point: any) => ({ lat: point.lat, lng: point.lng }))],
                safetyScore: this.calculateRouteSafety(route.path)
              };

              console.log("路线规划完成，开始导航");
              this.speakText("路线规划完成，开始导航。");
              resolve(routeResult);
            } else {
              const error = "路线规划失败，请检查坐标";
              console.error(error);
              reject(new Error(error));
            }
          }
        );
      });
    });
  }

  // 开始实时导航
  startRealtimeNavigation(): void {
    if (!window.AMap) {
      console.error('高德地图API未加载');
      return;
    }

    window.AMap.plugin("AMap.Geolocation", () => {
      const geo = new window.AMap.Geolocation({ 
        enableHighAccuracy: true, 
        timeout: 10000 
      });
      
      this.currentWatchId = geo.watchPosition((status: string, result: any) => {
        if (status === "complete") {
          this.handleNavigationPosition(result.position);
        }
      });
    });
  }

  // 处理导航位置更新
  private handleNavigationPosition(position: { lat: number; lng: number }): void {
    if (!this.navSteps.length || this.currentStep >= this.navSteps.length) return;

    const step = this.navSteps[this.currentStep];
    if (!step) return;

    const [lng, lat] = step.end_location.split(",").map(Number);
    const distance = this.getDistanceBetweenPoints(position, { lat, lng });

    console.log(`距离下一指令点 ${Math.round(distance)} 米`);

    // 到达检测 - 30米内触发语音播报
    if (distance < 30) {
      this.speakText(step.instruction);
      console.log(`当前指令：${step.instruction}`);
      this.currentStep++;
    }
  }

  // 语音播报功能 - 参考3.0.html实现
  private speakText(text: string): void {
    if ("speechSynthesis" in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "zh-CN";
      utterance.rate = 1.0;
      speechSynthesis.speak(utterance);
    }
  }

  // 停止实时导航
  stopRealtimeNavigation(): void {
    if (this.currentWatchId !== null && this.geolocation) {
      this.geolocation.clearWatch(this.currentWatchId);
      this.currentWatchId = null;
    }
    this.currentStep = 0;
    this.navSteps = [];
  }

  // 添加途径点标记
  addWaypointMarkers(waypoints: RoutePoint[]): void {
    if (!this.map || !window.AMap) return;

    waypoints.forEach(point => {
      new window.AMap.Marker({
        position: [point.lng, point.lat],
        map: this.map,
        title: point.name,
        content: `<div style="background:#007bff;color:#fff;padding:2px 6px;border-radius:4px">${point.name}</div>`
      });
    });
  }

  // 获取导航步骤
  getNavigationSteps(): any[] {
    return this.navSteps;
  }

  // 获取当前导航步骤
  getCurrentNavigationStep(): number {
    return this.currentStep;
  }

  // 清理地图
  destroy(): void {
    if (this.map) {
      this.map.destroy();
      this.map = null;
    }
  }
}

// 默认配置
export const defaultAmapConfig: AmapConfig = {
  key: import.meta.env.VITE_AMAP_API_KEY || 'your-amap-key',
  version: '2.0',
  plugins: ['AMap.Walking', 'AMap.PlaceSearch', 'AMap.Geolocation', 'AMap.Driving']
};

// 创建默认实例
export const amapService = new AmapService(defaultAmapConfig);