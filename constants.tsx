import React from 'react';
import { Category } from './types';
import { 
  Book, Code, Server, Sparkles, FileJson, Table, Clipboard, 
  Scissors, Network, Mail, Plane, Globe, Film, PlayCircle, 
  MessageSquare, Cpu, Compass, Bot, Zap, Coffee, Box, MonitorPlay, Users
} from 'lucide-react';

export const DEFAULT_CATEGORIES: Category[] = [
  {
    id: 'quick',
    title: '快捷',
    icon: <Zap size={18} />,
    links: [
      { id: 'quick-1', title: 'Z-Library', url: 'https://zh.zlih.ru', icon: <Book size={18} className="text-blue-500" />, description: '全球最大的电子书库之一' },
      { id: 'quick-2', title: 'Java全栈', url: 'https://pdai.tech/', icon: <Code size={18} className="text-orange-500" />, description: 'Java全栈学习体系' },
      { id: 'quick-3', title: '飞牛NAS', url: 'http://u.xinyounet.cn:49006/login', icon: <Server size={18} className="text-blue-400" />, description: '飞牛系统' },
    ]
  },
  {
    id: 'ai',
    title: 'AI',
    icon: <Sparkles size={18} />,
    links: [
      { id: 'ai-1', title: 'Google AI Studio', url: 'https://aistudio.google.com/', icon: <Sparkles size={18} className="text-purple-500" />, description: 'Google AI 开发平台' },
      { id: 'ai-2', title: '在问AI', url: 'https://www.zaiwenai.com?channel-code=6969da17021a1d9c7fc6437b', icon: <Bot size={18} className="text-emerald-500" />, description: '免费智能AI对话' },
    ]
  },
  {
    id: 'tools',
    title: '好用工具',
    icon: <Box size={18} />,
    links: [
      { id: 'tool-1', title: 'ESJSON', url: 'http://www.esjson.com/', icon: <FileJson size={18} className="text-yellow-500" />, description: 'JSON在线格式化' },
      { id: 'tool-2', title: 'TableConvert', url: 'https://tableconvert.com/', icon: <Table size={18} className="text-green-500" />, description: '表格数据转换工具' },
      { id: 'tool-3', title: 'Clipy', url: 'https://github.com/Clipy/Clipy/releases', icon: <Clipboard size={18} className="text-slate-300" />, description: 'macOS 剪贴板扩展' },
      { id: 'tool-4', title: 'Snipaste', url: 'https://zh.snipaste.com/download.html', icon: <Scissors size={18} className="text-red-400" />, description: '截图与贴图工具' },
      { id: 'tool-5', title: 'Whistle', url: 'https://wproxy.org/', icon: <Network size={18} className="text-cyan-400" />, description: '网络调试代理' },
    ]
  },
  {
    id: 'interest',
    title: '兴趣',
    icon: <Coffee size={18} />,
    links: [
      { id: 'int-1', title: '2925无限邮', url: 'https://2925.com/', icon: <Mail size={18} className="text-indigo-400" />, description: '临时邮箱服务' },
      { id: 'int-2', title: '宝可梦加速器', url: 'https://love1.go52pokemon.com/#/register?code=IBHnGmBM', icon: <Plane size={18} className="text-sky-500" />, description: '网络服务' },
      { id: 'int-3', title: '赔钱机场', url: 'https://dash.pqjc.site/#/register?code=Q6CDOi7f', icon: <Plane size={18} className="text-sky-500" />, description: '赔钱机场' },
      { id: 'int-4', title: 'SAKURA FRP', url: 'https://www.natfrp.com/', icon: <Globe size={18} className="text-pink-400" />, description: '免费内网穿透' },
      { id: 'int-5', title: 'AppleID', url: 'https://fanqiangnan.com/appleid.html', icon: <Globe size={18} className="text-blue-500" />, description: '美区ID分享' },
    ]
  },
  {
    id: 'media',
    title: '影视',
    icon: <MonitorPlay size={18} />,
    links: [
      { id: 'med-1', title: '流光影院', url: 'https://www.gyf.lol/', icon: <Film size={18} className="text-rose-500" />, description: '在线高清影视' },
      { id: 'med-2', title: '蛋播星球', url: 'https://danboxingqiu.cn/', icon: <PlayCircle size={18} className="text-orange-500" />, description: '全平台影视App' },
    ]
  },
  {
    id: 'community',
    title: '社区',
    icon: <Users size={18} />,
    links: [
      { id: 'com-1', title: '小众软件', url: 'https://meta.appinn.net/', icon: <MessageSquare size={18} className="text-emerald-500" />, description: '软件推荐与交流' },
      { id: 'com-2', title: 'TopsTip', url: 'https://topstip.com/', icon: <Cpu size={18} className="text-blue-500" />, description: '科技测评指南' },
      { id: 'com-3', title: 'NodeLoc', url: 'https://www.nodeloc.com/', icon: <Server size={18} className="text-slate-800 dark:text-slate-200" />, description: '主机交流社区' },
    ]
  },
  {
    id: 'nav',
    title: '导航网',
    icon: <Compass size={18} />,
    links: [
      { id: 'nav-1', title: '硬核指南', url: 'https://yinghezhinan.com/', icon: <Compass size={18} className="text-indigo-500" />, description: '高清硬核资源' },
      { id: 'nav-2', title: 'AI工具集', url: 'https://ai-bot.cn/', icon: <Bot size={18} className="text-purple-500" />, description: 'AI 工具导航大全' },
    ]
  }
];