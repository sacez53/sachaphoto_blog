# ============================================================
# new-article.ps1 — Utilitaire de gestion des articles du blog
# Usage : .\new-article.ps1   ou   double-cliquer sur new-article.bat
# ============================================================

# --- Fonctions utilitaires ---

function ConvertTo-Slug($text) {
    $normalized = $text.Normalize([System.Text.NormalizationForm]::FormD)
    $slug = ''
    foreach ($char in $normalized.ToCharArray()) {
        $category = [System.Globalization.CharUnicodeInfo]::GetUnicodeCategory($char)
        if ($category -ne [System.Globalization.UnicodeCategory]::NonSpacingMark) {
            $slug += $char
        }
    }
    $slug = $slug.ToLower()
    $slug = $slug -replace '[^a-z0-9\s-]', ''
    $slug = $slug.Trim() -replace '\s+', '-'
    $slug = $slug -replace '-{2,}', '-'
    return $slug
}

function Get-RoundedDate {
    $now = Get-Date
    $totalMinutes = $now.Hour * 60 + $now.Minute
    $rounded = [Math]::Round($totalMinutes / 15) * 15
    $hours = [Math]::Floor($rounded / 60)
    $minutes = $rounded % 60
    if ($hours -ge 24) { $hours = 0 }
    return $now.Date.AddHours($hours).AddMinutes($minutes)
}

function Write-Utf8($path, $content) {
    $fullPath = Join-Path (Get-Location) $path
    $dir = Split-Path $fullPath -Parent
    if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
    [System.IO.File]::WriteAllText($fullPath, $content, [System.Text.UTF8Encoding]::new($false))
}

function Read-ArticlesList {
    $listPath = Join-Path (Get-Location) 'data\articles.json'
    if (Test-Path $listPath) {
        $content = [System.IO.File]::ReadAllText($listPath, [System.Text.UTF8Encoding]::new($false))
        $list = $content | ConvertFrom-Json
        # Garantir que c'est un tableau
        if ($null -eq $list) { return @() }
        if ($list -isnot [System.Array]) { return @($list) }
        return $list
    }
    return @()
}

function Save-ArticlesList($list) {
    $json = ConvertTo-Json -InputObject @($list) -Depth 10
    Write-Utf8 'data\articles.json' $json
}

function Get-FeaturedArticle($list) {
    foreach ($a in $list) {
        if ($a.important -eq $true -or $a.featured -eq $true) { return $a }
    }
    return $null
}

function Show-Separator {
    Write-Host '  ----------------------------------------' -ForegroundColor DarkGray
}

