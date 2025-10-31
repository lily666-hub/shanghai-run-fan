// 天气服务
export interface WeatherData {
  temperature: number;
  condition: string;
  humidity: number;
  windSpeed: number;
  description: string;
  icon: string;
  uvIndex?: number;
  visibility?: number;
  pressure?: number;
  feelsLike?: number;
}

export interface WeatherForecast {
  date: string;
  temperature: {
    min: number;
    max: number;
  };
  condition: string;
  description: string;
  icon: string;
  precipitation: number;
}

// 天气条件映射
const weatherConditionMap: Record<string, { description: string; icon: string; runningAdvice: string }> = {
  'clear': { description: '晴朗', icon: '☀️', runningAdvice: '完美的跑步天气！' },
  'sunny': { description: '晴天', icon: '🌞', runningAdvice: '适合跑步，注意防晒' },
  'partly-cloudy': { description: '多云', icon: '⛅', runningAdvice: '很好的跑步条件' },
  'cloudy': { description: '阴天', icon: '☁️', runningAdvice: '舒适的跑步天气' },
  'overcast': { description: '阴沉', icon: '🌫️', runningAdvice: '适合跑步，空气湿润' },
  'light-rain': { description: '小雨', icon: '🌦️', runningAdvice: '建议室内运动或等雨停' },
  'rain': { description: '雨天', icon: '🌧️', runningAdvice: '不建议户外跑步' },
  'heavy-rain': { description: '大雨', icon: '⛈️', runningAdvice: '避免户外运动' },
  'snow': { description: '雪天', icon: '❄️', runningAdvice: '路面湿滑，注意安全' },
  'fog': { description: '雾天', icon: '🌫️', runningAdvice: '能见度低，注意安全' },
  'windy': { description: '大风', icon: '💨', runningAdvice: '注意风阻，调整配速' }
};

// 获取跑步建议
export const getRunningAdvice = (weather: WeatherData): string => {
  const condition = weatherConditionMap[weather.condition];
  if (condition) {
    return condition.runningAdvice;
  }

  // 基于温度的建议
  if (weather.temperature < 0) {
    return '气温较低，注意保暖，建议室内运动';
  } else if (weather.temperature > 35) {
    return '气温过高，建议避开高温时段或选择室内运动';
  } else if (weather.temperature >= 15 && weather.temperature <= 25) {
    return '温度适宜，是跑步的好时机！';
  } else if (weather.temperature < 15) {
    return '气温偏低，注意热身和保暖';
  } else {
    return '气温偏高，注意补水和防暑';
  }
};

// 获取天气适宜性评分 (0-1)
export const getWeatherSuitabilityScore = (weather: WeatherData): number => {
  let score = 1.0;

  // 温度评分
  if (weather.temperature >= 15 && weather.temperature <= 25) {
    score *= 1.0; // 最佳温度
  } else if (weather.temperature >= 10 && weather.temperature <= 30) {
    score *= 0.8; // 良好温度
  } else if (weather.temperature >= 5 && weather.temperature <= 35) {
    score *= 0.6; // 可接受温度
  } else {
    score *= 0.3; // 不适宜温度
  }

  // 天气条件评分
  switch (weather.condition) {
    case 'clear':
    case 'sunny':
    case 'partly-cloudy':
      score *= 1.0;
      break;
    case 'cloudy':
    case 'overcast':
      score *= 0.9;
      break;
    case 'light-rain':
      score *= 0.4;
      break;
    case 'rain':
    case 'heavy-rain':
      score *= 0.1;
      break;
    case 'snow':
    case 'fog':
      score *= 0.2;
      break;
    default:
      score *= 0.7;
  }

  // 风速评分
  if (weather.windSpeed <= 10) {
    score *= 1.0;
  } else if (weather.windSpeed <= 20) {
    score *= 0.8;
  } else {
    score *= 0.5;
  }

  // 湿度评分
  if (weather.humidity >= 40 && weather.humidity <= 70) {
    score *= 1.0;
  } else if (weather.humidity >= 30 && weather.humidity <= 80) {
    score *= 0.9;
  } else {
    score *= 0.7;
  }

  return Math.max(0, Math.min(1, score));
};

