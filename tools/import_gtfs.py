"""Import official TMB GTFS; use its public Mobility Database archive without credentials."""
import csv, io, json, os, re, urllib.request, zipfile, collections, datetime, pathlib, hashlib
ROOT = pathlib.Path(__file__).resolve().parents[1]
def download(url):
    return urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent':'BarcelonaLatido/1.0'}), timeout=60).read()
def generate(raw, source):
    z=zipfile.ZipFile(io.BytesIO(raw))
    def rows(name):
        return list(csv.DictReader(io.TextIOWrapper(z.open(name), encoding='utf-8-sig'))) if name in z.namelist() else []
    def sec(v):
        if not v:return None
        h,m,s=map(int,v.split(':'));return h*3600+m*60+s
    stops=[{'id':s['stop_id'],'code':s.get('stop_code',''),'name':s['stop_name'],'lat':float(s['stop_lat']),'lon':float(s['stop_lon']),'kind':int(s.get('location_type') or 0),'parent':s.get('parent_station',''),'accessible':int(s.get('wheelchair_boarding') or 0)} for s in rows('stops.txt')]
    si={s['id']:i for i,s in enumerate(stops)}
    routes=[{'id':r['route_id'],'name':r['route_short_name'],'description':r['route_long_name'],'type':int(r['route_type']),'color':'#'+(r.get('route_color') or '81b6a4'),'url':r.get('route_url','')} for r in rows('routes.txt')]
    ri={r['id']:i for i,r in enumerate(routes)}
    shapes={}
    for s in rows('shapes.txt'):shapes.setdefault(s['shape_id'],[]).append((int(s['shape_pt_sequence']),[float(s['shape_pt_lon']),float(s['shape_pt_lat'])]))
    shapeids=list(shapes);shi={s:i for i,s in enumerate(shapeids)}
    shapevalues=[[x[1] for x in sorted(shapes[s])] for s in shapeids]
    triprows=rows('trips.txt');tripmap={t['trip_id']:t for t in triprows}
    stop_times={}
    for st in rows('stop_times.txt'):
        if st['trip_id'] in tripmap:stop_times.setdefault(st['trip_id'],[]).append((int(st['stop_sequence']),si[st['stop_id']],sec(st['arrival_time']),sec(st['departure_time'])))
    serviceids=sorted({t['service_id'] for t in triprows});sei={s:i for i,s in enumerate(serviceids)}
    services=[{'id':s,'dates':[],'removed':[],'calendar':None} for s in serviceids]
    for c in rows('calendar.txt'):
        if c['service_id'] in sei:services[sei[c['service_id']]]['calendar']=[c['start_date'],c['end_date'],*[int(c[d]) for d in ['monday','tuesday','wednesday','thursday','friday','saturday','sunday']]]
    for c in rows('calendar_dates.txt'):
        if c['service_id'] in sei:services[sei[c['service_id']]]['dates' if c['exception_type']=='1' else 'removed'].append(c['date'])
    patterns=[];pm={};heads=[];hm={};trips=[];directions=collections.defaultdict(list);tripindex={}
    for t in triprows:
        times=sorted(stop_times.get(t['trip_id'],[]))
        if not times or t['shape_id'] not in shi:continue
        # GTFS permits blank times between timepoints. Interpolate only bounded gaps.
        known=[i for i,x in enumerate(times) if x[2] is not None and x[3] is not None]
        if not known or known[0]!=0 or known[-1]!=len(times)-1:continue
        for left,right in zip(known,known[1:]):
            for k in range(left+1,right):
                at=round(times[left][3]+(times[right][2]-times[left][3])*(k-left)/(right-left))
                times[k]=(times[k][0],times[k][1],at,at)
        start=times[0][2];p=([x[1] for x in times],[x[2]-start for x in times],[x[3]-start for x in times]);key=json.dumps(p,separators=(',',':'))
        if key not in pm:pm[key]=len(patterns);patterns.append(p)
        head=t['trip_headsign']
        if head not in hm:hm[head]=len(heads);heads.append(head)
        trip=[ri[t['route_id']],sei[t['service_id']],shi[t['shape_id']],hm[head],pm[key],start]
        tripindex[t['trip_id']]=len(trips);trips.append(trip)
        directions[(trip[0],int(t.get('direction_id') or 0))].append((trip[2],trip[4]))
    frequencies=[]
    for f in rows('frequencies.txt'):
        if f['trip_id'] in tripindex:frequencies.append([tripindex[f['trip_id']],sec(f['start_time']),sec(f['end_time']),int(f['headway_secs'])])
    for i,r in enumerate(routes):
        r['directions']=[]
        for d in [0,1]:
            choices=directions.get((i,d),[])
            if choices:
                sh,pi=collections.Counter(choices).most_common(1)[0][0]
                r['directions'].append({'shape':sh,'stops':patterns[pi][0],'direction':d})
        r['stops']=sorted({s for key,choices in directions.items() if key[0]==i for sh,pi in choices for s in patterns[pi][0]})
    feed=rows('feed_info.txt')[0]
    transfers=[[si[t['from_stop_id']],si[t['to_stop_id']],int(t['transfer_type']),int(t.get('min_transfer_time') or 0)] for t in rows('transfers.txt') if t['from_stop_id'] in si and t['to_stop_id'] in si]
    pathways=[[si[p['from_stop_id']],si[p['to_stop_id']],int(p.get('traversal_time') or 0),int(p['pathway_mode']),p.get('signposted_as','')] for p in rows('pathways.txt') if p['from_stop_id'] in si and p['to_stop_id'] in si]
    metadata={'publisher':'TMB','source':source,'fetchedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'version':feed['feed_version'],'start':feed['feed_start_date'],'end':feed['feed_end_date'],'sha256':hashlib.sha256(raw).hexdigest(),'routes':len(routes),'stops':sum(s['kind']==0 for s in stops),'trips':len(trips),'shapes':len(shapevalues),'timezone':'Europe/Madrid'}
    out=ROOT/'public'/'data';out.mkdir(parents=True,exist_ok=True)
    for name,obj in [('network',{'meta':metadata,'routes':routes,'stops':stops,'shapes':shapevalues,'transfers':transfers,'pathways':pathways}),('schedule',{'services':services,'patterns':patterns,'heads':heads,'trips':trips,'frequencies':frequencies})]:
        (out/(name+'.json')).write_text(json.dumps(obj,separators=(',',':'),ensure_ascii=False),encoding='utf-8')
    print(json.dumps(metadata,indent=2))
if __name__=='__main__':
    local=ROOT/'tools'/'gtfs.zip'
    source='https://files.mobilitydatabase.org/mdb-2359/mdb-2359-202610030154/mdb-2359-202610030154.zip'
    if '--local' in __import__('sys').argv:raw=local.read_bytes()
    else:
        appid=os.getenv('TMB_APP_ID');key=os.getenv('TMB_APP_KEY')
        if appid and key:
            raw=download('https://api.tmb.cat/v1/static/datasets/gtfs.zip?app_id='+appid+'&app_key='+key)
            source='https://api.tmb.cat/v1/static/datasets/gtfs.zip'
        else:
            page=download('https://mobilitydatabase.org/feeds/gtfs/mdb-2359').decode()
            urls=re.findall(r'https://files\.mobilitydatabase\.org/mdb-2359/[^"<>\\ ]+\.zip',page)
            if not urls:raise RuntimeError('No public GTFS archive was found. Existing data was preserved.')
            source=sorted(set(urls),reverse=True)[0];raw=download(source)
    generate(raw,source)
