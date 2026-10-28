from importlib import import_module

import pytest
from django.apps import apps
from django.db import connection

seed_categories = import_module(
    'marketplace.categories.migrations.0002_seed_cleaning_categories',
).seed_categories


@pytest.mark.django_db
def test_cleaning_category_seed_is_idempotent():
    with connection.schema_editor() as schema_editor:
        seed_categories(apps, schema_editor)
        seed_categories(apps, schema_editor)

    Category = apps.get_model('marketplace_categories', 'Category')
    root = Category.objects.get(slug='limpieza')
    assert root.children.count() == 6
    assert Category.objects.filter(slug='limpieza').count() == 1
