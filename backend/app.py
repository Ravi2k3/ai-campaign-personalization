import asyncio
from src.mail import generate_mail # type: ignore

if __name__ == "__main__":
    user_info = {
        "name": "John Doe",
        "age": 30,
        "gender": "Male",
        "interests": ["Reading", "Traveling", "Photography"],
        "location": "New York"
    }

    output = asyncio.run(generate_mail(user_info))
    print(output.subject)
    print(output.body)