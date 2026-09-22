# QuickQuiz v1 — deployment-ready

A dependency-free first working version of a 2–6 player multiplayer quiz game.

## Deploy on Render

This package is prepared for a Node.js web service such as Render.

Deployment files:
- `package.json` — provides `npm start`.
- `render.yaml` — Render Blueprint configuration.
- `server.js` — reads the hosting provider `PORT` environment variable and binds to `0.0.0.0`.

Render uses the `PORT` environment variable for web-service HTTP binding.

### Steps
1. Extract this ZIP.
2. Create a new GitHub repository and upload all project files to its root.
3. In Render, choose **New → Web Service** and connect the repository.
4. If Render does not automatically use `render.yaml`, set:
   - Language: Node
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Plan: Free, if available for your account
5. Deploy. Render will provide a public `onrender.com` URL.
6. Open that URL on two separate devices and test the game.

Official Render documentation:
- https://render.com/docs/your-first-deploy
- https://render.com/docs/environment-variables

## Local run

Node.js 18+ is recommended.

```bash
node server.js
```

Then open `http://localhost:3000`. The local fallback remains port 3000, so the existing local workflow is unchanged.

## Gameplay

- Create a room and share the 4-character code.
- Players join with an in-game nickname.
- Host starts once 2–6 players are present.
- 10 questions, 15 seconds each.
- Correct answer: 100 points.
- Speed bonus: up to 50 additional points.
- Final leaderboard appears after question 10.
- Host can use Play Again to restart.

## Privacy

The app does not ask for accounts, email, phone numbers, location, or other personal information. Player data exists only in the server's in-memory room while the game is running.

## Hosting limitation of v1

Rooms and scores are stored only in server memory. A server restart/redeploy ends active rooms. The game functionality is otherwise unchanged.
