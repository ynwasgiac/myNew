import React from 'react';
import { RefreshCw, BookOpen } from 'lucide-react';

interface ReviewWordsButtonProps {
  currentUser: any;
  onStartReview?: (words: any[]) => void;
}

const ReviewWordsButton: React.FC<ReviewWordsButtonProps> = ({ currentUser, onStartReview }) => {
    const [reviewWords, setReviewWords] = React.useState<any[]>([]);
    const [isLoading, setIsLoading] = React.useState(false);
    
  React.useEffect(() => {
    const fetchReviewWords = async () => {
      try {
        const userLanguage = currentUser?.main_language?.language_code || 'en';
        // Mock API call - replace with actual learningAPI.getWordsForReview
        const words = await fetch(`/learning/words/due-for-review?limit=50&language_code=${userLanguage}`)
          .then(res => res.json());
        setReviewWords(words || []);
      } catch (error) {
        console.error('Failed to fetch review words:', error);
      }
    };

    if (currentUser) {
      fetchReviewWords();
    }
  }, [currentUser]);

  const handleStartReview = async () => {
    if (reviewWords.length === 0) return;
    
    setIsLoading(true);
    try {
      // Start review session with learning module
      const response = await fetch('/learning-module/batch/review-words/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit: 9 })
      });
      
      const result = await response.json();
      
      if (response.ok) {
        // Navigate to learning module or trigger callback
        if (onStartReview) {
          onStartReview(result.words);
        } else {
          window.location.href = '/app/learning-module';
        }
      } else {
        throw new Error(result.detail || 'Failed to start review session');
      }
    } catch (error) {
      console.error('Failed to start review session:', error);
      alert('Failed to start review session. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const reviewWordsCount = reviewWords?.length || 0;

  if (reviewWordsCount === 0) {
    return null;
  }

  return (
    <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="flex-shrink-0">
            <RefreshCw className="h-6 w-6 text-orange-600" />
          </div>
          <div>
            <h3 className="text-lg font-medium text-orange-900">
              Words Ready for Review
            </h3>
            <p className="text-sm text-orange-700">
              {reviewWordsCount} words need practice to maintain your learning
            </p>
          </div>
        </div>
        <button
          onClick={handleStartReview}
          disabled={isLoading}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <>
              <RefreshCw className="animate-spin -ml-1 mr-2 h-4 w-4" />
              Starting...
            </>
          ) : (
            <>
              <BookOpen className="-ml-1 mr-2 h-4 w-4" />
              Start Review Session
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default ReviewWordsButton;