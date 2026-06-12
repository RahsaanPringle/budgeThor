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
    $DateStr = $DateStr.Trim() -replace '^"|"$', ''
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
                description = ($parts[1] -replace '^"|"$', '').Trim()
                amount = [double](ConvertAmount $parts[2])
                balance = [double](ConvertAmount $parts[3])
            }
        }
    }
}

$boaTransactions = $boaTransactions | Sort-Object { [datetime]$_.date }
Write-Host "✓ BOA Personal: $($boaTransactions.Count) transactions ($(if($boaTransactions.Count -gt 0){"$($boaTransactions[0].date) to $($boaTransactions[-1].date)"}else{""}))"

# ===== PARSE HTB BUSINESS =====
$htbBizTransactions = @()
$allLines = @(Get-Content "$basePath\HTB Business.csv" -Encoding UTF8)

for ($i = 1; $i -lt $allLines.Count; $i++) {
    $line = $allLines[$i]
    if ([string]::IsNullOrWhiteSpace($line)) { continue }
    
    $parts = ParseCsvLine $line
    if ($parts.Count -ge 8) {
        $date = ConvertDate ($parts[0] -replace '^"|"$', '')
        if ($date) {
            $desc = ($parts[3] -replace '^"|"$', '').Trim()
            $debit = ConvertAmount ($parts[4] -replace '^"|"$', '')
            $credit = ConvertAmount ($parts[5] -replace '^"|"$', '')
            $balance = ConvertAmount ($parts[7] -replace '^"|"$', '')
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
Write-Host "✓ HTB Business: $($htbBizTransactions.Count) transactions ($(if($htbBizTransactions.Count -gt 0){"$($htbBizTransactions[0].date) to $($htbBizTransactions[-1].date)"}else{""}))"

# ===== PARSE HTB PERSONAL =====
$htbPerTransactions = @()
$allLines = @(Get-Content "$basePath\HTB Personal.csv" -Encoding UTF8)

for ($i = 1; $i -lt $allLines.Count; $i++) {
    $line = $allLines[$i]
    if ([string]::IsNullOrWhiteSpace($line)) { continue }
    
    $parts = ParseCsvLine $line
    if ($parts.Count -ge 8) {
        $date = ConvertDate ($parts[0] -replace '^"|"$', '')
        if ($date) {
            $desc = ($parts[3] -replace '^"|"$', '').Trim()
            $debit = ConvertAmount ($parts[4] -replace '^"|"$', '')
            $credit = ConvertAmount ($parts[5] -replace '^"|"$', '')
            $balance = ConvertAmount ($parts[7] -replace '^"|"$', '')
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
Write-Host "✓ HTB Personal: $($htbPerTransactions.Count) transactions ($(if($htbPerTransactions.Count -gt 0){"$($htbPerTransactions[0].date) to $($htbPerTransactions[-1].date)"}else{""}))"

# ===== CREATE JSON =====
$jsonData = @{
    boa = @{
        name = "BOA Personal"
        color = "#FF6B35"
        icon = "🏦"
        transactions = @($boaTransactions)
    }
    htbBiz = @{
        name = "HTB Business"
        color = "#4ECDC4"
        icon = "💼"
        transactions = @($htbBizTransactions)
    }
    htbPer = @{
        name = "HTB Personal"
        color = "#95E1D3"
        icon = "👤"
        transactions = @($htbPerTransactions)
    }
}

$json = $jsonData | ConvertTo-Json -Depth 5 -AsArray:$false
$json | Out-File "$basePath\bank_data.json" -Encoding UTF8

$fileSize = (Get-Item "$basePath\bank_data.json").Length
Write-Host "✓ JSON file created: $(([math]::Round($fileSize/1024, 2)))KB"
