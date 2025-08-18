import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { RotateCcw } from 'lucide-react';
import { learningAPI } from '../../services/learningAPI'; // Updated import path
import { toast } from 'react-hot-toast';

interface BatchReviewActionsProps {
  selectedWordIds: number[];
  onReviewsTriggered: () => void;
}

export const BatchReviewActions: React.FC<BatchReviewActionsProps> = ({
  selectedWordIds,
  onReviewsTriggered
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [reviewType, setReviewType] = useState<'immediate' | 'scheduled'>('immediate');
  const [daysFromNow, setDaysFromNow] = useState(7);
  const [isLoading, setIsLoading] = useState(false);

  const handleBatchReview = async () => {
    setIsLoading(true);
    try {
      const result = await learningAPI.batchTriggerReviews({
        word_ids: selectedWordIds,
        review_type: reviewType,
        days_from_now: reviewType === 'scheduled' ? daysFromNow : undefined
      });

      toast.success(
        `Successfully scheduled ${result.successful_count}/${result.total_count} words for review`
      );
      
      setIsOpen(false);
      onReviewsTriggered();
    } catch (error) {
      toast.error('Failed to schedule batch review');
      console.error('Batch review error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (selectedWordIds.length === 0) return null;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <RotateCcw className="w-4 h-4" />
          Schedule Review ({selectedWordIds.length})
        </Button>
      </DialogTrigger>
      
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Schedule Batch Review</DialogTitle>
          <DialogDescription>
            Schedule {selectedWordIds.length} selected words for review
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <RadioGroup value={reviewType} onValueChange={(value) => setReviewType(value as 'immediate' | 'scheduled')}>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="immediate" id="immediate" />
              <Label htmlFor="immediate">Review immediately</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="scheduled" id="scheduled" />
              <Label htmlFor="scheduled">Schedule for later</Label>
            </div>
          </RadioGroup>
          
          {reviewType === 'scheduled' && (
            <div className="space-y-2">
              <Label htmlFor="days">Days from now</Label>
              <Input
                id="days"
                type="number"
                min="1"
                max="365"
                value={daysFromNow}
                onChange={(e) => setDaysFromNow(parseInt(e.target.value) || 7)}
              />
            </div>
          )}
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleBatchReview} disabled={isLoading}>
            {isLoading ? 'Processing...' : 'Schedule Review'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
