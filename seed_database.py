# seed_database.py - Run this to populate your database
import asyncio
import sys
import os

# Add the current directory to Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database.seed_data import DatabaseSeeder
from database import init_database
from database.connection import AsyncSessionLocal


async def main():
    """Seed the database with initial data"""
    print("🚀 Initializing Kazakh Language Learning Database...")

    try:
        # Initialize database (create tables)
        await init_database()

        # Seed data
        async with AsyncSessionLocal() as db:
            await DatabaseSeeder.seed_all(db)

        print("\n🎉 Database setup completed successfully!")
        print("\n📋 You can now:")
        print("   1. Start your FastAPI server: python main.py")
        print("   2. Register a new user: POST /auth/register")
        print("   3. Login: POST /auth/login")
        print("   4. Access protected endpoints with the token")
        print("\n🔑 Admin credentials:")
        print("   Username: admin")
        print("   Password: admin123!")
        print("   Email: admin@kazakhlearn.com")

    except Exception as e:
        print(f"❌ Error during database setup: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(main())