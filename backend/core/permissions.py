from rest_framework.permissions import BasePermission


class IsStaffRole(BasePermission):
    """Only superusers or users with role='admin' (barbershop staff) may pass."""

    def has_permission(self, request, view):
        return bool(
            request.user and
            request.user.is_authenticated and
            (request.user.is_superuser or getattr(request.user, 'role', None) == 'admin')
        )


class IsReservationClientOwner(BasePermission):
    """Seul le client titulaire de la réservation peut agir dessus."""

    def has_object_permission(self, request, view, obj):
        return obj.user_id == request.user.id


class IsBarber(BasePermission):
    """Utilisateur avec role='barber'."""

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and getattr(request.user, 'role', None) == 'barber')


class IsAdmin(IsStaffRole):
    """Gérant du salon : mêmes règles que IsStaffRole."""
