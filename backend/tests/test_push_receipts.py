"""Tests for Expo push receipt polling.

Covers:
- check_push_receipts CRUD: ok-tickets deleted, DeviceNotRegistered tokens pruned
- check_push_receipts CRUD: non-DeviceNotRegistered errors logged, ticket still deleted
- check_push_receipts CRUD: tickets too young are skipped
- check_push_receipts CRUD: expired tickets (>25h) pruned without Expo call
- check_push_receipts CRUD: no tickets in DB → fast return
- POST /admin/push-receipts/check endpoint: requires admin auth
- POST /admin/push-receipts/check endpoint: non-admin rejected with 403
- POST /admin/push-receipts/check endpoint: happy path returns summary dict
- _send_expo_push: ok tickets stored in push_tickets when db is provided
- _send_expo_push: error tickets NOT stored in push_tickets
- _send_expo_push: push_tickets not written when db=None
"""

import datetime
import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from sqlalchemy.exc import IntegrityError

from app.main import app
from app import crud, models
from app.auth import create_access_token, get_password_hash
from app.models import UserRole

client = TestClient(app)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_user(db_session, email: str, name: str, role: UserRole = UserRole.USER) -> models.User:
    existing = db_session.query(models.User).filter(models.User.email == email).first()
    if existing:
        return existing
    user = models.User(
        email=email,
        name=name,
        hashed_password=get_password_hash("password123"),
        is_active=True,
        role=role,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


def _auth_headers(user: models.User) -> dict:
    token = create_access_token({"sub": user.email})
    return {"Authorization": f"Bearer {token}"}


def _make_ticket(db_session, expo_id: str, token: str, age_minutes: int = 20) -> models.PushTicket:
    """Insert a PushTicket row with a specified age."""
    sent_at = datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(minutes=age_minutes)
    row = models.PushTicket(expo_ticket_id=expo_id, token=token, sent_at=sent_at)
    db_session.add(row)
    db_session.commit()
    db_session.refresh(row)
    return row


def _make_device_token(db_session, user: models.User, token: str) -> models.DeviceToken:
    return crud.register_device_token(db_session, user.id, token, "ios")


def _mock_receipts_response(receipts_data: dict) -> MagicMock:
    """Return a mock httpx response for /push/getReceipts."""
    mock = MagicMock()
    mock.status_code = 200
    mock.json.return_value = {"data": receipts_data}
    return mock


# ---------------------------------------------------------------------------
# CRUD: check_push_receipts
# ---------------------------------------------------------------------------

class TestCheckPushReceiptsCrud:

    def test_no_tickets_returns_fast(self, db_session):
        result = crud.check_push_receipts(db_session, min_age_minutes=15)
        assert result["tickets_checked"] == 0
        assert result["tokens_pruned"] == 0
        assert result["tickets_remaining"] == 0

    def test_ok_receipt_deletes_ticket(self, db_session):
        user = _make_user(db_session, "receipt_ok@test.com", "Receipt OK")
        token = "ExponentPushToken[receipt_ok_tok]"
        _make_device_token(db_session, user, token)
        _make_ticket(db_session, "ticket-ok-001", token, age_minutes=20)

        mock_resp = _mock_receipts_response({"ticket-ok-001": {"status": "ok"}})
        with patch("app.crud.httpx.post", return_value=mock_resp):
            result = crud.check_push_receipts(db_session, min_age_minutes=15)

        assert result["ok"] == 1
        assert result["tokens_pruned"] == 0
        # Ticket row should be deleted
        remaining = db_session.query(models.PushTicket).filter(
            models.PushTicket.expo_ticket_id == "ticket-ok-001"
        ).first()
        assert remaining is None

    def test_device_not_registered_prunes_token(self, db_session):
        user = _make_user(db_session, "receipt_dnr@test.com", "Receipt DNR")
        token = "ExponentPushToken[dead_token_dnr]"
        _make_device_token(db_session, user, token)
        _make_ticket(db_session, "ticket-dnr-001", token, age_minutes=20)

        dnr_receipt = {
            "ticket-dnr-001": {
                "status": "error",
                "message": "DeviceNotRegistered",
                "details": {"error": "DeviceNotRegistered"},
            }
        }
        mock_resp = _mock_receipts_response(dnr_receipt)
        with patch("app.crud.httpx.post", return_value=mock_resp):
            result = crud.check_push_receipts(db_session, min_age_minutes=15)

        assert result["tokens_pruned"] == 1
        assert result["errors"] == 1
        # DeviceToken row must be gone
        dt = db_session.query(models.DeviceToken).filter(
            models.DeviceToken.token == token
        ).first()
        assert dt is None
        # Ticket row must also be gone
        ticket = db_session.query(models.PushTicket).filter(
            models.PushTicket.expo_ticket_id == "ticket-dnr-001"
        ).first()
        assert ticket is None

    def test_other_error_logs_but_deletes_ticket(self, db_session):
        user = _make_user(db_session, "receipt_err@test.com", "Receipt Err")
        token = "ExponentPushToken[other_error_tok]"
        _make_device_token(db_session, user, token)
        _make_ticket(db_session, "ticket-err-001", token, age_minutes=20)

        err_receipt = {
            "ticket-err-001": {
                "status": "error",
                "message": "InvalidCredentials",
                "details": {"error": "InvalidCredentials"},
            }
        }
        mock_resp = _mock_receipts_response(err_receipt)
        with patch("app.crud.httpx.post", return_value=mock_resp):
            result = crud.check_push_receipts(db_session, min_age_minutes=15)

        # Token NOT pruned (only DeviceNotRegistered triggers deletion)
        assert result["tokens_pruned"] == 0
        assert result["errors"] == 1
        # Ticket deleted regardless
        ticket = db_session.query(models.PushTicket).filter(
            models.PushTicket.expo_ticket_id == "ticket-err-001"
        ).first()
        assert ticket is None

    def test_young_tickets_skipped(self, db_session):
        """Tickets sent 5 minutes ago must not be checked (too young)."""
        user = _make_user(db_session, "receipt_young@test.com", "Receipt Young")
        token = "ExponentPushToken[young_tok]"
        _make_device_token(db_session, user, token)
        _make_ticket(db_session, "ticket-young-001", token, age_minutes=5)

        mock_post = MagicMock()
        with patch("app.crud.httpx.post", mock_post):
            result = crud.check_push_receipts(db_session, min_age_minutes=15)

        # Expo API should NOT be called because there are no old-enough tickets
        assert result["tickets_checked"] == 0
        # Young ticket must still be in the table
        ticket = db_session.query(models.PushTicket).filter(
            models.PushTicket.expo_ticket_id == "ticket-young-001"
        ).first()
        assert ticket is not None

    def test_expired_tickets_pruned_without_expo(self, db_session):
        """Tickets older than 25 hours are pruned locally (Expo receipts expire after 24h)."""
        user = _make_user(db_session, "receipt_expire@test.com", "Receipt Expire")
        token = "ExponentPushToken[expire_tok]"
        _make_device_token(db_session, user, token)
        _make_ticket(db_session, "ticket-expire-001", token, age_minutes=26 * 60)  # 26 hours

        # Expo returns empty receipts (ticket expired)
        mock_resp = _mock_receipts_response({})
        with patch("app.crud.httpx.post", return_value=mock_resp):
            crud.check_push_receipts(db_session, min_age_minutes=15)

        # Expired ticket must be deleted locally
        ticket = db_session.query(models.PushTicket).filter(
            models.PushTicket.expo_ticket_id == "ticket-expire-001"
        ).first()
        assert ticket is None

    def test_expo_api_failure_is_non_fatal(self, db_session):
        """Network error from Expo must not raise; returns partial summary."""
        user = _make_user(db_session, "receipt_netfail@test.com", "Net Fail")
        token = "ExponentPushToken[netfail_tok]"
        _make_device_token(db_session, user, token)
        _make_ticket(db_session, "ticket-netfail-001", token, age_minutes=20)

        with patch("app.crud.httpx.post", side_effect=Exception("network error")):
            result = crud.check_push_receipts(db_session, min_age_minutes=15)

        # Should not raise. tickets_checked reports 1 (one ticket attempted),
        # receipts_returned is 0 because Expo returned no data.
        assert result["tickets_checked"] == 1
        assert result["receipts_returned"] == 0

    def test_tickets_checked_counts_attempted_tickets(self, db_session):
        db_session.query(models.PushTicket).delete()
        db_session.commit()

        user = _make_user(db_session, "receipt_partial@test.com", "Receipt Partial")
        token_a = "ExponentPushToken[partial_tok_a]"
        token_b = "ExponentPushToken[partial_tok_b]"
        _make_device_token(db_session, user, token_a)
        _make_device_token(db_session, user, token_b)
        _make_ticket(db_session, "ticket-partial-001", token_a, age_minutes=20)
        _make_ticket(db_session, "ticket-partial-002", token_b, age_minutes=20)

        mock_resp = _mock_receipts_response({"ticket-partial-001": {"status": "ok"}})
        with patch("app.crud.httpx.post", return_value=mock_resp):
            result = crud.check_push_receipts(db_session, min_age_minutes=15)

        assert result["tickets_checked"] == 2
        assert result["ok"] == 1

    def test_push_ticket_expo_id_is_unique(self, db_session):
        db_session.query(models.PushTicket).delete()
        db_session.commit()

        user = _make_user(db_session, "receipt_unique@test.com", "Receipt Unique")
        token_a = "ExponentPushToken[unique_tok_a]"
        token_b = "ExponentPushToken[unique_tok_b]"
        _make_device_token(db_session, user, token_a)
        _make_device_token(db_session, user, token_b)
        _make_ticket(db_session, "ticket-unique-001", token_a, age_minutes=20)

        duplicate = models.PushTicket(
            expo_ticket_id="ticket-unique-001",
            token=token_b,
            sent_at=datetime.datetime.now(datetime.timezone.utc),
        )
        db_session.add(duplicate)

        with pytest.raises(IntegrityError):
            db_session.commit()

        db_session.rollback()


# ---------------------------------------------------------------------------
# _send_expo_push: ticket storage
# ---------------------------------------------------------------------------

class TestSendExpoPushTicketStorage:

    def test_ok_ticket_stored_when_db_provided(self, db_session):
        user = _make_user(db_session, "store_ticket@test.com", "Store Ticket")
        token = "ExponentPushToken[store_tok_ok]"
        _make_device_token(db_session, user, token)

        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {"data": [{"status": "ok", "id": "expo-ticket-stored-001"}]}

        with patch("app.crud.httpx.post", return_value=mock_resp):
            crud._send_expo_push(tokens=[token], title="T", body="B", db=db_session)

        ticket = db_session.query(models.PushTicket).filter(
            models.PushTicket.expo_ticket_id == "expo-ticket-stored-001"
        ).first()
        assert ticket is not None
        assert ticket.token == token

    def test_error_ticket_not_stored(self, db_session):
        user = _make_user(db_session, "nostore_err@test.com", "No Store Err")
        token = "ExponentPushToken[err_no_store_tok]"
        _make_device_token(db_session, user, token)

        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "data": [{"status": "error", "message": "InvalidToken", "details": {"error": "InvalidToken"}}]
        }

        with patch("app.crud.httpx.post", return_value=mock_resp):
            crud._send_expo_push(tokens=[token], title="T", body="B", db=db_session)

        ticket = db_session.query(models.PushTicket).filter(
            models.PushTicket.token == token
        ).first()
        assert ticket is None

    def test_no_db_no_ticket_stored(self, db_session):
        """When db=None, _send_expo_push must NOT write to push_tickets."""
        token = "ExponentPushToken[nodb_tok]"

        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {"data": [{"status": "ok", "id": "expo-ticket-nodb"}]}

        before = db_session.query(models.PushTicket).count()
        with patch("app.crud.httpx.post", return_value=mock_resp):
            crud._send_expo_push(tokens=[token], title="T", body="B", db=None)
        after = db_session.query(models.PushTicket).count()

        assert before == after  # no new rows


