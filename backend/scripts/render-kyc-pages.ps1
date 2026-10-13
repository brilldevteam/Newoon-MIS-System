param([string]$Directory = "$PSScriptRoot\..\..\docs\kyc-export-preview\standard", [string]$Name = 'kyc-chromium', [string]$Prefix = 'pdf-page', [int]$Width = 0)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$null = [Windows.Storage.StorageFile, Windows.Storage, ContentType = WindowsRuntime]
$null = [Windows.Data.Pdf.PdfDocument, Windows.Data.Pdf, ContentType = WindowsRuntime]
$null = [Windows.Storage.Streams.InMemoryRandomAccessStream, Windows.Storage.Streams, ContentType = WindowsRuntime]
function Await-Result($Operation, [Type]$ResultType) {
    $method = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.IsGenericMethod -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' } | Select-Object -First 1
    $task = $method.MakeGenericMethod($ResultType).Invoke($null, @($Operation))
    $task.Wait()
    return $task.Result
}
$Directory = (Resolve-Path -LiteralPath $Directory).Path
$file = Await-Result ([Windows.Storage.StorageFile]::GetFileFromPathAsync("$Directory\$Name.pdf")) ([Windows.Storage.StorageFile])
$pdf = Await-Result ([Windows.Data.Pdf.PdfDocument]::LoadFromFileAsync($file)) ([Windows.Data.Pdf.PdfDocument])
for ($i = 0; $i -lt $pdf.PageCount; $i++) {
    $page = $pdf.GetPage($i)
    $stream = New-Object Windows.Storage.Streams.InMemoryRandomAccessStream
    try {
        $prepare = $page.PreparePageAsync()
        $actionMethod = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and -not $_.IsGenericMethod -and $_.GetParameters().Count -eq 1 } | Select-Object -First 1
        $actionMethod.Invoke($null, @($prepare)).Wait()
        if ($Width -gt 0) {
            $options = New-Object Windows.Data.Pdf.PdfPageRenderOptions
            $options.DestinationWidth = $Width
            $action = $page.RenderToStreamAsync($stream, $options)
        } else {
            $action = $page.RenderToStreamAsync($stream)
        }
        $method = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and -not $_.IsGenericMethod -and $_.GetParameters().Count -eq 1 } | Select-Object -First 1
        $task = $method.Invoke($null, @($action))
        $task.Wait()
        $input = [System.IO.WindowsRuntimeStreamExtensions]::AsStreamForRead($stream)
        $output = [System.IO.File]::Create("$Directory\$Prefix-$($i + 1).png")
        try { $input.CopyTo($output) } finally { $output.Dispose(); $input.Dispose() }
    } finally { $page.Dispose(); $stream.Dispose() }
}
Write-Output "Rendered $($pdf.PageCount) page images."
