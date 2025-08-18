import React, { useState } from 'react';
import { Button } from '../ui';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Calendar, Clock, RotateCcw } from 'lucide-react';
import { learningAPI } from '../../services/learningAPI'; // Updated import path
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

  const handleReviewTrigger = async (type: 'immediate' | 'scheduled', days?: number) => {
    setIsLoading(true);
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

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="outline" 
          size={size}
          disabled={disabled || isLoading}
          className="gap-2"
        >
          <RotateCcw className="w-4 h-4" />
          {isLoading ? 'Processing...' : 'Review'}
        </Button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem onClick={() => handleReviewTrigger('immediate')}>
          <Clock className="w-4 h-4 mr-2" />
          Review Now
        </DropdownMenuItem>
        
        <DropdownMenuSeparator />
        
        <DropdownMenuItem onClick={() => handleReviewTrigger('scheduled', 1)}>
          <Calendar className="w-4 h-4 mr-2" />
          Review Tomorrow
        </DropdownMenuItem>
        
        <DropdownMenuItem onClick={() => handleReviewTrigger('scheduled', 3)}>
          <Calendar className="w-4 h-4 mr-2" />
          Review in 3 Days
        </DropdownMenuItem>
        
        <DropdownMenuItem onClick={() => handleReviewTrigger('scheduled', 7)}>
          <Calendar className="w-4 h-4 mr-2" />
          Review in 1 Week
        </DropdownMenuItem>
        
        <DropdownMenuItem onClick={() => handleReviewTrigger('scheduled', 30)}>
          <Calendar className="w-4 h-4 mr-2" />
          Review in 1 Month
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
