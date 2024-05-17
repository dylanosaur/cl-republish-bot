const puppeteer = require('puppeteer');
const fs = require('fs');
const axios = require('axios');

// uncomment to run bot as standalone process outside of express server
// (async () => {
//   let usersConfig = require('./users.json')
//   let users = usersConfig.data
//   console.log(users)
//   const browserHandle = await setupBrowser();
//   const browser = browserHandle.browser
//   const page = browserHandle.page
// })();


const writeJSONToFile = (filePath, data) => {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    console.log(`JSON data has been written to ${filePath}`);
  } catch (error) {
    console.error(`Error writing JSON data to ${filePath}: ${error}`);
  }
};


function readJSONFile(filepath, callback) {
  fs.readFile(filepath, 'utf8', (err, data) => {
    if (err) {
      callback(err, null);
      return;
    }
    try {
      const jsonData = JSON.parse(data);
      callback(null, jsonData);
    } catch (error) {
      callback(error, null);
    }
  });
}

async function setupBrowser() {

  const browser = await puppeteer.launch({
    headless: false,
    timeout: 60000,
    args: [
      '--disable-notifications',
    ],
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\Chrome.exe"
  }); // Launch browser
  const page = await browser.newPage(); // Create a new page
  await page.setViewport({ width: 0, height: 0 });
  // await page.setViewport({ width: null, height: null });

  return { browser, page }
}

function uniqueStrings(array) {
  return [...new Set(array)];
}

async function returnToHome(page) {
  await page.goto('https://accounts.craigslist.org/login/home')
}

async function loginToCraigslist(page, username, password) {
    // Navigate to Craigslist login page
    await page.goto('https://accounts.craigslist.org/login');

    // Fill in the login form
    await page.type('#inputEmailHandle', username, {delay: 200}); // Replace 'your_username' with your Craigslist username
    await page.type('#inputPassword', password, {delay: 200}); // Replace 'your_password' with your Craigslist password
  
    await new Promise(resolve => setTimeout(resolve, 2 * 1000));

    // Click the login button
    await page.waitForSelector('button[id=login]');
    await page.evaluate(() =>
        document.querySelectorAll('button[id=login]')[0].click()
    );

    // Wait for the login process to complete
    await page.waitForNavigation();
  
    // Check if login was successful
    const isLoggedIn = await page.evaluate(() => {
      return document.querySelector('.account-header') !== null; // Assuming that after login, there's an element with class 'account-header'
    });
  
    if (isLoggedIn) {
      console.log('Login successful!');
      
    } else {
      console.log('Login failed!');
    }

}

async function scrapeListings(page) {
  await returnToHome(page);

  // Get all tr rows inside the tbody
  const listings = await page.evaluate(() => {
    const rows = document.querySelectorAll('tbody tr');
    // Extract data from each row
    console.log(rows)
    const data = [];
    rows.forEach(row => {
        let children = row.children;
        let childrenArray = [...children]
        let rowData = childrenArray.map((x) => ({"classes": x.className, "text": x.innerText}))
        // const title = row.querySelector('.title').innerText;
        // const price = row.querySelector('.price').innerText;
        // Add more data extraction as needed
        data.push(rowData);
    });
    return data;
  });

  console.log(listings)

  writeJSONToFile('data/listings.json', listings)

}



