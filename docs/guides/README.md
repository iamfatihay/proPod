# User Guides & Tutorials

Step-by-step guides for common tasks and configurations.

## 📄 Documents

### [Quick Start Guide](./QUICK_START.md)
**Get ProPod running in 5 minutes**

**Topics:**
- Environment setup
- Backend installation
- Frontend setup
- First run and testing

**Audience:** New developers

---

### [Development Workflow](./DEVELOPMENT_WORKFLOW.md)
**Daily development practices and git workflow**

**Topics:**
- Branch strategy
- Commit conventions
- Pull request process
- Code review guidelines
- Deployment procedures

**Audience:** All developers

---

### [Admin Customization Guide](./ADMIN_CUSTOMIZATION_GUIDE.md)
**Configuring the admin panel**

**Topics:**
- Admin role setup
- Permission configuration
- UI customization
- Feature toggles

**Audience:** System administrators

---

### [WiFi Change Guide](./WIFI_CHANGE_GUIDE.md)
**Updating network configuration for mobile testing**

**Topics:**
- Backend IP configuration
- Frontend API endpoint updates
- Mobile device connectivity
- Troubleshooting network issues

**Audience:** Developers testing on mobile devices

## 🎯 Quick Reference

### Common Commands

```bash
# Start backend
cd backend && uvicorn app.main:app --reload --host 0.0.0.0

# Start frontend
cd frontend && npm start

# Run tests
cd backend && pytest
```

### Configuration Files

- Backend: `backend/app/config.py`
- Frontend: `frontend/app.config.js`
- Environment: `backend/.env`

## 🔄 Related Documentation

- [API Documentation](../api/API_DOCUMENTATION.md)
- [Feature Roadmap](../project/FEATURE_ROADMAP.md)
- [Testing Guide](../testing/TEST_DOCUMENTATION.md)
