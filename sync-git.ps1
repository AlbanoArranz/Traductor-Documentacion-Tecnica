param(
  [string]$RepoPath = ".",
  [string]$Remote = "origin",
  [string]$Branch = ""
)

$ErrorActionPreference = "Stop"

[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)

function Ensure-Success($Message) {
  if ($LASTEXITCODE -ne 0) { throw $Message }
}

Write-Host "== Git sync ==" -ForegroundColor Cyan
Write-Host "Repo: $RepoPath"

if (-not (Test-Path $RepoPath)) { throw "RepoPath no existe: $RepoPath" }

Push-Location $RepoPath
try {
  git rev-parse --is-inside-work-tree | Out-Null
  Ensure-Success "No es un repo git (o git no está disponible)."

  if ([string]::IsNullOrWhiteSpace($Branch)) {
    $Branch = (git branch --show-current).Trim()
    Ensure-Success "No se pudo detectar la rama actual."
  }

  Write-Host "Remote: $Remote | Branch: $Branch"

  Write-Host "`n1) Fetch..." -ForegroundColor Yellow
  git fetch $Remote
  Ensure-Success "git fetch falló."

  $dirtyBeforePull = (git status --porcelain)
  if (-not [string]::IsNullOrWhiteSpace($dirtyBeforePull)) {
    Write-Host "`nTienes cambios locales sin commitear. Para hacer pull con rebase hay que guardar esos cambios." -ForegroundColor Magenta
    Write-Host "Opciones: [s] stash (recomendado), [c] cancelar" -ForegroundColor Magenta
    $respDirty = Read-Host "¿Qué quieres hacer? (s/c)"
    if ($respDirty -match '^(s|S)$') {
      git stash push -u -m "sync-git auto-stash"
      Ensure-Success "git stash falló."
      $didStash = $true
    } else {
      throw "Cancelado: hay cambios locales sin commitear. Haz commit o stash y reintenta."
    }
  }

  Write-Host "`n2) Pull (rebase)..." -ForegroundColor Yellow
  git pull --rebase $Remote $Branch
  Ensure-Success "git pull --rebase falló. Revisa conflictos."

  if ($didStash) {
    Write-Host "`nRestaurando cambios del stash..." -ForegroundColor Yellow
    git stash pop
    Ensure-Success "git stash pop falló. Resuelve conflictos si los hay."
  }

  Write-Host "`n3) Status..." -ForegroundColor Yellow
  git status

  $porcelain = (git status --porcelain)
  if (-not [string]::IsNullOrWhiteSpace($porcelain)) {
    Write-Host "`nHay cambios locales." -ForegroundColor Magenta

    $resp = Read-Host "¿Quieres hacer commit y push ahora? (s/n)"
    if ($resp -match '^(s|S|si|SI|sí|Sí)$') {
      git add -A
      Ensure-Success "git add falló."

      $msg = Read-Host "Mensaje de commit"
      if ([string]::IsNullOrWhiteSpace($msg)) { throw "Mensaje de commit vacío. Cancelado." }

      git commit -m "$msg"
      Ensure-Success "git commit falló (¿no había cambios staged?)."
    } else {
      Write-Host "No se hace commit. Saliendo sin push." -ForegroundColor Gray
      return
    }
  } else {
    Write-Host "`nNo hay cambios locales que commitear." -ForegroundColor Green
  }

  Write-Host "`n4) Push..." -ForegroundColor Yellow
  git push -u $Remote $Branch
  Ensure-Success "git push falló."

  Write-Host "`nOK: Repo sincronizado (pull + push)." -ForegroundColor Green
}
finally {
  Pop-Location
}
