# Testing Documentation

Testing strategies, guidelines, and procedures for ProPod.

## Documents

### [Manual Regression Re-Entry Guide](./MANUAL_REGRESSION_REENTRY_GUIDE.md)
Step-by-step manual test flows for regaining project context after time away.

Topics:
- auth and profile checks
- recording and draft recovery
- search, continue listening, playlists, sharing, analytics, and RTC
- high-risk regression areas and a fast 60-minute pass

Status: current manual walkthrough

---

### [Test Documentation](./TEST_DOCUMENTATION.md)
Complete testing strategy and guidelines

Topics:
- Unit testing with pytest
- Integration testing
- API testing
- Test structure and organization
- Mocking strategies
- Coverage requirements

Status: reference guide

---

### [Cross-Platform Testing Guide](./CROSS_PLATFORM_TESTING_GUIDE.md)
Mobile testing procedures for iOS and Android

Topics:
- Physical device testing
- Emulator/Simulator setup
- Network configuration
- Platform-specific issues
- Performance testing
- UI testing

Platforms: iOS, Android

## Running Tests

### Backend Tests
```bash
cd backend
source venv/bin/activate
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/propod_test pytest tests/ -q
pytest tests/test_ai_service.py -q
pytest -v
pytest --cov=app
```

Note: backend tests intentionally refuse to run against the normal dev database. In-memory SQLite remains acceptable for isolated unit scenarios, but the documented default is a disposable PostgreSQL test database.

### Frontend Tests
```bash
cd frontend
npm test
npm test -- --watch
npm run test:ci
npm run test:e2e
```

## Current Notes

- Focused Google auth tests pass after the native sign-in migration.
- Full frontend CI passes.
- Full backend suite currently has one unrelated failure in `tests/test_sharing.py::TestSharePodcastPublic::test_relative_audio_url_gets_base_url_prefix`.

## Test Checklist

Before committing:
- [ ] All existing tests pass
- [ ] New features have tests
- [ ] Edge cases covered
- [ ] Error scenarios tested
- [ ] Mocks used for external services
- [ ] No flaky tests

## Related Documentation

- [Development Workflow](../guides/DEVELOPMENT_WORKFLOW.md)
- [API Documentation](../api/API_DOCUMENTATION.md)
- [Architecture](../architecture/)
