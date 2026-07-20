$ErrorActionPreference = "Stop"

# Pull latest changes first
Write-Host "Pulling latest changes..."
git pull

# Array of objects with files and commit messages
$commits = @(
    @{
        Files = @("backend/app/api/routes/repos.py")
        Message = "fix(api): handle GitHub rate limiting and resolve IntegrityError during repo ingestion"
    },
    @{
        Files = @("src/hooks/useAnalysis.ts", "src/routes/dashboard.tsx")
        Message = "feat(dashboard): support instant telemetry rendering with pre-computed analysis IDs"
    },
    @{
        Files = @("src/components/portal-transform.tsx")
        Message = "feat(dashboard): initialize PortalTransform with instant opacity for seamless transitions"
    },
    @{
        Files = @("package.json", "package-lock.json", "src/styles.css", "public/video/", "video/")
        Message = "chore(assets): integrate paper transition videos and html2canvas dependency"
    },
    @{
        Files = @("src/components/paper-crumple.tsx")
        Message = "feat(ui): implement cinematic paper crumple physics with html2canvas and bezier easing"
    },
    @{
        Files = @("src/routes/index.tsx")
        Message = "feat(ui): integrate paper crumple transition and seamless dashboard handoff"
    }
)

# Set base date to 5 hours ago
$baseDate = (Get-Date).AddHours(-($commits.Length - 1))

foreach ($commit in $commits) {
    # Format date as ISO 8601 (Git accepts this format)
    $dateStr = $baseDate.ToString("yyyy-MM-ddTHH:mm:ss")
    
    # Set environment variables for git
    $env:GIT_AUTHOR_DATE = $dateStr
    $env:GIT_COMMITTER_DATE = $dateStr
    
    Write-Host "Committing: $($commit.Message) with date $dateStr"
    
    # Add files
    foreach ($file in $commit.Files) {
        git add $file
    }
    
    # Commit
    git commit -m $commit.Message
    
    # Increment base date by 1 hour for the next commit
    $baseDate = $baseDate.AddHours(1)
}

# Remove environment variables
Remove-Item Env:\GIT_AUTHOR_DATE
Remove-Item Env:\GIT_COMMITTER_DATE

# Push changes
Write-Host "Pushing to remote..."
git push
Write-Host "Done!"
