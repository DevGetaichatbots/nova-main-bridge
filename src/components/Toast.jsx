import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

const Toast = ({ message, type = 'success', isVisible, onClose, duration = 4000 }) => {
  const { t } = useTranslation();
  useEffect(() => {
    if (isVisible && duration) {
      const timer = setTimeout(() => {
        onClose();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [isVisible, duration, onClose]);

  if (!isVisible) return null;

  const isSuccess = type === 'success';

  return (
    <>
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9998] transition-all duration-300"
        onClick={onClose}
        style={{
          animation: 'fadeIn 0.3s ease-out'
        }}
      />

      <div className="fixed inset-0 flex items-center justify-center z-[9999] pointer-events-none">
        <div 
          className="pointer-events-auto relative max-w-md w-full mx-4"
          style={{
            animation: 'scaleIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)'
          }}
        >
          <div
            className="relative rounded-2xl shadow-2xl border overflow-hidden"
            style={{
              background: isSuccess
                ? 'linear-gradient(145deg, rgba(5, 150, 105, 0.98) 0%, rgba(16, 185, 129, 0.95) 100%)'
                : 'linear-gradient(145deg, rgba(220, 38, 38, 0.98) 0%, rgba(239, 68, 68, 0.95) 100%)',
              borderColor: isSuccess ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)',
              backdropFilter: 'blur(20px)',
              boxShadow: isSuccess 
                ? '0 25px 50px -12px rgba(16, 185, 129, 0.5), 0 0 80px rgba(16, 185, 129, 0.3)'
                : '0 25px 50px -12px rgba(239, 68, 68, 0.5), 0 0 80px rgba(239, 68, 68, 0.3)'
            }}
          >
            <div className="absolute top-0 left-0 right-0 h-1 overflow-hidden">
              <div 
                className="h-full"
                style={{
                  background: isSuccess 
                    ? 'linear-gradient(90deg, #10b981, #34d399, #6ee7b7)'
                    : 'linear-gradient(90deg, #ef4444, #f87171, #fca5a5)',
                  animation: 'shimmer 2s infinite'
                }}
              />
            </div>

            <div className="absolute top-0 right-0 bottom-0 left-0 opacity-10">
              <div 
                className="absolute top-4 right-4 w-32 h-32 rounded-full"
                style={{
                  background: 'radial-gradient(circle, rgba(255,255,255,0.8) 0%, transparent 70%)',
                  filter: 'blur(40px)',
                  animation: 'pulse 2s infinite'
                }}
              />
            </div>

            <div className="relative p-6">
              <div className="flex items-start gap-4">
                <div 
                  className="flex-shrink-0 w-14 h-14 rounded-xl flex items-center justify-center"
                  style={{
                    background: isSuccess
                      ? 'linear-gradient(135deg, rgba(255, 255, 255, 0.25) 0%, rgba(255, 255, 255, 0.1) 100%)'
                      : 'linear-gradient(135deg, rgba(255, 255, 255, 0.25) 0%, rgba(255, 255, 255, 0.1) 100%)',
                    boxShadow: '0 8px 16px rgba(0, 0, 0, 0.2)',
                    animation: 'bounce 2s infinite'
                  }}
                >
                  {isSuccess ? (
                    <svg
                      className="w-8 h-8 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2.5}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  ) : (
                    <svg
                      className="w-8 h-8 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2.5}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  )}
                </div>

                <div className="flex-1 pt-1">
                  <h3 
                    className="text-xl font-bold text-white mb-2"
                    style={{
                      textShadow: '0 2px 10px rgba(0, 0, 0, 0.3)'
                    }}
                  >
                    {isSuccess ? t('toast.success') : t('toast.error')}
                  </h3>
                  <p 
                    className="text-white/95 leading-relaxed text-base"
                    style={{
                      textShadow: '0 1px 3px rgba(0, 0, 0, 0.2)'
                    }}
                  >
                    {message}
                  </p>
                </div>

                <button
                  onClick={onClose}
                  className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200 hover:scale-110 hover:rotate-90"
                  style={{
                    background: 'rgba(255, 255, 255, 0.2)',
                  }}
                  aria-label={t('toast.closeNotification')}
                >
                  <svg
                    className="w-5 h-5 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>

              <div className="mt-4 flex items-center gap-3">
                <div 
                  className="flex-1 h-1.5 rounded-full overflow-hidden"
                  style={{
                    background: 'rgba(255, 255, 255, 0.2)'
                  }}
                >
                  <div 
                    className="h-full rounded-full"
                    style={{
                      background: 'rgba(255, 255, 255, 0.8)',
                      animation: `shrink ${duration}ms linear`
                    }}
                  />
                </div>
                <span className="text-white/70 text-xs font-medium">
                  {Math.round(duration / 1000)}s
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes scaleIn {
          from {
            opacity: 0;
            transform: scale(0.8) translateY(-20px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }

        @keyframes shimmer {
          0%, 100% { transform: translateX(-100%); }
          50% { transform: translateX(100%); }
        }

        @keyframes bounce {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }

        @keyframes shrink {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
    </>
  );
};

export default Toast;
