# Setup guide: from code to friends using the app

About one hour, all free. You need a laptop, your Gmail account, your phone, and your GitHub
login (the code is already on GitHub, branch `phase-2-wip`).

| Part                  | What it gives you                                              | Time      |
| --------------------- | -------------------------------------------------------------- | --------- |
| 1. Supabase           | Accounts and the cloud copy of everyone's workouts             | 15 min    |
| 2. Email              | Sign-up confirmations and password resets that actually arrive | 10 min    |
| 3. Cloudflare Pages   | The web address people open (`something.pages.dev`)            | 15 min    |
| 4. Connect the two    | Email links that open your app                                 | 3 min     |
| 5. Test on your phone | Confidence before anyone else sees it                          | 15 min    |
| 6. Invite friends     | Your first users                                               | 5 min     |
| 7. Running it         | Pro, payments, updates, problems                               | as needed |

Keep a note open while you work. You will copy three things into it: the Supabase project URL,
the Supabase publishable key, and your app address.

---

## Part 1. Supabase (accounts and database)

### 1.1 Create the project

1. Go to supabase.com and click **Start your project**.
2. Sign in with **GitHub** (the easiest option).
3. If asked to create an organization: give it any name, choose the **Free** plan, click **Create organization**.
4. Click **New project** and fill in:
   - **Project name:** `overload`
   - **Database password:** click **Generate a password**, then copy it into your password manager. The app never needs it, but you will need it if you ever contact Supabase support.
   - **Region:** **South Asia (Mumbai)** (closest to you and your friends, so the app syncs faster).
   - Leave any security or Data API options on their defaults.
5. Click **Create new project** and wait one or two minutes until the dashboard finishes setting up.

### 1.2 Create the tables (run four files, in order)

The database structure is in four files in your GitHub repository. You copy each one into Supabase and run it.

1. In a new browser tab, open your repository on GitHub: `github.com/anishverma25/Workout-Logging`.
2. Click the branch dropdown (it may say `phase-1-foundation`) and choose **phase-2-wip**.
3. Open the folder **supabase**, then **migrations**. You will see four files:
   - `20261005000001_schema.sql`
   - `20261005000002_exercise_library.sql`
   - `20261005000003_subscriptions.sql`
   - `20261007000004_personal_training.sql`
4. Click the **first** file. At the top right of the file view, click the **Copy raw file** button (two overlapping squares).
5. Back in Supabase, click **SQL Editor** in the left sidebar, then **New query** (or the **+** tab).
6. Paste with Ctrl+V (Cmd+V on a Mac) and click **Run** (or press Ctrl+Enter).
   - You should see **Success. No rows returned**.
   - If Supabase asks you to confirm because the query changes the database, choose to run it.
7. Repeat steps 4 to 6 for the **second**, **third** and **fourth** files. Always use a new query tab, and always keep this order.

### 1.3 Check it worked

1. Click **Table Editor** in the left sidebar.
2. You should see 14 tables: `body_measurements`, `body_weight`, `exercises`, `goals`, `profiles`, `routine_days`, `routine_exercises`, `routines`, `sets`, `subscriptions`, `user_exercises`, `user_preferences`, `workout_exercises`, `workouts`.
3. Click **exercises**: it should show **101 rows**. That is the built-in exercise library.

If a table is missing, rerun the file that creates it. If a file shows an error, copy the red error message and send it to me.

### 1.4 Copy the two values the app needs

1. Click the **gear icon (Project Settings)** at the bottom of the left sidebar.
2. Open **Data API** (or **API**) and copy the **Project URL**. It looks like `https://abcdefghijkl.supabase.co`. Paste it into your note.
3. Open **API Keys** and copy the **Publishable key**. It starts with `sb_publishable_`. Paste it into your note.
   - If you only see a **Legacy** tab, copy the key labelled **anon public** instead. Either works.
   - **Never copy the secret key or the service_role key.** Those bypass all security. The app refuses to start accounts if you give it one.

---

## Part 2. Email (choose A or B)

Supabase's built-in email sends only **2 emails an hour** for the whole project. That covers sign-up confirmations and password resets together, so it runs out fast. Choose one fix.

### Option A (recommended): send email through your Gmail

**Step 1: create a Gmail app password.**

1. Go to myaccount.google.com and open **Security**.
2. Turn on **2-Step Verification** if it is off (Google requires it for app passwords).
3. In the search bar at the top, type **App passwords** and open it.
4. Name it `Supabase` and click **Create**.
5. Copy the 16-letter password Google shows (without the spaces). You will not see it again.

**Step 2: connect it in Supabase.**

1. In Supabase, go to **Authentication** in the left sidebar, then **Emails**, then the **SMTP Settings** tab (it may be labelled **Custom SMTP**).
2. Turn on **Enable custom SMTP** and fill in:
   - **Sender email:** your Gmail address
   - **Sender name:** `Overload`
   - **Host:** `smtp.gmail.com`
   - **Port:** `587`
   - **Username:** your Gmail address
   - **Password:** the 16-letter app password
