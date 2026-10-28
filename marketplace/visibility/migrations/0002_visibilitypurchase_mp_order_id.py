from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("marketplace_visibility", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="visibilitypurchase",
            name="mp_order_id",
            field=models.CharField(blank=True, max_length=120),
        ),
    ]