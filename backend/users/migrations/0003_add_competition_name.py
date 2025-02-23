# Generated manually

from django.db import migrations, models


def generate_unique_names(apps, schema_editor):
    Competition = apps.get_model('users', 'Competition')
    for i, competition in enumerate(Competition.objects.all().select_related('creator')):
        competition.name = f"Competition {competition.creator.username} {competition.created_at.strftime('%Y-%m-%d %H:%M')}"
        competition.save()


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0002_competitionuser'),
    ]

    operations = [
        migrations.AddField(
            model_name='competition',
            name='name',
            field=models.CharField(max_length=100, unique=True, null=True),
        ),
        migrations.RunPython(
            code=generate_unique_names,
            reverse_code=migrations.RunPython.noop
        ),
        migrations.AlterField(
            model_name='competition',
            name='name',
            field=models.CharField(max_length=100, unique=True),
        ),
    ] 