# ---------------------------------------------------------------------------
# Admin endpoint: POST /admin/push-receipts/check
# ---------------------------------------------------------------------------

class TestAdminPushReceiptsEndpoint:

    def test_requires_auth(self):
        resp = client.post("/admin/push-receipts/check")
        assert resp.status_code == 401

    def test_regular_user_forbidden(self, db_session):
        user = _make_user(db_session, "pr_regular@test.com", "PR Regular", role=UserRole.USER)
        resp = client.post("/admin/push-receipts/check", headers=_auth_headers(user))
        assert resp.status_code == 403

    def test_admin_can_call_endpoint(self, db_session):
        admin = _make_user(db_session, "pr_admin@test.com", "PR Admin", role=UserRole.ADMIN)
        mock_resp = _mock_receipts_response({})
        with patch("app.crud.httpx.post", return_value=mock_resp):
            resp = client.post("/admin/push-receipts/check", headers=_auth_headers(admin))
        assert resp.status_code == 200
        data = resp.json()
        assert "tickets_checked" in data
        assert "tokens_pruned" in data
        assert "tickets_remaining" in data

    def test_super_admin_can_call_endpoint(self, db_session):
        sadmin = _make_user(db_session, "pr_sadmin@test.com", "PR SuperAdmin", role=UserRole.SUPER_ADMIN)
        mock_resp = _mock_receipts_response({})
        with patch("app.crud.httpx.post", return_value=mock_resp):
            resp = client.post("/admin/push-receipts/check", headers=_auth_headers(sadmin))
        assert resp.status_code == 200

    def test_endpoint_returns_correct_counts(self, db_session):
        admin = _make_user(db_session, "pr_counts@test.com", "PR Counts", role=UserRole.ADMIN)
        user = _make_user(db_session, "pr_target@test.com", "PR Target")
        token = "ExponentPushToken[pr_endpoint_tok]"
        _make_device_token(db_session, user, token)
        _make_ticket(db_session, "ep-ticket-001", token, age_minutes=20)

        dnr = {
            "ep-ticket-001": {
                "status": "error",
                "message": "DeviceNotRegistered",
                "details": {"error": "DeviceNotRegistered"},
            }
        }
        mock_resp = _mock_receipts_response(dnr)
        with patch("app.crud.httpx.post", return_value=mock_resp):
            resp = client.post("/admin/push-receipts/check", headers=_auth_headers(admin))

        assert resp.status_code == 200
        data = resp.json()
        assert data["tokens_pruned"] == 1
        assert data["errors"] == 1
