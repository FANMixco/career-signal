$ErrorActionPreference = "Stop"

$requiredVariables = @(
  "WINDOWS_STORE_IDENTITY_NAME",
  "WINDOWS_STORE_PUBLISHER",
  "WINDOWS_STORE_PUBLISHER_DISPLAY_NAME"
)

$missingVariables = $requiredVariables | Where-Object {
  -not [Environment]::GetEnvironmentVariable($_, "Process")
}

if ($missingVariables.Count -gt 0) {
  throw "Missing Microsoft Store package identity environment values. Copy them from Partner Center > Product identity into your local shell before running this script."
}

Write-Host "Building Microsoft Store package from local Partner Center identity values."
npm run desktop:store
