import os
from textwrap import dedent
from dotenv import load_dotenv
from moonlight import Agent, Provider, Content
from .base import PersonalizedMessage

load_dotenv()

PROVIDER = 'groq'
API = os.getenv("GROQ_API_KEY")
MODEL = "qwen/qwen3-32b"

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
    agent_prompt = Content(
        text=dedent(f"""
        Here is the information about the user:
        {user_info}

        Now write a personalized email to the user based on the information provided.
        """)
    )

    try:
        response: PersonalizedMessage = await agent.run(agent_prompt) # type: ignore
        return response
    except Exception as e:
        raise e