async function scrapeListingsAllPages(page) {



  await returnToHome(page);

  let pagelinks = await page.evaluate(() => {
    const boxes = document.querySelectorAll('a'); // Select all <a> tags
    const data = [];
    boxes.forEach(aTag => {
        // Extract href attribute from each <a> tag
        const href = aTag.getAttribute('href');
        // Push href into data array
        if (String(href).includes('?filter_page=')) {
          data.push(`https://accounts.craigslist.org/login/home${href}`);
        }
    });

    return data
  })

  pagelinks = uniqueStrings(pagelinks)
  console.log('found these pagelinks', pagelinks)

  let all_listings = []
  let listings = []

  // scrape out home page
  listings = await page.evaluate(() => {

    function parseHrefFromString(inputString) {
      const regex = /<a\s+(?:[^>]*?\s+)?href=(["'])(.*?)\1/g;
      const match = regex.exec(inputString);
      if (match && match.length >= 3) {
          return match[2];
      }
      return null;
    }

    function extractPostLink(htmlString) {
      const regex = /<form\s+action="(.*?)"/g;
      const match = regex.exec(htmlString);
      if (match && match.length >= 2) {
          return match[1];
      }
      return null;
    }

    const rows = document.querySelectorAll('tbody tr');
    // Extract data from each row
    console.log(rows)
    const data = [];
    rows.forEach(row => {
        let children = row.children;
        let childrenArray = [...children]
        let rowData = childrenArray.map((x) => ({"classes": x.className, "text": x.innerText, "html": x.innerHTML, 'ref': parseHrefFromString(x.innerHTML), 'postref': extractPostLink(x.innerHTML)}))
        // const title = row.querySelector('.title').innerText;
        // const price = row.querySelector('.price').innerText;
        // Add more data extraction as needed
        data.push(rowData);
    });
    return data;
  });

  console.log('page', 1, 'has listings', listings.length)
  all_listings = [...all_listings, ...listings]

  // scrape out all other pages
  for (let pagelink of pagelinks) {
    await page.goto(pagelink);
    // Get all tr rows inside the tbody
    listings = await page.evaluate(() => {
      function parseHrefFromString(inputString) {
        const regex = /<a\s+(?:[^>]*?\s+)?href=(["'])(.*?)\1/g;
        const match = regex.exec(inputString);
        if (match && match.length >= 3) {
            return match[2];
        }
        return null;
      }

      function extractPostLink(htmlString) {
        const regex = /<form\s+action="(.*?)"/g;
        const match = regex.exec(htmlString);
        if (match && match.length >= 2) {
            return match[1];
        }
        return null;
      }

      const rows = document.querySelectorAll('tbody tr');
      // Extract data from each row
      console.log(rows)
      const data = [];
      rows.forEach(row => {
          let children = row.children;
          let childrenArray = [...children]
          let rowData = childrenArray.map((x) => ({"classes": x.className, "text": x.innerText, "html": x.innerHTML, 'ref': parseHrefFromString(x.innerHTML), 'postref': extractPostLink(x.innerHTML)}))
          // const title = row.querySelector('.title').innerText;
          // const price = row.querySelector('.price').innerText;
          // Add more data extraction as needed
          data.push(rowData);
      });
      return data;
    });

    console.log('page', pagelink, 'has listings', listings.length)
    all_listings = [...all_listings, ...listings]
  }
  

  writeJSONToFile('data/listings.json', all_listings)

}

async function repostListing(page, listingId, enablePaymentConfirm) {
  console.log('processing page with listingId', listingId)
  // url = "https://accounts.craigslist.org/manage/7743285416?action=repost&go=repost"
  url = `https://post.craigslist.org/manage/${listingId}?action=repost&go=repost`
  await page.goto(url);
  await new Promise(resolve => setTimeout(resolve, 2 * 1000));

  // Click the repost now button by tabbing the cursor to the button
  await page.keyboard.press('Tab')
  await new Promise(resolve => setTimeout(resolve, 1 * 1000));
  await page.keyboard.press('Tab')
  await new Promise(resolve => setTimeout(resolve, 1 * 1000));
  await page.keyboard.press('Tab')
  await new Promise(resolve => setTimeout(resolve, 1 * 1000));
  await page.keyboard.press('Tab')
  await new Promise(resolve => setTimeout(resolve, 1 * 1000));
  await page.keyboard.press('Enter')
  await new Promise(resolve => setTimeout(resolve, 2 * 1000));


  // use the current url to get to the edit image page
  // https://post.craigslist.org/k/mkaZV8ML7xGnFjnPgP5-0w/9DVGy?s=edit
  // url  = https://post.craigslist.org/k/mkaZV8ML7xGnFjnPgP5-0w/9DVGy?s=editimage -> 
  let currentUrl = page.url();
  console.log('current url', currentUrl)
  let newUrl = `${currentUrl}image`
  console.log('new url', newUrl)

  // first we must click the continue button or the edit image page gets a redirect
  // button classes: go big-button
  let continueButton = await (await page.waitForSelector(".go", { visible: true }));
  continueButton.click()
  await new Promise(resolve => setTimeout(resolve, 2 * 1000));

  // jump to edit images page
  await page.goto(newUrl);
  await new Promise(resolve => setTimeout(resolve, 2 * 1000));

  // check if "did you mean to post without a price?" page has popped up
  // I just don't want to show a price
  // get position of first image and last image
  const pricePageFound = await page.evaluate(() => {
    console.log('searching for spans')
    const selectOptions = document.querySelectorAll('span');
    // Extract data from each image box element
    console.log(selectOptions)
    let keywordsFound = false;

    selectOptions.forEach(selectOption => {
        if (String(selectOption.innerText).includes("I just don't want to")) {
          selectOption.click()
          keywordsFound = true;
        }
    });
    return keywordsFound;
  });

  if (pricePageFound) {

    // confirm the price choice
    const priceConfirmContinueButtonClicked = await page.evaluate(() => {
      const allButtons = document.querySelectorAll('button');
      // Extract data from each image box element
      console.log('confirm price choice buttons', allButtons)
      const data = [];
      allButtons.forEach(button => {
          if (String(button.innerText).includes("continue")) {
            button.click()
          }
      });
      return data;
    });

    await new Promise(resolve => setTimeout(resolve, 2 * 1000));

    // confirm the posting area code choice
    const continueButtonClicked = await page.evaluate(() => {
      const allButtons = document.querySelectorAll('button');
      // Extract data from each image box element
      console.log('buttons for confirm continue button to confirm area code', allButtons)
      const data = [];
      allButtons.forEach(button => {
          if (String(button.innerText).includes("continue")) {
            button.click()
          }
      });
      return data;
    });

    await new Promise(resolve => setTimeout(resolve, 2 * 1000));

    let waitingForButton = true;
    while (waitingForButton) {

        // confirm that the ad should be in some location other than Jacksonville, FL
      const dryRunclickedConfirmPostingAreaButton = await page.evaluate(() => {
        const continueButtons = document.querySelectorAll('.continue');
        // Extract data from each image box element
        console.log('.continue buttons for confirm posting area', continueButtons)
        let success = false;
        continueButtons.forEach(button => {
            if (button.name == 'keep_old_area') {
              success = true;
              console.log('found keep old area button')
            }
        });
        return success;
      });
      waitingForButton = !dryRunclickedConfirmPostingAreaButton
      console.log('still waiting for button?', waitingForButton)
    }
    
    await new Promise(resolve => setTimeout(resolve, 2 * 1000));
    // confirm that the ad should be in some location other than Jacksonville, FL
    const clickedConfirmPostingAreaButton = await page.evaluate(() => {
      const continueButtons = document.querySelectorAll('.continue');
      // Extract data from each image box element
      console.log('.continue buttons for confirm posting area', continueButtons)
      let success = false;
      continueButtons.forEach(button => {
          if (button.name == 'keep_old_area') {
            button.click()
            success = true;
          }
      });
      return success;
    });

    console.log('button click to confirm area result', clickedConfirmPostingAreaButton)
    await new Promise(resolve => setTimeout(resolve, 2 * 1000));

    if (!clickedConfirmPostingAreaButton) {
      await new Promise(resolve => setTimeout(resolve, 50 * 1000));

    }

      // jump to edit images page
    await page.goto(newUrl);
    await new Promise(resolve => setTimeout(resolve, 2 * 1000));

  }

  // get position of first image and last image
  const imageBoxes = await page.evaluate(() => {
    const boxes = document.querySelectorAll('.imgbox');
    // Extract data from each image box element
    console.log(boxes)
    const data = [];
    boxes.forEach(imgBox => {
        let boundingBox = imgBox.getBoundingClientRect()
        let imageBoxData = {"x": boundingBox.x, "y": boundingBox.y, "width": boundingBox.width, "height": boundingBox.height}
        if (boundingBox.x > 10 && boundingBox.y >10) {
          data.push(imageBoxData);
        }
    });
    return data;
  });

  console.log('image boxes', imageBoxes)
  let lastImageBox = imageBoxes[imageBoxes.length-1]

  // drag and drop image node
  let elm = await (await page.waitForSelector(".imgbox", { visible: true }));
  let bounding_box = await elm.boundingBox();
  let boxWidth = bounding_box.width
  let boxHeight = bounding_box.height
  let x = bounding_box.x + bounding_box.width / 2;
  let y = bounding_box.y + bounding_box.height / 2;

  await page.mouse.move(x, y);
  await page.mouse.down();
  let startingX = x
  let startingY = y
  
  let finalX = lastImageBox.x + boxWidth*1.8
  let finalY = lastImageBox.y + boxHeight*0.5

  for (let i=0; i<200; i++) {
    let yJitter = Math.random()*4 -2
    let currentX = startingX + i/200 * (finalX-startingX)
    let currentY = startingY + i/200 * (finalY-startingY) + yJitter
    await new Promise(resolve => setTimeout(resolve, 1 * 30));
    await page.mouse.move(currentX, currentY);
  }
  await page.mouse.up();
  await new Promise(resolve => setTimeout(resolve, 1 * 1000));

  // click 'done with images' button using its class as a selector
  let confirmButton = await (await page.waitForSelector(".done", { visible: true }));
  confirmButton.click()
  await new Promise(resolve => setTimeout(resolve, 1 * 1000));


  // user is redirected to main edit listing page with "continue button" inside black banner
  let draftContinueButton = await (await page.waitForSelector(".button", { visible: true }));
  draftContinueButton.click()
  await new Promise(resolve => setTimeout(resolve, 1 * 1000));


  // user is redirected to payment options confirmation page with "continue posting" button
  if (enablePaymentConfirm) {
    let paymentConfirmButton = await (await page.waitForSelector(".go", { visible: true }));
    paymentConfirmButton.click()
  }

  await new Promise(resolve => setTimeout(resolve, 1 * 1000));

  console.log('republish completed normally')

  // let date = new Date().toISOString();
  // saveProcessResult(listingId, 'success', date)
  return true;
}

function saveProcessResult(id, successMessage, date) {

  const filePath = './data/process_results.json'

  // Read the existing data from the JSON file
  fs.readFile(filePath, 'utf8', (err, data) => {
      if (err && err.code !== 'ENOENT') {
          console.error('Error reading file:', err);
          return;
      }

      let results = [];
      if (!err) {
          try {
              results = JSON.parse(data);
          } catch (parseErr) {
              console.error('Error parsing JSON:', parseErr);
          }
      }

      // Append the new result
      results.push({
          id: id,
          success_message: successMessage,
          date: date
      });

      // Save the updated data back to the JSON file
      fs.writeFile(filePath, JSON.stringify(results, null, 4), 'utf8', (writeErr) => {
          if (writeErr) {
              console.error('Error writing file:', writeErr);
          } else {
              console.log('Process result saved successfully');
          }
      });
  });
}

module.exports = {
  setupBrowser, 
  loginToCraigslist, 
  scrapeListings, 
  repostListing,
  scrapeListingsAllPages,
  saveProcessResult
}