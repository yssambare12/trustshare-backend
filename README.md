# TrustShare Backend

Backend server for TrustShare - a secure file sharing platform.

## Links

- **Live App**: [https://trustshare-kappa.vercel.app/](https://trustshare-kappa.vercel.app/)
- **Frontend Repo**: [https://github.com/yssambare12/trustshare](https://github.com/yssambare12/trustshare)
- **Backend Repo**: [https://github.com/yssambare12/trustshare-backend](https://github.com/yssambare12/trustshare-backend)

## Features

- User authentication with JWT
- Secure file upload and sharing
- User management
- MongoDB database integration

## Tech Stack

- Node.js + Express
- MongoDB
- JWT for authentication
- Multer for file uploads

## Run Locally

1. **Clone the repository**
   ```bash
   git clone https://github.com/yssambare12/trustshare-backend.git
   cd trustshare-backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Create a `.env` file** in the root directory with:
   ```
   PORT=5000
   MONGODB_URI=your_mongodb_connection_string
   JWT_SECRET=your_jwt_secret_key
   ```

4. **Start the server**
   ```bash
   # Development mode
   npm run dev

   # Production mode
   npm start
   ```

The server will run on `http://localhost:5000`

## API Health Check

Visit `http://localhost:5000/health` to check if the server is running.
