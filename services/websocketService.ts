import { io, Socket } from 'socket.io-client';
import { useState, useEffect } from 'react';

export interface WebSocketConfig {
  url?: string;
  reconnectInterval?: number;
  heartbeatInterval?: number;
  maxReconnectAttempts?: number;
}

export interface WebSocketMessage {
  type: string;
  data: any;
  timestamp: string;
}

export interface LocationUpdate {
  userId: string;
  lng: number;
  lat: number;
  timestamp: string;
  accuracy?: number;
  speed?: number;
}

export interface EmergencyAlert {
  userId: string;
  type: 'sos' | 'medical' | 'accident' | 'harassment' | 'suspicious';
  lng: number;
  lat: number;
  location: {
    lng: number;
    lat: number;
  };
  description?: string;
  message?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: string;
}

export interface SafetyNotification {
  type: 'risk_alert' | 'route_warning' | 'weather_alert' | 'area_warning';
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'danger';
  lng?: number;
  lat?: number;
  location?: {
    lng: number;
    lat: number;
  };
  radius?: number;
  timestamp: string;
}

export interface BuddyUpdate {
  type: 'invitation' | 'response' | 'status_change';
  fromUserId: string;
  toUserId: string;
  data: any;
  timestamp: string;
}

export class WebSocketService {
  private socket: Socket | null = null;
  private config: WebSocketConfig;
  private messageHandlers: Map<string, (data: any) => void> = new Map();
  private reconnectAttempts = 0;
  private isConnecting = false;

  constructor(config: WebSocketConfig = {}) {
    this.config = {
      url: 'http://localhost:3001',
      reconnectInterval: 5000,
      heartbeatInterval: 30000,
      maxReconnectAttempts: 5,
      ...config
    };
  }

  // 连接WebSocket
  connect(userId?: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.socket?.connected) {
        resolve();
        return;
      }

      if (this.isConnecting) {
        reject(new Error('Connection already in progress'));
        return;
      }

      this.isConnecting = true;

