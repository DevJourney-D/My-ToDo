# My Todo App

A full-stack todo application built with:
- **Frontend**: Next.js 14 with TypeScript, Tailwind CSS
- **Backend**: Express.js with PostgreSQL
- **Authentication**: JWT tokens

## Project Structure

```
my-todo-app/
├── api/          # Express.js backend
│   ├── src/
│   │   ├── config/
│   │   ├── controllers/
│   │   ├── routes/
│   │   └── middleware/
│   ├── server.js
│   └── package.json
├── web/          # Next.js frontend
│   ├── src/
│   │   ├── app/
│   │   ├── components/
│   │   ├── services/
│   │   └── types/
│   └── package.json
└── package.json  # Root package.json
```

## Quick Start

1. **Install all dependencies:**
   ```bash
   npm run install:all
   ```

2. **Set up environment variables:**
   ```bash
   cp api/.env.example api/.env
   # Edit api/.env with your database credentials
   ```

3. **Run development servers:**
   ```bash
   npm run dev
   ```

This will start both the API server (port 5000) and the Next.js app (port 3000).

## Available Scripts

- `npm run dev` - Start both frontend and backend in development mode
- `npm run dev:api` - Start only the API server
- `npm run dev:web` - Start only the Next.js app
- `npm run build` - Build the frontend for production
- `npm run start` - Start both servers in production mode

## Features

- ✅ User authentication (login/register)
- ✅ Create, read, update, delete todos
- ✅ Responsive design
- ✅ TypeScript support
- ✅ Modern UI with Tailwind CSS
- 🔄 Analytics dashboard (coming soon)
- 🔄 Tags and categories (coming soon)

## Tech Stack

### Frontend
- Next.js 14
- TypeScript
- Tailwind CSS
- React Hooks

### Backend
- Express.js
- PostgreSQL
- JWT Authentication
- CORS enabled

## Database Setup

1. Install PostgreSQL
2. Create a database named `todoapp`
3. Update the `DATABASE_URL` in `api/.env`
4. The app will create necessary tables automatically

## Deployment

### Frontend (Vercel)
1. Push to GitHub
2. Connect to Vercel
3. Deploy from the `web` directory

### Backend (Railway/Heroku)
1. Push to GitHub
2. Connect to your preferred platform
3. Deploy from the `api` directory
4. Set environment variables

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request
