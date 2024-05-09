from flask import Flask, request, jsonify, render_template, session, make_response, redirect
import datetime
import os
import json
from logger import app_logger
import subprocess
import requests
from dateutil import parser

def start_puppeteer_bot():
    subprocess.Popen(['powershell.exe', '-ExecutionPolicy',  'Bypass', '-File', '.\\run_bot.ps1'])

app = Flask(__name__)
app.secret_key = 'my-secret-key'
app.config["SESSION_PERMANENT"] = True

@app.route('/', methods=['GET', 'POST'])
def index():
    print('starting session', session)

    if 'batchIds' not in session:
        print('resetting batch ids')
        session['batchIds'] = json.dumps({"ids":[]})
        batchIds = {"ids": []}
    else:
        batchIds = json.loads(session['batchIds'])

    try:
        listings = json.loads( open('cl-bot/data/listings.json', 'rb').read() )
    except:
        listings = []

    full_listings = listings
    # pull out valid listing regions
    regions_all = list(set([x[3]['text'][:3] for x in listings]))
    regions_all.sort()
    # process the expiry days for filtering
    for item in listings:
        item[6]['days'] = item[6]['text'].split(' ')[0]
        try:
            item[6]['days'] = int(item[6]['days'])
        except:
            item[6]['days'] = -1

    applied_filters = ''
    if request.method == 'POST':
        print('starting session', session)
        print('form data', request.form)
        if 'category' in request.form and len(request.form['category']) > 0:
            session['category'] = request.form['category']
        if 'expiry' in request.form and len(request.form.get('expiry'))>0:
            expiry_input = request.form.get('expiry') if len(request.form.get('expiry'))>0 else 90
            session['expiry'] = int(expiry_input)
        if 'datePickerStart' in request.form and len(request.form.get('datePickerStart'))>0:
            session['datePickerStart'] = request.form.get('datePickerStart')
        if 'datePickerEnd' in request.form and len(request.form.get('datePickerEnd'))>0:
            session['datePickerEnd'] = request.form.get('datePickerEnd')

    if 'expiry' in session:
        expiry_input = session['expiry']
        listings = [x for x in listings if expiry_input > x[6]['days'] > 0]
    if 'category' in session:
        category_filter = session['category']
        listings = [x for x in listings if category_filter in x[3]['text']]
        applied_filters += f"[category={category_filter}]"
    if 'datePickerStart' in session:
        start_date = parser.parse(session['datePickerStart'])
        listings = [x for x in listings if start_date < parser.parse(x[4]['text'][:11])]
        applied_filters += f"[dateStart={start_date}]"
    if 'datePickerEnd' in session:
        end_date = parser.parse(session['datePickerEnd'])
        listings = [x for x in listings if end_date >= parser.parse(x[4]['text'][:11])]
        applied_filters += f"[dateEnd={end_date}]"

    print('final session', session)

    batch_republish_listings = [x for x in full_listings if x[7]['text'] in batchIds["ids"]]
    return render_template('listings.html', listings=listings, applied_filters=applied_filters, category_options=regions_all, batch_republish_listings=batch_republish_listings)


@app.route('/clear_filters', methods=['GET', 'POST'])
def clear_session():
    if 'expiry' in session:
        del session['expiry']
    if 'category' in session:
        del session['category']
    if 'datePickerStart' in session:
        del session['datePickerStart']
    if 'datePickerEnd' in session:
        del session['datePickerEnd']      
    return 'success'

@app.route('/update_session', methods=['POST'])
def update_session():
    data = request.json
    batch_id = data.get('id')

    # Initialize session['batchIds'] if it doesn't exist
    # session.setdefault('batchIds', [])
    if 'batchIds' not in session:
        print('resetting batch ids')
        session['batchIds'] = json.dumps({"ids":[]})
        batchIds = {"ids": []}
    else:
        batchIds = json.loads(session['batchIds'])

    # Append the batch ID to session['batchIds']
    batchIds["ids"].append(batch_id)
    batchIds["ids"] = list(set(batchIds["ids"]))
    session['batchIds'] = json.dumps(batchIds)
    print(session)
    return 'Session updated', 200


@app.route('/remove_from_batch', methods=['POST'])
def remove_from_batch():
    data = request.json
    item_id = data.get('id')

     # Initialize session['batchIds'] if it doesn't exist
    # session.setdefault('batchIds', [])
    if 'batchIds' not in session:
        print('resetting batch ids')
        session['batchIds'] = json.dumps({"ids":[]})
        batchIds = {"ids": []}
    else:
        batchIds = json.loads(session['batchIds'])
    
    print('removing', item_id)
    if item_id in batchIds["ids"]:
        batchIds["ids"].remove(item_id)
        session['batchIds'] = json.dumps(batchIds)

    return 'success'

