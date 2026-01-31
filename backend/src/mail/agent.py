import os, asyncio

from textwrap import dedent
from dotenv import load_dotenv

from moonlight import Agent, Provider, Content

from .base import PersonalizedMessage
from ..logger import logger

load_dotenv()

# AI Provider Configuration
SOURCE = 'groq'
API = os.getenv("GROQ_API_KEY")
MODEL = "qwen/qwen3-32b"

# Retry configuration
MAX_RETRIES = 3

# Ensure that this is length of MAX_RETRIES and values are in seconds
RETRY_DELAYS = [1, 2, 4]  # Exponential backoff: 1s, 2s, 4s

# Check if the length of RETRY_DELAYS is equal to MAX_RETRIES
if len(RETRY_DELAYS) != MAX_RETRIES:
    raise ValueError("RETRY_DELAYS must be of length MAX_RETRIES")

# Initialize Provider
PROVIDER = Provider(
    source=SOURCE,
    api=API # type: ignore
)

# Role & Prompt for the AI
ROLE = dedent("""
# Role

You will be provided with information about the user. Your task is to write a personalized email to the user based on the information provided.
Make sure to keep it friendly and engaging. Ensure to not use em-dashes or markdown format. Keep it as human as possible.

## Important
Make sure to return the body of the email in html format so the email looks clean.
""")

PROMPT = dedent("""
Here is the information about the user:
{user_info}

Now write a personalized email to the user based on the information provided.
""")


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

    email_agent = Agent(
        provider=PROVIDER,
        model=MODEL,
        output_schema=PersonalizedMessage,
        system_role=ROLE
    )
    
    email_agent_prompt = Content(
        PROMPT.format(user_info=user_info)
    )

    last_exception = None
    
    for attempt in range(MAX_RETRIES):
        try:
            response: PersonalizedMessage = await email_agent.run(email_agent_prompt) # type: ignore
            return response
        except Exception as e:
            last_exception = e
            logger.warning(
                f"Email generation failed (attempt {attempt + 1}/{MAX_RETRIES}): {str(e)}"
            )
            
            # Don't sleep after the last attempt
            if attempt < MAX_RETRIES - 1:
                await asyncio.sleep(RETRY_DELAYS[attempt])
    
    logger.error(f"Email generation failed after {MAX_RETRIES} attempts: {str(last_exception)}")

    raise last_exception  # type: ignore