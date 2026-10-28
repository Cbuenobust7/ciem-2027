import pytest
from django.core.exceptions import ValidationError as DjangoValidationError
from marketplace.listings.models import Listing
from rest_framework.test import APIClient

from verticals.cleaning.services.models import ServiceDetails


@pytest.fixture
def api_client():
    return APIClient()


def service_payload(account, category, **overrides):
    payload = {
        'provider_account': account.pk,
        'title': 'Limpieza profunda',
        'description': 'Servicio de prueba',
        'price': '150.00',
        'currency': 'PEN',
        'category': category.pk,
        'location': 'Lima',
        'duration_minutes': 120,
        'buffer_minutes': 30,
    }
    payload.update(overrides)
    return payload


@pytest.mark.django_db
def test_service_creation_is_atomic_and_server_sets_seller_and_draft(
    api_client, provider_account, cleaning_owner, cleaning_category, cleaning_customer,
):
    api_client.force_authenticate(cleaning_owner)
    response = api_client.post(
        '/api/cleaning/services/',
        service_payload(
            provider_account,
            cleaning_category,
            seller=cleaning_customer.pk,
            seller_id=cleaning_customer.pk,
            status='active',
        ),
        format='json',
    )

    assert response.status_code == 201
    listing = Listing.objects.get(pk=response.data['listing'])
    details = ServiceDetails.objects.get(listing=listing)
    assert listing.seller_id == provider_account.owner_id
    assert listing.status == 'draft'
    assert listing.price == 150
    assert details.provider_account == provider_account
    assert details.duration_minutes == 120


@pytest.mark.django_db
def test_service_creation_rolls_back_listing_when_details_validation_fails(
    api_client, provider_account, cleaning_owner, cleaning_category, monkeypatch,
):
    before = Listing.objects.count()

    def fail_full_clean(*args, **kwargs):
        raise DjangoValidationError({'duration_minutes': 'forced failure'})

    monkeypatch.setattr(ServiceDetails, 'full_clean', fail_full_clean)
    api_client.force_authenticate(cleaning_owner)
    response = api_client.post(
        '/api/cleaning/services/',
        service_payload(provider_account, cleaning_category),
        format='json',
    )

    assert response.status_code == 400
    assert Listing.objects.count() == before
    assert ServiceDetails.objects.count() == 0


@pytest.mark.django_db
def test_non_member_cannot_create_service_or_set_another_sellers_price(
    api_client, provider_account, cleaning_customer, cleaning_category,
):
    api_client.force_authenticate(cleaning_customer)
    response = api_client.post(
        '/api/cleaning/services/',
        service_payload(provider_account, cleaning_category, price='0.01'),
        format='json',
    )
    assert response.status_code == 403
    assert not Listing.objects.exists()


@pytest.mark.django_db
def test_service_edit_is_owner_admin_only_and_updates_listing_and_details(
    api_client, provider_account, cleaning_owner, provider_admin, provider_staff,
    cleaning_category,
):
    api_client.force_authenticate(cleaning_owner)
    created = api_client.post(
        '/api/cleaning/services/',
        service_payload(provider_account, cleaning_category),
        format='json',
    )
    listing_id = created.data['listing']

    api_client.force_authenticate(provider_staff)
    denied = api_client.patch(
        f'/api/cleaning/services/{listing_id}/', {'price': '200.00'}, format='json',
    )
    assert denied.status_code == 403

    api_client.force_authenticate(provider_admin)
    edited = api_client.patch(
        f'/api/cleaning/services/{listing_id}/',
        {'price': '200.00', 'duration_minutes': 180},
        format='json',
    )
    assert edited.status_code == 200
    listing = Listing.objects.get(pk=listing_id)
    details = ServiceDetails.objects.get(listing=listing)
    assert listing.price == 200
    assert details.duration_minutes == 180


@pytest.mark.django_db
def test_services_are_listed_publicly_only_after_listing_is_published(
    api_client, provider_account, cleaning_owner, cleaning_category,
):
    api_client.force_authenticate(cleaning_owner)
    created = api_client.post(
        '/api/cleaning/services/',
        service_payload(provider_account, cleaning_category),
        format='json',
    )
    listing = Listing.objects.get(pk=created.data['listing'])
    hidden = api_client.get(f'/api/cleaning/providers/{provider_account.pk}/services/')
    listing.publish()
    visible = api_client.get(f'/api/cleaning/providers/{provider_account.pk}/services/')

    assert hidden.status_code == 200
    assert hidden.data['results'] == []
    assert visible.status_code == 200
    assert visible.data['results'][0]['listing_id'] == listing.pk


@pytest.mark.django_db
def test_listing_detail_includes_nested_cleaning_service_details(
    api_client, provider_account, cleaning_owner, cleaning_category,
):
    api_client.force_authenticate(cleaning_owner)
    created = api_client.post(
        '/api/cleaning/services/',
        service_payload(provider_account, cleaning_category),
        format='json',
    )
    listing = Listing.objects.get(pk=created.data['listing'])
    listing.publish()

    response = api_client.get(f'/api/listings/{listing.pk}/')

    assert response.status_code == 200
    assert response.data['service_details']['provider_account'] == provider_account.pk
    assert response.data['service_details']['duration_minutes'] == 120
