# NGA Task Mentor - Comprehensive Documentation

## Table of Contents
1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Project Structure](#project-structure)
4. [Installation & Setup](#installation--setup)
5. [API Documentation](#api-documentation)
6. [Database Schema](#database-schema)
7. [Frontend Components](#frontend-components)
8. [Features](#features)
9. [Proctoring System](#proctoring-system)
10. [Security](#security)
11. [Deployment](#deployment)
12. [Contributing](#contributing)

## Overview

NGA Task Mentor is a comprehensive educational platform designed to streamline academic workflows for modern educational institutions. It provides robust tools for course management, assignments, quizzes, student progress tracking, and advanced proctoring capabilities.

### Key Features
- **Course Management**: Create and manage courses with enrollment capabilities
- **Assignment System**: Comprehensive assignment creation, submission, and grading
- **Quiz Platform**: Advanced quiz creation with multiple question types and Bloom's Taxonomy integration
- **Proctoring System**: AI-powered live proctoring with WebRTC streaming
- **Question Bank**: Centralized repository for reusable questions
- **Analytics & Reporting**: Detailed insights into student performance
- **Real-time Communication**: Live streaming and messaging capabilities

## Architecture

The platform follows a microservices architecture with three main components:

### 1. Main Server (Port 5000)
- **Technology**: Node.js, Express, TypeScript, Sequelize ORM
- **Database**: MySQL with Sequelize
- **Purpose**: Core API endpoints, authentication, data management

### 2. Live Server (Port 5002)
- **Technology**: Node.js, Socket.IO, WebRTC
- **Purpose**: Real-time communication, proctoring streams, video conferencing

### 3. Client Application
- **Technology**: React, TypeScript, Vite, TailwindCSS
- **State Management**: Redux Toolkit
- **UI Components**: Custom components with Lucide icons

## Project Structure

```
nga-task-mentor/
├── client/                 # React frontend application
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── pages/          # Page-level components
│   │   ├── contexts/       # React contexts
│   │   └── store/          # Redux store configuration
├── server/                 # Main backend server
│   ├── src/
│   │   ├── controllers/    # API route handlers
│   │   ├── models/         # Database models
│   │   ├── routes/         # API route definitions
│   │   ├── middleware/     # Custom middleware
│   │   └── config/         # Configuration files
├── live-server/            # Real-time communication server
│   └── src/
│       ├── index.ts        # Socket.IO server
│       └── types.ts        # TypeScript definitions
└── database/               # Database files and migrations
```

## Installation & Setup

### Prerequisites
- Node.js (v18 or higher)
- MySQL database
- npm or yarn

### Environment Variables

#### Server (.env)
```env
NODE_ENV=development
PORT=5000
JWT_SECRET=your-jwt-secret
DB_HOST=localhost
DB_PORT=3306
DB_NAME=taskmentor
DB_USER=root
DB_PASSWORD=your-password
```

#### Live Server (.env)
```env
PORT=5002
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173
MAX_PARTICIPANTS_PER_ROOM=10
```

### Installation Steps

1. **Clone the repository**
```bash
git clone <repository-url>
cd nga-task-mentor
```

2. **Install dependencies**
```bash
npm install
cd client && npm install
cd ../server && npm install
cd ../live-server && npm install
```

3. **Setup database**
```bash
cd server
npm run migrate
npm run seed  # Optional: seed with demo data
```

4. **Start the application**
```bash
# From root directory
npm run dev
```

This will start:
- Main server on port 5000
- Live server on port 5002
- Client development server on port 5173

## API Documentation

### Authentication Endpoints
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `POST /api/auth/logout` - User logout
- `GET /api/auth/me` - Get current user

### User Management
- `GET /api/users` - List users (admin only)
- `GET /api/users/:id` - Get user details
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user

### Course Management
- `GET /api/courses` - List courses
- `POST /api/courses` - Create course
- `GET /api/courses/:id` - Get course details
- `PUT /api/courses/:id` - Update course
- `DELETE /api/courses/:id` - Delete course

### Assignment Management
- `GET /api/assignments` - List assignments
- `POST /api/assignments` - Create assignment
- `GET /api/assignments/:id` - Get assignment details
- `PUT /api/assignments/:id` - Update assignment
- `DELETE /api/assignments/:id` - Delete assignment

### Quiz Management
- `GET /api/quizzes` - List quizzes
- `POST /api/quizzes` - Create quiz
- `GET /api/quizzes/:id` - Get quiz details
- `PUT /api/quizzes/:id` - Update quiz
- `DELETE /api/quizzes/:id` - Delete quiz
- `POST /api/quizzes/:id/submit` - Submit quiz

### Proctoring
- `POST /api/proctoring/session` - Create proctoring session
- `GET /api/proctoring/session/:id` - Get proctoring session
- `POST /api/proctoring/event` - Log proctoring event

### Question Bank
- `GET /api/question-bank` - List questions
- `POST /api/question-bank` - Create question
- `GET /api/question-bank/:id` - Get question details
- `PUT /api/question-bank/:id` - Update question
- `DELETE /api/question-bank/:id` - Delete question

## Database Schema

### Core Models

#### User
```typescript
interface User {
  id: number;
  username: string;
  email: string;
  password: string;
  role: 'student' | 'instructor' | 'admin';
  first_name: string;
  last_name: string;
  profile_image?: string;
  created_at: Date;
  updated_at: Date;
}
```

#### Course
```typescript
interface Course {
  id: number;
  title: string;
  description: string;
  course_code: string;
  created_by: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}
```

#### Assignment
```typescript
interface Assignment {
  id: number;
  title: string;
  description: string;
  course_id: number;
  created_by: number;
  due_date: Date;
  max_score: number;
  assignment_type: string;
  created_at: Date;
  updated_at: Date;
}
```

#### Quiz
```typescript
interface Quiz {
  id: number;
  title: string;
  description: string;
  course_id: number;
  created_by: number;
  time_limit: number;
  max_attempts: number;
  is_published: boolean;
  shuffle_questions: boolean;
  show_results: boolean;
  created_at: Date;
  updated_at: Date;
}
```

#### QuizQuestion
```typescript
interface QuizQuestion {
  id: number;
  quiz_id: number;
  question_id: number;
  question_order: number;
  points: number;
}
}
```

#### QuestionBank
```typescript
interface QuestionBank {
  id: number;
  question_text: string;
  question_type: 'multiple_choice' | 'true_false' | 'short_answer' | 'essay';
  options: string;
  correct_answer: string;
  explanation?: string;
  difficulty: 'easy' | 'medium' | 'hard';
  blooms_taxonomy_level_id: number;
  created_by: number;
  is_public: boolean;
  tags: string;
  created_at: Date;
  updated_at: Date;
}
```

#### ProctoringSession
```typescript
interface ProctoringSession {
  id: number;
  quiz_id: number;
  student_id: number;
  proctor_id: number;
  session_token: string;
  start_time: Date;
  end_time?: Date;
  status: 'active' | 'completed' | 'terminated';
  violation_count: number;
  created_at: Date;
  updated_at: Date;
}
```

## Frontend Components

### Layout Components
- `Layout` - Main application layout with navigation
- `Navbar` - Top navigation bar
- `Sidebar` - Side navigation menu

### Authentication
- `Login` - Login form
- `AuthGuard` - Route protection wrapper
- `ProtectedRoute` - Role-based route protection

### Dashboard
- `Dashboard` - Main dashboard (role-specific)
- `StudentDashboard` - Student-specific dashboard
- `InstructorDashboard` - Instructor-specific dashboard

### Course Management
- `Courses` - Course list and management
- `CourseDetails` - Individual course view
- `CreateCourse` - Course creation form

### Assignment System
- `Assignments` - Assignment list
- `AssignmentDetails` - Assignment details and submissions
- `CreateAssignment` - Assignment creation form
- `SubmissionGrading` - Grading interface

### Quiz Platform
- `QuizList` - Quiz listing
- `QuizView` - Quiz details and questions
- `QuizTaker` - Quiz taking interface
- `QuizResults` - Results display
- `CreateQuiz` - Quiz creation form
- `EditQuiz` - Quiz editing interface

### Proctoring System
- `LiveProctoringDashboard` - Real-time proctoring monitoring
- `QuizProctoringPage` - Quiz proctoring setup
- `ProctoringMonitoring` - Live monitoring interface

### Question Bank
- `QuestionBankList` - Question repository
- `QuestionBankSelector` - Question selection modal
- `CreateQuestion` - Question creation form

## Features

### 1. Course Management
- Create and manage courses
- Student enrollment
- Course-specific assignments and quizzes
- Progress tracking

### 2. Assignment System
- Multiple assignment types
- File submission support
- Grading with rubrics
- Plagiarism detection integration
- Deadline management

### 3. Quiz Platform
- Multiple question types:
  - Multiple choice
  - True/False
  - Short answer
  - Essay questions
- Bloom's Taxonomy integration
- Time limits and attempts
- Automatic grading for objective questions
- Random question order

### 4. Proctoring System
- AI-powered monitoring
- Live video streaming
- Screen recording
- Violation detection
- Real-time alerts
- Session recording and playback

### 5. Question Bank
- Centralized question repository
- Question categorization
- Bloom's Taxonomy levels
- Difficulty levels
- Public/private questions
- Tags and search functionality

### 6. Analytics & Reporting
- Student performance analytics
- Course completion rates
- Quiz statistics
- Proctoring reports
- Export capabilities

## Proctoring System

The proctoring system provides comprehensive exam monitoring through:

### Architecture
- **Live Server**: Handles real-time WebRTC streaming
- **AI Detection**: Face detection and object recognition
- **Event Logging**: Comprehensive violation tracking
- **Real-time Monitoring**: Live dashboard for instructors

### Features
- **Face Detection**: Using MediaPipe and TensorFlow.js
- **Object Detection**: COCO-SSD model for unauthorized objects
- **Screen Monitoring**: Periodic screenshots
- **Audio Monitoring**: Noise level detection
- **Violation Types**:
  - Face not visible
  - Multiple faces detected
  - Unauthorized objects
  - Tab switching
  - Copy-paste attempts

### Implementation
```typescript
// Proctoring session flow
1. Student starts quiz → Creates proctoring session
2. WebRTC connection established → Live streaming begins
3. AI monitoring starts → Face/object detection
4. Violations logged → Real-time alerts to instructor
5. Session ends → Comprehensive report generated
```

## Security

### Authentication & Authorization
- JWT-based authentication
- Role-based access control (RBAC)
- Session management
- Password hashing with bcrypt

### Data Protection
- Input validation and sanitization
- SQL injection prevention
- XSS protection
- CORS configuration
- Rate limiting

### Proctoring Security
- Encrypted WebRTC streams
- Secure session tokens
- Violation evidence storage
- Audit trails

## Deployment

### Production Setup

#### Environment Configuration
```env
NODE_ENV=production
PORT=5000
DB_HOST=your-production-db-host
DB_NAME=taskmentor_prod
JWT_SECRET=your-production-jwt-secret
```

#### Database Setup
```bash
# Run migrations
npm run migrate

# Seed production data (optional)
npm run seed:prod
```

#### Build Process
```bash
# Build client
cd client
npm run build

# Build server
cd ../server
npm run build

# Build live server
cd ../live-server
npm run build
```

#### Process Management
Using PM2 for production:
```bash
# Install PM2
npm install -g pm2

# Start all services
pm2 start ecosystem.config.js

# Monitor
pm2 monit
```

### Docker Deployment

```dockerfile
# Dockerfile example
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 5000

CMD ["npm", "start"]
```

## Contributing

### Development Guidelines

1. **Code Standards**
   - Use TypeScript for type safety
   - Follow ESLint configuration
   - Use Prettier for code formatting

2. **Git Workflow**
   - Create feature branches
   - Write descriptive commit messages
   - Create pull requests for review

3. **Testing**
   - Write unit tests for new features
   - Test API endpoints
   - Verify UI functionality

### Adding New Features

1. **Backend Changes**
   - Create/update models in `server/src/models/`
   - Add controllers in `server/src/controllers/`
   - Define routes in `server/src/routes/`
   - Update database schema if needed

2. **Frontend Changes**
   - Create components in `client/src/components/`
   - Add pages in `client/src/pages/`
   - Update routing in `client/src/App.tsx`
   - Manage state with Redux if needed

3. **Database Migrations**
```bash
# Create new migration
npx sequelize-cli migration:create --name add_new_feature

# Run migration
npm run migrate
```

### Code Review Process
1. Ensure code follows project standards
2. Test all functionality
3. Update documentation
4. Submit pull request with clear description

## Support

For technical support or questions:
- Review this documentation
- Check existing issues
- Contact the development team

---

**Last Updated**: March 2026
**Version**: 1.0.0
**Maintainer**: NGA Development Team
