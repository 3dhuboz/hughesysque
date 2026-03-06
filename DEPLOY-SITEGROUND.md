# Deploy to SiteGround Shared Hosting (GoGeek)

## Prerequisites

- SiteGround GoGeek plan with SSH access enabled
- Domain `hugheseysque.au` pointed to SiteGround
- MongoDB Atlas connection string (already configured in `.env`)

---

## Step 1: Enable SSH on SiteGround

1. Log in to SiteGround → **Site Tools**
2. Go to **Devs → SSH Keys Manager**
3. Generate or import an SSH key
4. Note your SSH credentials (shown on the page)

## Step 2: Set Up Node.js App in cPanel

1. Go to **Site Tools → Devs → Node.js**
2. Click **Create Application**
3. Configure:
   - **Node.js Version**: 18.x or 20.x (latest available)
   - **Application Mode**: Production
   - **Application Root**: `hugheseysque.au/app` (we'll create this folder)
   - **Application URL**: `hugheseysque.au`
   - **Application Startup File**: `app.js`
4. Click **Create**
5. Note the **virtual environment path** shown (e.g., `/home/username/nodevenv/...`)

## Step 3: Upload Files via SSH

Connect via SSH:

```bash
ssh username@hugheseysque.au
```

Navigate to your site directory and create the app folder:

```bash
cd ~/public_html
mkdir -p app
cd app
```

Clone the repo (or upload via SFTP):

```bash
git clone https://github.com/3dhuboz/Penny-Wise-IT.git .
```

## Step 4: Configure Environment

Create the `.env` file on the server:

```bash
nano .env
```

Paste your production environment variables:

```
NODE_ENV=production
PORT=5000

# Client mode
CLIENT_MODE=true
ENABLED_APPS=foodtruck,socialai
BRAND_NAME="Hughesys Que"
BRAND_TAGLINE="Quality Street Food"
PRIMARY_COLOR=#f59e0b

# MongoDB (replace with your real Atlas connection string)
MONGODB_URI=mongodb+srv://YOUR_USER:YOUR_PASSWORD@cluster.mongodb.net/hughesys-que?retryWrites=true&w=majority

# Auth
JWT_SECRET=GENERATE_A_64_CHAR_RANDOM_STRING
ADMIN_EMAIL=hugheseysbbq2021@gmail.com
ADMIN_PASSWORD=CHANGE_THIS_TO_A_STRONG_PASSWORD

# Square Payments
SQUARE_ACCESS_TOKEN=your-production-access-token
SQUARE_LOCATION_ID=your-production-location-id
SQUARE_ENVIRONMENT=production

# AI
GEMINI_API_KEY=your-gemini-api-key

# Email (optional — needed for confirmation emails)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=hugheseysbbq2021@gmail.com
SMTP_PASS=your-gmail-app-password

# Google OAuth (optional)
GOOGLE_CLIENT_ID=your-google-client-id
```

**Important:** Change `JWT_SECRET` and `ADMIN_PASSWORD` to strong unique values for production!

## Step 5: Install Dependencies & Build

Activate the Node.js virtual environment (use the path from Step 2):

```bash
source /home/USERNAME/nodevenv/hugheseysque.au/app/18/bin/activate
```

Install server dependencies:

```bash
npm install --production
```

Install client dependencies and build:

```bash
cd client
npm install
npm run build
cd ..
```

## Step 6: Copy .htaccess to Public Root

The `.htaccess` file needs to be in your `public_html` directory:

```bash
cp .htaccess ~/public_html/.htaccess
```

## Step 7: Restart the Application

Go back to **Site Tools → Devs → Node.js** and click **Restart** on your application.

Or via SSH:

```bash
mkdir -p tmp
touch tmp/restart.txt
```

---

## Updating the App

After pushing new code to GitHub:

```bash
cd ~/public_html/app
git pull origin main
source /home/USERNAME/nodevenv/hugheseysque.au/app/18/bin/activate
npm install --production
cd client && npm install && npm run build && cd ..
touch tmp/restart.txt
```

## Troubleshooting

- **500 error**: Check `~/logs/hugheseysque.au.error.log`
- **App not starting**: Verify `app.js` is set as startup file in Node.js manager
- **MongoDB connection error**: Ensure your Atlas cluster allows connections from SiteGround's IP (or set to 0.0.0.0/0)
- **Static files not loading**: Ensure `client/build` exists and `NODE_ENV=production` is set
- **Blank page**: Check browser console for API errors; verify `.env` has correct `MONGODB_URI`

## File Structure on Server

```
~/public_html/
├── .htaccess              ← Routes all traffic to Node.js
└── app/                   ← Application root
    ├── app.js             ← Passenger entry point
    ├── .env               ← Production environment variables
    ├── package.json
    ├── server/
    │   ├── index.js       ← Express server
    │   ├── models/
    │   ├── routes/
    │   └── middleware/
    ├── client/
    │   └── build/         ← Production React build
    └── uploads/           ← User uploads
```
