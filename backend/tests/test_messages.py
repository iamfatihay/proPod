"""Tests for the /messages endpoints (Direct Messaging).

Covers:
- POST /messages/       — send DM (happy path, self-message rejection, inactive recipient)
- GET  /messages/inbox  — inbox listing, unread counts, user isolation
- GET  /messages/{id}   — conversation retrieval, pagination, ordering, read-marking side effect
"""
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app import crud, models
from app.auth import create_access_token, get_password_hash

client = TestClient(app)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_user(db, email: str, name: str, is_active: bool = True) -> models.User:
    existing = db.query(models.User).filter(models.User.email == email).first()
    if existing:
        return existing
    user = models.User(
        email=email,
        name=name,
        hashed_password=get_password_hash("password123"),
        is_active=is_active,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _auth(user: models.User) -> dict:
    token = create_access_token({"sub": user.email})
    return {"Authorization": f"Bearer {token}"}


def _send_dm(db, sender, recipient, body="Hello!") -> models.DirectMessage:
    return crud.send_direct_message(db, sender.id, recipient.id, body)


# ---------------------------------------------------------------------------
# POST /messages/ — send a direct message
# ---------------------------------------------------------------------------

class TestSendMessage:
    def test_send_message_happy_path(self, db_session):
        sender = _make_user(db_session, "dm_sender@example.com", "Sender")
        recip  = _make_user(db_session, "dm_recip@example.com",  "Recipient")

        resp = client.post(
            "/messages/",
            json={"recipient_id": recip.id, "body": "Hey there!"},
            headers=_auth(sender),
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["body"] == "Hey there!"
        assert data["sender_id"] == sender.id
        assert data["recipient_id"] == recip.id
        assert data["is_read"] is False

    def test_send_message_unauthenticated(self, db_session):
        recip = _make_user(db_session, "dm_unauth_recip@example.com", "Recip")
        resp = client.post(
            "/messages/",
            json={"recipient_id": recip.id, "body": "Hi"},
        )
        assert resp.status_code == 401

    def test_self_message_rejected(self, db_session):
        user = _make_user(db_session, "dm_self@example.com", "Self User")
        resp = client.post(
            "/messages/",
            json={"recipient_id": user.id, "body": "Talking to myself"},
            headers=_auth(user),
        )
        assert resp.status_code == 400

    def test_recipient_not_found_returns_404(self, db_session):
        sender = _make_user(db_session, "dm_nf_sender@example.com", "NF Sender")
        resp = client.post(
            "/messages/",
            json={"recipient_id": 999999, "body": "Ghost message"},
            headers=_auth(sender),
        )
        assert resp.status_code == 404

    def test_inactive_recipient_rejected(self, db_session):
        sender   = _make_user(db_session, "dm_active_sender@example.com",   "Active Sender")
        inactive = _make_user(db_session, "dm_inactive_recip@example.com",  "Gone User", is_active=False)
        resp = client.post(
            "/messages/",
            json={"recipient_id": inactive.id, "body": "Are you there?"},
            headers=_auth(sender),
        )
        assert resp.status_code == 404

    def test_empty_body_rejected(self, db_session):
        sender = _make_user(db_session, "dm_empty_sender@example.com", "Empty Sender")
        recip  = _make_user(db_session, "dm_empty_recip@example.com",  "Empty Recip")
        resp = client.post(
            "/messages/",
            json={"recipient_id": recip.id, "body": "   "},
            headers=_auth(sender),
        )
        assert resp.status_code == 422


# ---------------------------------------------------------------------------
# GET /messages/inbox — inbox listing
# ---------------------------------------------------------------------------

class TestInbox:
    def test_inbox_empty_for_new_user(self, db_session):
        user = _make_user(db_session, "inbox_empty@example.com", "Inbox Empty")
        resp = client.get("/messages/inbox", headers=_auth(user))
        assert resp.status_code == 200
        assert resp.json()["threads"] == []

    def test_inbox_unauthenticated(self):
        resp = client.get("/messages/inbox")
        assert resp.status_code == 401

    def test_inbox_shows_conversation_after_message(self, db_session):
        alice = _make_user(db_session, "inbox_alice@example.com", "Alice")
        bob   = _make_user(db_session, "inbox_bob@example.com",   "Bob")
        _send_dm(db_session, alice, bob, "Hey Bob!")

        resp = client.get("/messages/inbox", headers=_auth(alice))
        assert resp.status_code == 200
        threads = resp.json()["threads"]
        assert len(threads) >= 1
        partner_ids = [t["partner_id"] for t in threads]
        assert bob.id in partner_ids

    def test_inbox_unread_count(self, db_session):
        carol = _make_user(db_session, "inbox_carol@example.com", "Carol")
        dave  = _make_user(db_session, "inbox_dave@example.com",  "Dave")
        _send_dm(db_session, dave, carol, "First unread")
        _send_dm(db_session, dave, carol, "Second unread")

        resp = client.get("/messages/inbox", headers=_auth(carol))
        threads = resp.json()["threads"]
        dave_thread = next((t for t in threads if t["partner_id"] == dave.id), None)
        assert dave_thread is not None
        assert dave_thread["unread_count"] == 2

    def test_inbox_user_isolation(self, db_session):
        eve   = _make_user(db_session, "inbox_eve@example.com",   "Eve")
        frank = _make_user(db_session, "inbox_frank@example.com", "Frank")
        grace = _make_user(db_session, "inbox_grace@example.com", "Grace")
        _send_dm(db_session, eve, frank, "Private msg")

        # Grace should NOT see Eve↔Frank thread
        resp = client.get("/messages/inbox", headers=_auth(grace))
        partner_ids = [t["partner_id"] for t in resp.json()["threads"]]
        assert eve.id not in partner_ids
        assert frank.id not in partner_ids

    def test_inbox_skips_inactive_partner(self, db_session):
        active_user  = _make_user(db_session, "inbox_active@example.com",   "Active")
        gone_user    = _make_user(db_session, "inbox_gone@example.com",      "Gone")
        _send_dm(db_session, gone_user, active_user, "Old message")

        # Deactivate gone_user
        gone_user.is_active = False
        db_session.commit()

        resp = client.get("/messages/inbox", headers=_auth(active_user))
        partner_ids = [t["partner_id"] for t in resp.json()["threads"]]
        assert gone_user.id not in partner_ids


# ---------------------------------------------------------------------------
# GET /messages/{partner_id} — conversation retrieval
# ---------------------------------------------------------------------------

class TestGetConversation:
    def test_get_conversation_happy_path(self, db_session):
        henry = _make_user(db_session, "conv_henry@example.com", "Henry")
        ivy   = _make_user(db_session, "conv_ivy@example.com",   "Ivy")
        _send_dm(db_session, henry, ivy, "Hello Ivy")
        _send_dm(db_session, ivy, henry, "Hey Henry")

        resp = client.get(f"/messages/{ivy.id}", headers=_auth(henry))
        assert resp.status_code == 200
        data = resp.json()
        assert "messages" in data
        assert len(data["messages"]) == 2

    def test_get_conversation_unauthenticated(self, db_session):
        user = _make_user(db_session, "conv_unauth@example.com", "Unauth")
        resp = client.get(f"/messages/{user.id}")
        assert resp.status_code == 401

    def test_get_conversation_with_inactive_partner_returns_404(self, db_session):
        jack    = _make_user(db_session, "conv_jack@example.com",    "Jack")
        deleted = _make_user(db_session, "conv_deleted@example.com", "Deleted")
        deleted.is_active = False
        db_session.commit()

        resp = client.get(f"/messages/{deleted.id}", headers=_auth(jack))
        assert resp.status_code == 404

    def test_read_marking_side_effect_on_fetch(self, db_session):
        """Fetching a conversation marks all incoming messages as read."""
        kim  = _make_user(db_session, "conv_kim@example.com",  "Kim")
        liam = _make_user(db_session, "conv_liam@example.com", "Liam")
        _send_dm(db_session, liam, kim, "Unread 1")
        _send_dm(db_session, liam, kim, "Unread 2")

        # Verify unread before fetch
        inbox_before = client.get("/messages/inbox", headers=_auth(kim)).json()["threads"]
        kim_thread = next((t for t in inbox_before if t["partner_id"] == liam.id), None)
        assert kim_thread is not None
        assert kim_thread["unread_count"] == 2

        # Fetch conversation (triggers mark-as-read)
        client.get(f"/messages/{liam.id}", headers=_auth(kim))

        # Unread count should now be 0
        inbox_after = client.get("/messages/inbox", headers=_auth(kim)).json()["threads"]
        kim_thread_after = next((t for t in inbox_after if t["partner_id"] == liam.id), None)
        assert kim_thread_after is not None
        assert kim_thread_after["unread_count"] == 0

    def test_pagination_ordering(self, db_session):
        """Messages are returned newest-first; pagination skip/limit works."""
        mia  = _make_user(db_session, "conv_mia@example.com",  "Mia")
        noah = _make_user(db_session, "conv_noah@example.com", "Noah")

        for i in range(6):
            _send_dm(db_session, mia, noah, f"Msg {i}")

        # First page: limit=4, skip=0
        resp1 = client.get(f"/messages/{noah.id}?skip=0&limit=4", headers=_auth(mia))
        assert resp1.status_code == 200
        data1 = resp1.json()
        assert len(data1["messages"]) == 4
        assert data1["has_more"] is True

        # Second page: skip=4, limit=4 should return remaining 2
        resp2 = client.get(f"/messages/{noah.id}?skip=4&limit=4", headers=_auth(mia))
        data2 = resp2.json()
        assert len(data2["messages"]) == 2
        assert data2["has_more"] is False

        # Verify newest-first ordering on first page
        bodies = [m["body"] for m in data1["messages"]]
        assert bodies[0] == "Msg 5"  # newest
