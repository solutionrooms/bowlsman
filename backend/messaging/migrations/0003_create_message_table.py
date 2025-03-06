# Manual migration to create the messaging_message table

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('messaging', '0002_auto_20250306_2335'),
    ]

    operations = [
        migrations.RunSQL(
            """
            CREATE TABLE IF NOT EXISTS messaging_message (
                id BIGSERIAL PRIMARY KEY,
                subject VARCHAR(255) NOT NULL,
                content TEXT NOT NULL,
                is_read BOOLEAN NOT NULL DEFAULT FALSE,
                is_club_wide BOOLEAN NOT NULL DEFAULT FALSE,
                created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
                club_id BIGINT NOT NULL REFERENCES users_club(id) ON DELETE CASCADE,
                recipient_id BIGINT REFERENCES auth_user(id) ON DELETE CASCADE,
                sender_id BIGINT NOT NULL REFERENCES auth_user(id) ON DELETE CASCADE
            );
            """,
            "DROP TABLE IF EXISTS messaging_message;"
        ),
    ]