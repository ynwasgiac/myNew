import React, { useEffect, useState } from 'react';
import { card, cardContent, CardHeader, CardTitle } from '../ui/StatsCard';
import  Button  from '../ui/Button';
import Badge from '../ui/Badge';
import { Clock, Calendar, AlertTriangle, BookOpen } from 'lucide-react';
import { learningAPI, type ReviewStats } from '../../services/learningAPI'; // Updated import path
import { useNavigate } from 'react-router-dom';

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
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RotateCcw className="w-5 h-5" />
            Review Schedule
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-2">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!stats) return null;

  const hasReviews = stats.due_now > 0 || stats.due_today > 0 || stats.overdue > 0;

  return (
    <Card className={`${stats.overdue > 0 ? 'border-orange-200 bg-orange-50' : ''}`}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <RotateCcw className="w-5 h-5" />
          Review Schedule
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
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
                  <Badge variant="secondary">{stats.due_now}</Badge>
                </div>
              )}
              
              {stats.due_today > 0 && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-green-600" />
                    <span className="text-sm">Due today</span>
                  </div>
                  <Badge variant="secondary">{stats.due_today}</Badge>
                </div>
              )}
              
              {stats.overdue > 0 && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-orange-600" />
                    <span className="text-sm">Overdue</span>
                  </div>
                  <Badge variant="destructive">{stats.overdue}</Badge>
                </div>
              )}
            </div>
            
            <Button 
              onClick={() => navigate('/learning/practice?mode=review')}
              className="w-full"
              variant={stats.overdue > 0 ? "destructive" : "default"}
            >
              {stats.overdue > 0 ? 'Catch Up on Reviews' : 'Start Reviewing'}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
};