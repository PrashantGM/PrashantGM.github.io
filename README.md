**Requirements:**
1. You must have node and postgres installed on your PC. 
2. Set up cloudinary account and get its account name, api key and api-secret.
3. Code editor is recommended. Eg; VS Code

## Steps to run bookstore-webapp
1. Download zip file or clone the app with: git clone https://github.com/PrashantGM/bookstore-webapp.git.
2. After download, open project folder in your favorite text editor and run npm install on its terminal.
   Note: You should be on same project directory on the terminal.
3. Create .env file on project's root directory and include following .env variables PORT, CLOUD_NAME,
   CLOUD_API_KEY, CLOUD_API_SECRET, JWT_SECRET and JWT_LIFE_TIME with corresponding values in that file          Note: They are case-sensitive.
4. Run npx prisma migrate dev on the terminal.
5. Then, execute npm run dev. 
   App wil be live on http://localhost:8000.

**Notice: By default, new users registered are normal user. You need to have users with admin role
        to get admin access for CRUD operations. Currently, admin role can only be set manually within the postgres database.**
