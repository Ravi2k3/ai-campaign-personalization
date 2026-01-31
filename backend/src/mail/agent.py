import os
import asyncio
from textwrap import dedent
from dotenv import load_dotenv
from moonlight import Agent, Provider, Content
from .base import PersonalizedMessage
from ..logger import logger

load_dotenv()

PROVIDER = 'groq'
API = os.getenv("GROQ_API_KEY")
MODEL = "qwen/qwen3-32b"

# Retry configuration
MAX_RETRIES = 3
RETRY_DELAYS = [1, 2, 4]  # Exponential backoff: 1s, 2s, 4s

provider = Provider(
    source=PROVIDER,
    api=API # type: ignore
)

agent_role = dedent("""
# Role

You will be provided with information about the user. Your task is to write a personalized email to the user based on the information provided.
Make sure to keep it friendly and engaging. Ensure to not use em-dashes or markdown format. Keep it as human as possible.

## Important
Make sure to return the body of the email in html format so the email looks clean.
""")

agent = Agent(
    provider=provider,
    model=MODEL,
    output_schema=PersonalizedMessage,
    system_role=agent_role
)

async def generate_mail(
    user_info: dict
) -> PersonalizedMessage:
    """
    Generate a personalized email using AI with retry logic.
    
    Args:
        user_info: Dictionary containing user information for personalization.
    
    Returns:
        PersonalizedMessage with subject and body.
    
    Raises:
        Exception: If all retry attempts fail.
    """
    agent_prompt = Content(
        text=dedent(f"""
        Here is the information about the user:
        {user_info}

        Now write a personalized email to the user based on the information provided.
        """)
    )

    last_exception = None
    
    for attempt in range(MAX_RETRIES):
        try:
            logger.info(f"Generating personalized email (attempt {attempt + 1}/{MAX_RETRIES})")
            response: PersonalizedMessage = await agent.run(agent_prompt) # type: ignore
            logger.info(f"Email generated successfully on attempt {attempt + 1}")
            return response
        except Exception as e:
            last_exception = e
            logger.warning(
                f"Email generation failed on attempt {attempt + 1}/{MAX_RETRIES}: {str(e)}"
            )
            
            # Don't sleep after the last attempt
            if attempt < MAX_RETRIES - 1:
                delay = RETRY_DELAYS[attempt]
                logger.info(f"Retrying in {delay} seconds...")
                await asyncio.sleep(delay)
    
    logger.error(f"Email generation failed after {MAX_RETRIES} attempts: {str(last_exception)}")
    raise last_exception  # type: ignore