# Jotta Learn

![Build Status](https://img.shields.io/github/actions/workflow/status/yourusername/jotta-learn/build.yml?style=flat-square)
![License](https://img.shields.io/github/license/yourusername/jotta-learn?style=flat-square)

An interactive learning platform for creating and managing YouTube video flashcards.

## Features
- 🎥 YouTube video processing and flashcard generation
- 📚 Organized flashcard management system
- 🔍 Search and navigation through video content
- 📊 Progress tracking and analytics
- 🔒 User authentication and session management

## Technology Stack
- **Frontend**: React, TypeScript, Tailwind CSS
- **Backend**: Node.js, Express, MongoDB
- **AI Integration**: OpenAI API
- **DevOps**: Docker, GitHub Actions

## Getting Started

### Prerequisites
- Node.js v18+
- MongoDB v6+
- Python 3.9+ (for optional ML features)

### Installation
```bash
# Clone repository
git clone https://github.com/yourusername/jotta-learn.git
cd jotta-learn

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### Configuration
1. Create `.env` file in backend directory:
```env
MONGODB_URI=mongodb://localhost:27017/jotta-learn
JWT_SECRET=your_jwt_secret
OPENAI_API_KEY=your_openai_key
```

## Running the Application
```bash
# Start backend server
cd backend
npm start

# Start frontend development server
cd ../frontend
npm start
```

## API Documentation
Our API endpoints follow RESTful principles. Explore the API documentation at [http://localhost:5000/api-docs](http://localhost:5000/api-docs) when the backend server is running.

## Deployment
```bash
# Production build with Docker
docker-compose -f docker-compose.prod.yml up --build
```

## Contributing
1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License
Distributed under the MIT License. See `LICENSE` for more information.

## Support
For questions or issues, please [open an issue](https://github.com/yourusername/jotta-learn/issues) or contact maintainers@jotta-learn.com