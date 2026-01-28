import React, { useEffect, useState } from 'react';
import { Cloud, CloudRain, CloudSun, Sun, Wind, MapPin } from 'lucide-react';
import { fetchWeather, getWeatherDescription } from '../services/weatherService';
import { WeatherData } from '../types';

interface WeatherProps {
  compact?: boolean;
}

const Weather: React.FC<WeatherProps> = ({ compact = false }) => {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [locationName, setLocationName] = useState<string>('Local');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Default to Shanghai coords if geolocation fails
    const defaultLat = 31.2304;
    const defaultLon = 121.4737;

    const loadWeather = async (lat: number, lon: number) => {
      setLoading(true);
      const data = await fetchWeather(lat, lon);
      if (data) setWeather(data);
      setLoading(false);
    };

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          loadWeather(position.coords.latitude, position.coords.longitude);
          setLocationName("当前位置");
        },
        () => {
          loadWeather(defaultLat, defaultLon);
          setLocationName("上海");
        }
      );
    } else {
      loadWeather(defaultLat, defaultLon);
      setLocationName("上海");
    }
  }, []);

  if (loading) return (
    <div className={`flex items-center space-x-2 ${compact ? 'opacity-50' : 'glass-panel px-4 py-2 rounded-2xl shadow-sm'}`}>
        <div className="w-4 h-4 rounded-full bg-slate-200 dark:bg-slate-700 animate-pulse" />
        <div className="w-12 h-3 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
    </div>
  );

  if (!weather) return null;

  const WeatherIcon = () => {
    const code = weather.weatherCode;
    const iconClass = compact ? "w-4 h-4" : "w-6 h-6";
    if (code === 0) return <Sun className={`text-amber-500 dark:text-yellow-400 ${iconClass}`} />;
    if (code <= 3) return <CloudSun className={`text-slate-400 dark:text-slate-300 ${iconClass}`} />;
    if (code >= 51) return <CloudRain className={`text-blue-500 dark:text-blue-400 ${iconClass}`} />;
    return <Cloud className={`text-slate-400 ${iconClass}`} />;
  };

  if (compact) {
    return (
      <div className="flex items-center space-x-3 text-sm font-medium text-slate-600 dark:text-slate-300">
        <div className="flex items-center space-x-1.5">
          <WeatherIcon />
          <span>{weather.temperature}°C</span>
        </div>
        <div className="hidden lg:flex items-center space-x-1 text-xs text-slate-500 dark:text-slate-400">
           <MapPin size={12} />
           <span className="truncate max-w-[80px]">{locationName}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center space-x-4 glass-panel px-4 py-2 rounded-2xl shadow-sm transition-all hover:shadow-md
      text-slate-700 dark:text-slate-100 border border-white/20 dark:border-white/10
    ">
      <div className="flex flex-col items-center">
        <WeatherIcon />
      </div>
      <div className="flex flex-col">
        <div className="flex items-center space-x-2">
           <span className="text-lg font-bold tracking-tight">{weather.temperature}°C</span>
           <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded-md">
            <Wind size={10} className="mr-1" /> {weather.windSpeed} km/h
           </span>
        </div>
        <div className="flex items-center text-xs text-slate-500 dark:text-slate-400 mt-0.5">
           <MapPin size={10} className="mr-1" />
           <span>{locationName} • {getWeatherDescription(weather.weatherCode)}</span>
        </div>
      </div>
    </div>
  );
};

export default Weather;