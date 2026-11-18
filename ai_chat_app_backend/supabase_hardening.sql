-- Run in Supabase SQL Editor.
-- Django connects directly to PostgreSQL and is unaffected by these Data API restrictions.

DO $$
DECLARE
    table_record record;
BEGIN
    FOR table_record IN
        SELECT tablename
        FROM pg_tables
        WHERE schemaname = 'public'
    LOOP
        EXECUTE format(
            'ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',
            table_record.tablename
        );

        -- Remove every PostgREST Data API table privilege.
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
            EXECUTE format(
                'REVOKE ALL PRIVILEGES ON TABLE public.%I FROM anon',
                table_record.tablename
            );
        END IF;

        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
            EXECUTE format(
                'REVOKE ALL PRIVILEGES ON TABLE public.%I FROM authenticated',
                table_record.tablename
            );
        END IF;
    END LOOP;
END $$;

-- Prevent future public tables from inheriting Data API grants.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    REVOKE ALL ON TABLES FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    REVOKE ALL ON TABLES FROM authenticated;
