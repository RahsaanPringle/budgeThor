# PowerShell script to generate bank accounts dashboard with REAL DATA
$basePath = "c:\Users\Rahsa\OneDrive\Documents\2026\June\05"

function ConvertAmount {
    param([string]$AmountStr)
    if (-not $AmountStr) { return 0.0 }
    return [double]($AmountStr -replace '[^\d.-]', '')
}

function ConvertDate {
    param([string]$DateStr)
    if (-not $DateStr) { return $null }
    $DateStr = $DateStr.Trim() -replace '^\s*"|"\s*$', ''
    if ($DateStr -notmatch '^\d{1,2}/\d{1,2}/\d{4}$') { return $null }
    try {
        $dt = [datetime]::ParseExact($DateStr, 'M/d/yyyy', $null)
        return $dt.ToString('yyyy-MM-dd')
    } catch {
        return $null
    }
}

# Function to parse CSV line
function ParseCsvLine {
    param([string]$line)
    $parts = @()
    $inQuotes = $false
    $current = ""
    
    for ($j = 0; $j -lt $line.Length; $j++) {
        $char = $line[$j]
        if ($char -eq '"') {
            $inQuotes = -not $inQuotes
        } elseif ($char -eq ',' -and -not $inQuotes) {
            $parts += $current
            $current = ""
        } else {
            $current += $char
        }
    }
    $parts += $current
    return $parts
}

# ===== PARSE BOA PERSONAL =====
$boaTransactions = @()
$allLines = @(Get-Content "$basePath\BOA Personal.csv" -Encoding UTF8)
$dataStart = 7

for ($i = $dataStart; $i -lt $allLines.Count; $i++) {
    $line = $allLines[$i]
    if ([string]::IsNullOrWhiteSpace($line)) { continue }
    
    $parts = ParseCsvLine $line
    if ($parts.Count -ge 4) {
        $date = ConvertDate $parts[0]
        if ($date) {
            $boaTransactions += @{
                date = $date
                description = ($parts[1] -replace '^\s*"|"\s*$', '').Trim()
                amount = [double](ConvertAmount $parts[2])
                balance = [double](ConvertAmount $parts[3])
            }
        }
    }
}

$boaTransactions = $boaTransactions | Sort-Object { [datetime]$_.date }
Write-Host "BOA Personal: $($boaTransactions.Count) transactions"

# ===== PARSE HTB BUSINESS =====
$htbBizTransactions = @()
$allLines = @(Get-Content "$basePath\HTB Business.csv" -Encoding UTF8)

for ($i = 1; $i -lt $allLines.Count; $i++) {
    $line = $allLines[$i]
    if ([string]::IsNullOrWhiteSpace($line)) { continue }
    
    $parts = ParseCsvLine $line
    if ($parts.Count -ge 8) {
        $dateStr = $parts[0] -replace '^\s*"|"\s*$', ''
        $date = ConvertDate $dateStr
        if ($date) {
            $desc = ($parts[3] -replace '^\s*"|"\s*$', '').Trim()
            $debitStr = $parts[4] -replace '^\s*"|"\s*$', ''
            $creditStr = $parts[5] -replace '^\s*"|"\s*$', ''
            $balanceStr = $parts[7] -replace '^\s*"|"\s*$', ''
            $debit = ConvertAmount $debitStr
            $credit = ConvertAmount $creditStr
            $balance = ConvertAmount $balanceStr
            $amount = if ($credit -gt 0) { $credit } else { -$debit }
            
            if ($desc) {
                $htbBizTransactions += @{
                    date = $date
                    description = $desc
                    amount = [double]$amount
                    balance = [double]$balance
                }
            }
        }
    }
}

$htbBizTransactions = $htbBizTransactions | Sort-Object { [datetime]$_.date }
Write-Host "HTB Business: $($htbBizTransactions.Count) transactions"

# ===== PARSE HTB PERSONAL =====
$htbPerTransactions = @()
$allLines = @(Get-Content "$basePath\HTB Personal.csv" -Encoding UTF8)

for ($i = 1; $i -lt $allLines.Count; $i++) {
    $line = $allLines[$i]
    if ([string]::IsNullOrWhiteSpace($line)) { continue }
    
    $parts = ParseCsvLine $line
    if ($parts.Count -ge 8) {
        $dateStr = $parts[0] -replace '^\s*"|"\s*$', ''
        $date = ConvertDate $dateStr
        if ($date) {
            $desc = ($parts[3] -replace '^\s*"|"\s*$', '').Trim()
            $debitStr = $parts[4] -replace '^\s*"|"\s*$', ''
            $creditStr = $parts[5] -replace '^\s*"|"\s*$', ''
            $balanceStr = $parts[7] -replace '^\s*"|"\s*$', ''
            $debit = ConvertAmount $debitStr
            $credit = ConvertAmount $creditStr
            $balance = ConvertAmount $balanceStr
            $amount = if ($credit -gt 0) { $credit } else { -$debit }
            
            if ($desc) {
                $htbPerTransactions += @{
                    date = $date
                    description = $desc
                    amount = [double]$amount
                    balance = [double]$balance
                }
            }
        }
    }
}

$htbPerTransactions = $htbPerTransactions | Sort-Object { [datetime]$_.date }
Write-Host "HTB Personal: $($htbPerTransactions.Count) transactions"

# ===== CREATE JSON =====
$jsonData = @{
    boa = @{
        name = "BOA Personal"
        color = "#FF6B35"
        icon = "1F3E6"
        transactions = @($boaTransactions)
    }
    htbBiz = @{
        name = "HTB Business"
        color = "#4ECDC4"
        icon = "1F4BC"
        transactions = @($htbBizTransactions)
    }
    htbPer = @{
        name = "HTB Personal"
        color = "#95E1D3"
        icon = "1F9C0"
        transactions = @($htbPerTransactions)
    }
}

$json = $jsonData | ConvertTo-Json -Depth 10
$json | Out-File "$basePath\bank_data.json" -Encoding UTF8

$fileSize = (Get-Item "$basePath\bank_data.json").Length
Write-Host "JSON created: $(([math]::Round($fileSize/1024, 2)))KB"
Write-Host "Done!"
