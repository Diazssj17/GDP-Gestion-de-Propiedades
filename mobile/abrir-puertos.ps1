# Abre los puertos de GDP para probar la app desde el celular fisico.
# Ejecutar como ADMINISTRADOR (clic derecho -> Ejecutar con PowerShell como administrador)
New-NetFirewallRule -DisplayName "GDP-Flask-5001" -Direction Inbound -Protocol TCP -LocalPort 5001 -Action Allow
New-NetFirewallRule -DisplayName "GDP-Metro-8081" -Direction Inbound -Protocol TCP -LocalPort 8081 -Action Allow
Write-Host ""
Write-Host "Puertos 5001 y 8081 abiertos." -ForegroundColor Green
Write-Host "Ahora en el celular abre Expo Go y entra a: exp://192.168.1.2:8081" -ForegroundColor Cyan