# ============================================================
#  CREER UN ARTICLE
# ============================================================
function New-Article {
    Write-Host ''
    Write-Host '  === Creer un article ===' -ForegroundColor Cyan
    Write-Host ''

    # Titre
    do {
        $title = Read-Host '  Titre'
        if ([string]::IsNullOrWhiteSpace($title)) {
            Write-Host '  Le titre ne peut pas etre vide.' -ForegroundColor Yellow
        }
    } while ([string]::IsNullOrWhiteSpace($title))

    $slug = ConvertTo-Slug $title
    Write-Host "  Slug : $slug" -ForegroundColor DarkGray

    # Vérifier doublon
    $articlePath = "data\articles\$slug.json"
    if (Test-Path $articlePath) {
        Write-Host "  Attention : un article avec le slug '$slug' existe deja." -ForegroundColor Red
        $overwrite = Read-Host '  Ecraser ? (o/n)'
        if ($overwrite.ToLower() -ne 'o') {
            Write-Host '  Annule.' -ForegroundColor Yellow
            return
        }
    }

    # Auteur
    do {
        $author = Read-Host '  Auteur'
        if ([string]::IsNullOrWhiteSpace($author)) {
            Write-Host '  L''auteur ne peut pas etre vide.' -ForegroundColor Yellow
        }
    } while ([string]::IsNullOrWhiteSpace($author))

    # A la une ?
    $list = Read-ArticlesList
    $currentFeatured = Get-FeaturedArticle $list

    Write-Host ''
    if ($null -ne $currentFeatured) {
        Write-Host "  Actuellement a la une : `"$($currentFeatured.title)`"" -ForegroundColor Magenta
    } else {
        Write-Host '  Aucun article a la une actuellement.' -ForegroundColor DarkGray
    }

    $featuredInput = Read-Host '  Mettre ce nouvel article a la une ? (o/n)'
    $isFeatured = ($featuredInput.ToLower() -eq 'o')

    # Si on met à la une, retirer l'ancien
    if ($isFeatured -and $null -ne $currentFeatured) {
        Write-Host "  `"$($currentFeatured.title)`" ne sera plus a la une." -ForegroundColor DarkGray
        foreach ($a in $list) {
            if ($a.slug -eq $currentFeatured.slug) {
                $a.featured = $false
                $a.important = $false
            }
        }
        # Mettre aussi à jour le JSON individuel de l'ancien article
        $oldPath = "data\articles\$($currentFeatured.slug).json"
        if (Test-Path $oldPath) {
            $oldContent = [System.IO.File]::ReadAllText((Resolve-Path $oldPath).Path, [System.Text.UTF8Encoding]::new($false))
            $oldArticle = $oldContent | ConvertFrom-Json
            $oldArticle.featured = $false
            $oldArticle.important = $false
            $oldJson = $oldArticle | ConvertTo-Json -Depth 10
            Write-Utf8 $oldPath $oldJson
        }
    }

    # Date arrondie
    $roundedDate = Get-RoundedDate
    $dateStr = $roundedDate.ToString('yyyy-MM-ddTHH:mm')
    Write-Host "  Date : $dateStr" -ForegroundColor DarkGray

    # Créer le JSON de l'article
    $articleObj = [ordered]@{
        slug      = $slug
        title     = $title
        author    = $author
        date      = $dateStr
        featured  = $isFeatured
        important = $isFeatured
        excerpt   = "A completer."
        image     = "assets/images/$slug.png"
        content   = @(
            [ordered]@{
                type = 'paragraph'
                text = 'A completer.'
            }
        )
    }
    Write-Utf8 $articlePath ($articleObj | ConvertTo-Json -Depth 10)

    # Mettre à jour articles.json
    $list = [System.Collections.ArrayList]@($list | Where-Object { $_.slug -ne $slug })
    $newEntry = [ordered]@{
        slug      = $slug
        title     = $title
        author    = $author
        date      = $dateStr
        featured  = $isFeatured
        important = $isFeatured
        excerpt   = "A completer."
        image     = "assets/images/$slug.png"
    }
    $list.Add($newEntry) | Out-Null
    Save-ArticlesList $list

    # Résumé
    Write-Host ''
    Write-Host '  Article cree avec succes !' -ForegroundColor Green
    Write-Host "  Fichier : $articlePath" -ForegroundColor DarkGray
    Show-Separator
    Write-Host '  Prochaines etapes :'
    Write-Host "    1. Ajoutez l'image : assets/images/$slug.png"
    Write-Host "    2. Completez l'extrait (excerpt) dans data\articles.json"
    Write-Host "    3. Completez le contenu (content) dans $articlePath"
    Write-Host ''
}

