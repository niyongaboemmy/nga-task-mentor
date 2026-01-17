# SPWMS Development Setup Guide

## Overview

SPWMS (Student Practical Work Management System) is a full-stack web application built with React, Node.js, Express, MySQL, and Socket.io. This guide provides instructions for setting up and running the project in development mode.

## Prerequisites

- **Node.js** (v16 or higher recommended)
- **MySQL** (running on localhost:8889 - MAMP or similar recommended for easy setup)
- **npm** or **yarn**

## Project Structure

```
spwms/
├── client/          # React frontend (Vite)
├── server/          # Node.js backend (Express + TypeScript)
├── package.json     # Root package.json with dev scripts
└── DEVELOPMENT.md   # This file
```

## Setup Instructions

### 1. Database Setup

- Start your MySQL server (ensure it's running on port 8889)
- Create a database named `taskmentor_dev`
- Import the database schema:
  ```bash
  mysql -u root -proot taskmentor_dev < server/taskmentor_dev.sql
  ```
  **Note**: Uses root/root credentials as configured in `server/.env`

### 2. Install Dependencies

From the project root directory (`spwms/`):

```bash
npm run install-all
```

This installs dependencies for both client and server.

### 3. Run Database Migrations (if needed)

```bash
cd server
npm run migrate
```

This applies any pending Sequelize migrations.

### 4. Start Development Environment

From the project root directory (`spwms/`):

```bash
npm run dev
```

This concurrently starts:

- **Frontend** (React + Vite) on http://localhost:5173
- **Backend API** (Node.js + Express) on http://localhost:5001
- **Socket Server** for real-time proctoring features

## Access the Application

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:5001/api/v1
- **Default Admin User**: admin@taskmentor.com / admin123

## Additional Scripts

- `npm run server` - Run only the backend server
- `npm run client` - Run only the frontend
- `npm run socket` - Run only the socket server
- `npm run build` - Build the frontend for production

## Features Included

- User management (students, instructors, admins)
- Course and assignment management
- Quiz system with multiple question types:
  - Single choice
  - Multiple choice
  - True/False
  - Matching
  - Fill in the blank
  - Dropdown
  - Numerical
  - Algorithmic
  - Short answer
  - Coding questions
  - Logical expression
  - Drag and drop
  - Ordering
- Proctoring system with:
  - Face detection using face-api.js
  - Camera/microphone monitoring
  - Fullscreen enforcement
  - Real-time violation tracking
  - Object detection framework
- Real-time notifications via Socket.io
- File uploads
- Responsive design with Tailwind CSS

## Environment Configuration

The application uses the following key environment variables (configured in `server/.env`):

- `PORT=5001` - Backend server port
- `DATABASE_URI=mysql://localhost:8889/taskmentor_dev` - Database connection
- `JWT_SECRET=123871298376187364873264` - JWT secret key
- `FRONTEND_URL=http://localhost:5173` - Frontend URL for CORS

## Database Schema

The database includes tables for:

- Users (students, instructors, admins)
- Courses
- Assignments
- Quizzes and quiz questions
- Quiz submissions and attempts
- Proctoring sessions and events
- Proctoring settings
- User course enrollments

## Development Notes

- The frontend uses Vite for fast development with HMR
- Backend uses TypeScript with ts-node-dev for hot reloading
- Sequelize is used for database ORM with migrations
- Socket.io handles real-time proctoring and notifications
- Face detection uses TensorFlow.js and face-api.js

## Troubleshooting

- Ensure MySQL is running on port 8889
- Check that all dependencies are installed (`npm run install-all`)
- Verify database connection in `server/.env`
- Check console logs for any error messages
- Ensure ports 5001, 5173, and MySQL port 8889 are available

## Contributing

1. Follow the existing code structure and naming conventions
2. Run tests before committing changes
3. Update documentation for any new features
4. Ensure proper TypeScript typing

---

**Last Updated**: November 27, 2025
