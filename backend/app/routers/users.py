from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session
from .. import schemas, crud, models, auth
from ..database import SessionLocal
from ..schemas import User as UserSchema, BaseModel, ChangePasswordRequest

router = APIRouter(prefix="/users", tags=["users"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


class AuthResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str
    user: UserSchema


@router.post("/register", response_model=AuthResponse)
def register(user: schemas.UserCreate, db: Session = Depends(get_db)):
    db_user = crud.get_user_by_email(db, email=user.email)
    if db_user:
        raise HTTPException(
            status_code=400, detail="Email is already registered")
    db_user = crud.create_user(db, user)
    access_token = auth.create_access_token(data={"sub": db_user.email})
    refresh_token = auth.create_refresh_token(data={"sub": db_user.email})
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user": UserSchema.model_validate(db_user)
    }


@router.post("/login", response_model=AuthResponse)
async def login(request: Request, db: Session = Depends(get_db)):
    body = await request.json()
    print("LOGIN BODY:", body)
    user = schemas.UserLogin(**body)
    db_user = crud.get_user_by_email(db, email=user.email)
    if not db_user or not auth.verify_password(user.password, db_user.hashed_password):
        raise HTTPException(
            status_code=400, detail="Invalid email or password")
    access_token = auth.create_access_token(data={"sub": db_user.email})
    refresh_token = auth.create_refresh_token(data={"sub": db_user.email})
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user": UserSchema.model_validate(db_user)
    }


@router.post("/google-login", response_model=AuthResponse)
def google_login(user: schemas.UserBase, db: Session = Depends(get_db)):
    db_user = crud.get_user_by_email(db, email=user.email)
    if not db_user:
        user_create = schemas.UserCreate(
            email=user.email,
            name=user.name,
            provider="google",
            photo_url=user.photo_url,
            password=None
        )
        db_user = crud.create_user(db, user_create)
    access_token = auth.create_access_token(data={"sub": db_user.email})
    refresh_token = auth.create_refresh_token(data={"sub": db_user.email})
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user": UserSchema.model_validate(db_user)
    }


@router.post("/refresh-token")
def refresh_token_endpoint(refresh_token: str):
    payload = auth.verify_token(refresh_token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid refresh token")
    access_token = auth.create_access_token(data={"sub": payload["sub"]})
    return {"access_token": access_token, "token_type": "bearer"}

# Get current user's profile
@router.get("/me", response_model=UserSchema)
def get_me(current_user: models.User = Depends(auth.get_current_user)):
    return UserSchema.model_validate(current_user)

# Update current user's profile
@router.put("/me", response_model=UserSchema)
def update_me(update: schemas.UserBase, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    updated_user = crud.update_user(db, current_user, update)
    return UserSchema.model_validate(updated_user)

# Change password endpoint
@router.post("/change-password", status_code=status.HTTP_200_OK)
def change_password(request: ChangePasswordRequest, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    crud.change_user_password(db, current_user, request.old_password, request.new_password)
    return {"message": "Password changed successfully"}

# Delete account endpoint (soft delete)
@router.post("/delete", status_code=status.HTTP_200_OK)
def delete_account(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    crud.soft_delete_user(db, current_user)
    return {"message": "Account deleted successfully"}
