from rest_framework.permissions import BasePermission

from .models import ProviderMembership


def membership_for(user, account):
    if not user or not user.is_authenticated:
        return None
    return ProviderMembership.objects.filter(
        account=account, user=user, is_active=True,
    ).first()


def membership_role(user, account):
    membership = membership_for(user, account)
    return membership.role if membership else None


def can_manage_provider(user, account):
    """`owner`/`admin` de la cuenta, o plataforma (§6.1)."""
    if user and user.is_authenticated and user.is_staff:
        return True
    return membership_role(user, account) in {
        ProviderMembership.Role.OWNER,
        ProviderMembership.Role.ADMIN,
    }


def is_provider_owner(user, account):
    """Solo el titular (o la plataforma): titularidad y borrado (§6.2)."""
    if user and user.is_authenticated and user.is_staff:
        return True
    return membership_role(user, account) == ProviderMembership.Role.OWNER


def can_manage_resource(user, account, resource=None):
    """Quién puede ver o editar la agenda.

    `owner`/`admin` cualquier recurso de su cuenta; `staff` **solo** los recursos
    a los que está asignado (§6.1: "solo su propia agenda").
    """
    if can_manage_provider(user, account):
        return True
    if resource is None:
        return membership_role(user, account) == ProviderMembership.Role.STAFF
    if membership_role(user, account) != ProviderMembership.Role.STAFF:
        return False
    return resource.members.filter(pk=user.pk).exists()


def can_assign_resource_members(user, account):
    """Asignar gente a un recurso es gestión comercial: `owner`/`admin`."""
    return can_manage_provider(user, account)


def staff_membership_exists(account, user):
    """§3.1: todo miembro de un recurso necesita membership `staff` activa."""
    return ProviderMembership.objects.filter(
        account=account,
        user=user,
        role=ProviderMembership.Role.STAFF,
        is_active=True,
    ).exists()


# ---------------------------------------------------------------------------
# Rol del usuario, resuelto contra `ProviderMembership` (ADR-11)
# ---------------------------------------------------------------------------
# Los flags `User.is_seller`/`is_buyer` son vestigiales: no expresan "es dueño
# de esta cuenta" ni "puede publicar". Todo lo que decide permisos o enruta la
# interfaz sale de aquí.
PUBLISHING_ROLES = (
    ProviderMembership.Role.OWNER,
    ProviderMembership.Role.ADMIN,
)


def provider_memberships_for(user):
    """Memberships activas del usuario, de cuentas activas."""
    if not user or not user.is_authenticated:
        return ProviderMembership.objects.none()
    return (
        ProviderMembership.objects
        .filter(user=user, is_active=True, account__is_active=True)
        .select_related('account')
        .order_by('account_id')
    )


def is_provider_user(user):
    """¿Tiene alguna cuenta de proveedor? Sirve para enrutar tras el login."""
    return provider_memberships_for(user).exists()


def has_publishing_membership(user):
    """Solo `owner`/`admin` publican servicios; el `staff` no (§6.1)."""
    return provider_memberships_for(user).filter(role__in=PUBLISHING_ROLES).exists()


def provider_accounts_payload(user):
    """Cuentas del usuario con su rol, para que el frontend no tenga que adivinar."""
    return [
        {
            'id': membership.account_id,
            'display_name': membership.account.display_name,
            'role': membership.role,
        }
        for membership in provider_memberships_for(user)
    ]


class IsProviderMember(BasePermission):
    def has_object_permission(self, request, view, obj):
        return membership_for(request.user, obj) is not None


class IsProviderManager(BasePermission):
    def has_object_permission(self, request, view, obj):
        return can_manage_provider(request.user, obj)


class IsProviderOwner(BasePermission):
    """`owner` o plataforma: cambios de titularidad y borrado (§6.2)."""

    def has_object_permission(self, request, view, obj):
        return is_provider_owner(request.user, obj)


__all__ = [
    'IsProviderMember',
    'IsProviderManager',
    'IsProviderOwner',
    'can_assign_resource_members',
    'can_manage_provider',
    'can_manage_resource',
    'has_publishing_membership',
    'is_provider_owner',
    'is_provider_user',
    'membership_for',
    'membership_role',
    'provider_accounts_payload',
    'provider_memberships_for',
    'staff_membership_exists',
]
