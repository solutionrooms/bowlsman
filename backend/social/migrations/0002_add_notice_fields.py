# Generated manually

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('social', '0001_initial'),
    ]

    operations = [
        # Add notice_type field to SocialBowl model
        migrations.AddField(
            model_name='socialbowl',
            name='notice_type',
            field=models.CharField(choices=[('social_bowl', 'Social Bowling'), ('general', 'General Notice'), ('for_sale', 'For Sale')], default='social_bowl', max_length=20),
        ),
        
        # Add price field to SocialBowl model
        migrations.AddField(
            model_name='socialbowl',
            name='price',
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=10, null=True),
        ),
        
        # Make date, time, and location optional
        migrations.AlterField(
            model_name='socialbowl',
            name='date',
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AlterField(
            model_name='socialbowl',
            name='time',
            field=models.TimeField(blank=True, null=True),
        ),
        migrations.AlterField(
            model_name='socialbowl',
            name='location',
            field=models.CharField(blank=True, max_length=255),
        ),
        
        # Update Meta options
        migrations.AlterModelOptions(
            name='socialbowl',
            options={'ordering': ['-created_at'], 'verbose_name': 'Notice', 'verbose_name_plural': 'Notices'},
        ),
    ] 