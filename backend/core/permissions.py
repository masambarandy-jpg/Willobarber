from rest_framework.permissions import BasePermission


class IsStaffRole(BasePermission):
    """Only users with role='admin' (barbershop staff) may pass."""

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.role == 'admin'
        )
