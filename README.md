# Personal Site

A personal website built with SvelteKit and hosted on GitHub Pages.

## About

I am a professional problem solver currently working as a Senior Software Engineer at Liberty Mutual.

## Tech Stack

- **Framework**: SvelteKit with TypeScript
- **Styling**: Tailwind CSS
- **Build**: Vite
- **Testing**: Vitest (unit) + Playwright (e2e)
- **Code Quality**: ESLint + Prettier
- **Deployment**: GitHub Pages (static adapter)

## Development

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Run unit tests
npm run test

# Run e2e tests
npm run test:e2e

# Lint code
npm run lint

# Format code
npm run format
```

## Project Structure

- `/` - Home page with hello world
- `/learn-python` - Python learning resources
- `/travelogue` - Travel stories and photos

## Deployment

This site is automatically deployed to GitHub Pages when changes are pushed to the `main` branch. The workflow:

1. Builds the static site using `@sveltejs/adapter-static`
2. Uploads the build artifacts
3. Deploys to GitHub Pages

Make sure to enable GitHub Pages in your repository settings and set the source to "GitHub Actions".
