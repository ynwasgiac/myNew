// src/components/learning/ReviewButton.tsx
import React, { useState, useRef, useEffect } from 'react';
import Button from '../ui/Button';
import { Calendar, Clock, RotateCcw } from 'lucide-react';
import { learningAPI } from '../../services/learningAPI';
import { toast } from 'react-hot-toast';

interface ReviewButtonProps {
  wordId: number;
  currentStatus: string;
  onReviewTriggered?: () => void;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export const ReviewButton: React.FC<ReviewButtonProps> = ({
  wordId,
  currentStatus,
  onReviewTriggered,
  disabled = false,
  size = 'md'
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleReviewTrigger = async (type: 'immediate' | 'scheduled', days?: number) => {
    setIsLoading(true);
    setIsOpen(false);
    
    try {
      await learningAPI.triggerWordReview(wordId, {
        review_type: type,
        days_from_now: days
      });
      
      toast.success(
        type === 'immediate' 
          ? 'Word marked for immediate review' 
          : `Word scheduled for review in ${days} days`
      );
      
      onReviewTriggered?.();
    } catch (error) {
      toast.error('Failed to schedule review');
      console.error('Review trigger error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Only show for learned/mastered words
  if (!['learned', 'mastered'].includes(currentStatus)) {
    return null;
  }

  const reviewOptions = [
    { label: 'Review Now', icon: Clock, action: () => handleReviewTrigger('immediate') },
    { divider: true },
    { label: 'Review Tomorrow', icon: Calendar, action: () => handleReviewTrigger('scheduled', 1) },
    { label: 'Review in 3 Days', icon: Calendar, action: () => handleReviewTrigger('scheduled', 3) },
    { label: 'Review in 1 Week', icon: Calendar, action: () => handleReviewTrigger('scheduled', 7) },
    { label: 'Review in 1 Month', icon: Calendar, action: () => handleReviewTrigger('scheduled', 30) },
  ];

  return (
    <div className="relative" ref={dropdownRef}>
      <Button 
        variant="secondary"
        size={size}
        disabled={disabled || isLoading}
        onClick={() => setIsOpen(!isOpen)}
        className="gap-2"
      >
        <RotateCcw className="w-4 h-4" />
        {isLoading ? 'Processing...' : 'Review'}
      </Button>
      
      {isOpen && (
        <div className="absolute right-0 z-10 mt-2 w-56 origin-top-right rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
          <div className="py-1">
            {reviewOptions.map((option, index) => {
              if (option.divider) {
                return (
                  <div key={index} className="border-t border-gray-100 my-1" />
                );
              }

              const Icon = option.icon;
              return (
                <button
                  key={index}
                  onClick={option.action}
                  className="group flex w-full items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900"
                  disabled={isLoading}
                >
                  {Icon && <Icon className="mr-3 h-4 w-4 text-gray-400 group-hover:text-gray-500" />}
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};