Add-Type -AssemblyName PresentationFramework
try {
    [xml]$xaml = (Get-Content -Raw "c:\Users\sacha\Documents\DEVELOPPEMENT\WEB\sachaphoto_blog\new-article.ps1" | Select-String -Pattern '(?s)<Window.*?</Window>').Matches[0].Value
    $reader = (New-Object System.Xml.XmlNodeReader $xaml)
    $window = [Windows.Markup.XamlReader]::Load($reader)
    Write-Host "SUCCESS"
} catch {
    Write-Host "ERROR: $($_.Exception.Message)"
    Write-Host "INNER: $($_.Exception.InnerException.Message)"
    Write-Host "INNERINNER: $($_.Exception.InnerException.InnerException.Message)"
}
