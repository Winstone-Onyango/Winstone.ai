from django.db import migrations


def secure_public_tables(apps, schema_editor):
    """Keep Django tables out of Supabase's public Data API.

    Django connects with a database role that owns these tables and continues
    to work normally. The anon/authenticated PostgREST roles receive no table
    privileges, and RLS provides a second denial layer.
    """
    with schema_editor.connection.cursor() as cursor:
        cursor.execute(
            "SELECT tablename FROM pg_tables WHERE schemaname = 'public'"
        )
        tables = [row[0] for row in cursor.fetchall()]

        for table_name in tables:
            quoted_name = schema_editor.quote_name(table_name)
            qualified_name = f"public.{quoted_name}"
            cursor.execute(f"ALTER TABLE {qualified_name} ENABLE ROW LEVEL SECURITY")
            cursor.execute(
                f"REVOKE ALL PRIVILEGES ON TABLE {qualified_name} "
                "FROM anon, authenticated"
            )


def noop_reverse(apps, schema_editor):
    # Security hardening must not be automatically undone by reversing the migration.
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("Winstone_app", "0002_alter_chat_options_alter_chatmessage_options_and_more"),
    ]

    operations = [
        migrations.RunPython(secure_public_tables, noop_reverse),
    ]
