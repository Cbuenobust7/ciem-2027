from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("marketplace_listings", "0003_listingimage_marketplace_listing_bec690_idx_and_more")]

    operations = [
        migrations.AddField(
            model_name="listing", name="rejection_reason", field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name="listing", name="reviewed_at", field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="listing", name="reviewed_by", field=models.ForeignKey(blank=True, null=True, on_delete=models.deletion.SET_NULL, related_name="reviewed_listings", to=settings.AUTH_USER_MODEL),
        ),
        migrations.AlterField(
            model_name="listing", name="status", field=models.CharField(choices=[("draft", "Borrador"), ("pending_review", "Pendiente de revisión"), ("active", "Activo"), ("rejected", "Rechazado"), ("paused", "Pausado"), ("sold", "Vendido"), ("expired", "Expirado")], default="draft", max_length=20),
        ),
    ]
