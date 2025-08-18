# run_image_generation.py
#!/usr/bin/env python3
"""
Convenient runner script for Word Image Generation Service
Auto-configured for testing with localhost:8000
"""

import os
import sys
import asyncio
import logging
from pathlib import Path


async def run_image_generation():
    """Run the image generation service with predefined settings"""
    try:
        # Import the service
        from services.word_image_service import WordImageService
        
        print("Starting Image Generation Process")
        print("=" * 50)
        print("Configuration:")
        print("   - API URL: http://localhost:8000")
        print("   - Max words: 1 (test mode)")
        print("   - Delay: 2.0 seconds")
        print("   - Debug: Enabled")
        print("=" * 50)
        
        # Get token from environment or prompt once
        api_token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhZG1pbiIsInVzZXJfaWQiOjEsInJvbGUiOiJhZG1pbiIsImp0aSI6IjIyZjA2OGVjLWViMzEtNGRlYS05ZmViLWM5YmEyODBlOWY1ZSIsImV4cCI6MTc1NTI4MDU4NX0.BTgCwkbwdfXGWVv66hv9FgNHOEfgmqeOpmnboxJgvPE"
        if not api_token or api_token == 'your-api-token-here':
            print("\nAPI Token Required")
            print("Please enter your API token:")
            try:
                api_token = input("Token: ").strip()
            except KeyboardInterrupt:
                print("\nOperation cancelled")
                return False
        
        if not api_token:
            print("ERROR: API token is required")
            return False
        
        async with WordImageService("http://localhost:8000", api_token) as service:
            stats = await service.process_all_words_without_images(
                max_words=100,  # Process only 1 word for testing
                delay_between_words=2.0
            )
            
            # Display results
            print("\n" + "="*50)
            print("IMAGE GENERATION COMPLETE!")
            print("="*50)
            print("Final Statistics:")
            print(f"   - Total words found: {stats['total_words']}")
            print(f"   - Words processed: {stats['processed']}")
            print(f"   - Successful: {stats['successful']}")
            print(f"   - Failed: {stats['failed']}")
            
            if stats['processed'] > 0:
                success_rate = (stats['successful'] / stats['processed']) * 100
                print(f"   - Success rate: {success_rate:.1f}%")
            
            if stats['errors']:
                print(f"\nErrors encountered:")
                for i, error in enumerate(stats['errors'][:3], 1):
                    print(f"   {i}. {error}")
                if len(stats['errors']) > 3:
                    print(f"   ... and {len(stats['errors']) - 3} more errors")
            
            print(f"\nFull log saved to: word_image_generation.log")
            return True
            
    except KeyboardInterrupt:
        print("\nProcess interrupted by user")
        return False
    except Exception as e:
        print(f"\nFatal error: {e}")
        return False


def main():
    """Main function with auto-configuration"""
    print("Kazakh Word Image Generation Service - Auto Test Mode")
    print("=" * 60)
    
    # Configure logging for debug mode with UTF-8 encoding
    logging.basicConfig(
        level=logging.ERROR,  # Enable debug logging
        format='%(asctime)s - %(levelname)s - %(message)s',
        handlers=[
            # Console handler with UTF-8 encoding
            logging.StreamHandler(sys.stdout),
            # File handler with UTF-8 encoding
            logging.FileHandler('word_image_generation.log', encoding='utf-8')
        ]
    )
    
    # Set console encoding to UTF-8
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    if hasattr(sys.stderr, 'reconfigure'):
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')
    
    print("Starting automatic image generation test...")
    
    # Run the service
    success = asyncio.run(run_image_generation())
    
    if success:
        print(f"\nTest completed successfully!")
        print(f"Check public/images/words/categories/ for generated images")
    else:
        print(f"\nTest completed with issues")
        print(f"Check word_image_generation.log for details")


if __name__ == "__main__":
    main()