3. Click **Save**.
4. Optional: go to **Authentication > Rate Limits**. After custom SMTP is on, Supabase allows 30 emails an hour, which is plenty for now. Gmail itself allows a few hundred a day.

Emails will come from your Gmail address. Tell friends to check spam the first time.

### Option B (quickest): skip email confirmation

1. In Supabase, go to **Authentication**, then **Sign In / Providers**, then **Email**.
2. Turn off **Confirm email** and click **Save**.

People can now sign up and use the app immediately. Password reset emails still use the 2-an-hour limit, which is fine for a small group. You can switch to Option A later.

---

## Part 3. Cloudflare Pages (the web address)

### 3.1 Create the account

1. Go to dash.cloudflare.com and sign up (free). Verify your email.
2. You do not need to add a domain. Skip any prompt that asks for one.

### 3.2 Create the site from GitHub

1. In the left sidebar, open **Workers & Pages**.
2. Click **Create application**, choose the **Pages** tab, then **Connect to Git**.
   - If you only see Workers options, look for a link like **Looking to deploy Pages? Get started**. Use Pages, not Workers.
3. Choose **GitHub** and authorize Cloudflare. When GitHub asks which repositories, choose **Only select repositories**, pick **Workout-Logging**, then click **Install & Authorize**.
4. Select **Workout-Logging** and click **Begin setup**.

### 3.3 Build settings

Fill in exactly:

| Field                  | Value                                                                                          |
| ---------------------- | ---------------------------------------------------------------------------------------------- |
| Project name           | a short unique name, for example `overload-gym`. Your address becomes `overload-gym.pages.dev` |
| Production branch      | `phase-2-wip`                                                                                  |
| Framework preset       | `None`                                                                                         |
| Build command          | `pnpm build`                                                                                   |
| Build output directory | `dist`                                                                                         |

### 3.4 Environment variables

Open **Environment variables (optional)** on the same page and add these four, one per row:

| Variable name            | Value                                       |
| ------------------------ | ------------------------------------------- |
| `NODE_VERSION`           | `22`                                        |
| `PNPM_VERSION`           | `10.28.0`                                   |
| `VITE_SUPABASE_URL`      | the Project URL from step 1.4               |
| `VITE_SUPABASE_ANON_KEY` | the publishable (or anon) key from step 1.4 |

Check the values for extra spaces before you continue.

### 3.5 Deploy

1. Click **Save and Deploy**. The first build takes 2 to 4 minutes.
2. When it says **Success**, click **Continue to project**. Your address is shown at the top, for example `https://overload-gym.pages.dev`. Copy it into your note.
3. Open it on your laptop. Click **Account** in the menu: you should see the sign-in page. If it says accounts are not set up, see Troubleshooting.

---

## Part 4. Tell Supabase your app's address

This makes confirmation and password reset links open your app instead of a blank page.

1. In Supabase, go to **Authentication > URL Configuration**.
2. **Site URL:** paste your address, for example `https://overload-gym.pages.dev`. Click **Save**.
3. Under **Redirect URLs**, click **Add URL** and enter your address followed by `/**`, for example `https://overload-gym.pages.dev/**`. Click **Save**.

---

## Part 5. Test it yourself on your phone

Do every step. If anything looks wrong, take a screenshot and send it to me.

1. **Install it.**
   - Android (Chrome): open your address, tap the **three dots** menu, then **Install app** or **Add to Home screen**.
   - iPhone (Safari only): open your address, tap the **Share** button, then **Add to Home Screen**, then **Add**.
2. Open the app **from the home screen icon**, not the browser.
3. Tap **More**, then **Account**. On the sign-in page tap **Create an account** and use your real email. If you chose Option A, open the confirmation email and tap the link.
4. Go to **More > Profile** and set your name and goal.
5. Go to **Routines**, tap **Create a routine**, pick a template, and change one target to see editing work.
6. Go to **Workout** and start today's day. Log three sets with a decimal weight such as `82.5`. Check that the number keyboard appears and the rest timer starts.
7. Lock your phone for a minute, unlock it: the workout and timer should still be there.
8. Turn on **flight mode**, log two more sets, and tap **Finish**. The summary should say the workout is saved on this device, not synced.
9. Turn flight mode **off**. Within a few seconds it should say **Synced to your account**.
10. On your laptop, open your address, sign in with the same account, and open **History**. The workout should be there with the same numbers.
11. Sign out on the laptop, tap **Forgot your password?**, and complete the reset from the email.
12. Open **Pro** on your phone. It should show **Free trial** with about 7 days left.
13. In Supabase **Table Editor**, open `workouts` and `sets`: your workout is there. Open `subscriptions`: your row shows a trial ending 168 hours after you signed up.

---

## Part 6. Invite your friends

### 6.1 Start small

Invite 3 or 4 friends first. After two or three days with no problems, invite the rest. Small batches keep email limits and any surprises manageable.

### 6.2 Message to send (copy and edit)

