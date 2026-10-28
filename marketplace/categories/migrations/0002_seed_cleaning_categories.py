from django.db import migrations


CATEGORIES = (
    ('limpieza-profunda', 'Limpieza profunda'),
    ('limpieza-regular', 'Limpieza regular'),
    ('post-construccion', 'Post-construcción'),
    ('oficinas', 'Oficinas'),
    ('vidrios', 'Vidrios'),
    ('tapiceria', 'Tapicería'),
)


def seed_categories(apps, schema_editor):
    Category = apps.get_model('marketplace_categories', 'Category')
    root, _ = Category.objects.get_or_create(
        slug='limpieza', defaults={'name': 'Limpieza'},
    )
    if root.parent_id is not None:
        root.parent = None
        root.save(update_fields=['parent'])
    for order, (slug, name) in enumerate(CATEGORIES):
        Category.objects.get_or_create(
            slug=slug,
            defaults={'name': name, 'parent_id': root.pk, 'order': order},
        )


def unseed_categories(apps, schema_editor):
    Category = apps.get_model('marketplace_categories', 'Category')
    Category.objects.filter(slug__in=[slug for slug, _ in CATEGORIES]).delete()
    Category.objects.filter(slug='limpieza').delete()


class Migration(migrations.Migration):
    dependencies = [
        ('marketplace_categories', '0001_initial'),
        ('cleaning_services', '0001_initial'),
    ]

    operations = [migrations.RunPython(seed_categories, unseed_categories)]
