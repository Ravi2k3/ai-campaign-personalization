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

You are an expert email copywriter specializing in personalized B2B outreach campaigns. Your emails are:
- Highly personalized and relevant to each recipient
- Conversational and human-like (no corporate jargon or robotic language)
- Concise and respectful of the recipient's time
- Focused on value and genuine connection, not pushy sales tactics

## Writing Guidelines
- Write in a natural, conversational tone as if you're a real person reaching out
- Avoid em-dashes (—), excessive exclamation marks, and overly formal language.
- Keep paragraphs short (2-3 sentences max)
- Use the recipient's name naturally, but don't overuse it
- Reference specific details about the recipient when relevant
- End with a clear, low-pressure call-to-action

## Do nots
- Do not use any special characters in the email body.
- Do not give any false information about the company or the recipient.
- Do not provide any examples in the email body.
- Do not provide any ungiven links in the email body.

## Technical Requirements
- Return the email body in clean HTML format (use <p>, <strong>, <em> tags only)
- Do NOT use markdown formatting
- Keep the subject line under 60 characters when possible
- Ensure the email is mobile-friendly (short paragraphs, scannable)
""")

PROMPT = dedent("""
Generate a personalized email for the following campaign:

## RECIPIENT INFORMATION
{user_info}

## CAMPAIGN DETAILS
{campaign_info}

## EMAIL SEQUENCE CONTEXT
{previous_emails}

---

Based on the above information:
1. If this is the first email (no previous emails), write an engaging introduction
2. If there are previous emails, write a natural follow-up that acknowledges the sequence without being pushy
3. Personalize based on the recipient's role, company, and any other available details
4. Align the message with the campaign goal
5. Keep the tone warm, professional, and human

Generate the email now.
""")

async def generate_mail(
    user_info: dict,
    campaign_info: dict,
    previous_emails: list
) -> PersonalizedMessage: # type: ignore
    """
    Generate a personalized email using AI with retry logic.
    
    Args:
        user_info: Dictionary containing user information for personalization.
        campaign_info: Dictionary containing campaign information for personalization.
        previous_emails: List of previous emails sent to the user.
    
    Returns:
        PersonalizedMessage with subject and body.
    
    Raises:
        Exception: If all retry attempts fail.
    """

    email_agent = Agent(
        provider=PROVIDER,
        model=MODEL,
        output_schema=PersonalizedMessage,
        system_role=ROLE,
        persistence=False # We do not need to store entire agents history
    )
    
    email_agent_prompt = Content(PROMPT.format(
        user_info=user_info,
        campaign_info=campaign_info,
        previous_emails=previous_emails
    ))

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

    if last_exception:
        # pls catch this during runtime
        raise last_exception