> Hey! I built a workout logging app and I'd love you to try it for a week.
>
> 1. Open this on your phone: https://overload-gym.pages.dev
> 2. Add it to your home screen. On Android: menu (three dots), then Install app. On iPhone, in Safari: Share, then Add to Home Screen.
> 3. Create an account (check spam for the confirmation email).
> 4. Set up your profile, pick a routine under Routines, and log your next gym sessions in it.
>
> You get 7 days of Pro free, and your workout history always stays yours. It works without signal at the gym and syncs later.
>
> Please tell me anything that felt slow, confusing or wrong. Screenshots help a lot.

Replace the address with yours.

### 6.3 What to ask them after a week

- Was logging a set faster than writing it in Notes?
- Did "last time" show the right numbers?
- Did anything get lost, duplicated or look wrong?
- What did Progress tell you that you did not already know?
- Would you pay for Pro, and what should it include?

---

## Part 7. Running it

### Give someone Pro by hand

1. In Supabase, open **SQL Editor > New query**.
2. Paste this, replace the email (and the number of days if you like), and click **Run**:

```sql
update public.subscriptions
set status = 'active',
    pro_started_at = case when pro_expires_at > now() then pro_started_at else now() end,
    pro_expires_at = greatest(coalesce(pro_expires_at, now()), now()) + interval '30 days',
    admin_note = concat_ws(e'\n', admin_note, to_char(now(), 'YYYY-MM-DD') || ': granted by hand')
where user_id = (select id from auth.users where email = 'friend@example.com');
```

3. It should say **1 row affected**. The friend sees Pro within ten minutes, or immediately after reopening the app.

More queries (pending payments, revoking Pro) are in `docs/admin-pro-payments.md` in the repository.

### Open payments when you are ready

1. Decide your UPI ID, the name shown to payers, the price in rupees, and the days one payment buys.
2. In Cloudflare: open your project, then **Settings > Variables and Secrets** (or **Environment variables**). Add these for **Production**:
   - `VITE_UPI_ID`: for example `yourname@okhdfcbank`
   - `VITE_UPI_PAYEE_NAME`: your name
   - `VITE_PRO_PRICE_INR`: for example `99`
   - `VITE_PRO_PERIOD_DAYS`: for example `30`
3. Go to **Deployments**, open the menu (three dots) on the latest deployment, and click **Retry deployment**. Variables only take effect after a new build.
4. On your phone, open **Pro** and check the price and UPI ID are right. Tap **Open a UPI app** and check the payee name before sharing with anyone.
5. When someone pays, their transaction reference appears in Supabase. Match it against your UPI app, then grant Pro as above.

### Updates

**If an update adds a database file, run it first.** When I tell you an update has a new file in
`supabase/migrations`, open it on GitHub (branch `phase-2-wip`), copy it, and run it in the
Supabase **SQL Editor** in a new query, exactly as in step 1.2. Only then should the new code go
live. If the code goes first, phones keep the new data safely on the device and keep retrying,
but nothing syncs until the file is run.

The October update (setup, body numbers, goals, the tour) needs
`20261007000004_personal_training.sql`. After running it, **Table Editor** shows the new
tables `body_measurements` and `goals`, and `exercises` has 101 rows.

When new code is pushed to `phase-2-wip`, Cloudflare rebuilds the site automatically within a few minutes. Open apps show **A new version of the app is ready** with a **Reload** button, so nobody is interrupted mid-workout.

### Keep Supabase awake

Free Supabase projects pause after about a week with little activity. Supabase emails you first. If you or your friends use the app most days, it stays awake. If it pauses: open the Supabase dashboard, select the project, click **Resume**. Nothing is lost, and phones keep working offline while it is paused.

---

## Troubleshooting

| What you see                                                   | What to do                                                                                                                                     |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Cloudflare build fails with a pnpm or Node error               | Check `NODE_VERSION` is `22` and `PNPM_VERSION` is `10.28.0`, then **Retry deployment**.                                                       |
| The app says "Accounts are not set up in this version"         | The Supabase variables are missing or were added after the build. Check both `VITE_SUPABASE_` values in Cloudflare, then **Retry deployment**. |
| Sign-up says "Too many attempts" or the email never arrives    | You hit the 2-an-hour limit: do Part 2. Also check spam.                                                                                       |
| A confirmation or reset link opens a blank page or `localhost` | Part 4 is missing or has a typo in the address.                                                                                                |
| Sign-in says "Confirm your email first"                        | They have not tapped the confirmation link. Resend by signing up again, or use Option B.                                                       |
| Account says "Could not reach your account" for a long time    | The Supabase project may be paused: resume it. The data is safe on the phone meanwhile.                                                        |
| A friend sees an old version                                   | Tap **Reload** on the banner, or close and reopen the app.                                                                                     |
| A SQL file in step 1.2 shows an error                          | Send me the exact red message. Do not edit the files.                                                                                          |

Anything else: send me a screenshot and what you tapped just before.
