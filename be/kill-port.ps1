# Kill process dang dung port (mac dinh 3000)
param([int]$Port = 3000)

$connections = netstat -ano | Select-String ":$Port\s" | Select-String "LISTENING"
if (-not $connections) {
    Write-Host "No process found on port $Port"
    exit 0
}

$pids = $connections | ForEach-Object {
    ($_ -split '\s+')[-1]
} | Sort-Object -Unique

foreach ($pid in $pids) {
    if ($pid -match '^\d+$') {
        $proc = Get-Process -Id $pid -ErrorAction SilentlyContinue
        Write-Host "Killing PID $pid ($($proc.ProcessName))..."
        taskkill /PID $pid /F
    }
}
Write-Host "Port $Port is now free."
