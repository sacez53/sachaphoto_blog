try {
    . 'c:\Users\sacha\Documents\DEVELOPPEMENT\WEB\sachaphoto_blog\new-article.ps1'
} catch {
    Write-Host "XAML_ERROR: $($_.Exception.Message)"
    Write-Host "INNER_ERROR: $($_.Exception.InnerException.Message)"
    Write-Host "INNER_INNER_ERROR: $($_.Exception.InnerException.InnerException.Message)"
}
