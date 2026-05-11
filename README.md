# Campus-Food-Ordering-Platform
Web-based campus food ordering platform for students and vendors to browse menus, place orders, and track order status in real time. Built using Firebase and modern web technologies by Team 404 Team Not Found for the Wits Software Design course.

## Local Configuration

The real Firebase config is intentionally not committed. To run the app locally, copy `public/authentication/config.example.js` to `public/authentication/config.js` and fill in your Firebase web app values.

Optional environment variables can be documented in `.env.example` and placed in a local `.env` file when needed.

## Tests and Coverage

Run the test suite with coverage using:

```bash
npm run test:coverage
```

GitHub Actions runs the same coverage command on pushes and pull requests, then uploads the generated `coverage/` folder as a workflow artifact. The local `coverage/` folder is ignored because it is generated output.