      try {
        this.socket = io(this.config.url!, {
          transports: ['websocket', 'polling'],
          timeout: 10000,
          reconnection: true,
          reconnectionAttempts: this.config.maxReconnectAttempts,
          reconnectionDelay: this.config.reconnectInterval
        });

        this.socket.on('connect', () => {
          console.log('WebSocket connected');
          this.isConnecting = false;
          this.reconnectAttempts = 0;

          // 注册用户
          if (userId) {
            this.socket!.emit('user:register', { userId });
          }

          resolve();
        });

        this.socket.on('disconnect', (reason) => {
          console.log('WebSocket disconnected:', reason);
          this.isConnecting = false;
        });

        this.socket.on('connect_error', (error) => {
          console.error('WebSocket connection error:', error);
          this.isConnecting = false;
          reject(error);
        });

        this.socket.on('error', (error) => {
          console.error('WebSocket error:', error);
        });

        // 设置消息处理器
        this.setupMessageHandlers();

      } catch (error) {
        this.isConnecting = false;
        reject(error);
      }
    });
  }

  // 断开连接
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.isConnecting = false;
  }

  // 设置消息处理器
  private setupMessageHandlers(): void {
    if (!this.socket) return;

    // 连接确认
    this.socket.on('connection:confirmed', (data) => {
      this.handleMessage('connection:confirmed', data);
    });

    // 位置更新
    this.socket.on('location:updated', (data) => {
      this.handleMessage('location:updated', data);
    });

    // 紧急警报
    this.socket.on('emergency:received', (data) => {
      this.handleMessage('emergency:received', data);
    });

    this.socket.on('emergency:confirmed', (data) => {
      this.handleMessage('emergency:confirmed', data);
    });

    // 安全通知
    this.socket.on('safety:alert', (data) => {
      this.handleMessage('safety:alert', data);
    });

    this.socket.on('safety:zone_warning', (data) => {
      this.handleMessage('safety:zone_warning', data);
    });

    // 跑友相关
    this.socket.on('buddy:invitation', (data) => {
      this.handleMessage('buddy:invitation', data);
    });

    this.socket.on('buddy:response_received', (data) => {
      this.handleMessage('buddy:response_received', data);
    });

    this.socket.on('buddy:request_sent', (data) => {
      this.handleMessage('buddy:request_sent', data);
    });

    this.socket.on('buddy:user_offline', (data) => {
      this.handleMessage('buddy:user_offline', data);
    });

    // 用户状态
    this.socket.on('user:offline', (data) => {
      this.handleMessage('user:offline', data);
    });

    // 心跳响应
    this.socket.on('pong', (data) => {
      this.handleMessage('pong', data);
    });
  }

  // 处理消息
  private handleMessage(type: string, data: any): void {
    const handler = this.messageHandlers.get(type);
    if (handler) {
      handler(data);
    }
  }

  // 发送位置更新
  sendLocationUpdate(locationUpdate: LocationUpdate): void {
    if (this.socket?.connected) {
      this.socket.emit('location:update', locationUpdate);
    }
  }

  // 发送紧急警报
  sendEmergencyAlert(alert: EmergencyAlert): void {
    if (this.socket?.connected) {
      this.socket.emit('emergency:alert', alert);
    }
  }

  // 发送跑友邀请
  sendBuddyRequest(request: {
    fromUserId: string;
    toUserId: string;
    scheduledTime: string;
    routeName: string;
    routeDistance: number;
    routeDuration: number;
    message?: string;
  }): void {
    if (this.socket?.connected) {
      this.socket.emit('buddy:request', request);
    }
  }

  // 响应跑友邀请
  respondToBuddyRequest(response: {
    invitationId: string;
    response: 'accepted' | 'declined';
    fromUserId: string;
  }): void {
    if (this.socket?.connected) {
      this.socket.emit('buddy:response', response);
    }
  }

  // 发送安全通知
  sendSafetyNotification(notification: SafetyNotification): void {
    if (this.socket?.connected) {
      this.socket.emit('safety:notification', notification);
    }
  }

  // 发送心跳
  sendHeartbeat(): void {
    if (this.socket?.connected) {
      this.socket.emit('ping');
    }
  }

  // 添加消息处理器
  addMessageHandler(type: string, handler: (data: any) => void): void {
    this.messageHandlers.set(type, handler);
  }

  // 移除消息处理器
  removeMessageHandler(type: string): void {
    this.messageHandlers.delete(type);
  }

  // 获取连接状态
  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  // 获取连接状态文本
  getConnectionStatus(): string {
    if (!this.socket) return 'disconnected';
    if (this.isConnecting) return 'connecting';
    return this.socket.connected ? 'connected' : 'disconnected';
  }
}

// React Hook for WebSocket
export function useWebSocket(config: WebSocketConfig = {}, userId?: string) {
  const [connectionStatus, setConnectionStatus] = useState<string>('disconnected');
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const [service] = useState(() => new WebSocketService(config));

  useEffect(() => {
    const connectWebSocket = async () => {
      try {
        await service.connect(userId);
        setConnectionStatus('connected');
      } catch (error) {
        console.error('Failed to connect WebSocket:', error);
        setConnectionStatus('error');
      }
    };

    connectWebSocket();

    // 添加通用消息处理器
    const handleMessage = (type: string) => (data: any) => {
      setLastMessage({
        type,
        data,
        timestamp: new Date().toISOString()
      });
    };

    // 注册所有消息类型的处理器
    const messageTypes = [
      'connection:confirmed',
      'location:updated',
      'emergency:received',
      'emergency:confirmed',
      'safety:alert',
      'safety:zone_warning',
      'buddy:invitation',
      'buddy:response_received',
      'buddy:request_sent',
      'buddy:user_offline',
      'user:offline',
      'pong'
    ];

    messageTypes.forEach(type => {
      service.addMessageHandler(type, handleMessage(type));
    });

    // 定期更新连接状态
    const statusInterval = setInterval(() => {
      setConnectionStatus(service.getConnectionStatus());
    }, 1000);

    return () => {
      clearInterval(statusInterval);
      messageTypes.forEach(type => {
        service.removeMessageHandler(type);
      });
      service.disconnect();
    };
  }, [service, userId]);

  return {
    service,
    connectionStatus,
    lastMessage,
    isConnected: connectionStatus === 'connected'
  };
}