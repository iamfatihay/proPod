from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .routers import users, podcasts

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Geliştirme için tüm originlere izin ver
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(users.router)
app.include_router(podcasts.router)


@app.get("/")
def read_root():
    return {"message": "proPod FastAPI backend is running!"}
