# ============================================================
# new-article.ps1 - Utilitaire de gestion des articles (Version Graphique / WPF)
# Usage : double-cliquer sur new-article.bat
# ============================================================

Add-Type -AssemblyName PresentationFramework
Add-Type -AssemblyName PresentationCore

# --- Fonctions utilitaires ---

function ConvertTo-Slug($text) {
    if ([string]::IsNullOrWhiteSpace($text)) { return "" }
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
        if ([string]::IsNullOrWhiteSpace($content)) { return @() }
        $list = $content | ConvertFrom-Json
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

# --- Design XAML ---
[xml]$xaml = @"
<Window xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="Gestionnaire d'articles - Blog" Height="500" Width="640"
        WindowStartupLocation="CenterScreen"
        FontFamily="Segoe UI Variable Display, Segoe UI" FontSize="14"
        Background="#F3F3F3">
    <Window.Resources>
        <!-- Windows 11 Fluent Button -->
        <Style TargetType="Button">
            <Setter Property="Padding" Value="16,8"/>
            <Setter Property="Background" Value="#005FB8"/>
            <Setter Property="Foreground" Value="White"/>
            <Setter Property="BorderThickness" Value="1"/>
            <Setter Property="BorderBrush" Value="#00000000"/>
            <Setter Property="Cursor" Value="Hand"/>
            <Setter Property="FontWeight" Value="SemiBold"/>
            <Setter Property="Template">
                <Setter.Value>
                    <ControlTemplate TargetType="Button">
                        <Border Background="{TemplateBinding Background}" CornerRadius="4" BorderBrush="{TemplateBinding BorderBrush}" BorderThickness="{TemplateBinding BorderThickness}">
                            <ContentPresenter HorizontalAlignment="Center" VerticalAlignment="Center"/>
                        </Border>
                    </ControlTemplate>
                </Setter.Value>
            </Setter>
            <Style.Triggers>
                <Trigger Property="IsMouseOver" Value="True">
                    <Setter Property="Background" Value="#0055A5"/>
                </Trigger>
                <Trigger Property="IsPressed" Value="True">
                    <Setter Property="Background" Value="#004A8F"/>
                </Trigger>
            </Style.Triggers>
        </Style>

        <!-- Secondary Button (Danger) -->
        <Style x:Key="DangerButton" TargetType="Button" BasedOn="{StaticResource {x:Type Button}}">
            <Setter Property="Background" Value="#C42B1C"/>
            <Style.Triggers>
                <Trigger Property="IsMouseOver" Value="True">
                    <Setter Property="Background" Value="#B12417"/>
                </Trigger>
                <Trigger Property="IsPressed" Value="True">
                    <Setter Property="Background" Value="#9F2015"/>
                </Trigger>
            </Style.Triggers>
        </Style>

        <!-- Fluent TextBox -->
        <Style TargetType="TextBox">
            <Setter Property="Padding" Value="10,6"/>
            <Setter Property="BorderBrush" Value="#E5E5E5"/>
            <Setter Property="BorderThickness" Value="1,1,1,2"/>
            <Setter Property="Background" Value="#FFFFFF"/>
            <Setter Property="Template">
                <Setter.Value>
                    <ControlTemplate TargetType="TextBox">
                        <Border Background="{TemplateBinding Background}" BorderBrush="{TemplateBinding BorderBrush}" BorderThickness="{TemplateBinding BorderThickness}" CornerRadius="4">
                            <ScrollViewer x:Name="PART_ContentHost"/>
                        </Border>
                    </ControlTemplate>
                </Setter.Value>
            </Setter>
            <Style.Triggers>
                <Trigger Property="IsFocused" Value="True">
                    <Setter Property="BorderBrush" Value="#005FB8"/>
                </Trigger>
            </Style.Triggers>
        </Style>

        <!-- Fluent ComboBox -->
        <Style TargetType="ComboBox">
            <Setter Property="Padding" Value="10,6"/>
            <Setter Property="BorderBrush" Value="#E5E5E5"/>
            <Setter Property="BorderThickness" Value="1,1,1,2"/>
            <Setter Property="Background" Value="#FFFFFF"/>
        </Style>

        <!-- TabControl Fluent Style -->
        <Style TargetType="TabControl">
            <Setter Property="Background" Value="Transparent"/>
            <Setter Property="BorderThickness" Value="0"/>
        </Style>
        <Style TargetType="TabItem">
            <Setter Property="Padding" Value="12,8"/>
            <Setter Property="FontSize" Value="14"/>
            <Setter Property="Background" Value="Transparent"/>
            <Setter Property="BorderThickness" Value="0"/>
            <Setter Property="Foreground" Value="#666666"/>
            <Setter Property="Template">
                <Setter.Value>
                    <ControlTemplate TargetType="TabItem">
                        <Border Background="{TemplateBinding Background}" CornerRadius="4" Padding="{TemplateBinding Padding}" Margin="2,0">
                            <ContentPresenter ContentSource="Header"/>
                        </Border>
                    </ControlTemplate>
                </Setter.Value>
            </Setter>
            <Style.Triggers>
                <Trigger Property="IsSelected" Value="True">
                    <Setter Property="Foreground" Value="#000000"/>
                    <Setter Property="FontWeight" Value="SemiBold"/>
                    <Setter Property="Background" Value="#FFFFFF"/>
                </Trigger>
                <Trigger Property="IsMouseOver" Value="True">
                    <Setter Property="Background" Value="#EAEAEA"/>
                </Trigger>
                <MultiTrigger>
                    <MultiTrigger.Conditions>
                        <Condition Property="IsSelected" Value="True"/>
                        <Condition Property="IsMouseOver" Value="True"/>
                    </MultiTrigger.Conditions>
                    <Setter Property="Background" Value="#FFFFFF"/>
                </MultiTrigger>
            </Style.Triggers>
        </Style>
    </Window.Resources>

    <Grid Margin="10,10,10,0">
        <TabControl>
            <!-- ONGLET 1: CRÉER -->
            <TabItem Header="Nouveau">
                <Border Background="#FFFFFF" CornerRadius="8" BorderBrush="#E5E5E5" BorderThickness="1" Margin="0,10,0,10" Padding="24">
                    <Grid>
                        <Grid.RowDefinitions>
                            <RowDefinition Height="Auto"/>
                            <RowDefinition Height="Auto"/>
                            <RowDefinition Height="Auto"/>
                            <RowDefinition Height="Auto"/>
                            <RowDefinition Height="Auto"/>
                            <RowDefinition Height="Auto"/>
                            <RowDefinition Height="*"/>
                        </Grid.RowDefinitions>

                        <TextBlock Text="Cr&#xE9;er un nouvel article" FontSize="24" FontWeight="SemiBold" Margin="0,0,0,24" Foreground="#1A1A1A"/>

                        <TextBlock Grid.Row="1" Text="Titre de l'article" Margin="0,0,0,6" Foreground="#1A1A1A" FontWeight="SemiBold"/>
                        <TextBox Grid.Row="2" Name="TxtTitle" Margin="0,0,0,20" FontSize="14" />

                        <TextBlock Grid.Row="3" Text="Auteur" Margin="0,0,0,6" Foreground="#1A1A1A" FontWeight="SemiBold"/>
                        <TextBox Grid.Row="4" Name="TxtAuthor" Margin="0,0,0,20" Text="Sacha GUITTER" FontSize="14" />

                        <CheckBox Grid.Row="5" Name="ChkFeatured" Content="Mettre cet article &#xE0; la une" Margin="0,0,0,24" FontSize="14" />

                        <StackPanel Grid.Row="6" Orientation="Horizontal" VerticalAlignment="Top">
                            <Button Name="BtnCreate" Content="Cr&#xE9;er l'article" Width="160" />
                        </StackPanel>

                        <TextBlock Grid.Row="6" Name="TxtCreateMsg" Foreground="#0F7B0F" VerticalAlignment="Bottom" TextWrapping="Wrap" FontWeight="SemiBold" />
                    </Grid>
                </Border>
            </TabItem>

            <!-- ONGLET 2: SUPPRIMER -->
            <TabItem Header="Supprimer">
                <Border Background="#FFFFFF" CornerRadius="8" BorderBrush="#E5E5E5" BorderThickness="1" Margin="0,10,0,10" Padding="24">
                    <Grid>
                        <Grid.RowDefinitions>
                            <RowDefinition Height="Auto"/>
                            <RowDefinition Height="Auto"/>
                            <RowDefinition Height="Auto"/>
                            <RowDefinition Height="*"/>
                        </Grid.RowDefinitions>

                        <TextBlock Text="Supprimer un article" FontSize="24" FontWeight="SemiBold" Margin="0,0,0,24" Foreground="#1A1A1A"/>

                        <TextBlock Grid.Row="1" Text="S&#xE9;lectionnez un article &#xE0; supprimer" Margin="0,0,0,6" Foreground="#1A1A1A" FontWeight="SemiBold"/>
                        <ComboBox Grid.Row="2" Name="CmbArticles" Margin="0,0,0,24" DisplayMemberPath="title" FontSize="14" />

                        <StackPanel Grid.Row="3" Orientation="Horizontal" VerticalAlignment="Top">
                            <Button Name="BtnDelete" Content="Supprimer" Width="140" Style="{StaticResource DangerButton}" />
                        </StackPanel>

                        <TextBlock Grid.Row="3" Name="TxtDeleteMsg" Foreground="#0F7B0F" VerticalAlignment="Bottom" TextWrapping="Wrap" FontWeight="SemiBold" />
                    </Grid>
                </Border>
            </TabItem>

            <!-- ONGLET 3: SYNCHRONISER -->
            <TabItem Header="Synchroniser">
                <Border Background="#FFFFFF" CornerRadius="8" BorderBrush="#E5E5E5" BorderThickness="1" Margin="0,10,0,10" Padding="24">
                    <Grid>
                        <Grid.RowDefinitions>
                            <RowDefinition Height="Auto"/>
                            <RowDefinition Height="Auto"/>
                            <RowDefinition Height="*"/>
                        </Grid.RowDefinitions>

                        <TextBlock Text="Synchroniser articles.json" FontSize="24" FontWeight="SemiBold" Margin="0,0,0,12" Foreground="#1A1A1A"/>
                        <TextBlock Grid.Row="1" Text="R&#xE9;g&#xE9;n&#xE8;re le fichier de configuration principal &#xE0; partir des articles existants." TextWrapping="Wrap" Margin="0,0,0,24" Foreground="#5D5D5D"/>

                        <StackPanel Grid.Row="2" VerticalAlignment="Top">
                            <Button Name="BtnSync" Content="Lancer la synchronisation" Width="220" HorizontalAlignment="Left" Margin="0,0,0,20" />
                            <TextBox Name="TxtSyncLog" IsReadOnly="True" Height="140" VerticalScrollBarVisibility="Auto" AcceptsReturn="True" TextWrapping="Wrap" FontFamily="Consolas" FontSize="13" Background="#F9F9F9" BorderBrush="#E5E5E5" BorderThickness="1"/>
                        </StackPanel>
                    </Grid>
                </Border>
            </TabItem>
        </TabControl>
    </Grid>
</Window>
"@

$reader = (New-Object System.Xml.XmlNodeReader $xaml)
try {
    $window = [Windows.Markup.XamlReader]::Load($reader)
} catch {
    Write-Host "Erreur de chargement XAML : $_"
    exit
}

# --- Variables Globales GUI ---
$TxtTitle = $window.FindName("TxtTitle")
$TxtAuthor = $window.FindName("TxtAuthor")
$ChkFeatured = $window.FindName("ChkFeatured")
$BtnCreate = $window.FindName("BtnCreate")
$TxtCreateMsg = $window.FindName("TxtCreateMsg")

$CmbArticles = $window.FindName("CmbArticles")
$BtnDelete = $window.FindName("BtnDelete")
$TxtDeleteMsg = $window.FindName("TxtDeleteMsg")

$BtnSync = $window.FindName("BtnSync")
$TxtSyncLog = $window.FindName("TxtSyncLog")

# --- Methodes ---

function Refresh-ArticlesDropdown {
    $list = Read-ArticlesList
    $CmbArticles.ItemsSource = $list
    if ($list.Count -gt 0) {
        $CmbArticles.SelectedIndex = 0
    }
}

# Creation d'article
$BtnCreate.Add_Click({
    $title = $TxtTitle.Text.Trim()
    $author = $TxtAuthor.Text.Trim()
    $isFeatured = $ChkFeatured.IsChecked -eq $true

    if ([string]::IsNullOrEmpty($title)) {
        $TxtCreateMsg.Foreground = "Red"
        $TxtCreateMsg.Text = "Erreur : Le titre ne peut pas etre vide."
        return
    }
    if ([string]::IsNullOrEmpty($author)) {
        $TxtCreateMsg.Foreground = "Red"
        $TxtCreateMsg.Text = "Erreur : L'auteur ne peut pas etre vide."
        return
    }

    $slug = ConvertTo-Slug $title
    $articlePath = "data\articles\$slug.json"

    if (Test-Path $articlePath) {
        $result = [System.Windows.MessageBox]::Show("Un article avec ce nom existe deja. Ecraser ?", "Attention", [System.Windows.MessageBoxButton]::YesNo, [System.Windows.MessageBoxImage]::Warning)
        if ($result -ne [System.Windows.MessageBoxResult]::Yes) {
            $TxtCreateMsg.Foreground = "#FFB900"
            $TxtCreateMsg.Text = "Creation annulee."
            return
        }
    }

    $list = Read-ArticlesList
    $currentFeatured = Get-FeaturedArticle $list

    if ($isFeatured -and $null -ne $currentFeatured) {
        foreach ($a in $list) {
            if ($a.slug -eq $currentFeatured.slug) {
                $a.featured = $false
                $a.important = $false
            }
        }
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

    $roundedDate = Get-RoundedDate
    $dateStr = $roundedDate.ToString('yyyy-MM-ddTHH:mm')

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

    $TxtCreateMsg.Foreground = "Green"
    $TxtCreateMsg.Text = "[OK] Article '$title' cree avec succes !`r`nN'oubliez pas d'ajouter l'image assets/images/$slug.png"
    $TxtTitle.Text = ""
    Refresh-ArticlesDropdown
})

# Suppression d'article
$BtnDelete.Add_Click({
    $target = $CmbArticles.SelectedItem
    if ($null -eq $target) {
        $TxtDeleteMsg.Foreground = "Red"
        $TxtDeleteMsg.Text = "Erreur : Aucun article selectionne."
        return
    }

    $result = [System.Windows.MessageBox]::Show("Voulez-vous vraiment supprimer '$($target.title)' ?", "Confirmation", [System.Windows.MessageBoxButton]::YesNo, [System.Windows.MessageBoxImage]::Warning)
    if ($result -ne [System.Windows.MessageBoxResult]::Yes) {
        $TxtDeleteMsg.Foreground = "#FFB900"
        $TxtDeleteMsg.Text = "Suppression annulee."
        return
    }

    $list = Read-ArticlesList
    $wasFeatured = ($target.important -eq $true -or $target.featured -eq $true)
    $targetSlug = $target.slug

    $jsonPath = "data\articles\$targetSlug.json"
    if (Test-Path $jsonPath) { Remove-Item $jsonPath -Force }

    $extensions = @('.png', '.jpg', '.jpeg', '.webp', '.gif')
    if ($target.image -and (Test-Path $target.image)) {
        Remove-Item $target.image -Force
    } else {
        foreach ($ext in $extensions) {
            $imgPath = "assets\images\$targetSlug$ext"
            if (Test-Path $imgPath) {
                Remove-Item $imgPath -Force
                break
            }
        }
    }

    $newList = [System.Collections.ArrayList]@($list | Where-Object { $_.slug -ne $targetSlug })

    if ($wasFeatured -and $newList.Count -gt 0) {
        $sorted = $newList | Sort-Object { [DateTime]$_.date } -Descending
        $promoted = $sorted[0]

        foreach ($a in $newList) {
            if ($a.slug -eq $promoted.slug) {
                $a.featured = $true
                $a.important = $true
            }
        }
        $promoPath = "data\articles\$($promoted.slug).json"
        if (Test-Path $promoPath) {
            $promoContent = [System.IO.File]::ReadAllText((Resolve-Path $promoPath).Path, [System.Text.UTF8Encoding]::new($false))
            $promoArticle = $promoContent | ConvertFrom-Json
            $promoArticle.featured = $true
            $promoArticle.important = $true
            Write-Utf8 $promoPath ($promoArticle | ConvertTo-Json -Depth 10)
        }
    }

    Save-ArticlesList $newList
    $TxtDeleteMsg.Foreground = "Green"
    $TxtDeleteMsg.Text = "[OK] Article supprime avec succes."
    Refresh-ArticlesDropdown
})

# Synchronisation
$BtnSync.Add_Click({
    $articlesDir = Join-Path (Get-Location) 'data\articles'
    if (-not (Test-Path $articlesDir)) {
        $TxtSyncLog.Text = "Aucun dossier data\articles trouve."
        return
    }

    $jsonFiles = Get-ChildItem -Path $articlesDir -Filter '*.json' -File
    if ($jsonFiles.Count -eq 0) {
        Save-ArticlesList @()
        $TxtSyncLog.Text = "Aucun fichier JSON trouve. articles.json vide."
        Refresh-ArticlesDropdown
        return
    }

    $oldList = Read-ArticlesList
    $oldMap = @{}
    foreach ($a in $oldList) { $oldMap[$a.slug] = $a }

    $newList = [System.Collections.ArrayList]::new()
    $logs = @()

    foreach ($file in $jsonFiles) {
        try {
            $content = [System.IO.File]::ReadAllText($file.FullName, [System.Text.UTF8Encoding]::new($false))
            $article = $content | ConvertFrom-Json

            $entry = [ordered]@{
                slug      = $article.slug
                title     = $article.title
                author    = $article.author
                date      = $article.date
                featured  = [bool]$article.featured
                important = [bool]$article.important
                excerpt   = $article.excerpt
                image     = $article.image
            }
            $newList.Add($entry) | Out-Null

            $slug = $article.slug
            if ($oldMap.ContainsKey($slug)) {
                $old = $oldMap[$slug]
                $changes = @()
                if ($old.title -ne $article.title) { $changes += "titre" }
                if ($old.date -ne $article.date) { $changes += "date" }
                if ($changes.Count -gt 0) {
                    $logs += "~ $($article.title) mis a jour."
                }
            } else {
                $logs += "+ $($article.title) ajoute."
            }
        } catch {
            $logs += "! Erreur sur $($file.Name): $($_.Exception.Message)"
        }
    }

    $newSlugs = $newList | ForEach-Object { $_.slug }
    foreach ($slug in $oldMap.Keys) {
        if ($slug -notin $newSlugs) {
            $logs += "- $($oldMap[$slug].title) retire."
        }
    }

    Save-ArticlesList $newList
    if ($logs.Count -eq 0) {
        $TxtSyncLog.Text = "Tout est deja a jour. ($($newList.Count) articles)"
    } else {
        $TxtSyncLog.Text = ($logs -join "`r`n") + "`r`n`r`nSynchronisation terminee ($($newList.Count) articles)."
    }
    Refresh-ArticlesDropdown
})

# Initialisation
$window.Add_Loaded({
    Refresh-ArticlesDropdown
})

# Lancement
$window.ShowDialog() | Out-Null
