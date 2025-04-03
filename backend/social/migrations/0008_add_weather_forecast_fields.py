from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('social', '0007_alter_socialbowl_notice_type'),
    ]

    operations = [
        migrations.AddField(
            model_name='socialbowl',
            name='weather_forecast',
            field=models.JSONField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='socialbowl',
            name='weather_updated_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]