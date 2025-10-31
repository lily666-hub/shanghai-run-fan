import { supabase } from '../lib/supabase';
import { RealtimeLocation, EmergencyType, EmergencyStatus } from '../types';

export interface EmergencyContact {
  id: string;
  name: string;
  phone: string;
  relationship: 'family' | 'friend' | 'colleague' | 'emergency';
  priority: number;
  verified: boolean;
}

export interface EmergencyEvent {
  id: string;
  user_id: string;
  type: EmergencyType;
  status: EmergencyStatus;
  location: RealtimeLocation;
  description?: string;
  audio_url?: string;
  photo_url?: string;
  created_at: string;
  resolved_at?: string;
  response_time?: number; // 响应时间（秒）
  resolution?: string; // 解决方案
}

export interface EmergencyAlert {
  id: string;
  emergency_event_id: string;
  contact_id: string;
  sent_at: string;
  delivered: boolean;
  response_received: boolean;
}

export class EmergencyService {
  private static instance: EmergencyService;
  private emergencyContacts: EmergencyContact[] = [];
  private activeEmergency: EmergencyEvent | null = null;

  static getInstance(): EmergencyService {
    if (!EmergencyService.instance) {
      EmergencyService.instance = new EmergencyService();
    }
    return EmergencyService.instance;
  }

  /**
   * 触发紧急求救
   */
  async triggerEmergency(
    type: EmergencyType,
    location: RealtimeLocation,
    description?: string,
    options?: {
      includeAudio?: boolean;
      includePhoto?: boolean;
      autoAlert?: boolean;
      alertDelay?: number; // 延迟时间（秒）
    }
  ): Promise<EmergencyEvent> {
    try {
      // 创建紧急事件记录
      const emergencyEvent: Partial<EmergencyEvent> = {
        type,
        status: 'active',
        location,
        description,
        created_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('emergency_events')
        .insert([emergencyEvent])
        .select()
        .single();

      if (error) throw error;

      this.activeEmergency = data;

      // 如果启用了自动报警，则发送警报
      if (options?.autoAlert) {
        if (options.alertDelay && options.alertDelay > 0) {
          // 延迟发送
          setTimeout(() => {
            this.sendEmergencyAlerts(data.id);
          }, options.alertDelay * 1000);
        } else {
          // 立即发送
          await this.sendEmergencyAlerts(data.id);
        }
      }

      // 录制音频（如果启用）
      if (options?.includeAudio) {
        this.startAudioRecording(data.id);
      }

      // 拍摄照片（如果启用）
      if (options?.includePhoto) {
        this.capturePhoto(data.id);
      }

      return data;
    } catch (error) {
      console.error('触发紧急求救失败:', error);
      throw error;
    }
  }

  /**
   * 取消紧急求救
   */
  async cancelEmergency(emergencyId: string, reason?: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('emergency_events')
        .update({
          status: 'cancelled',
          resolved_at: new Date().toISOString(),
          description: reason ? `取消原因: ${reason}` : undefined
        })
        .eq('id', emergencyId);

      if (error) throw error;

      this.activeEmergency = null;

      // 通知联系人取消警报
      await this.notifyEmergencyCancelled(emergencyId);
    } catch (error) {
      console.error('取消紧急求救失败:', error);
      throw error;
    }
  }

  /**
   * 解决紧急事件
   */
  async resolveEmergency(emergencyId: string, resolution?: string): Promise<void> {
    try {
      const resolvedAt = new Date().toISOString();
      const createdAt = this.activeEmergency?.created_at;
      let responseTime: number | undefined;

      if (createdAt) {
        responseTime = Math.floor((new Date(resolvedAt).getTime() - new Date(createdAt).getTime()) / 1000);
      }

      const { error } = await supabase
        .from('emergency_events')
        .update({
          status: 'resolved',
          resolved_at: resolvedAt,
          response_time: responseTime,
          description: resolution ? `解决方案: ${resolution}` : undefined
        })
        .eq('id', emergencyId);

      if (error) throw error;

      this.activeEmergency = null;

      // 通知联系人事件已解决
      await this.notifyEmergencyResolved(emergencyId);
    } catch (error) {
      console.error('解决紧急事件失败:', error);
      throw error;
    }
  }

