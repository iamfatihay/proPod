from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import users, podcasts
from dotenv import load_dotenv

load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(users.router)
app.include_router(podcasts.router)


@app.get("/")
def read_root():
    return {"message": "proPod FastAPI backend is running!"}
