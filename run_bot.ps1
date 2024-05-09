# # Find the processes running on port 3000
# $processes = Get-NetTCPConnection -LocalPort 3000

# # Check if any processes are found
# if ($processes) {
#     # Iterate through each process and kill it
#     foreach ($process in $processes) {
#         Stop-Process -Id $process.OwningProcess -Force
#     }
#     Write-Host "Processes running on port 3000 have been terminated."
# } else {
#     Write-Host "No processes found running on port 3000."
# }

cd cl-bot
node puppeteer-server.js