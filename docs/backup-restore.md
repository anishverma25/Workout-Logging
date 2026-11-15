# Backups and restoring them

Supabase's free plan has no automatic backups. `.github/workflows/backup.yml` makes one every day
at 03:07 India time (and whenever you press **Run workflow**): the roles, the schema and all the
data, compressed and encrypted, kept 30 days as a GitHub Actions artifact.

## Set it up once

In GitHub, open the repository, **Settings > Secrets and variables > Actions > New repository
secret**, and add two secrets:

1. `SUPABASE_DB_URL`: in Supabase, **Connect** (top of the project), **Session pooler**, copy the
   connection string and put the database password in place of `[YOUR-PASSWORD]`.
2. `BACKUP_PASSPHRASE`: a long passphrase you make up. Save it in your password manager too:
   without it a backup cannot be opened, and GitHub never shows a secret again.

Then open **Actions > Database backup > Run workflow** once and check it finishes green. The
backup is under the run's **Artifacts**.

## Restore

You need the Supabase CLI, Docker (for the CLI) or `psql`, and `gpg`.

1. Download the artifact from the run you want (a zip holding `macrotrophy-YYYY-MM-DD.tar.gz.gpg`)
   and unzip it.
2. Decrypt and unpack:

   ```sh
   gpg --decrypt -o backup.tar.gz macrotrophy-YYYY-MM-DD.tar.gz.gpg
   mkdir backup && tar -xzf backup.tar.gz -C backup
   ```

3. Restore into a **new, empty** Supabase project (never over the live one while people use it).
   Use that project's Session pooler connection string:

   ```sh
   psql --single-transaction --variable ON_ERROR_STOP=1 \
     --file backup/roles.sql --file backup/schema.sql \
     --command 'SET session_replication_role = replica' \
     --file backup/data.sql \
     --dbname "postgresql://...new project..."
   ```

   `session_replication_role = replica` skips triggers while the data goes in, so rows keep their
   own timestamps and trial dates.

4. Check: in the new project's **Table editor**, `workouts`, `sets` and `subscriptions` have rows,
   and signing in with a test account shows its history.
5. Point the app at the new project (its URL and anon key in Cloudflare Pages, as in
   `docs/deployment.md`), deploy the Edge Functions there and set their secrets again.

Try a restore once into a spare project, so the steps are known before they are needed.
