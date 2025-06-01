from fastapi import FastAPI
from .routers import users, podcasts

app = FastAPI()

app.include_router(users.router)
app.include_router(podcasts.router)


@app.get("/")
def read_root():
    return {"message": "proPod FastAPI backend is running!"}
