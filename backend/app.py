import asyncio

# type: ignore
from src.mail import (
    generate_mail,
    send_mail,
    send_mail_batch,
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

    batch = [
        Mail(
            sender="John Doe",
            to="gotham47g@gmail.com",
            subject="Hello",
            body="Hello, how are you?"
        ),
        Mail(
            sender="Miaow Woof",
            to="gotham47g@gmail.com",
            subject="Hello, please reply",
            body="Hello, how are you?"
        ),
        Mail(
            sender="Rawr Doe",
            to="gotham47g@gmail.com",
            subject="Hello, pls",
            body="Hello, how are you?"
        )
    ]

    send_mail_batch(batch)