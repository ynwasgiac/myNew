// REPLACE YOUR EXISTING src/components/dashboard/ReviewWidget.tsx with this:

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, Calendar, AlertTriangle, BookOpen, RotateCcw } from 'lucide-react';
import { learningAPI } from '../../services/learningAPI';

// Define the ReviewStats interface locally if it's not exported
interface ReviewStats {
  due_now: number;
  due_today: number;
  overdue: number;
}

export const ReviewWidget: React.FC = () => {
  const [stats, setStats] = useState<ReviewStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const reviewStats = await learningAPI.getReviewStats();
        setStats(reviewStats);
      } catch (error) {
        console.error('Failed to fetch review stats:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <RotateCcw className="w-5 h-5" />
          <h3 className="text-lg font-semibold">Review Schedule</h3>
        </div>
        <div className="animate-pulse space-y-2">
          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  if (!stats) return null;

  const hasReviews = stats.due_now > 0 || stats.due_today > 0 || stats.overdue > 0;

  return (
    <div className={`bg-white rounded-lg border p-6 ${stats.overdue > 0 ? 'border-orange-200 bg-orange-50' : 'border-gray-200'}`}>
      <div className="flex items-center gap-2 mb-4">
        <RotateCcw className="w-5 h-5" />
        <h3 className="text-lg font-semibold">Review Schedule</h3>
      </div>
      
      <div className="space-y-4">
        {!hasReviews ? (
          <div className="text-center py-4">
            <BookOpen className="w-8 h-8 mx-auto text-gray-400 mb-2" />
            <p className="text-gray-600">No reviews due right now</p>
            <p className="text-sm text-gray-500">Keep learning new words!</p>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              {stats.due_now > 0 && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-blue-600" />
                    <span className="text-sm">Due now</span>
                  </div>
                  <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded">
                    {stats.due_now}
                  </span>
                </div>
              )}
              
              {stats.due_today > 0 && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-green-600" />
                    <span className="text-sm">Due today</span>
                  </div>
                  <span className="bg-green-100 text-green-800 text-xs font-medium px-2.5 py-0.5 rounded">
                    {stats.due_today}
                  </span>
                </div>
              )}
              
              {stats.overdue > 0 && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-orange-600" />
                    <span className="text-sm">Overdue</span>
                  </div>
                  <span className="bg-red-100 text-red-800 text-xs font-medium px-2.5 py-0.5 rounded">
                    {stats.overdue}
                  </span>
                </div>
              )}
            </div>
            
            <button 
              onClick={() => navigate('/app/practice?mode=review')}
              className={`w-full px-4 py-2 rounded-md font-medium transition-colors ${
                stats.overdue > 0 
                  ? 'bg-red-600 hover:bg-red-700 text-white' 
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
            >
              {stats.overdue > 0 ? 'Catch Up on Reviews' : 'Start Reviewing'}
            </button>
          </>
        )}
      </div>
    </div>
  );
};