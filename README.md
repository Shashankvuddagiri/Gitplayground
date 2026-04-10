# 🎮 Git Playground | Interactive Git Simulator

Git Playground is a premium, web-based interactive Git terminal designed to help developers master version control through hands-on practice, visual feedback, and AI-powered coaching.

## 🚀 Key Features

- **Interactive Terminal**: A fully functional browser-based Git simulator.
- **D3.js Commit Graph**: Real-time visualization of your repository history, branches, and merges.
- **Git Sage (AI Coaching)**: Proactive command suggestions based on your repository state and current level goals.
- **Vim Modal Simulator**: Practice complex commands like `git rebase -i` or `git commit` using a realistic Vim text editor simulator.
- **Learning Tracks**: 10+ levels ranging from basic initialization to advanced interactive rebasing.
- **GitBot Assistant**: A domain-locked AI tutor powered by OpenRouter to answer your Git and GitHub questions.
- **Sync & Persistence**: Progress automatically saves to the backend, allowing you to pick up where you left off.

## 🛠️ Technology Stack

- **Frontend**: Vanilla JavaScript (ESM), D3.js, Glassmorphism CSS.
- **Backend**: Node.js, Express.js.


## 🔨 Local Setup

1. **Clone the repository**:
   ```bash
   git clone <your-repo-url>
   cd GitPlayground
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables**:
   Create a `.env` file in the root directory:
   ```env
   API_KEY=your_key_here
   PORT=3002
   ```

4. **Start the server**:
   ```bash
   npm start
   ```
   Open `http://localhost:3002` in your browser.



## 📜 License

MIT License - feel free to use and contribute!
