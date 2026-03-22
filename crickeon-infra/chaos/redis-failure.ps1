$ErrorActionPreference = 'Stop'

Write-Host "Injecting redis failure for 45 seconds..."

docker stop lamcl-redis-1
Start-Sleep -Seconds 45
docker start lamcl-redis-1

Write-Host "Redis restored. Validate recovery metrics and websocket reconnect rates."
