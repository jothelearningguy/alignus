# Counselor's Insight

A real-time relationship counseling application that helps couples communicate better through AI-powered insights and exercises.

## Features

- Real-time chat between partners
- AI-powered sentiment analysis and insights
- Communication exercises and goal tracking
- Cool-down periods for heated conversations
- Beautiful and intuitive UI

## Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- Firebase account
- Google Cloud API key for Gemini AI

## Setup

1. Clone the repository:
```bash
git clone <repository-url>
cd counselors-insight
```

2. Install dependencies:
```bash
npm install
```

3. Configure Firebase:
   - Create a new Firebase project
   - Enable Authentication (Anonymous)
   - Enable Firestore Database
   - Copy your Firebase configuration

4. Configure environment variables:
   Create a `.env` file in the root directory with the following variables:
   ```
   REACT_APP_FIREBASE_API_KEY=your_api_key
   REACT_APP_FIREBASE_AUTH_DOMAIN=your_auth_domain
   REACT_APP_FIREBASE_PROJECT_ID=your_project_id
   REACT_APP_FIREBASE_STORAGE_BUCKET=your_storage_bucket
   REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
   REACT_APP_FIREBASE_APP_ID=your_app_id
   REACT_APP_GEMINI_API_KEY=your_gemini_api_key
   ```

5. Start the development server:
```bash
npm start
```

The application will be available at `http://localhost:3000`.

## Usage

1. One partner starts a new session
2. Share the generated ID with your partner
3. The other partner joins using the shared ID
4. Start communicating and receive AI-powered insights

## Security

- All communication is encrypted
- Anonymous authentication
- No personal data is stored
- Sessions are temporary and can be deleted

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details. 