  /**
   * 发送紧急警报给所有联系人
   */
  async sendEmergencyAlerts(emergencyId: string): Promise<void> {
    try {
      const contacts = await this.getEmergencyContacts();
      const alerts: Partial<EmergencyAlert>[] = [];

      for (const contact of contacts) {
        // 发送短信/电话警报
        const alertSent = await this.sendAlert(contact, emergencyId);
        
        alerts.push({
          emergency_event_id: emergencyId,
          contact_id: contact.id,
          sent_at: new Date().toISOString(),
          delivered: alertSent,
          response_received: false
        });
      }

      // 记录警报发送情况
      const { error } = await supabase
        .from('emergency_alerts')
        .insert(alerts);

      if (error) throw error;

      // 通知附近的安全资源
      await this.notifyNearbyResources(emergencyId);
    } catch (error) {
      console.error('发送紧急警报失败:', error);
      throw error;
    }
  }

  /**
   * 发送单个警报
   */
  private async sendAlert(contact: EmergencyContact, emergencyId: string): Promise<boolean> {
    try {
      // 这里应该集成实际的短信/电话服务
      // 例如：阿里云短信服务、腾讯云短信服务等
      
      const emergency = this.activeEmergency;
      if (!emergency) return false;

      const message = `【紧急求救】${emergency.type === 'medical' ? '医疗急救' : 
                      emergency.type === 'harassment' ? '骚扰求助' : 
                      emergency.type === 'accident' ? '意外事故' : '紧急求助'}
位置：${emergency.location.latitude}, ${emergency.location.longitude}
时间：${new Date(emergency.created_at).toLocaleString()}
请立即查看并提供帮助！`;

      // 模拟发送短信
      console.log(`发送紧急警报给 ${contact.name} (${contact.phone}):`, message);
      
      // 如果是紧急服务号码，直接拨打电话
      if (contact.relationship === 'emergency') {
        this.makeEmergencyCall(contact.phone);
      }

      return true;
    } catch (error) {
      console.error(`发送警报给 ${contact.name} 失败:`, error);
      return false;
    }
  }

  /**
   * 拨打紧急电话
   */
  private makeEmergencyCall(phoneNumber: string): void {
    // 在实际应用中，这里可能需要使用WebRTC或其他通话服务
    console.log(`拨打紧急电话: ${phoneNumber}`);
    
    // 在移动设备上可以使用 tel: 协议
    if (typeof window !== 'undefined') {
      window.open(`tel:${phoneNumber}`);
    }
  }

  /**
   * 通知附近的安全资源
   */
  private async notifyNearbyResources(emergencyId: string): Promise<void> {
    try {
      const emergency = this.activeEmergency;
      if (!emergency) return;

      // 查找附近的安全资源（警察局、医院、安保中心等）
      const nearbyResources = await this.findNearbyResources(emergency.location);
      
      for (const resource of nearbyResources) {
        // 发送警报给安全资源
        await this.notifySecurityResource(resource, emergency);
      }
    } catch (error) {
      console.error('通知附近安全资源失败:', error);
    }
  }

  /**
   * 查找附近的安全资源
   */
  private async findNearbyResources(location: RealtimeLocation): Promise<any[]> {
    // 这里应该查询附近的安全资源数据库
    // 或者调用地图API获取附近的警察局、医院等
    return [
      { type: 'police', name: '黄浦区派出所', distance: 0.5, phone: '021-12345678' },
      { type: 'hospital', name: '上海第一人民医院', distance: 1.2, phone: '021-87654321' },
      { type: 'security', name: '外滩安保中心', distance: 0.3, phone: '021-11111111' }
    ];
  }

  /**
   * 通知安全资源
   */
  private async notifySecurityResource(resource: any, emergency: EmergencyEvent): Promise<void> {
    console.log(`通知安全资源 ${resource.name}:`, {
      type: emergency.type,
      location: emergency.location,
      time: emergency.created_at
    });
  }

  /**
   * 开始音频录制
   */
  private async startAudioRecording(emergencyId: string): Promise<void> {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        console.warn('设备不支持音频录制');
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      const audioChunks: Blob[] = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunks.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
        await this.uploadAudio(emergencyId, audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();

      // 录制30秒后自动停止
      setTimeout(() => {
        if (mediaRecorder.state === 'recording') {
          mediaRecorder.stop();
        }
      }, 30000);
    } catch (error) {
      console.error('音频录制失败:', error);
    }
  }

