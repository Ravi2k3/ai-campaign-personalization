# type: ignore
from src.mail import (
    generate_mail,
    send_mail,
    send_mail_batch,
    Mail,
    Sender
)

if __name__ == "__main__":
    batch = [
        Mail(
            sender=Sender(
                name="John Doe",
                email="bktmb234g@gmail.com"
            ),
            to="gotham47g@gmail.com",
            subject="Hello",
            body="Hello, how are you?"
        ),
        Mail(
            sender=Sender(
                name="Miaow Woof",
                email="bktmb234g@gmail.com"
            ),
            to="gotham47g@gmail.com",
            subject="Hello, please reply",
            body="Hello, how are you?"
        ),
        Mail(
            sender=Sender(
                name="Rawr Doe",
                email="bktmb234g@gmail.com"
            ),
            to="gotham47g@gmail.com",
            subject="Hello, pls",
            body="Hello, how are you?"
        )
    ]

    send_mail_batch(batch)