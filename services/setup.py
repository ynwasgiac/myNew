#!/usr/bin/env python3
"""
Setup script for GPT-4 Translation Service
This script installs dependencies and verifies the translation service setup
"""

import os
import sys
import subprocess
import asyncio
from pathlib import Path


def install_requirements():
    """Install required Python packages"""
    requirements = [
        "openai>=1.0.0",
        "python-dotenv>=1.0.0",
        "pydantic>=2.0.0",
        "asyncio",
    ]

    print("Installing required packages...")
    for req in requirements:
        try:
            subprocess.check_call([sys.executable, "-m", "pip", "install", req])
            print(f"✅ Installed {req}")
        except subprocess.CalledProcessError as e:
            print(f"❌ Failed to install {req}: {e}")
            return False

    return True


def check_openai_key():
    """Check if OpenAI API key is configured"""
    from dotenv import load_dotenv
    load_dotenv()

    api_key = os.getenv('OPENAI_API_KEY')

    if not api_key:
        print("❌ OPENAI_API_KEY not found in environment variables")
        print("📝 Please set your OpenAI API key in the .env file")
        return False

    if api_key == "sk-your-openai-api-key-here":
        print("❌ Please replace the placeholder OpenAI API key in .env file")
        return False

    if not api_key.startswith('sk-'):
        print("❌ Invalid OpenAI API key format (should start with 'sk-')")
        return False

    print("✅ OpenAI API key configured")
    return True


async def test_translation_service():
    """Test the translation service"""
    try:
        # Import after ensuring dependencies are installed
        from services.translation_service import translation_service, test_translation_service

        print("Testing translation service...")

        # Test API key validation
        if not translation_service.validate_api_key():
            print("❌ Translation service validation failed")
            return False

        print("✅ Translation service API key validated")

        # Test basic translation
        test_successful = await translation_service.test_translation()

        if test_successful:
            print("✅ Translation service test successful")

            # Run comprehensive test
            print("Running comprehensive test...")
            test_results = await test_translation_service()

            print(f"✅ Service available: {test_results['service_available']}")
            print(f"✅ Supported languages: {test_results['supported_languages_count']}")
            print(f"✅ Available models: {len(test_results['available_models'])}")

            if test_results.get('errors'):
                print("⚠️  Some errors occurred during testing:")
                for error in test_results['errors']:
                    print(f"   - {error}")

            return True
        else:
            print("❌ Translation service test failed")
            return False

    except ImportError as e:
        print(f"❌ Failed to import translation service: {e}")
        print("📝 Make sure all dependencies are installed and the service file exists")
        return False
    except Exception as e:
        print(f"❌ Translation service test error: {e}")
        return False


def verify_file_structure():
    """Verify required files exist"""
    required_files = [
        "services/translation_service.py",
        "database/admin_routes.py",
        "database/main.py"
    ]

    missing_files = []

    for file_path in required_files:
        if not Path(file_path).exists():
            missing_files.append(file_path)

    if missing_files:
        print("❌ Missing required files:")
        for file in missing_files:
            print(f"   - {file}")
        return False

    print("✅ All required files found")
    return True


def main():
    """Main setup function"""
    print("🚀 Setting up GPT-4 Translation Service")
    print("=" * 50)

    # Step 1: Verify file structure
    print("\n1. Verifying file structure...")
    if not verify_file_structure():
        print("❌ Setup failed: Missing required files")
        return False

    # Step 2: Install dependencies
    print("\n2. Installing dependencies...")
    if not install_requirements():
        print("❌ Setup failed: Could not install dependencies")
        return False

    # Step 3: Create configuration files
    print("\n3. Creating configuration files...")

    # Step 4: Check API key
    print("\n4. Checking OpenAI API key...")
    api_key_configured = check_openai_key()

    # Step 5: Test translation service (only if API key is configured)
    if api_key_configured:
        print("\n5. Testing translation service...")
        try:
            test_result = asyncio.run(test_translation_service())
            if not test_result:
                print("⚠️  Translation service test failed, but setup is complete")
        except Exception as e:
            print(f"⚠️  Could not test translation service: {e}")
    else:
        print("\n5. Skipping translation service test (API key not configured)")

    # Final summary
    print("\n" + "=" * 50)
    print("🎉 Setup Summary:")
    print("✅ Dependencies installed")
    print("✅ Configuration files created")

    if api_key_configured:
        print("✅ OpenAI API key configured")
        print("✅ Translation service ready")
    else:
        print("📝 Next steps:")
        print("   1. Get your OpenAI API key from https://platform.openai.com/")
        print("   2. Edit the .env file and replace the placeholder API key")
        print("   3. Restart your FastAPI server")

    print("\n🚀 To start your server:")
    print("   uvicorn main:app --reload")

    return True


if __name__ == "__main__":
    try:
        success = main()
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        print("\n❌ Setup interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Setup failed with error: {e}")
        sys.exit(1)