from rest_framework.permissions import BasePermission


class IsOwnerOrAdmin(BasePermission):
    def has_object_permission(self, request, view, obj):
        if request.user.is_staff:
            return True
        if hasattr(obj, 'client'):
            return obj.client == request.user
        if hasattr(obj, 'user'):
            return obj.user == request.user
        return False


class IsBarberOrAdmin(BasePermission):
    def has_permission(self, request, view):
        return request.user.role in ['barber', 'admin'] or request.user.is_staff
