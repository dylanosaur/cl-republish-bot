# started from a cron job
cd /home/ubuntu/speak-easy/outreach-bot
. /home/ubuntu/speak-easy/.env
npm install
npm start

# windows 8.1 has a specifc chrome that gets installed and needs an old puppeteer
# we used 19.4.0
# https://pptr.dev/supported-browsers