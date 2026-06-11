from fastapi import HTTPException, status
from ..models.users import User, UserType, is_system_admin

def check_platform_role(user: User, required_role: UserType):
    """Raise 403 if the user's role doesn't match the required role."""
    if user.role != required_role:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"{required_role.value} permissions required",
        )

def check_super_admin(user: User):
    """Raise 403 if the user is not a system admin."""
    if not is_system_admin(user.role):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Super admin permissions required",
        )
