# API Documentation

REST API documentation and endpoint references for ProPod.

## 📄 Documents

### [API Documentation](./API_DOCUMENTATION.md)
Complete REST API reference including:
- Authentication endpoints
- Podcast management
- User management
- AI processing endpoints
- Search and filtering

## 🔗 Quick Links

- **Backend API:** `http://YOUR_BACKEND_IP:8000`
- **API Docs (Swagger):** `http://YOUR_BACKEND_IP:8000/docs`
- **ReDoc:** `http://YOUR_BACKEND_IP:8000/redoc`

> **Note:** Replace `YOUR_BACKEND_IP` with your actual backend server IP address.
> For local development, use `http://localhost:8000` or your LAN IP (e.g., `192.168.x.x`).

## 📝 Request Examples

All endpoints require authentication via JWT tokens:
```bash
Authorization: Bearer <your-jwt-token>
```

## 🔄 Related Documentation

- [Quick Start Guide](../guides/QUICK_START.md) - API setup instructions
- [AI Integration Guide](../features/AI_INTEGRATION_GUIDE.md) - AI endpoints usage
