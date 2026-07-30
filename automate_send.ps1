$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms

Write-Host "Waiting for GitHub Actions to complete..."
$completed = $false
while (-not $completed) {
    Start-Sleep -Seconds 15
    try {
        $runs = (Invoke-RestMethod -Uri "https://api.github.com/repos/albinokira-crypto/inicialsistema/actions/runs").workflow_runs
        $latest = $runs | Where-Object { $_.name -match "Build Android" } | Select-Object -First 1
        if ($latest.status -eq "completed") {
            if ($latest.conclusion -eq "success") {
                $completed = $true
            } else {
                Write-Host "Android Build failed!"
                exit
            }
        }
    } catch {
        Write-Host "API error, retrying..."
    }
}

Write-Host "Build completed! Waiting 15 seconds for CDN..."
Start-Sleep -Seconds 15

$url = "https://github.com/albinokira-crypto/inicialsistema/raw/main/VistoriaInicial.apk?v=$(Get-Random)"
$outPath = "$env:USERPROFILE\Desktop\VistoriaInicial.apk"
Write-Host "Downloading APK from $url..."
Invoke-WebRequest -Uri $url -OutFile $outPath
Write-Host "Downloaded successfully."

# Copy to clipboard
$data = New-Object System.Collections.Specialized.StringCollection
$data.Add($outPath) | Out-Null
[System.Windows.Forms.Clipboard]::SetFileDropList($data)

# Launch WhatsApp
Write-Host "Launching WhatsApp..."
Start-Process "whatsapp://"
Start-Sleep -Seconds 12

# Automate keystrokes
Write-Host "Sending keystrokes..."
[System.Windows.Forms.SendKeys]::SendWait("^f")
Start-Sleep -Seconds 2
[System.Windows.Forms.SendKeys]::SendWait("Sr Diego")
Start-Sleep -Seconds 3
[System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
Start-Sleep -Seconds 3
[System.Windows.Forms.SendKeys]::SendWait("^v")
Start-Sleep -Seconds 4
[System.Windows.Forms.SendKeys]::SendWait("{ENTER}")

Write-Host "Sent! Waiting 30 seconds for upload..."
Start-Sleep -Seconds 30


