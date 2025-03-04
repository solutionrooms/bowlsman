from django.db import migrations, models
import django.db.models.deletion
from django.conf import settings


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('users', '0010_competition_max_rounds'),
    ]

    operations = [
        migrations.CreateModel(
            name='Club',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=100, unique=True)),
                ('address', models.TextField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
            ],
            options={
                'ordering': ['name'],
            },
        ),
        migrations.CreateModel(
            name='ClubUser',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('is_admin', models.BooleanField(default=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('last_login_at', models.DateTimeField(blank=True, null=True)),
                ('club', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='members', to='users.club')),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='club_memberships', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ['created_at'],
                'unique_together': {('user', 'club')},
            },
        ),
        # Add default club for existing data
        migrations.RunSQL(
            "INSERT INTO users_club (name, address, created_at) VALUES ('The Westlands', NULL, NOW())",
            "DELETE FROM users_club WHERE name = 'The Westlands'"
        ),
        # Add club_id field to Competition
        migrations.AddField(
            model_name='competition',
            name='club',
            field=models.ForeignKey(null=True, on_delete=django.db.models.deletion.CASCADE, related_name='competitions', to='users.club'),
        ),
        # Set all existing competitions to the default club
        migrations.RunSQL(
            "UPDATE users_competition SET club_id = (SELECT id FROM users_club WHERE name = 'The Westlands')",
            ""
        ),
        # Make club_id NOT NULL after we've set it for all existing rows
        migrations.AlterField(
            model_name='competition',
            name='club',
            field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='competitions', to='users.club'),
        ),
        # Remove unique constraint on competition name and add one for (name, club)
        migrations.AlterUniqueTogether(
            name='competition',
            unique_together={('name', 'club')},
        ),
        migrations.AlterField(
            model_name='competition',
            name='name',
            field=models.CharField(max_length=100),
        ),
        # Add all existing users to the default club
        migrations.RunSQL(
            """
            INSERT INTO users_clubuser (user_id, club_id, is_admin, created_at)
            SELECT id, (SELECT id FROM users_club WHERE name = 'The Westlands'), 
                   CASE WHEN is_staff=true THEN true ELSE false END, NOW()
            FROM auth_user WHERE is_active=true
            """,
            ""
        ),
    ] 