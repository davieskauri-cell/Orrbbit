"""Shared fixtures for backend API tests.

Since iter43, unverified accounts are hard-blocked from product APIs
(EMAIL_VERIFICATION_REQUIRED). Tests that register throwaway accounts must
mark them verified in the DB — exactly what a user does via the email link.
"""
import pymongo
import pytest
from dotenv import dotenv_values


@pytest.fixture(scope="session")
def verify_email():
    env = dotenv_values("/app/backend/.env")

    def _verify(email: str):
        c = pymongo.MongoClient(env["MONGO_URL"])
        c[env["DB_NAME"]].users.update_one(
            {"email": email.lower()}, {"$set": {"email_verified": True}})
        c.close()

    return _verify
