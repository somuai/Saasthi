from rest_framework.permissions import SAFE_METHODS, BasePermission


class RolePermission(BasePermission):
    allowed_roles = ()

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.is_superuser or request.user.role == "admin":
            return True
        allowed = getattr(view, "allowed_roles", self.allowed_roles)
        return not allowed or request.user.role in allowed


class ReadOnlyOrSupervisor(RolePermission):
    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return super().has_permission(request, view)
        if not request.user or not request.user.is_authenticated:
            return False
        return request.user.is_superuser or request.user.role in {"admin", "supervisor"}
