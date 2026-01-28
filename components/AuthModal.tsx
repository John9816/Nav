import React, { useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { X, Mail, Lock, Loader2, AlertCircle, LogIn, ArrowRight } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const getErrorMessage = (error: any) => {
    // Log error for debugging but keep UI clean
    console.debug('Auth Error Details:', error);
    
    const msg = error?.message || '';
    const code = error?.code || '';

    if (code === 'invalid_credentials' || msg.includes('Invalid login credentials')) {
      return '账号或密码错误。';
    }
    if (msg.includes('Email not confirmed')) {
      return '账号未验证。请查收邮件，或在 Supabase 后台删除该用户后重新直接登录。';
    }
    if (msg.includes('User already registered') || code === 'user_already_exists') {
      return '该邮箱已被注册，请直接登录。';
    }
    if (msg.includes('Password should be at least')) {
      return '密码长度至少为 6 位。';
    }
    if (msg.includes('anonymous_provider_disabled')) {
      return '匿名登录未开启。';
    }
    
    return msg || '操作失败，请重试。';
  };

  const isUserExistsError = (error: any) => {
    return error?.code === 'user_already_exists' || 
           error?.message?.includes('User already registered') || 
           error?.message?.includes('already registered');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      if (isLogin) {
        // 1. 尝试登录
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (signInError) {
          // 2. 如果登录失败是 "Invalid credentials"
          if (signInError.code === 'invalid_credentials' || signInError.message.includes('Invalid login credentials')) {
             
             console.log("Login failed, attempting auto-registration...");
             
             // 3. 尝试自动注册 (假设用户不存在)
             const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
               email,
               password,
             });

             if (signUpError) {
               // 4. 注册失败 (用户已存在) -> 此时意味着 Login 失败 + Register 失败
               // 这种情况通常是: 
               // A. 密码真的错了
               // B. 密码是对的，但账号是 "未验证 (Unverified)" 状态 (Supabase 也会报 Invalid credentials)
               if (isUserExistsError(signUpError)) {
                 setError("登录失败：账号已存在。如果您确认密码正确，说明该账号“未验证”。请去邮箱验证，或在 Supabase 后台删除该用户后重试。");
               } else {
                 setError(getErrorMessage(signUpError));
               }
             } else {
               // 5. 注册成功
               if (signUpData.session) {
                 setMessage("检测到新用户，已自动注册并登录！");
                 setTimeout(() => onClose(), 1500);
               } else if (signUpData.user) {
                 // 注册成功但无 Session (开启了邮箱验证)
                 setError("新账号已创建，但系统开启了邮箱验证，无法直接登录。请关闭 'Confirm Email' 或查收邮件。");
               }
             }
          } else {
            // 其他登录错误 (如 Email not confirmed 明确报错)
            throw signInError;
          }
        } else {
          // 登录成功
          onClose();
        }
      } else {
        // 手动点击注册
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        setMessage('注册成功！');
      }
    } catch (err: any) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      ></div>

      <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">
            {isLogin ? '登录 / 自动注册' : '创建账号'}
          </h2>
          <button 
            onClick={onClose}
            className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            
            {error && (
              <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-xs sm:text-sm flex items-start gap-2">
                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {message && (
              <div className="p-3 rounded-lg bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 text-sm flex items-start gap-2">
                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                <span>{message}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-500 dark:text-slate-400 ml-1">邮箱</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all text-sm"
                  placeholder="name@example.com"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-500 dark:text-slate-400 ml-1">密码</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all text-sm"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium shadow-lg shadow-blue-500/30 transition-all active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2"
            >
              {loading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  <span>处理中...</span>
                </>
              ) : (
                <div className="flex items-center gap-2">
                  {isLogin ? <LogIn size={18} /> : <ArrowRight size={18} />}
                  <span>{isLogin ? '直接登录' : '注册账号'}</span>
                </div>
              )}
            </button>
          </form>
          
          <div className="mt-4 text-center">
             <p className="text-xs text-slate-400 flex items-center justify-center gap-1">
               {isLogin ? '如果账号不存在，系统将自动注册。' : '注册即表示同意服务条款。'}
             </p>
          </div>
          
          <div className="mt-4 text-center border-t border-slate-100 dark:border-slate-800 pt-4">
            <button 
                onClick={() => {
                   setIsLogin(!isLogin);
                   setError(null);
                   setMessage(null);
                }}
                className="text-sm text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
              >
                {isLogin ? '切换到手动注册' : '返回登录'}
              </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthModal;