import os
import datetime
import thread
import gzip
import tarfile
import StringIO

from flask import Flask, url_for, session, redirect, request, Response
from flask import render_template
import memcache
import json
from boto.s3.connection import S3Connection

import settings

app = Flask(__name__)
mc = memcache.Client(['127.0.0.1:11211'], debug=0)
s3 = S3Connection(settings.AWS_KEY, settings.AWS_SECRET_KEY)
bucket = s3.get_bucket(settings.BUCKET_NAME)

app.debug = settings.APP_DEBUG
app.secret_key = settings.APP_SECRET_KEY

# Helper functions
def _update_cameras():
    camera_names = []
    for item in bucket.list():
        if not os.path.splitext(item.name)[1]:
            camera_names.append(item.name)
    mc.set("camera_names", camera_names, settings.NAMES_TIMEOUT)
    return camera_names

def _update_events(name):
    events = []
    for item in bucket.list(name):
        if not os.path.splitext(item.name)[1]:
            continue
        try:
            _, filename = os.path.split(item.name)
            datestr, _ = os.path.splitext(os.path.splitext(filename)[0])
            id = datestr
            datestr, _ = datestr.split("-")
            date = datetime.datetime.strptime(datestr, "%Y%m%d%H%M%S")
            event_name = date.strftime("%c")
        except Exception as e:
            print "Error parsing %s" % item.name
            continue

        url = '/api/cameras/%s/events/%s' % (name, id)
        events.append({'name':event_name, 'url':url, 'id':id})
    mc.set(str('camera_events_%s' % name), events, settings.EVENTS_TIMEOUT)
    return events

def _basic_camera_dict(name):
    return {'name':name, 'url':'/api/cameras/%s' % name}

def _get_event_data(camera_name, event_name):
    keyname = str('%s/%s.tar.gz' % (camera_name, event_name))
    key = bucket.get_key(keyname)
    if key is None:
        return None
    gzipstr = key.get_contents_as_string()
    gzipfile = gzip.GzipFile(fileobj=StringIO.StringIO(gzipstr), mode='r')
    eventtar = tarfile.TarFile(fileobj=gzipfile, mode='r')
    for name in eventtar.getnames():
        if name.endswith('.swf'):
            event_data = eventtar.extractfile(name).read()
            mc.set(str('camera_event_%s_%s' % (camera_name, event_name)), event_data, settings.EVENT_TIMEOUT)
            return event_data
    return None


# API endpoints
@app.route('/api/cameras/')
def cameras():
    camera_names = mc.get('camera_names')
    if camera_names is None:
        camera_names = _update_cameras()
    cameras = [_basic_camera_dict(n) for n in camera_names]
    return Response(json.dumps(cameras))

@app.route('/api/cameras/<name>')
def camera(name):
    data = _basic_camera_dict(name)

    events = mc.get(str('camera_events_%s' % name))
    if events is None:
        events = _update_events(name)
    else:
        # If it was in the cache, update it anyways, but in the background
        thread.start_new_thread(_update_events, (name,))
    data['events'] = events

    return Response(json.dumps(data))

@app.route('/api/cameras/<camera_name>/events/<event_name>')
def event(camera_name, event_name):
    event_data = mc.get(str('camera_event_%s_%s' % (camera_name, event_name)))
    if event_data is None:
        event_data = _get_event_data(camera_name, event_name)
    if event_data is None:
        return Response(status=404)
    return Response(event_data, mimetype='application/x-shockwave-flash')

# Pages that actually get loaded
@app.route('/')
def index():
    return render_template('index.html')

@app.route('/cameras/<name>')
def camera_html(name):
    return render_template('index.html')
    
if __name__=='__main__':
    app.run()