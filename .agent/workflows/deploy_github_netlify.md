---
description: Deploy to GitHub and Netlify
---

# Deploy to GitHub and Netlify

This workflow guides you through the process of version controlling your project with Git, pushing it to GitHub, and deploying it to Netlify.

## 1. Initialize Git and Create .gitignore

First, we need to ensure this is a git repository and that we are ignoring unnecessary files.

```bash
git init
```

Check if `.gitignore` exists. If not, create it with the following content:

```text
node_modules
dist
dist-ssr
*.local
.DS_Store
.env
```

// turbo

```bash
echo "node_modules/" > .gitignore
echo "dist/" >> .gitignore
echo ".env" >> .gitignore
echo ".DS_Store" >> .gitignore
```

## 2. Stage and Commit Files

Add all your project files to the git staging area and commit them.

```bash
git add .
git commit -m "Initial commit: Map Visualizer Pro"
```

## 3. Push to GitHub

You need to create a repository on GitHub first.

1. Go to [GitHub.com/new](https://github.com/new).
2. Create a new repository (e.g., `map-visualizer-pro`).
3. **Do not** initialize with README, .gitignore, or License (we already have them).
4. Copy the commands to "push an existing repository from the command line".

It will look something like this (replace `YOUR_USERNAME` and `REPO_NAME`):

```bash
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/REPO_NAME.git
git push -u origin main
```

## 4. Deploy to Netlify

There are two ways to deploy to Netlify:

### Option A: Connect to GitHub (Recommended)

1. Go to [Netlify.com](https://app.netlify.com/).
2. Click "Add new site" > "Import from an existing project".
3. Choose "GitHub".
4. Authorize Netlify to access your GitHub repositories.
5. Select the `map-visualizer-pro` repository you just created.
6. **Build Settings**:
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`
7. Click "Deploy site".

### Option B: Drag and Drop (Manual)

1. Run the build command locally:

   ```bash
   npm run build
   ```

2. Go to [Netlify Drop](https://app.netlify.com/drop).
3. Drag and drop the `dist` folder created in your project directory into the browser window.

## 5. Verify Deployment

Once deployed, Netlify will give you a URL (e.g., `https://random-name.netlify.app`). Open it to verify your application is working correctly.
