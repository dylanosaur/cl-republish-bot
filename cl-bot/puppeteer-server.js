const express = require('express');
const puppeteer = require('puppeteer');
const {setupBrowser, loginToCraigslist, scrapeListings, repostListing, scrapeListingsAllPages, saveProcessResult} = require('./puppy.js')
const fs = require('fs');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to parse JSON bodies
app.use(express.json());

let browserHandle, browser, page;


// API endpoint to interact with Puppeteer
app.get('/puppeteer/restart', async (req, res) => {

    try {
        browser.close()
    } catch(error) {
        console.log('unable to close existing browser, continuing normally')
    }

    try {

        browserHandle = await setupBrowser();
        browser = browserHandle.browser
        page = browserHandle.page

        res.status(200).send('Action completed successfully');
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('An error occurred');
    }
});


app.get('/puppeteer/login', async (req, res) => {
    try {
        
        let usersConfig = require('./users.json')
        let users = usersConfig.data
        // console.log(users)

        await loginToCraigslist(page, users[0].username, users[0].password)

        res.status(200).send('Action completed successfully');
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('An error occurred');
    }
});

// API endpoint to interact with Puppeteer
app.get('/puppeteer/scrape_listings', async (req, res) => {
    try {
        await scrapeListings(page)

        res.status(200).send('Action completed successfully');
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('An error occurred');
    }
});

// API endpoint to interact with Puppeteer
app.get('/puppeteer/full_scrape_listings', async (req, res) => {
    try {
        await scrapeListingsAllPages(page)
        res.status(200).send('full sync success');
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('An error occurred');
    }
});

// API endpoint to interact with Puppeteer
app.get('/puppeteer/republish', async (req, res) => {
    try {
        const { listingId } = req.query;
        await repostListing(page, listingId, false)

        let date = new Date().toISOString();
        saveProcessResult(listingId, 'success', date)

        res.status(200).send('Action completed successfully');
    } catch (error) {
        console.error('Error:', error);

        let date = new Date().toISOString();
        saveProcessResult(listingId, 'error', date)
        
        res.status(500).send('An error occurred');
    }
});

// API endpoint to interact with Puppeteer
app.get('/puppeteer/close', async (req, res) => {
    try {
        page.close()
        browser.close()
        res.status(200).send('Action completed successfully');
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('An error occurred');
    }
});

// Start the Express server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
