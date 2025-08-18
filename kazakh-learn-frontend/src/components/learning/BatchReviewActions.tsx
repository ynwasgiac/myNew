// src/components/learning/BatchReviewActions.tsx
import React, { useState, ChangeEvent } from 'react';
import Button from '../ui/Button';
import Modal from '../ui/Modal';
import { RotateCcw } from 'lucide-react';
import { learningAPI } from '../../services/learningAPI';
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

  const handleRadioChange = (value: string) => {
    setReviewType(value as 'immediate' | 'scheduled');
  };

  const handleDaysChange = (e: ChangeEvent<HTMLInputElement>) => {
    setDaysFromNow(parseInt(e.target.value) || 7);
  };

  if (selectedWordIds.length === 0) return null;

  return (
    <>
      <Button 
        variant="secondary" 
        onClick={() => setIsOpen(true)}
        className="gap-2"
      >
        <RotateCcw className="w-4 h-4" />
        Schedule Review ({selectedWordIds.length})
      </Button>
      
      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Schedule Batch Review"
        className="max-w-md"
      >
        <div className="space-y-6">
          <p className="text-gray-600">
            Schedule {selectedWordIds.length} selected words for review
          </p>
          
          <div className="space-y-4">
            <div className="space-y-3">
              <label className="font-medium text-gray-900">Review Type</label>
              
              <div className="space-y-2">
                <label className="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                  <input
                    type="radio"
                    name="reviewType"
                    value="immediate"
                    checked={reviewType === 'immediate'}
                    onChange={() => handleRadioChange('immediate')}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-3 text-gray-700">Review immediately</span>
                </label>
                
                <label className="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                  <input
                    type="radio"
                    name="reviewType"
                    value="scheduled"
                    checked={reviewType === 'scheduled'}
                    onChange={() => handleRadioChange('scheduled')}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-3 text-gray-700">Schedule for later</span>
                </label>
              </div>
            </div>
            
            {reviewType === 'scheduled' && (
              <div className="space-y-2">
                <label htmlFor="days" className="block font-medium text-gray-900">
                  Days from now
                </label>
                <input
                  id="days"
                  type="number"
                  min="1"
                  max="365"
                  value={daysFromNow}
                  onChange={handleDaysChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <p className="text-sm text-gray-500">
                  Words will be scheduled for review in {daysFromNow} {daysFromNow === 1 ? 'day' : 'days'}
                </p>
              </div>
            )}
          </div>
          
          <div className="flex justify-end space-x-3 pt-4 border-t">
            <Button 
              variant="secondary" 
              onClick={() => setIsOpen(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleBatchReview} 
              disabled={isLoading}
            >
              {isLoading ? 'Processing...' : 'Schedule Review'}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
};