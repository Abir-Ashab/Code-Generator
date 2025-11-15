# AI Code Generator

This is a full-stack application for generating C++ code using AI.

## Tech Stack
- Frontend: React with Tailwind CSS
- Backend: Node.js with Express
- File Storage: MinIO
- AI: Google Gemini

## Quick Start with Docker

### Prerequisites
- Docker and Docker Compose installed
- Google Gemini API key

### Setup Steps
1. **Clone or navigate to the project directory**

2. **Set up environment variables:**
   - Copy `backend/.env` and update with your credentials:
     - `GEMINI_API_KEY`: Your Google Gemini API key from https://makersuite.google.com/app/apikey
     - MongoDB URI is already configured

3. **Build and start minio**
   ```bash
   docker-compose up --build
   ```
   This will:
   - Start MinIO file storage server

4. **Access the application:**
   - Frontend: http://localhost:3000 (`npm start`)
   - Backend API: http://localhost:5000 (`npm start`)
   - MinIO Console: http://localhost:9001 (login: minioadmin/minioadmin)

## Manual Setup (Alternative)

### Prerequisites
- Node.js installed
- Google Gemini API key
- MinIO server running locally

### Backend Setup
1. Navigate to `backend` folder
2. Install dependencies: `npm install`
3. Update `.env` with your Gemini API key
4. Start the server: `npm start`

### Frontend Setup
1. Navigate to `frontend` folder
2. Install dependencies: `npm install`
3. Start the app: `npm start`

### MinIO Setup
1. Download MinIO from https://min.io/download
2. Run MinIO server: `minio server ./minio-data` (from project root)
3. Access MinIO console at http://localhost:9001

## Usage
1. Open frontend at http://localhost:3000
2. Enter a query like "write a code to add two numbers"
3. Click Generate Code
4. View the generated code and download the .cpp file

## API
- POST /generate-code: { query: string } -> { fileUrl: string, code: string }