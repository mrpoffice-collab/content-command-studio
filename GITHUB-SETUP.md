# GitHub Setup Guide

## Your Code is Ready! ✅

I've committed all your foundation code to Git. Now let's push it to GitHub.

## Option 1: Create GitHub Repo via Website (Recommended)

### Step 1: Create Repository on GitHub

1. Go to https://github.com/new
2. Fill in:
   - **Repository name**: `content-command-studio`
   - **Description**: "AI-powered content strategy and blog post generation platform"
   - **Visibility**: Private (recommended) or Public
   - **DO NOT** initialize with README, .gitignore, or license (we already have these!)
3. Click "Create repository"

### Step 2: Push Your Code

After creating the repo, GitHub will show you commands. Use these:

```bash
cd "C:\Users\mrpof\APPS Homemade\content-command-studio"

# Add GitHub as remote
git remote add origin https://github.com/YOUR-USERNAME/content-command-studio.git

# Push your code
git branch -M main
git push -u origin main
```

Replace `YOUR-USERNAME` with your actual GitHub username!

## Option 2: Using GitHub CLI (if you have it)

```bash
cd "C:\Users\mrpof\APPS Homemade\content-command-studio"

# Create repo and push in one command
gh repo create content-command-studio --private --source=. --push
```

## What's Been Committed

Your first commit includes:
- ✅ Complete project structure
- ✅ All documentation (7 markdown files)
- ✅ Database schema
- ✅ Authentication setup
- ✅ AI integrations (OpenAI + Claude)
- ✅ Landing page + Dashboard
- ✅ All utility functions

**What's NOT committed (by design):**
- ❌ `.env.local` (contains secrets - in .gitignore)
- ❌ `node_modules/` (dependencies - in .gitignore)
- ❌ `.next/` (build files - in .gitignore)

## Daily Git Workflow

### After making changes:

```bash
# Check what changed
git status

# Stage your changes
git add .

# Commit with a message
git commit -m "Add strategy builder form"

# Push to GitHub
git push
```

### Creating feature branches (recommended):

```bash
# Create a new branch for a feature
git checkout -b feature/strategy-builder

# Make your changes...
git add .
git commit -m "Implement strategy builder"

# Push the branch
git push -u origin feature/strategy-builder

# Create a Pull Request on GitHub to merge into main
```

## Branching Strategy (Recommended)

```
main (production-ready code)
  ├── feature/strategy-builder
  ├── feature/content-generator
  ├── feature/post-editor
  └── feature/export-functionality
```

**Work flow:**
1. Create feature branch
2. Build the feature
3. Test locally
4. Push to GitHub
5. Create Pull Request
6. Review and merge to main
7. Deploy from main branch

## Connecting to Vercel

Once pushed to GitHub:

1. Go to https://vercel.com
2. Click "Add New" → "Project"
3. Import your GitHub repository
4. Add all your environment variables
5. Deploy!

Vercel will auto-deploy on every push to `main`.

## Useful Git Commands

```bash
# View commit history
git log --oneline

# See what changed in a file
git diff app/page.tsx

# Undo uncommitted changes
git restore app/page.tsx

# Create and switch to new branch
git checkout -b feature-name

# Switch branches
git checkout main

# Pull latest changes
git pull

# See all branches
git branch -a

# Delete a branch
git branch -d feature-name
```

## .gitignore (Already Set Up)

Your `.gitignore` already protects:
- `.env*` - No secrets will be committed
- `node_modules/` - No dependencies
- `.next/` - No build files
- `.vercel/` - No deployment files

## Commit Message Guidelines

Good commit messages:
- ✅ `"Add strategy builder form with validation"`
- ✅ `"Fix: Resolve authentication redirect issue"`
- ✅ `"Update: Improve dashboard loading performance"`

Bad commit messages:
- ❌ `"update"`
- ❌ `"fix bug"`
- ❌ `"changes"`

## Next Steps

1. **Create GitHub repo** (follow Option 1 above)
2. **Push your code** to GitHub
3. **Connect to Vercel** for deployment
4. **Start building features!**

## Troubleshooting

### "Remote origin already exists"
```bash
git remote remove origin
git remote add origin https://github.com/YOUR-USERNAME/content-command-studio.git
```

### "Permission denied"
- Use HTTPS URL, not SSH (unless you have SSH keys set up)
- Or use GitHub Desktop app

### "Failed to push"
```bash
git pull origin main --rebase
git push
```

## GitHub Repository Settings (After Setup)

Recommended settings:

1. **Branch Protection** (Settings → Branches)
   - Protect `main` branch
   - Require pull request reviews (optional for solo)

2. **Secrets** (Settings → Secrets → Actions)
   - Add environment variables for GitHub Actions (if using CI/CD)

3. **Collaborators** (Settings → Collaborators)
   - Add team members if needed

Your code is ready to go live! 🚀
