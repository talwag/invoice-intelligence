from google import genai
import os
from dotenv import load_dotenv

load_dotenv()

client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
# creates the client with our API key — like new Anthropic(api_key=...) in lesson 2.2

response = client.models.generate_content(
    model="gemini-2.5-flash",
    contents="Say hello in Hebrew"
)
print(response.text)
