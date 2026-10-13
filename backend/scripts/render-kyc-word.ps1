param([string]$Directory = "$PSScriptRoot\..\..\docs\kyc-export-preview", [string]$Name = 'kyc-sample')
$ErrorActionPreference = 'Stop'
$Directory = (Resolve-Path -LiteralPath $Directory).Path
$word = $null
$document = $null
try {
    $word = New-Object -ComObject Word.Application
    $word.Visible = $false
    $word.DisplayAlerts = 0
    $word.Options.PrintDrawingObjects = $true
    $word.Options.PrintBackgrounds = $true
    $word.Options.Pagination = $false
    $document = $word.Documents.Open("$Directory\$Name.docx", $false, $true)
    $document.PageSetup.DifferentFirstPageHeaderFooter = $false
    $document.PageSetup.OddAndEvenPagesHeaderFooter = $false
    $document.Fields.Update() | Out-Null
    $document.Repaginate()
    $word.ScreenRefresh()
    Start-Sleep -Seconds 2
    $pages = $document.ComputeStatistics(2)
    $document.ExportAsFixedFormat("$Directory\$Name.pdf", 17)
    Add-Type -AssemblyName System.Drawing
    $document.ActiveWindow.View.Type = 3
    for ($i = 1; $i -le $pages; $i++) {
        $document.GoTo(1, 1, $i).Select()
        $word.ScreenRefresh()
        Start-Sleep -Milliseconds 200
        $bytes = [byte[]]$document.ActiveWindow.Panes.Item(1).Pages.Item($i).EnhMetaFileBits
        $stream = New-Object System.IO.MemoryStream(,$bytes)
        $metafile = New-Object System.Drawing.Imaging.Metafile($stream)
        $bitmap = New-Object System.Drawing.Bitmap(1190, 1684)
        $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
        try {
            $graphics.Clear([System.Drawing.Color]::White)
            $graphics.DrawImage($metafile, 0, 0, 1190, 1684)
            $bitmap.Save("$Directory\page-$i.png", [System.Drawing.Imaging.ImageFormat]::Png)
        } finally { $graphics.Dispose(); $bitmap.Dispose(); $metafile.Dispose(); $stream.Dispose() }
    }
    Write-Output "Word rendered $pages pages: $Directory\$Name.pdf"
} finally {
    if ($null -ne $document) { $document.Close(0) }
    if ($null -ne $word) { $word.Quit() }
}
