// TTS语音服务 - 优化版本，专注于浏览器TTS稳定性
// 注意：阿里云TTS由于CORS限制暂时禁用，需要后端代理支持

// 配置接口
export interface TTSConfig {
  language?: string;
  voice?: string;
  // 阿里云配置保留但暂时不使用
  aliyunAppKey?: string;
  aliyunAccessKeyId?: string;
  aliyunAccessKeySecret?: string;
  aliyunTempToken?: string;
}

// 语音识别结果
export interface SpeechRecognitionResult {
  text: string;
  confidence: number;
  isFinal: boolean;
}

// 语音合成选项
export interface SpeechSynthesisOptions {
  text: string;
  voice?: string;
  rate?: number;
  pitch?: number;
  volume?: number;
}

// 语音引擎类型 - 暂时只支持浏览器TTS
export type TTSEngine = 'browser' | 'auto';

// 阿里云语音列表（保留用于未来后端集成）
export const ALIYUN_VOICES = {
  xiaoyun: { name: 'xiaoyun', gender: 'female', description: '小云，温柔女声' },
  ruoxi: { name: 'ruoxi', gender: 'female', description: '若汐，知性女声' },
  xiaogang: { name: 'xiaogang', gender: 'male', description: '小刚，成熟男声' },
  aiqi: { name: 'aiqi', gender: 'female', description: '艾琪，活泼女声' },
  aijia: { name: 'aijia', gender: 'female', description: '艾佳，亲和女声' },
  aicheng: { name: 'aicheng', gender: 'male', description: '艾诚，稳重男声' },
  aiwei: { name: 'aiwei', gender: 'male', description: '艾伟，磁性男声' },
  aibao: { name: 'aibao', gender: 'male', description: '艾宝，童声' }
};

export class TTSService {
  private recognition: SpeechRecognition | null = null;
  private synthesis: SpeechSynthesis;
  private isListening = false;
  private config: TTSConfig;
  private preferredEngine: TTSEngine = 'auto';
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private isSpeaking = false;
  private retryCount = 0;
  private maxRetries = 3;

  constructor(config: TTSConfig = {}) {
    this.config = {
      language: 'zh-CN',
      voice: 'xiaoyun',
      ...config,
    };
    
    this.synthesis = window.speechSynthesis;
    this.initializeSpeechRecognition();
    
    console.log('TTS服务初始化完成 (仅浏览器TTS)', {
      browserTTSSupported: this.isSpeechSynthesisSupported(),
      speechRecognitionSupported: this.isSpeechRecognitionSupported()
    });
  }

  /**
   * 设置首选引擎
   */
  setPreferredEngine(engine: TTSEngine): void {
    this.preferredEngine = engine;
    console.log('设置首选TTS引擎:', engine);
  }

