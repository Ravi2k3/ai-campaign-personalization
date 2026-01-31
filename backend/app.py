import asyncio

# type: ignore
from src.mail import (
    generate_mail,
    send_mail,
    send_mail_batch,
    Sender,
    Mail
)

if __name__ == "__main__":
    # user_info = {
    #     "name": "John Doe",
    #     "age": 30,
    #     "gender": "Male",
    #     "interests": ["Reading", "Traveling", "Photography"],
    #     "location": "New York"
    # }

    # output = asyncio.run(generate_mail(user_info))
    # print(output.subject)
    # print(output.body)

    send_mail(Mail(
        sender=Sender(
            name="John Doe",
            email="miaow@miaow.com"
        ),
        to="gotham47g@gmail.com",
        subject="Hello",
        body="Hello, how are you?"
    ))