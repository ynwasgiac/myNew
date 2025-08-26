# scheduler.py
import asyncio
import logging
from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select, and_, update
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger

# Import your models and database config
from database.learning_models import UserWordProgress, LearningStatus
from database.connection import AsyncSessionLocal
from database import get_db
import os

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Use existing session factory
async_session = AsyncSessionLocal

# Global scheduler instance
scheduler = AsyncIOScheduler()


async def process_overdue_reviews():
    """
    Background task to automatically convert LEARNED/MASTERED words
    with overdue next_review_at dates to REVIEW status
    """
    async with async_session() as db:
        try:
            now = datetime.utcnow()
            logger.info(f"Starting overdue review processing at {now}")

            # Find all LEARNED/MASTERED words where next_review_at has passed
            stmt = (
                select(UserWordProgress)
                .where(
                    and_(
                        UserWordProgress.status.in_([LearningStatus.LEARNED, LearningStatus.MASTERED]),
                        UserWordProgress.next_review_at.isnot(None),
                        UserWordProgress.next_review_at <= now
                    )
                )
            )

            result = await db.execute(stmt)
            overdue_words = result.scalars().all()

            if not overdue_words:
                logger.info("No overdue words found for review")
                return

            logger.info(f"Found {len(overdue_words)} overdue words to convert to REVIEW status")

            # Update all overdue words to REVIEW status
            update_stmt = (
                update(UserWordProgress)
                .where(
                    and_(
                        UserWordProgress.status.in_([LearningStatus.LEARNED, LearningStatus.MASTERED]),
                        UserWordProgress.next_review_at.isnot(None),
                        UserWordProgress.next_review_at <= now
                    )
                )
                .values(
                    status=LearningStatus.REVIEW,
                    updated_at=now
                )
            )

            await db.execute(update_stmt)
            await db.commit()

            logger.info(f"Successfully converted {len(overdue_words)} words to REVIEW status")

            # Log some details about the processed words
            for word in overdue_words[:5]:  # Log first 5 for debugging
                logger.debug(f"Converted word ID {word.id} (user {word.user_id}) - was due {word.next_review_at}")

        except Exception as e:
            logger.error(f"Error processing overdue reviews: {e}")
            await db.rollback()
            raise


def start_scheduler():
    """Initialize and start the background scheduler"""
    try:
        # Add the overdue review processing job
        # Run every hour to check for overdue reviews
        scheduler.add_job(
            process_overdue_reviews,
            trigger=IntervalTrigger(hours=1),
            id='process_overdue_reviews',
            name='Process Overdue Reviews',
            max_instances=1,
            coalesce=True,
            misfire_grace_time=300  # 5 minutes grace time
        )

        # Start the scheduler
        scheduler.start()
        logger.info("Review scheduler started successfully")

        # Run immediately on startup to catch any existing overdue words
        asyncio.create_task(process_overdue_reviews())

    except Exception as e:
        logger.error(f"Failed to start scheduler: {e}")
        raise


def stop_scheduler():
    """Stop the background scheduler"""
    try:
        scheduler.shutdown(wait=False)
        logger.info("Review scheduler stopped")
    except Exception as e:
        logger.error(f"Error stopping scheduler: {e}")


async def run_manual_review_check():
    """Manual function to trigger overdue review processing"""
    logger.info("Running manual overdue review check...")
    await process_overdue_reviews()
    logger.info("Manual review check completed")


# For testing purposes - standalone execution
if __name__ == "__main__":
    async def main():
        await run_manual_review_check()


    asyncio.run(main())