"""Tests for the APScheduler push-receipt auto-run setup in main.py.

Covers:
- lifespan starts the scheduler and registers the push_receipt_check job
- lifespan shuts the scheduler down on exit (no threads left running)
- _run_push_receipt_check opens a DB session, calls crud.check_push_receipts,
  and closes the session — even when crud raises
- _run_push_receipt_check logs the summary returned by crud
- _run_push_receipt_check swallows exceptions and does NOT re-raise
"""

import logging
from unittest.mock import MagicMock, patch

import pytest

from app.main import _run_push_receipt_check, lifespan


# ---------------------------------------------------------------------------
# _run_push_receipt_check unit tests
#
# The helper uses late (lazy) imports inside its body:
#   from app.database import SessionLocal
#   from app import crud
# so we patch the originals at their canonical locations, not app.main.
# ---------------------------------------------------------------------------

class TestRunPushReceiptCheck:
    """Unit tests for the _run_push_receipt_check helper."""

    def test_opens_session_calls_crud_and_closes(self):
        """Happy path: session opened, crud called, session closed."""
        mock_db = MagicMock()
        mock_summary = {"ok": 3, "errors": 0, "tickets_checked": 3}

        with (
            patch("app.database.SessionLocal", return_value=mock_db),
            patch("app.crud.check_push_receipts", return_value=mock_summary) as mock_check,
        ):
            _run_push_receipt_check()

        mock_check.assert_called_once_with(mock_db)
        mock_db.close.assert_called_once()

    def test_closes_session_even_when_crud_raises(self):
        """Session must be closed even if crud.check_push_receipts raises."""
        mock_db = MagicMock()

        with (
            patch("app.database.SessionLocal", return_value=mock_db),
            patch("app.crud.check_push_receipts", side_effect=RuntimeError("DB gone")),
        ):
            _run_push_receipt_check()  # must not raise

        mock_db.close.assert_called_once()

    def test_does_not_reraise_on_exception(self):
        """Exceptions from crud must be swallowed so the scheduler keeps running."""
        mock_db = MagicMock()

        with (
            patch("app.database.SessionLocal", return_value=mock_db),
            patch("app.crud.check_push_receipts", side_effect=Exception("network timeout")),
        ):
            try:
                _run_push_receipt_check()
            except Exception:
                pytest.fail("_run_push_receipt_check must not re-raise exceptions")

    def test_logs_summary_on_success(self, caplog):
        """Successful runs log the summary dict at INFO level."""
        mock_db = MagicMock()
        summary = {"ok": 5, "errors": 1, "tickets_checked": 6}

        with (
            patch("app.database.SessionLocal", return_value=mock_db),
            patch("app.crud.check_push_receipts", return_value=summary),
            caplog.at_level(logging.INFO, logger="app.main"),
        ):
            _run_push_receipt_check()

        assert any("Push receipt check completed" in r.message for r in caplog.records)


# ---------------------------------------------------------------------------
# lifespan tests
# ---------------------------------------------------------------------------

class TestLifespan:
    """Tests for the FastAPI lifespan context manager."""

    @pytest.mark.anyio
    async def test_scheduler_starts_and_job_registered(self):
        """Lifespan should start a scheduler with the push_receipt_check job."""
        from fastapi import FastAPI

        test_app = FastAPI()
        started_schedulers: list = []

        class SpyScheduler:
            def __init__(self, daemon=False):
                self.daemon = daemon
                self.jobs: list[str] = []
                self._running = False

            def add_job(self, func, **kwargs):
                self.jobs.append(kwargs.get("id", "unknown"))

            def start(self):
                self._running = True
                started_schedulers.append(self)

            def shutdown(self, wait=True):
                self._running = False

        with patch("app.main.BackgroundScheduler", SpyScheduler):
            async with lifespan(test_app):
                assert len(started_schedulers) == 1
                sched = started_schedulers[0]
                assert sched._running is True
                assert "push_receipt_check" in sched.jobs

        # After exiting lifespan the scheduler should be stopped
        assert sched._running is False

    @pytest.mark.anyio
    async def test_scheduler_stops_on_exit(self):
        """Lifespan must call scheduler.shutdown even if body raises."""
        from fastapi import FastAPI

        test_app = FastAPI()
        shutdown_called = []

        class SpyScheduler:
            def __init__(self, daemon=False):
                pass
            def add_job(self, *a, **kw):
                pass
            def start(self):
                pass
            def shutdown(self, wait=True):
                shutdown_called.append(True)

        with patch("app.main.BackgroundScheduler", SpyScheduler):
            try:
                async with lifespan(test_app):
                    raise RuntimeError("simulated app error")
            except RuntimeError:
                pass

        assert shutdown_called, "scheduler.shutdown() must be called even on error"

    @pytest.mark.anyio
    async def test_job_configured_with_30_min_interval(self):
        """The push_receipt_check job must be configured with a 30-minute interval."""
        from fastapi import FastAPI

        test_app = FastAPI()
        captured_kwargs: dict = {}

        class SpyScheduler:
            def __init__(self, daemon=False):
                pass
            def add_job(self, func, **kwargs):
                captured_kwargs.update(kwargs)
            def start(self):
                pass
            def shutdown(self, wait=True):
                pass

        with patch("app.main.BackgroundScheduler", SpyScheduler):
            async with lifespan(test_app):
                pass

        assert captured_kwargs.get("trigger") == "interval"
        assert captured_kwargs.get("minutes") == 30
        assert captured_kwargs.get("id") == "push_receipt_check"