  /**
   * 拍摄照片
   */
  private async capturePhoto(emergencyId: string): Promise<void> {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        console.warn('设备不支持拍照');
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      const video = document.createElement('video');
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');

      video.srcObject = stream;
      video.play();

      video.onloadedmetadata = () => {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context?.drawImage(video, 0, 0);
        
        canvas.toBlob(async (blob) => {
          if (blob) {
            await this.uploadPhoto(emergencyId, blob);
          }
          stream.getTracks().forEach(track => track.stop());
        }, 'image/jpeg', 0.8);
      };
    } catch (error) {
      console.error('拍照失败:', error);
    }
  }

  /**
   * 上传音频文件
   */
  private async uploadAudio(emergencyId: string, audioBlob: Blob): Promise<void> {
    try {
      const fileName = `emergency_audio_${emergencyId}_${Date.now()}.wav`;
      
      const { data, error } = await supabase.storage
        .from('emergency-files')
        .upload(fileName, audioBlob);

      if (error) throw error;

      // 更新紧急事件记录
      await supabase
        .from('emergency_events')
        .update({ audio_url: data.path })
        .eq('id', emergencyId);
    } catch (error) {
      console.error('上传音频失败:', error);
    }
  }

  /**
   * 上传照片
   */
  private async uploadPhoto(emergencyId: string, photoBlob: Blob): Promise<void> {
    try {
      const fileName = `emergency_photo_${emergencyId}_${Date.now()}.jpg`;
      
      const { data, error } = await supabase.storage
        .from('emergency-files')
        .upload(fileName, photoBlob);

      if (error) throw error;

      // 更新紧急事件记录
      await supabase
        .from('emergency_events')
        .update({ photo_url: data.path })
        .eq('id', emergencyId);
    } catch (error) {
      console.error('上传照片失败:', error);
    }
  }

  /**
   * 获取紧急联系人列表
   */
  async getEmergencyContacts(): Promise<EmergencyContact[]> {
    try {
      const { data, error } = await supabase
        .from('emergency_contacts')
        .select('*')
        .order('priority');

      if (error) throw error;

      this.emergencyContacts = data || [];
      return this.emergencyContacts;
    } catch (error) {
      console.error('获取紧急联系人失败:', error);
      return [];
    }
  }

  /**
   * 添加紧急联系人
   */
  async addEmergencyContact(contact: Omit<EmergencyContact, 'id'>): Promise<EmergencyContact> {
    try {
      const { data, error } = await supabase
        .from('emergency_contacts')
        .insert([contact])
        .select()
        .single();

      if (error) throw error;

      this.emergencyContacts.push(data);
      return data;
    } catch (error) {
      console.error('添加紧急联系人失败:', error);
      throw error;
    }
  }

  /**
   * 删除紧急联系人
   */
  async removeEmergencyContact(contactId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('emergency_contacts')
        .delete()
        .eq('id', contactId);

      if (error) throw error;

      this.emergencyContacts = this.emergencyContacts.filter(c => c.id !== contactId);
    } catch (error) {
      console.error('删除紧急联系人失败:', error);
      throw error;
    }
  }

  /**
   * 获取紧急事件历史
   */
  async getEmergencyHistory(limit: number = 10): Promise<EmergencyEvent[]> {
    try {
      const { data, error } = await supabase
        .from('emergency_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('获取紧急事件历史失败:', error);
      return [];
    }
  }

  /**
   * 通知紧急求救已取消
   */
  private async notifyEmergencyCancelled(emergencyId: string): Promise<void> {
    const contacts = await this.getEmergencyContacts();
    
    for (const contact of contacts) {
      const message = `【紧急求救已取消】之前的紧急求救已被用户取消，无需担心。`;
      console.log(`通知 ${contact.name} 紧急求救已取消:`, message);
    }
  }

  /**
   * 通知紧急事件已解决
   */
  private async notifyEmergencyResolved(emergencyId: string): Promise<void> {
    const contacts = await this.getEmergencyContacts();
    
    for (const contact of contacts) {
      const message = `【紧急事件已解决】紧急情况已得到妥善处理，感谢您的关注。`;
      console.log(`通知 ${contact.name} 紧急事件已解决:`, message);
    }
  }

  /**
   * 获取当前活跃的紧急事件
   */
  getActiveEmergency(): EmergencyEvent | null {
    return this.activeEmergency;
  }

  /**
   * 检查是否有活跃的紧急事件
   */
  hasActiveEmergency(): boolean {
    return this.activeEmergency !== null;
  }
}

export const emergencyService = EmergencyService.getInstance();