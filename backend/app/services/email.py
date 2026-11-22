from typing import Protocol


class EmailSender(Protocol):
    def send_password_reset(self, email: str, token: str) -> None: ...


class MockEmailSender:
    def send_password_reset(self, email: str, token: str) -> None:
        return None


def get_email_sender() -> EmailSender:
    return MockEmailSender()
