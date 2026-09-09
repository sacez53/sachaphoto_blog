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
        Title="Blog Workspace - Sachaphoto" Height="650" Width="1000"
        WindowStartupLocation="CenterScreen"
        FontFamily="Segoe UI Variable Display, Segoe UI, sans-serif" FontSize="15">
    <Window.Background>
        <LinearGradientBrush StartPoint="0,0" EndPoint="1,1">
            <GradientStop Color="#F3F6F9" Offset="0"/>
            <GradientStop Color="#FFFFFF" Offset="0.5"/>
            <GradientStop Color="#F3F6F9" Offset="1"/>
        </LinearGradientBrush>
    </Window.Background>
    
    <Window.Resources>
        <!-- Fluent Primary Button -->
        <Style TargetType="Button">
            <Setter Property="Padding" Value="24,12"/>
            <Setter Property="Background">
                <Setter.Value>
                    <LinearGradientBrush StartPoint="0,0" EndPoint="0,1">
                        <GradientStop Color="#0078D4" Offset="0"/>
                        <GradientStop Color="#005A9E" Offset="1"/>
                    </LinearGradientBrush>
                </Setter.Value>
            </Setter>
            <Setter Property="Foreground" Value="White"/>
            <Setter Property="BorderThickness" Value="1"/>
            <Setter Property="BorderBrush" Value="#00000000"/>
            <Setter Property="Cursor" Value="Hand"/>
            <Setter Property="FontWeight" Value="SemiBold"/>
            <Setter Property="Template">
                <Setter.Value>
                    <ControlTemplate TargetType="Button">
                        <Border Background="{TemplateBinding Background}" CornerRadius="6" BorderBrush="{TemplateBinding BorderBrush}" BorderThickness="{TemplateBinding BorderThickness}">
                            <Border.Effect>
                                <DropShadowEffect Color="#0078D4" Direction="270" ShadowDepth="2" BlurRadius="8" Opacity="0.3"/>
                            </Border.Effect>
                            <ContentPresenter HorizontalAlignment="Center" VerticalAlignment="Center"/>
                        </Border>
                    </ControlTemplate>
                </Setter.Value>
            </Setter>
            <Style.Triggers>
                <Trigger Property="IsMouseOver" Value="True">
                    <Setter Property="Opacity" Value="0.9"/>
                </Trigger>
                <Trigger Property="IsPressed" Value="True">
                    <Setter Property="Opacity" Value="0.8"/>
                </Trigger>
            </Style.Triggers>
        </Style>

        <!-- Danger Button -->
        <Style x:Key="DangerButton" TargetType="Button" BasedOn="{StaticResource {x:Type Button}}">
            <Setter Property="Background">
                <Setter.Value>
                    <LinearGradientBrush StartPoint="0,0" EndPoint="0,1">
                        <GradientStop Color="#D13438" Offset="0"/>
                        <GradientStop Color="#A4262C" Offset="1"/>
                    </LinearGradientBrush>
                </Setter.Value>
            </Setter>
            <Setter Property="Template">
                <Setter.Value>
                    <ControlTemplate TargetType="Button">
                        <Border Background="{TemplateBinding Background}" CornerRadius="6" BorderBrush="{TemplateBinding BorderBrush}" BorderThickness="{TemplateBinding BorderThickness}">
                            <Border.Effect>
                                <DropShadowEffect Color="#D13438" Direction="270" ShadowDepth="2" BlurRadius="8" Opacity="0.3"/>
                            </Border.Effect>
                            <ContentPresenter HorizontalAlignment="Center" VerticalAlignment="Center"/>
                        </Border>
                    </ControlTemplate>
                </Setter.Value>
            </Setter>
        </Style>

        <!-- Fluent TextBox -->
        <Style TargetType="TextBox">
            <Setter Property="Padding" Value="12,10"/>
            <Setter Property="BorderBrush" Value="#E5E5E5"/>
            <Setter Property="BorderThickness" Value="1,1,1,2"/>
            <Setter Property="Background" Value="#FCFCFC"/>
            <Setter Property="Template">
                <Setter.Value>
                    <ControlTemplate TargetType="TextBox">
                        <Border Background="{TemplateBinding Background}" BorderBrush="{TemplateBinding BorderBrush}" BorderThickness="{TemplateBinding BorderThickness}" CornerRadius="6">
                            <ScrollViewer x:Name="PART_ContentHost"/>
                        </Border>
                    </ControlTemplate>
                </Setter.Value>
            </Setter>
            <Style.Triggers>
                <Trigger Property="IsFocused" Value="True">
                    <Setter Property="BorderBrush" Value="#0078D4"/>
                    <Setter Property="Background" Value="#FFFFFF"/>
                </Trigger>
            </Style.Triggers>
        </Style>

        <Style TargetType="ComboBox">
            <Setter Property="Padding" Value="12,10"/>
            <Setter Property="BorderBrush" Value="#E5E5E5"/>
            <Setter Property="BorderThickness" Value="1,1,1,2"/>
            <Setter Property="Background" Value="#FCFCFC"/>
        </Style>
        
        <!-- Sidebar TabControl -->
        <Style TargetType="TabControl">
            <Setter Property="Template">
                <Setter.Value>
                    <ControlTemplate TargetType="TabControl">
                        <Grid>
                            <Grid.ColumnDefinitions>
                                <ColumnDefinition Width="Auto"/>
                                <ColumnDefinition Width="*"/>
                            </Grid.ColumnDefinitions>
                            <StackPanel Grid.Column="0" IsItemsHost="True" Margin="0,0,20,0"/>
                            <ContentPresenter Grid.Column="1" ContentSource="SelectedContent"/>
                        </Grid>
                    </ControlTemplate>
                </Setter.Value>
            </Setter>
        </Style>
        
        <Style TargetType="TabItem">
            <Setter Property="Padding" Value="16,14"/>
            <Setter Property="FontSize" Value="15"/>
            <Setter Property="Background" Value="Transparent"/>
            <Setter Property="Foreground" Value="#555555"/>
            <Setter Property="Margin" Value="0,2"/>
            <Setter Property="Cursor" Value="Hand"/>
            <Setter Property="Template">
                <Setter.Value>
                    <ControlTemplate TargetType="TabItem">
                        <Border x:Name="TabBorder" Background="{TemplateBinding Background}" CornerRadius="8" Padding="{TemplateBinding Padding}">
                            <ContentPresenter ContentSource="Header" HorizontalAlignment="Left"/>
                        </Border>
                        <ControlTemplate.Triggers>
                            <Trigger Property="IsMouseOver" Value="True">
                                <Setter TargetName="TabBorder" Property="Background" Value="#10000000"/>
                            </Trigger>
                            <Trigger Property="IsSelected" Value="True">
                                <Setter TargetName="TabBorder" Property="Background" Value="#FFFFFF"/>
                                <Setter Property="Foreground" Value="#0078D4"/>
                                <Setter Property="FontWeight" Value="Bold"/>
                            </Trigger>
                        </ControlTemplate.Triggers>
                    </ControlTemplate>
                </Setter.Value>
            </Setter>
        </Style>
    </Window.Resources>

    <Grid Margin="24">
        <TabControl TabStripPlacement="Left">
            
            <!-- ONGLET 1: CREER -->
            <TabItem>
                <TabItem.Header>
                    <StackPanel Orientation="Horizontal" Width="180">
                        <TextBlock Text="&#xE710;" FontFamily="Segoe MDL2 Assets" FontSize="18" Margin="0,0,12,0" VerticalAlignment="Center"/>
                        <TextBlock Text="Nouveau" VerticalAlignment="Center"/>
                    </StackPanel>
                </TabItem.Header>
                <Border Background="#FFFFFF" CornerRadius="12" BorderBrush="#F0F0F0" BorderThickness="1" Padding="40" Margin="0,0,0,0">
                    <Border.Effect>
                        <DropShadowEffect Color="#000000" Direction="270" ShadowDepth="4" BlurRadius="24" Opacity="0.06"/>
                    </Border.Effect>
                    <Grid>
                        <Grid.RowDefinitions>
                            <RowDefinition Height="Auto"/>
                            <RowDefinition Height="Auto"/>
                            <RowDefinition Height="Auto"/>
                            <RowDefinition Height="Auto"/>
                            <RowDefinition Height="Auto"/>
                            <RowDefinition Height="Auto"/>
                            <RowDefinition Height="Auto"/>
                            <RowDefinition Height="Auto"/>
                            <RowDefinition Height="*"/>
                            <RowDefinition Height="Auto"/>
                            <RowDefinition Height="Auto"/>
                        </Grid.RowDefinitions>
                        
                        <TextBlock Text="Cr&#xE9;er un nouvel article" FontSize="24" FontWeight="ExtraBold" Margin="0,0,0,16" Foreground="#1A1A1A"/>
                        
                        <TextBlock Grid.Row="1" Text="Titre de l'article" Margin="0,0,0,4" Foreground="#1A1A1A" FontWeight="SemiBold"/>
                        <TextBox Grid.Row="2" Name="TxtTitle" Margin="0,0,0,12" />
                        
                        <TextBlock Grid.Row="3" Text="Auteur" Margin="0,0,0,4" Foreground="#1A1A1A" FontWeight="SemiBold"/>
                        <TextBox Grid.Row="4" Name="TxtAuthor" Margin="0,0,0,12" Text="Sacha GUITTER" />
                        
                        <TextBlock Grid.Row="5" Text="Extrait (Description courte)" Margin="0,0,0,4" Foreground="#1A1A1A" FontWeight="SemiBold"/>
                        <TextBox Grid.Row="6" Name="TxtExcerpt" Margin="0,0,0,12" Height="50" AcceptsReturn="True" TextWrapping="Wrap" VerticalScrollBarVisibility="Auto" />
                        
                        <TextBlock Grid.Row="7" Text="Contenu (S&#xE9;parer les paragraphes par un saut de ligne)" Margin="0,0,0,4" Foreground="#1A1A1A" FontWeight="SemiBold"/>
                        <TextBox Grid.Row="8" Name="TxtContent" Margin="0,0,0,16" AcceptsReturn="True" TextWrapping="Wrap" VerticalScrollBarVisibility="Auto" />
                        
                        <CheckBox Grid.Row="9" Name="ChkFeatured" Content="Mettre cet article &#xE0; la une" Margin="0,0,0,16" FontSize="15" />
                        
                        <Grid Grid.Row="10">
                            <Button Name="BtnCreate" Content="Cr&#xE9;er l'article" Width="180" HorizontalAlignment="Left" />
                            <TextBlock Name="TxtCreateMsg" Foreground="#0F7B0F" VerticalAlignment="Center" Margin="200,0,0,0" TextWrapping="Wrap" FontWeight="SemiBold" />
                        </Grid>
                    </Grid>
                </Border>
            </TabItem>

            <!-- ONGLET 2: SUPPRIMER -->
            <TabItem>
                <TabItem.Header>
                    <StackPanel Orientation="Horizontal" Width="180">
                        <TextBlock Text="&#xE74D;" FontFamily="Segoe MDL2 Assets" FontSize="18" Margin="0,0,12,0" VerticalAlignment="Center"/>
                        <TextBlock Text="Supprimer" VerticalAlignment="Center"/>
                    </StackPanel>
                </TabItem.Header>
                <Border Background="#FFFFFF" CornerRadius="12" BorderBrush="#F0F0F0" BorderThickness="1" Padding="40" Margin="0,0,0,0">
                    <Border.Effect>
                        <DropShadowEffect Color="#000000" Direction="270" ShadowDepth="4" BlurRadius="24" Opacity="0.06"/>
                    </Border.Effect>
                    <Grid>
                        <Grid.RowDefinitions>
                            <RowDefinition Height="Auto"/>
                            <RowDefinition Height="Auto"/>
                            <RowDefinition Height="Auto"/>
                            <RowDefinition Height="*"/>
                        </Grid.RowDefinitions>
                        
                        <TextBlock Text="Supprimer un article" FontSize="28" FontWeight="ExtraBold" Margin="0,0,0,32" Foreground="#1A1A1A"/>
                        
                        <TextBlock Grid.Row="1" Text="S&#xE9;lectionnez un article &#xE0; supprimer" Margin="0,0,0,8" Foreground="#1A1A1A" FontWeight="SemiBold"/>
                        <ComboBox Grid.Row="2" Name="CmbArticles" Margin="0,0,0,32" DisplayMemberPath="title" />
                        
                        <StackPanel Grid.Row="3" Orientation="Horizontal" VerticalAlignment="Top">
                            <Button Name="BtnDelete" Content="Supprimer l'article" Width="180" Style="{StaticResource DangerButton}" />
                        </StackPanel>
                        
                        <TextBlock Grid.Row="3" Name="TxtDeleteMsg" Foreground="#0F7B0F" VerticalAlignment="Bottom" TextWrapping="Wrap" FontWeight="SemiBold" />
                    </Grid>
                </Border>
            </TabItem>

            <!-- ONGLET 3: SYNCHRONISER -->
            <TabItem>
                <TabItem.Header>
                    <StackPanel Orientation="Horizontal" Width="180">
                        <TextBlock Text="&#xE895;" FontFamily="Segoe MDL2 Assets" FontSize="18" Margin="0,0,12,0" VerticalAlignment="Center"/>
                        <TextBlock Text="Synchroniser" VerticalAlignment="Center"/>
                    </StackPanel>
                </TabItem.Header>
                <Border Background="#FFFFFF" CornerRadius="12" BorderBrush="#E5E5E5" BorderThickness="1" Padding="40" Margin="0,0,0,0">
                    <Border.Effect>
                        <DropShadowEffect Color="#000000" Direction="270" ShadowDepth="4" BlurRadius="24" Opacity="0.06"/>
                    </Border.Effect>
                    <Grid>
                        <Grid.RowDefinitions>
                            <RowDefinition Height="Auto"/>
                            <RowDefinition Height="Auto"/>
                            <RowDefinition Height="*"/>
                        </Grid.RowDefinitions>
                        
                        <TextBlock Text="Synchroniser les donn&#xE9;es" FontSize="28" FontWeight="ExtraBold" Margin="0,0,0,16" Foreground="#1A1A1A"/>
                        <TextBlock Grid.Row="1" Text="R&#xE9;g&#xE9;n&#xE8;re le fichier de configuration principal &#xE0; partir des articles existants dans le dossier data\articles. Utile si vous avez modifi&#xE9; les fichiers manuellement." TextWrapping="Wrap" Margin="0,0,0,32" Foreground="#5D5D5D" LineHeight="22"/>
                        
                        <StackPanel Grid.Row="2" VerticalAlignment="Top">
                            <Button Name="BtnSync" Content="Lancer la synchronisation" Width="240" HorizontalAlignment="Left" Margin="0,0,0,24" />
                            <TextBox Name="TxtSyncLog" IsReadOnly="True" Height="160" VerticalScrollBarVisibility="Auto" AcceptsReturn="True" TextWrapping="Wrap" FontFamily="Consolas" FontSize="13" Background="#F9F9F9" BorderBrush="#E5E5E5" BorderThickness="1"/>
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
    Write-Host "Inner: $($_.Exception.InnerException.Message)"
    Write-Host "InnerInner: $($_.Exception.InnerException.InnerException.Message)"
    exit
}

