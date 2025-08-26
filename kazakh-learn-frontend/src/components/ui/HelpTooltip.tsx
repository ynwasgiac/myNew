import React, { useState, useEffect, useRef, ReactNode, MouseEvent, KeyboardEvent } from 'react';
import { HelpCircle, X, Loader2 } from 'lucide-react';
import api from '../../services/api'; // Используем существующий API клиент

interface HelpTooltipProps {
  endpoint: string;
  lang?: string;
  iconSize?: number;
  iconColor?: string;
  maxWidth?: number;
  className?: string;
  children?: ReactNode;
}

const HelpTooltip: React.FC<HelpTooltipProps> = ({ 
  endpoint, 
  lang = 'ru', 
  iconSize = 16, 
  iconColor = '#6b7280',
  maxWidth = 400,
  className = '',
  children 
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [tooltipPosition, setTooltipPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  
  const triggerRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const loadContent = async (): Promise<void> => {
    if (content || loading) return;
    
    setLoading(true);
    setError('');
    
    try {
      // Используем существующий API клиент вместо прямого fetch
      const url = endpoint.includes('?') 
        ? `${endpoint}&lang=${lang}`
        : `${endpoint}?lang=${lang}`;
      
      const response = await api.get(url);
      
      // API клиент автоматически парсит JSON, поэтому используем response.data
      // Если ответ - строка, используем её, иначе пробуем получить текст
      const text = typeof response.data === 'string' 
        ? response.data 
        : response.data.description || response.data.content || JSON.stringify(response.data);
      
      setContent(text);
    } catch (err: any) {
      console.error('Error loading help content:', err);
      
      // Более детальная обработка ошибок
      if (err.response?.status === 404) {
        setError('Справочная информация не найдена');
      } else if (err.response?.status === 500) {
        setError('Ошибка сервера при загрузке справки');
      } else {
        setError('Не удалось загрузить описание');
      }
    } finally {
      setLoading(false);
    }
  };

  const calculatePosition = (): void => {
    if (!triggerRef.current || !tooltipRef.current) return;
    
    const viewport = {
      width: window.innerWidth,
      height: window.innerHeight
    };
    
    const top = Math.max(50, (viewport.height - 400) / 2);
    const left = Math.max(50, (viewport.width - maxWidth) / 2);
    
    setTooltipPosition({ top, left });
  };

  const handleToggle = (e: MouseEvent<HTMLSpanElement>): void => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!isOpen) {
      loadContent();
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: Event): void => {
      const target = event.target as Node;
      if (tooltipRef.current && !tooltipRef.current.contains(target) &&
          triggerRef.current && !triggerRef.current.contains(target)) {
        setIsOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape as any);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape as any);
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && tooltipRef.current) {
      calculatePosition();
      
      const handleResize = (): void => calculatePosition();
      window.addEventListener('resize', handleResize);
      window.addEventListener('scroll', handleResize);
      
      return () => {
        window.removeEventListener('resize', handleResize);
        window.removeEventListener('scroll', handleResize);
      };
    }
  }, [isOpen]);

  const handleKeyDown = (e: KeyboardEvent<HTMLSpanElement>): void => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleToggle(e as any);
    }
  };

  return (
    <>
      <span
        ref={triggerRef}
        onClick={handleToggle}
        className={`inline-flex items-center cursor-pointer hover:opacity-70 transition-opacity ${className}`}
        role="button"
        tabIndex={0}
        onKeyDown={handleKeyDown}
        aria-label="Показать справку"
      >
        {children || <HelpCircle size={iconSize} color={iconColor} />}
      </span>

      {isOpen && (
        <div
          ref={tooltipRef}
          className="fixed z-50 bg-white border border-gray-200 rounded-lg shadow-lg"
          style={{
            top: tooltipPosition.top,
            left: tooltipPosition.left,
            maxWidth: maxWidth,
            minWidth: 200
          }}
        >
          <div className="flex items-center justify-between p-3 border-b border-gray-100">
            <h3 className="font-medium text-gray-900">Справка</h3>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 hover:bg-gray-100 rounded"
              aria-label="Закрыть"
            >
              <X size={16} className="text-gray-500" />
            </button>
          </div>
          
          <div className="p-4">
            {loading && (
              <div className="flex items-center justify-center py-4">
                <Loader2 size={20} className="animate-spin text-gray-400" />
                <span className="ml-2 text-sm text-gray-500">Загрузка...</span>
              </div>
            )}
            
            {error && (
              <div className="text-sm text-red-600 py-2">
                {error}
              </div>
            )}
            
            {content && !loading && (
              <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                {content}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default HelpTooltip;