param(
    [string]$RpcUrl = $env:RPC_URL,
    [string]$PrivateKey = $env:PRIVATE_KEY,
    [string]$WalletConnectId = $env:NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID,
    [string]$ApiUrl = $env:NEXT_PUBLIC_API_URL,
    [string]$FrontendPort = "3000",
    [string]$BackendPort = "3001"
)

# --- Helpers ---
function Assert-Command {
    param([string]$Name)
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        Write-Error "Missing required command: $Name" -ErrorAction Stop
    }
}

$RepoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$ContractsDir = Join-Path $RepoRoot "contracts"
$BackendDir = Join-Path $RepoRoot "backend"
$FrontendDir = Join-Path $RepoRoot "sherlock"

Write-Host "Repo root: $RepoRoot" -ForegroundColor Cyan

# --- Requirements ---
Assert-Command "npm"
Assert-Command "forge"

# --- Contracts: build, test, deploy ---
Push-Location $ContractsDir
Write-Host "[contracts] npm not required; using forge" -ForegroundColor Yellow
forge build
forge test -vvv

if ($RpcUrl -and $PrivateKey) {
    Write-Host "[contracts] Deploying with forge script..." -ForegroundColor Yellow
    forge script script/Deploy.s.sol --rpc-url $RpcUrl --private-key $PrivateKey --broadcast
} else {
    Write-Host "[contracts] Skipping deploy (set RPC_URL and PRIVATE_KEY to enable)" -ForegroundColor DarkYellow
}
Pop-Location

# --- Backend: install + run dev ---
Push-Location $BackendDir
if (Test-Path package.json) {
    Write-Host "[backend] npm install" -ForegroundColor Yellow
    npm install
    $env:NEXT_PUBLIC_API_URL = $ApiUrl
    Write-Host "[backend] starting dev server on port $BackendPort" -ForegroundColor Yellow
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd `"$BackendDir`"; $env:PORT=$BackendPort; npm run dev" | Out-Null
} else {
    Write-Host "[backend] package.json not found; skipping" -ForegroundColor DarkYellow
}
Pop-Location

# --- Frontend: install + run dev ---
Push-Location $FrontendDir
if (Test-Path package.json) {
    Write-Host "[frontend] npm install" -ForegroundColor Yellow
    npm install
    if ($WalletConnectId) { $env:NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID = $WalletConnectId }
    if ($ApiUrl) { $env:NEXT_PUBLIC_API_URL = $ApiUrl }
    Write-Host "[frontend] starting dev server on port $FrontendPort" -ForegroundColor Yellow
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd `"$FrontendDir`"; $env:PORT=$FrontendPort; npm run dev" | Out-Null
} else {
    Write-Host "[frontend] package.json not found; skipping" -ForegroundColor DarkYellow
}
Pop-Location

Write-Host "All tasks kicked off. Backends and frontend running in separate PowerShell windows." -ForegroundColor Green
Write-Host "Frontend: http://localhost:$FrontendPort" -ForegroundColor Green
Write-Host "Backend:  http://localhost:$BackendPort" -ForegroundColor Green