# --- Variables Globales GUI ---
$TxtTitle = $window.FindName("TxtTitle")
$TxtAuthor = $window.FindName("TxtAuthor")
$TxtExcerpt = $window.FindName("TxtExcerpt")
$TxtContent = $window.FindName("TxtContent")
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
    $excerpt = $TxtExcerpt.Text.Trim()
    $rawContent = $TxtContent.Text.Trim()
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

    if ([string]::IsNullOrEmpty($excerpt)) { $excerpt = "A completer." }

    $contentArray = @()
    if ([string]::IsNullOrEmpty($rawContent)) {
        $contentArray += [ordered]@{ type = 'paragraph'; text = 'A completer.' }
    } else {
        $paragraphs = $rawContent -split "`r?`n`r?`n"
        foreach ($p in $paragraphs) {
            $pt = $p.Trim()
            if ($pt.Length -gt 0) {
                $pt = $pt -replace "`r?`n", "<br>"
                $contentArray += [ordered]@{ type = 'paragraph'; text = $pt }
            }
        }
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
        excerpt   = $excerpt
        image     = "assets/images/$slug.png"
        content   = $contentArray
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
        excerpt   = $excerpt
        image     = "assets/images/$slug.png"
    }
    $list.Add($newEntry) | Out-Null
    Save-ArticlesList $list

    $TxtCreateMsg.Foreground = "Green"
    $TxtCreateMsg.Text = "[OK] Article '$title' cree avec succes !`r`nN'oubliez pas d'ajouter l'image assets/images/$slug.png"
    $TxtTitle.Text = ""
    $TxtExcerpt.Text = ""
    $TxtContent.Text = ""
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