  /**
   * 改进的浏览器TTS语音合成 - 解决中断问题
   */
  private async synthesizeWithBrowser(options: SpeechSynthesisOptions): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.isSpeechSynthesisSupported()) {
        reject(new Error('浏览器不支持语音合成'));
        return;
      }

      try {
        // 确保停止当前播放
        this.stopSpeaking();
        
        // 等待一小段时间确保之前的语音完全停止
        setTimeout(() => {
          this.performBrowserTTS(options, resolve, reject);
        }, 100);

      } catch (error) {
        console.error('浏览器TTS初始化失败:', error);
        reject(error);
      }
    });
  }

  /**
   * 执行浏览器TTS播放
   */
  private performBrowserTTS(
    options: SpeechSynthesisOptions, 
    resolve: () => void, 
    reject: (error: Error) => void
  ): void {
    const utterance = new SpeechSynthesisUtterance(options.text);
    this.currentUtterance = utterance;
    
    // 设置语音参数
    utterance.lang = this.config.language || 'zh-CN';
    utterance.rate = Math.max(0.1, Math.min(10, options.rate || 1));
    utterance.pitch = Math.max(0, Math.min(2, options.pitch || 1));
    utterance.volume = Math.max(0, Math.min(1, options.volume || 1));

    // 尝试设置指定的语音
    const voices = this.synthesis.getVoices();
    let targetVoice = null;

    // 优先查找中文语音
    if (options.voice && options.voice !== 'xiaoyun') {
      targetVoice = voices.find(voice => 
        voice.name.toLowerCase().includes(options.voice!.toLowerCase())
      );
    }

    // 如果没找到，查找中文语音
    if (!targetVoice) {
      targetVoice = voices.find(voice => 
        voice.lang.includes('zh') || 
        voice.name.includes('Chinese') ||
        voice.name.includes('Microsoft')
      );
    }
    
    if (targetVoice) {
      utterance.voice = targetVoice;
      console.log('使用浏览器语音:', targetVoice.name);
    } else {
      console.log('未找到合适的中文语音，使用默认语音');
    }

    let hasStarted = false;
    let hasEnded = false;
    let timeoutId: NodeJS.Timeout;

    // 清理函数
    const cleanup = () => {
      if (timeoutId) clearTimeout(timeoutId);
      this.currentUtterance = null;
      this.isSpeaking = false;
    };

    // 设置事件监听器
    utterance.onstart = () => {
      hasStarted = true;
      this.isSpeaking = true;
      console.log('浏览器TTS开始播放');
    };

    utterance.onend = () => {
      if (!hasEnded) {
        hasEnded = true;
        console.log('浏览器TTS播放结束');
        cleanup();
        resolve();
      }
    };

    utterance.onerror = (event) => {
      if (!hasEnded) {
        hasEnded = true;
        const error = `浏览器TTS错误: ${event.error}`;
        console.error(error, event);
        cleanup();
        
        // 对于中断错误，尝试重试
        if (event.error === 'interrupted' && this.retryCount < this.maxRetries) {
          this.retryCount++;
          console.log(`检测到中断错误，第${this.retryCount}次重试...`);
          
          setTimeout(() => {
            this.performBrowserTTS(options, resolve, reject);
          }, 200 * this.retryCount); // 递增延迟
          return;
        }
        
        // 重置重试计数
        this.retryCount = 0;
        reject(new Error(error));
      }
    };

    // 添加超时保护 - 增加到60秒
    timeoutId = setTimeout(() => {
      if (!hasEnded) {
        hasEnded = true;
        console.warn('浏览器TTS超时');
        this.synthesis.cancel();
        cleanup();
        reject(new Error('浏览器TTS超时'));
      }
    }, 60000);

    // 开始播放
    console.log('开始浏览器TTS播放');
    this.synthesis.speak(utterance);

    // 检查是否立即失败 - 延长检查时间
    setTimeout(() => {
      if (!hasStarted && !hasEnded && !this.synthesis.speaking) {
        hasEnded = true;
        cleanup();
        console.warn('浏览器TTS可能立即失败');
        
        // 尝试重试
        if (this.retryCount < this.maxRetries) {
          this.retryCount++;
          console.log(`TTS启动失败，第${this.retryCount}次重试...`);
          setTimeout(() => {
            this.performBrowserTTS(options, resolve, reject);
          }, 500 * this.retryCount);
          return;
        }
        
        this.retryCount = 0;
        reject(new Error('浏览器TTS启动失败'));
      }
    }, 2000); // 延长到2秒
  }

  /**
   * 主要的语音合成方法 - 仅使用浏览器TTS
   */
  async speak(
    options: SpeechSynthesisOptions,
    onStart?: () => void,
    onEnd?: () => void,
    onError?: (error: string) => void
  ): Promise<void> {
    try {
      console.log('开始TTS合成:', options);
      onStart?.();

      // 重置重试计数
      this.retryCount = 0;

      // 仅使用浏览器TTS
      if (!this.isSpeechSynthesisSupported()) {
        throw new Error('浏览器不支持语音合成功能');
      }

      await this.synthesizeWithBrowser(options);
      console.log('浏览器TTS播放成功');

      onEnd?.();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('TTS合成失败:', errorMessage);
      onError?.(errorMessage);
      throw new Error(`TTS合成失败: ${errorMessage}`);
    }
  }

  /**
   * 初始化语音识别
   */
  private initializeSpeechRecognition(): void {
    if ('webkitSpeechRecognition' in window) {
      this.recognition = new (window as any).webkitSpeechRecognition();
    } else if ('SpeechRecognition' in window) {
      this.recognition = new (window as any).SpeechRecognition();
    }

    if (this.recognition) {
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = this.config.language || 'zh-CN';
    }
  }

  /**
   * 检查语音识别支持
   */
  isSpeechRecognitionSupported(): boolean {
    return this.recognition !== null;
  }

  /**
   * 检查语音合成支持
   */
  isSpeechSynthesisSupported(): boolean {
    return 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
  }

  /**
   * 检查阿里云TTS配置 - 暂时返回false
   */
  isAliyunTTSConfigured(): boolean {
    // 由于CORS限制，暂时禁用阿里云TTS
    return false;
  }

  /**
   * 开始语音识别
   */
  async startListening(
    onResult?: (result: SpeechRecognitionResult) => void,
    onError?: (error: string) => void
  ): Promise<void> {
    if (!this.isSpeechRecognitionSupported()) {
      throw new Error('浏览器不支持语音识别');
    }

    if (this.isListening) {
      console.log('语音识别已在进行中');
      return;
    }

    return new Promise((resolve, reject) => {
      if (!this.recognition) {
        reject(new Error('语音识别未初始化'));
        return;
      }

      this.recognition.onresult = (event) => {
        const results = event.results;
        for (let i = event.resultIndex; i < results.length; i++) {
          const result = results[i];
          const transcript = result[0].transcript;
          const confidence = result[0].confidence;
          
          onResult?.({
            text: transcript,
            confidence: confidence,
            isFinal: result.isFinal
          });
        }
      };

      this.recognition.onerror = (event) => {
        const error = `语音识别错误: ${event.error}`;
        console.error(error);
        onError?.(error);
        this.isListening = false;
      };

      this.recognition.onend = () => {
        console.log('语音识别结束');
        this.isListening = false;
      };

      this.recognition.onstart = () => {
        console.log('语音识别开始');
        this.isListening = true;
        resolve();
      };

      try {
        this.recognition.start();
      } catch (error) {
        console.error('启动语音识别失败:', error);
        reject(error);
      }
    });
  }

  /**
   * 停止语音识别
   */
  stopListening(): void {
    if (this.recognition && this.isListening) {
      this.recognition.stop();
      this.isListening = false;
      console.log('停止语音识别');
    }
  }

  /**
   * 停止语音播放
   */
  stopSpeaking(): void {
    if (this.synthesis) {
      this.synthesis.cancel();
      console.log('停止语音播放');
    }
    
    if (this.currentUtterance) {
      this.currentUtterance = null;
    }
    
    this.isSpeaking = false;
  }

  /**
   * 获取可用语音
   */
  getAvailableVoices(): { aliyun: typeof ALIYUN_VOICES; browser: SpeechSynthesisVoice[] } {
    return {
      aliyun: ALIYUN_VOICES, // 保留用于显示
      browser: this.synthesis ? this.synthesis.getVoices() : []
    };
  }

  /**
   * 获取服务状态
   */
  getServiceStatus() {
    return {
      aliyunTTS: {
        configured: false, // 暂时禁用
        tokenValid: false,
        corsLimited: true, // 新增CORS限制标识
        message: 'CORS限制：需要后端代理支持'
      },
      browserTTS: {
        supported: this.isSpeechSynthesisSupported(),
        isSpeaking: this.isSpeaking,
        availableVoices: this.synthesis ? this.synthesis.getVoices().length : 0
      },
      speechRecognition: {
        supported: this.isSpeechRecognitionSupported(),
        isListening: this.isListening
      },
      preferredEngine: this.preferredEngine,
      cacheSize: 0 // 暂时不使用缓存
    };
  }

  /**
   * 清除缓存 - 暂时无操作
   */
  clearCache(): void {
    console.log('缓存已清除（当前版本无缓存）');
  }

  /**
   * 测试TTS功能
   */
  async testTTS(engine: TTSEngine = 'auto'): Promise<{
    success: boolean;
    engine: string;
    error?: string;
  }> {
    try {
      const testText = '这是一个TTS测试';
      
      await this.speak({
        text: testText,
        voice: 'xiaoyun',
        rate: 1,
        pitch: 1,
        volume: 1
      });

      return {
        success: true,
        engine: 'browser'
      };
    } catch (error) {
      return {
        success: false,
        engine: 'browser',
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
}

// 导出服务实例
export const ttsService = new TTSService();

// 全局类型声明
declare global {
  interface Window {
    webkitSpeechRecognition: any;
    SpeechRecognition: any;
  }
}

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}

interface SpeechRecognitionResultList {
  length: number;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  length: number;
  isFinal: boolean;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
  start(): void;
  stop(): void;
}