"""Refresh configured networks; never erase a working city if a feed fails."""
import argparse
import datetime
import json
import os
import pathlib
import re
import urllib.request
import zipfile
from gtfs import parse_gtfs, merge_networks
from geometry import enrich, clear_missing, retain_published_geometry

ROOT = pathlib.Path(__file__).resolve().parents[1]
CONFIG = json.loads((ROOT/'tools/providers.json').read_text(encoding='utf-8'))
CACHE = ROOT/'tools/cache'
CACHE.mkdir(exist_ok=True)


def download(url):
    request = urllib.request.Request(url, headers={'User-Agent': 'EnRuta/2.0', 'Accept': '*/*'})
    with urllib.request.urlopen(request, timeout=50) as response: return response.read()


def mirror_url(feed):
    page = download('https://mobilitydatabase.org/feeds/gtfs/'+feed).decode()
    urls = re.findall(r'https://files\.mobilitydatabase\.org/'+feed+r'/[^"<>\\ ]+\.zip', page)
    if not urls: raise ValueError('No public archive link')
    return max(urls)


def fetch_feed(feed, local):
    path = CACHE/(feed['cache']+'.zip')
    source_path = CACHE/(feed['cache']+'.source')
    source = source_path.read_text() if source_path.exists() else feed.get('url', 'https://mobilitydatabase.org/feeds/gtfs/'+feed.get('mirror', ''))
    if local:
        if feed['id']=='tmb' and not path.exists(): path.write_bytes((ROOT/'tools/gtfs.zip').read_bytes())
        return path.read_bytes(), source
    try:
        public = feed.get('url')
        url = public
        if feed['id']=='tmb':
            if os.getenv('TMB_APP_ID') and os.getenv('TMB_APP_KEY'):
                from urllib.parse import urlencode
                url += '?' + urlencode({'app_id':os.environ['TMB_APP_ID'], 'app_key':os.environ['TMB_APP_KEY']})
            else: url = None
        if url:
            try: raw = download(url)
            except Exception:
                if not feed.get('mirror'): raise
                public = mirror_url(feed['mirror']); raw = download(public)
        else:
            public = mirror_url(feed['mirror']); raw = download(public)
        if not zipfile.is_zipfile(__import__('io').BytesIO(raw)): raise ValueError('Response is not a GTFS zip')
        path.write_bytes(raw); source_path.write_text(public)
        return raw, public
    except Exception:
        # Error text intentionally omits upstream URLs and authentication values.
        if path.exists():
            print(feed['id']+': download unavailable; retained cached archive')
            return path.read_bytes(), source
        raise RuntimeError(feed['id']+': download unavailable; existing city data retained') from None


def write_city(city, parts):
    network, schedule = merge_networks(parts, city)
    if not schedule['trips']: raise ValueError('No usable trips')
    out = ROOT/'public/data'/city['id']; out.mkdir(parents=True, exist_ok=True)
    if (out/'network.json').exists() and (out/'schedule.json').exists():
        old_network=json.loads((out/'network.json').read_text(encoding='utf-8'))
        old_schedule=json.loads((out/'schedule.json').read_text(encoding='utf-8'))
        retained=retain_published_geometry(network,schedule,old_network,old_schedule)
        if retained:print(city['id']+': retained '+str(retained)+' exact published alignments',flush=True)
    serialized = [(out/(name+'.json'), json.dumps(obj, ensure_ascii=False, separators=(',', ':'))) for name,obj in [('network',network),('schedule',schedule)]]
    for path, content in serialized:
        temp = path.with_suffix('.tmp'); temp.write_text(content, encoding='utf-8'); temp.replace(path)
    print(city['id'], network['meta']['routes'], 'routes', network['meta']['stops'], 'boarding points', network['meta']['trips'], 'trips', flush=True)
    return network['meta']


def main():
    parser=argparse.ArgumentParser(); parser.add_argument('--local', action='store_true'); parser.add_argument('--city')
    args=parser.parse_args(); feedmap={f['id']:f for f in CONFIG['feeds']}; cached={}; shared_archive=None
    cities=[]
    for city in CONFIG['cities']:
        out=ROOT/'public/data'/city['id']/'network.json'
        if args.city and city['id']!=args.city:
            meta=json.loads(out.read_text(encoding='utf-8'))['meta'] if out.exists() else None
        else:
            try:
                parts=[]
                for fid in city['feeds']:
                    feed=feedmap[fid]
                    if fid not in cached:
                        print('Importing '+fid, flush=True)
                        if feed['cache']=='andalucia' and shared_archive:
                            raw,source=shared_archive
                        else:
                            raw,source=fetch_feed(feed,args.local)
                            if feed['cache']=='andalucia':shared_archive=(raw,source)
                        cached[fid]=parse_gtfs(raw,feed,source)
                        n,s=cached[fid]
                        try: enrich(n,s,feed)
                        except Exception as error:
                            n.pop('_trips',None)
                            print(fid+': geometry enrichment unavailable ('+type(error).__name__+'); no schematic fallback',flush=True)
                        clear_missing(n)
                    parts.append(cached[fid])
                meta=write_city(city,parts)
            except Exception as error:
                print(city['id']+': import unavailable ('+type(error).__name__+'); retaining published files',flush=True)
                meta=json.loads(out.read_text(encoding='utf-8'))['meta'] if out.exists() else None
        if meta:
            cities.append({**city,'routes':meta['routes'],'stops':meta['stops'],'trips':meta['trips'],'feeds':meta['feeds'],
                           'network':'./data/'+city['id']+'/network.json','schedule':'./data/'+city['id']+'/schedule.json'})
        cached.clear()  # Keep peak memory bounded when parsing large national feeds.
    if not cities: raise RuntimeError('No networks available')
    (ROOT/'public/data/cities.json').write_text(json.dumps({'schema':2,'cities':cities},ensure_ascii=False,indent=2),encoding='utf-8')


if __name__=='__main__': main()
