# PowerShell script to generate bank accounts dashboard with real data
$basePath = "c:\Users\Rahsa\OneDrive\Documents\2026\June\05"

# Function to parse amounts
function ConvertAmount {
    param([string]$AmountStr)
    if (-not $AmountStr) { return 0.0 }
    return [double]($AmountStr -replace '[^\d.-]', '')
}

# Function to parse dates
function ConvertDate {
    param([string]$DateStr)
    if (-not $DateStr -or $DateStr -notmatch '^\d{1,2}/\d{1,2}/\d{4}$') { return $null }
    $dt = [datetime]::ParseExact($DateStr.Trim(), 'M/d/yyyy', $null)
    return $dt.ToString('yyyy-MM-dd')
}

# Parse BOA Personal
$boaRaw = Get-Content "$basePath\BOA Personal.csv" | Select-Object -Skip 7
$boaLines = $boaRaw | ConvertFrom-Csv
$boaTransactions = @()

foreach ($row in $boaLines) {
    $date = ConvertDate $row.Date
    if ($date) {
        $boaTransactions += @{
            date = $date
            description = ($row.Description -replace '^\s*"|"\s*$', '').Trim()
            amount = ConvertAmount $row.Amount
            balance = ConvertAmount $row.'Running Bal.'
        }
    }
}

Write-Host "BOA: $($boaTransactions.Count) transactions"

# Parse HTB Business
$htbBizRaw = Get-Content "$basePath\HTB Business.csv" | Select-Object -Skip 1
$htbBizLines = @()
$htbBizRaw | ForEach-Object {
    if ($_ -match '^"?\d{1,2}/\d{1,2}/\d{4}"?') {
        $htbBizLines += $_
    }
}

$htbBizTransactions = @()
$htbBizLines | ForEach-Object {
    # Manual CSV parsing due to complex quotes
    $parts = $_ -split '","'
    if ($parts.Count -ge 8) {
        $date = ConvertDate ($parts[0] -replace '^"|"$', '')
        if ($date) {
            $desc = ($parts[3] -replace '^\s*"|"\s*$', '').Trim()
            $debit = ConvertAmount ($parts[4] -replace '^"|"$', '')
            $credit = ConvertAmount ($parts[5] -replace '^"|"$', '')
            $balance = ConvertAmount ($parts[7] -replace '^"|"$', '')
            $amount = if ($credit -gt 0) { $credit } else { -$debit }
            
            $htbBizTransactions += @{
                date = $date
                description = $desc
                amount = $amount
                balance = $balance
            }
        }
    }
}

Write-Host "HTB Business: $($htbBizTransactions.Count) transactions"

# Parse HTB Personal
$htbPerRaw = Get-Content "$basePath\HTB Personal.csv" | Select-Object -Skip 1
$htbPerLines = @()
$htbPerRaw | ForEach-Object {
    if ($_ -match '^"?\d{1,2}/\d{1,2}/\d{4}"?') {
        $htbPerLines += $_
    }
}

$htbPerTransactions = @()
$htbPerLines | ForEach-Object {
    $parts = $_ -split '","'
    if ($parts.Count -ge 8) {
        $date = ConvertDate ($parts[0] -replace '^"|"$', '')
        if ($date) {
            $desc = ($parts[3] -replace '^\s*"|"\s*$', '').Trim()
            $debit = ConvertAmount ($parts[4] -replace '^"|"$', '')
            $credit = ConvertAmount ($parts[5] -replace '^"|"$', '')
            $balance = ConvertAmount ($parts[7] -replace '^"|"$', '')
            $amount = if ($credit -gt 0) { $credit } else { -$debit }
            
            $htbPerTransactions += @{
                date = $date
                description = $desc
                amount = $amount
                balance = $balance
            }
        }
    }
}

Write-Host "HTB Personal: $($htbPerTransactions.Count) transactions"

# Sort all by date
$boaTransactions = $boaTransactions | Sort-Object { [datetime]$_.date }
$htbBizTransactions = $htbBizTransactions | Sort-Object { [datetime]$_.date }
$htbPerTransactions = $htbPerTransactions | Sort-Object { [datetime]$_.date }

# Create JSON data
$jsonData = @{
    boa = @{
        name = "BOA Personal"
        color = "#FF6B35"
        icon = "🏦"
        transactions = @($boaTransactions | ForEach-Object { @{
            date = $_.date
            description = $_.description
            amount = [double]$_.amount
            balance = [double]$_.balance
        }})
    }
    htbBiz = @{
        name = "HTB Business"
        color = "#4ECDC4"
        icon = "💼"
        transactions = @($htbBizTransactions | ForEach-Object { @{
            date = $_.date
            description = $_.description
            amount = [double]$_.amount
            balance = [double]$_.balance
        }})
    }
    htbPer = @{
        name = "HTB Personal"
        color = "#95E1D3"
        icon = "👤"
        transactions = @($htbPerTransactions | ForEach-Object { @{
            date = $_.date
            description = $_.description
            amount = [double]$_.amount
            balance = [double]$_.balance
        }})
    }
}

$json = $jsonData | ConvertTo-Json -Depth 5
$json | Out-File "$basePath\bank_data.json"

Write-Host "JSON file created: $basePath\bank_data.json"
Write-Host "Size: $((Get-Item "$basePath\bank_data.json").Length) bytes"
