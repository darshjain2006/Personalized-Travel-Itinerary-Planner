class RepositoryError(Exception):
    """Base exception for repository layer operations."""
    def __init__(self, message: str, status_code: int = 500):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


class NotFoundError(RepositoryError):
    """Resource not found in database."""
    def __init__(self, message: str = "Resource not found"):
        super().__init__(message, status_code=404)


class ForbiddenError(RepositoryError):
    """Action forbidden due to insufficient permissions."""
    def __init__(self, message: str = "You do not have permission to perform this action"):
        super().__init__(message, status_code=403)


class ConflictError(RepositoryError):
    """Action conflicts with current resource state."""
    def __init__(self, message: str = "Resource conflict"):
        super().__init__(message, status_code=409)


class ValidationError(RepositoryError):
    """Business validation rule failure."""
    def __init__(self, message: str = "Validation failed"):
        super().__init__(message, status_code=400)