@app.route('/clear_batch', methods=['GET'])
def clear_batch():
    batchIds = {"ids": []}
    session['batchIds'] = json.dumps(batchIds)
    return redirect('/')

@app.route('/print_session', methods=['GET', 'POST'])
def print_session():
    print(session)
    return 'success'

@app.route('/sync', methods=['GET'])
def listings():
    res = requests.get('http://localhost:3000/puppeteer/restart')
    res = requests.get('http://localhost:3000/puppeteer/login')
    res = requests.get('http://localhost:3000/puppeteer/scrape_listings')
    res = requests.get('http://localhost:3000/puppeteer/close')


    listings = json.loads( open('cl-bot/data/listings.json', 'rb').read() )
    return render_template('listings.html', listings=listings)

@app.route('/fullsync', methods=['GET'])
def all_listings():
    res = requests.get('http://localhost:3000/puppeteer/restart')
    res = requests.get('http://localhost:3000/puppeteer/login')
    res = requests.get('http://localhost:3000/puppeteer/full_scrape_listings')
    res = requests.get('http://localhost:3000/puppeteer/close')


    listings = json.loads( open('cl-bot/data/listings.json', 'rb').read() )
    return redirect('/')

@app.route('/republish', methods=['GET'])
def republish():
    listingId = request.args['listingId']
    print(listingId)
    res = requests.get('http://localhost:3000/puppeteer/restart')
    res = requests.get('http://localhost:3000/puppeteer/login')
    res = requests.get(f'http://localhost:3000/puppeteer/republish?listingId={listingId}')
    res = requests.get('http://localhost:3000/puppeteer/close')

    # listings = json.loads( open('cl-bot/data/listings.json', 'rb').read() )
    # return render_template('listings.html', listings=listings)
    return "success"


@app.route('/batch_republish', methods=['POST'])
def batch_republish():


    if 'batchIds' not in session:
        print('resetting batch ids')
        session['batchIds'] = json.dumps({"ids":[]})
        batchIds = {"ids": []}
    else:
        batchIds = json.loads(session['batchIds'])

    try:
        listings = json.loads( open('cl-bot/data/listings.json', 'rb').read() )
    except:
        listings = []

    batch_republish_listings = [x for x in listings if x[7]['text'] in batchIds["ids"]]
    # print('republishing these listings', batch_republish_listings)
    ids = [x[7]['text'] for x in batch_republish_listings]

    print('republishing', ids)
    res = requests.get('http://localhost:3000/puppeteer/restart')
    res = requests.get('http://localhost:3000/puppeteer/login')
    for republish_id in ids:
        res = requests.get(f'http://localhost:3000/puppeteer/republish?listingId={republish_id}')
        app_logger.debug(f"id: {republish_id} code: {res.status_code}")

    res = requests.get('http://localhost:3000/puppeteer/close')

    # listings = json.loads( open('cl-bot/data/listings.json', 'rb').read() )
    # return render_template('listings.html', listings=listings)
    # app_logger.debug(ids)

    return render_template('republish_results.html')

@app.route('/confirm', methods=['GET', 'POST'])
def confirm():

    # selected_ids = request.args.get('selected_ids')

    if 'batchIds' not in session:
        print('resetting batch ids')
        session['batchIds'] = json.dumps({"ids":[]})
        batchIds = {"ids": []}
    else:
        batchIds = json.loads(session['batchIds'])

    try:
        listings = json.loads( open('cl-bot/data/listings.json', 'rb').read() )
    except:
        listings = []

    batch_republish_listings = [x for x in listings if x[7]['text'] in batchIds["ids"]]
    print('republishing these listings', batch_republish_listings)
    if request.method == 'POST':
        selected_ids = ','.join([x[7]['text'] for x in batch_republish_listings])
        print('republishing selected ids', selected_ids)
        requests.get(f'http://localhost:5000/batch_republish?ids={selected_ids}')

    return render_template('confirm.html', batch_republish_listings=batch_republish_listings)


from flask import send_file
import pandas as pd

@app.route('/export', methods=['GET', 'POST'])
def export():
    listings = json.loads( open('cl-bot/data/listings.json', 'rb').read() )

    for item in listings:
        item[6]['days'] = item[6]['text'].split(' ')[0]
        try:
            item[6]['days'] = int(item[6]['days'])
        except:
            item[6]['days'] = -1

    data = [
        {
        'id': x[7]['text'],
        'title': x[2]['text'],
        'status': x[0]['text'],
        'url':  x[2].get('ref', 'none'),
        'manageLink': x[1]['postref'],
        'category': x[3]['text'],
        'postedDate': x[4]['text'],
        'expiry': x[6]['days']
        } for x in listings
    ]
    pd.DataFrame(data).to_csv('data/export.csv', index=False)

    return send_file('data/export.csv', as_attachment=True)

if __name__ == '__main__':
    start_puppeteer_bot()
    app.run(debug=True)