# ============================================================
#  SUPPRIMER UN ARTICLE
# ============================================================
function Remove-Article {
    Write-Host ''
    Write-Host '  === Supprimer un article ===' -ForegroundColor Cyan
    Write-Host ''

    $list = Read-ArticlesList

    if ($list.Count -eq 0) {
        Write-Host '  Aucun article a supprimer.' -ForegroundColor Yellow
        return
    }

    # Afficher la liste
    for ($i = 0; $i -lt $list.Count; $i++) {
        $a = $list[$i]
        $label = "  $($i + 1). $($a.title)"
        if ($a.important -eq $true -or $a.featured -eq $true) {
            $label += ' [A LA UNE]'
            Write-Host $label -ForegroundColor Magenta
        } else {
            Write-Host $label
        }
    }

    Write-Host ''
    $choice = Read-Host "  Numero de l'article a supprimer (ou 'q' pour annuler)"
    if ($choice.ToLower() -eq 'q') { return }

    $index = 0
    if (-not [int]::TryParse($choice, [ref]$index)) {
        Write-Host '  Numero invalide.' -ForegroundColor Red
        return
    }
    $index = $index - 1

    if ($index -lt 0 -or $index -ge $list.Count) {
        Write-Host '  Numero hors limites.' -ForegroundColor Red
        return
    }

    $target = $list[$index]
    Write-Host ''
    Write-Host "  Supprimer `"$($target.title)`" ?" -ForegroundColor Yellow
    $confirm = Read-Host '  Confirmer (o/n)'
    if ($confirm.ToLower() -ne 'o') {
        Write-Host '  Annule.' -ForegroundColor Yellow
        return
    }

    $wasFeatured = ($target.important -eq $true -or $target.featured -eq $true)
    $targetSlug = $target.slug

    # Supprimer le fichier JSON
    $jsonPath = "data\articles\$targetSlug.json"
    if (Test-Path $jsonPath) {
        Remove-Item $jsonPath -Force
        Write-Host "  Supprime : $jsonPath" -ForegroundColor DarkGray
    }

    # Supprimer l'image (essayer plusieurs extensions)
    $extensions = @('.png', '.jpg', '.jpeg', '.webp', '.gif')
    # D'abord essayer le chemin exact de l'article
    if ($target.image -and (Test-Path $target.image)) {
        Remove-Item $target.image -Force
        Write-Host "  Supprime : $($target.image)" -ForegroundColor DarkGray
    } else {
        foreach ($ext in $extensions) {
            $imgPath = "assets\images\$targetSlug$ext"
            if (Test-Path $imgPath) {
                Remove-Item $imgPath -Force
                Write-Host "  Supprime : $imgPath" -ForegroundColor DarkGray
                break
            }
        }
    }

    # Retirer de la liste
    $newList = [System.Collections.ArrayList]@($list | Where-Object { $_.slug -ne $targetSlug })

    # Si c'était l'article à la une, promouvoir le plus récent
    if ($wasFeatured -and $newList.Count -gt 0) {
        # Trier par date décroissante
        $sorted = $newList | Sort-Object { [DateTime]$_.date } -Descending
        $promoted = $sorted[0]

        foreach ($a in $newList) {
            if ($a.slug -eq $promoted.slug) {
                $a.featured = $true
                $a.important = $true
            }
        }

        # Mettre à jour le JSON individuel du promu
        $promoPath = "data\articles\$($promoted.slug).json"
        if (Test-Path $promoPath) {
            $promoContent = [System.IO.File]::ReadAllText((Resolve-Path $promoPath).Path, [System.Text.UTF8Encoding]::new($false))
            $promoArticle = $promoContent | ConvertFrom-Json
            $promoArticle.featured = $true
            $promoArticle.important = $true
            $promoJson = $promoArticle | ConvertTo-Json -Depth 10
            Write-Utf8 $promoPath $promoJson
        }

        Write-Host ''
        Write-Host "  Nouvel article a la une : `"$($promoted.title)`"" -ForegroundColor Magenta
    }

    Save-ArticlesList $newList

    Write-Host ''
    Write-Host '  Article supprime avec succes.' -ForegroundColor Green
    Write-Host ''
}

# ============================================================
#  MENU PRINCIPAL
# ============================================================
function Show-Menu {
    while ($true) {
        Write-Host ''
        Write-Host '  ========================================' -ForegroundColor Cyan
        Write-Host '       Gestionnaire d''articles — Blog'      -ForegroundColor Cyan
        Write-Host '  ========================================' -ForegroundColor Cyan
        Write-Host ''
        Write-Host '  1. Creer un article'
        Write-Host '  2. Supprimer un article'
        Write-Host '  3. Quitter'
        Write-Host ''

        $choice = Read-Host '  Choix'

        switch ($choice) {
            '1' { New-Article }
            '2' { Remove-Article }
            '3' {
                Write-Host ''
                Write-Host '  A bientot !' -ForegroundColor Cyan
                Write-Host ''
                return
            }
            default {
                Write-Host '  Choix invalide.' -ForegroundColor Yellow
            }
        }
    }
}

# Lancer le menu
Show-Menu
