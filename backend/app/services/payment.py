from hashlib import sha256
from typing import Protocol


class PaymentAdapter(Protocol):
    def charge(
        self,
        *,
        user_id: int,
        course_id: str,
        amount: int,
        idempotency_key: str,
    ) -> str: ...


class MockPaymentAdapter:
    def charge(
        self,
        *,
        user_id: int,
        course_id: str,
        amount: int,
        idempotency_key: str,
    ) -> str:
        digest = sha256(idempotency_key.encode("utf-8")).hexdigest()
        return f"mock-{digest[:32]}"


def get_payment_adapter() -> PaymentAdapter:
    return MockPaymentAdapter()