// 模拟天气API（实际项目中应该调用真实的天气API）
export const fetchCurrentWeather = async (lat?: number, lon?: number): Promise<WeatherData> => {
  // 模拟API延迟
  await new Promise(resolve => setTimeout(resolve, 500));

  // 模拟上海的天气数据
  const conditions = ['clear', 'sunny', 'partly-cloudy', 'cloudy', 'light-rain'];
  const randomCondition = conditions[Math.floor(Math.random() * conditions.length)];
  const temperature = Math.round(15 + Math.random() * 15); // 15-30度
  const humidity = Math.round(40 + Math.random() * 40); // 40-80%
  const windSpeed = Math.round(Math.random() * 15); // 0-15 km/h

  const conditionInfo = weatherConditionMap[randomCondition] || weatherConditionMap['clear'];

  return {
    temperature,
    condition: randomCondition,
    humidity,
    windSpeed,
    description: conditionInfo.description,
    icon: conditionInfo.icon,
    uvIndex: Math.round(Math.random() * 10),
    visibility: Math.round(8 + Math.random() * 7), // 8-15 km
    pressure: Math.round(1000 + Math.random() * 50), // 1000-1050 hPa
    feelsLike: temperature + Math.round((Math.random() - 0.5) * 4) // ±2度
  };
};

// 获取天气预报
export const fetchWeatherForecast = async (lat?: number, lon?: number): Promise<WeatherForecast[]> => {
  await new Promise(resolve => setTimeout(resolve, 300));

  const forecast: WeatherForecast[] = [];
  const conditions = ['clear', 'sunny', 'partly-cloudy', 'cloudy', 'light-rain'];

  for (let i = 0; i < 7; i++) {
    const date = new Date();
    date.setDate(date.getDate() + i);
    
    const randomCondition = conditions[Math.floor(Math.random() * conditions.length)];
    const conditionInfo = weatherConditionMap[randomCondition] || weatherConditionMap['clear'];
    
    const minTemp = Math.round(10 + Math.random() * 10);
    const maxTemp = minTemp + Math.round(5 + Math.random() * 10);

    forecast.push({
      date: date.toISOString().split('T')[0],
      temperature: {
        min: minTemp,
        max: maxTemp
      },
      condition: randomCondition,
      description: conditionInfo.description,
      icon: conditionInfo.icon,
      precipitation: Math.round(Math.random() * 100) // 0-100%
    });
  }

  return forecast;
};

// 获取基于天气的路线推荐
export const getWeatherBasedRouteRecommendations = (weather: WeatherData) => {
  const recommendations = [];

  if (weather.condition === 'rain' || weather.condition === 'heavy-rain') {
    recommendations.push({
      type: 'indoor',
      message: '雨天建议选择室内跑步机或体育馆',
      routes: ['室内体育馆', '健身房跑步机', '地下通道']
    });
  } else if (weather.temperature > 30) {
    recommendations.push({
      type: 'shade',
      message: '高温天气建议选择有遮阴的路线',
      routes: ['公园林荫道', '河滨绿道', '地下通道']
    });
  } else if (weather.temperature < 5) {
    recommendations.push({
      type: 'warm',
      message: '低温天气建议选择避风的路线',
      routes: ['室内场馆', '建筑群间道路', '地铁站周边']
    });
  } else {
    recommendations.push({
      type: 'outdoor',
      message: '天气适宜，推荐户外路线',
      routes: ['滨江大道', '世纪公园', '外滩步道']
    });
  }

  return recommendations;
};

// 实际项目中可以集成真实的天气API，如：
// - OpenWeatherMap API
// - 和风天气 API
// - 高德天气 API
// - 百度天气 API

/*
// 真实API调用示例（OpenWeatherMap）
export const fetchRealWeather = async (lat: number, lon: number): Promise<WeatherData> => {
  const API_KEY = 'your_openweathermap_api_key';
  const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric&lang=zh_cn`;
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    
    return {
      temperature: Math.round(data.main.temp),
      condition: mapOpenWeatherCondition(data.weather[0].main),
      humidity: data.main.humidity,
      windSpeed: Math.round(data.wind.speed * 3.6), // m/s to km/h
      description: data.weather[0].description,
      icon: data.weather[0].icon,
      uvIndex: data.uvi,
      visibility: data.visibility / 1000, // m to km
      pressure: data.main.pressure,
      feelsLike: Math.round(data.main.feels_like)
    };
  } catch (error) {
    console.error('获取天气数据失败:', error);
    throw error;
  }
};
*/