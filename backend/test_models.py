import asyncio
import google.generativeai as genai
from src.database import get_database
from src.services.api_key_service import APIKeyService
from src.models.api_keys import AIProvider

async def main():
    db = get_database()
    # Initialize DB client verification
    await db.command("ping")
    
    # Retrieve decrypted Gemini key
    key = await APIKeyService.get_decrypted_key("Aun-shahid", AIProvider.GEMINI)
    if not key:
        # Check if we can find any gemini key in the collection
        cursor = db["api_keys"].find({"provider": "gemini"})
        async for doc in cursor:
            from src.services.encryption_service import decrypt_value
            key = decrypt_value(doc["encrypted_key"])
            print(f"Found Gemini key for user: {doc['user_id']}")
            break

    if not key:
        print("No active Gemini API key found in the database.")
        return

    genai.configure(api_key=key)
    print("Listing Gemini models:")
    try:
        for m in genai.list_models():
            if 'generateContent' in m.supported_generation_methods:
                print(f"- Name: {m.name}, Display: {m.display_name}")
    except Exception as e:
        print(f"Error listing models: {e}")

if __name__ == "__main__":
    asyncio.run(main())
