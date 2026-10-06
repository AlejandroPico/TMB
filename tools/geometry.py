"""Enrich missing GTFS shapes with published street/rail geometry, never chords.

IGN paths are reconstructed over the rail graph through the scheduled stations;
they describe physical infrastructure, not a dispatcher-confirmed service path.
"""
import collections
import heapq
import json
import math
import pathlib
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
CACHE = ROOT/'tools/cache'
IGN = 'https://api-features.idee.es/collections/railwaylink'
TUSSAM = 'https://services1.arcgis.com/hcmP7kr0Cx3AcTJk/arcgis/rest/services/TUSSAM_Lineas/FeatureServer/0'
LICENSE_IGN = 'https://www.ign.es/resources/licencia/Condiciones_licenciaUso_IGN.pdf'

def metres(a,b):
    lat=math.radians((a[1]+b[1])/2)
    return math.hypot((a[0]-b[0])*math.cos(lat),a[1]-b[1])*111195

def cached_json(name,url):
    path=CACHE/(name+'.json')
    if path.exists(): return json.loads(path.read_text(encoding='utf-8'))
    request=urllib.request.Request(url,headers={'User-Agent':'EnRuta/2.0 (+https://github.com/AlejandroPico/TMB)'})
    with urllib.request.urlopen(request,timeout=90) as response: raw=response.read()
    data=json.loads(raw)
    if data.get('error'): raise ValueError('Geometry source returned an error')
    path.write_bytes(raw)
    return data

def rail_features():
    path=CACHE/'rail-links.json'
    if path.exists():return json.loads(path.read_text(encoding='utf-8'))['features']
    features=[];offset=0
    while True:
        page=cached_json('rail-links-'+str(offset),IGN+'/items?f=json&limit=10000&offset='+str(offset))
        batch=page.get('features',[]);features.extend(batch)
        if not batch or not any(l.get('rel')=='next' for l in page.get('links',[])):break
        offset+=len(batch)
    if not features:raise ValueError('No railway geometry')
    path.write_text(json.dumps({'features':features}),encoding='utf-8')
    return features

def projection(point,coords,minimum=0):
    """Closest point on a line after a distance, with no cross-track jump."""
    best=None;travel=0;cos=math.cos(math.radians(point[1]))
    for a,b in zip(coords,coords[1:]):
        length=metres(a,b)
        if travel+length<minimum:travel+=length;continue
        x,y=(b[0]-a[0])*cos,b[1]-a[1]
        mix=max(0,min(1,(((point[0]-a[0])*cos)*x+(point[1]-a[1])*y)/(x*x+y*y))) if x*x+y*y else 0
        if length:mix=max(mix,(minimum-travel)/length)
        q=[a[0]+(b[0]-a[0])*mix,a[1]+(b[1]-a[1])*mix]
        error=metres(point,q);at=travel+length*mix
        if best is None or error<best[0]:best=(error,at,q)
        travel+=length
    return best

def line_match(points,coords,tolerance=120):
    last=0;positions=[];errors=[]
    for point in points:
        match=projection(point,coords,last)
        if not match or match[0]>tolerance:return None
        errors.append(match[0]);positions.append(match[1]);last=match[1]
    if positions[-1]-positions[0]<metres(points[0],points[-1])*.7:return None
    return sum(errors)/len(errors),positions

def trim(coords,start,end):
    result=[];travel=0
    for a,b in zip(coords,coords[1:]):
        length=metres(a,b);after=travel+length
        if after>=start and travel<=end:
            lo=max(0,(start-travel)/length) if length else 0
            hi=min(1,(end-travel)/length) if length else 0
            for mix in [lo,hi]:
                q=[round(a[0]+(b[0]-a[0])*mix,6),round(a[1]+(b[1]-a[1])*mix,6)]
                if not result or q!=result[-1]:result.append(q)
        travel=after
    return result

def tussam_geometry(n):
    data=cached_json('tussam-paths',TUSSAM+'/query?f=geojson&where=1%3D1&outFields=*&outSR=4326')
    choices=collections.defaultdict(list)
    def ref(value):return str(value).upper().lstrip('0') or '0'
    for f in data['features']:
        geom=f['geometry'];lines=[geom['coordinates']] if geom['type']=='LineString' else geom['coordinates']
        for line in lines:
            if len(line)>2:choices[ref(f['properties']['LabelLinea'])].append((line,f['properties']))
    replacements={}
    for r in n['routes']:
        for d in r['directions']:
            sid=d['shape']
            if n['shapeInfo'][sid]['kind']!='missing':continue
            points=n['shapes'][sid];best=None
            for coords,props in choices[ref(r['name'])]:
                for line in [coords,list(reversed(coords))]:
                    match=line_match(points,line)
                    if match and (best is None or match[0]<best[0]):best=(match[0],line,match[1],props)
            if best:
                line=trim(best[1],best[2][0],best[2][-1]);replacements[sid]=(line,best[3])
                r['color']=best[3].get('Color') or r['color']
    # Match all trip patterns, including short workings absent from directions.
    route_shapes=collections.defaultdict(set)
    for t in n.pop('_trips'):route_shapes[t[0]].add(t[2])
    for ri,shapes in route_shapes.items():
        r=n['routes'][ri]
        for sid in shapes:
            if sid in replacements or n['shapeInfo'][sid]['kind']!='missing':continue
            points=n['shapes'][sid];best=None
            for coords,props in choices[ref(r['name'])]:
                for line in [coords,list(reversed(coords))]:
                    match=line_match(points,line)
                    if match and (best is None or match[0]<best[0]):best=(match[0],line,match[1],props)
            if best:replacements[sid]=(trim(best[1],best[2][0],best[2][-1]),best[3])
    for sid,(line,props) in replacements.items():
        n['shapes'][sid]=line;n['shapeInfo'][sid]={'kind':'municipal','source':TUSSAM,'license':'https://sig.urbanismosevilla.org/GeoPortal.aspx','route':str(props['Ruta'])}
    return len(replacements)

def metro_geometry(n):
    # A complete OSM route relation supplies the underground alignment missing
    # from both the operator GTFS and IGN's national railway collection.
    import urllib.parse
    query='[out:json][timeout:60];relation(255088);out geom;'
    data=cached_json('metro-osm','https://overpass-api.de/api/interpreter?'+urllib.parse.urlencode({'data':query}))
    relation=next(e for e in data['elements'] if e['type']=='relation' and e['id']==255088)
    pieces=[]
    for member in relation['members']:
        if member['type']!='way' or member.get('role') in ['platform','stop']:continue
        coords=[[round(c['lon'],6),round(c['lat'],6)] for c in member.get('geometry',[])]
        if len(coords)>1:pieces.append(coords)
    if not pieces:raise ValueError('No Metro alignment')
    line=pieces.pop(0)
    while pieces:
        found=False
        for i,piece in enumerate(pieces):
            if metres(line[-1],piece[0])<2:line.extend(piece[1:]);found=True
            elif metres(line[-1],piece[-1])<2:line.extend(list(reversed(piece))[1:]);found=True
            elif metres(line[0],piece[-1])<2:line=piece[:-1]+line;found=True
            elif metres(line[0],piece[0])<2:line=list(reversed(piece))[:-1]+line;found=True
            if found:pieces.pop(i);break
        if not found:raise ValueError('Disconnected Metro relation; refused a bridge')
    count=0
    for sid,info in enumerate(n['shapeInfo']):
        if info['kind']!='missing':continue
        points=n['shapes'][sid]
        for coords in [line,list(reversed(line))]:
            match=line_match(points,coords,200)
            if match:
                n['shapes'][sid]=trim(coords,match[1][0],match[1][-1]);n['shapeInfo'][sid]={'kind':'osm-route','source':'https://www.openstreetmap.org/relation/255088','license':'https://www.openstreetmap.org/copyright'};count+=1;break
    return count

def simplify(coords,tolerance=8):
    """Douglas–Peucker within 8 m, retaining curves without multi-MB duplicates."""
    if len(coords)<3:return coords
    keep={0,len(coords)-1};stack=[(0,len(coords)-1)]
    while stack:
        a,b=stack.pop();p,q=coords[a],coords[b];cos=math.cos(math.radians((p[1]+q[1])/2));x,y=(q[0]-p[0])*cos,q[1]-p[1];den=x*x+y*y;best=tolerance;chosen=None
        for k in range(a+1,b):
            c=coords[k];mix=max(0,min(1,(((c[0]-p[0])*cos)*x+(c[1]-p[1])*y)/den)) if den else 0
            error=metres(c,[p[0]+(q[0]-p[0])*mix,p[1]+(q[1]-p[1])*mix])
            if error>best:best=error;chosen=k
        if chosen is not None:keep.add(chosen);stack.extend([(a,chosen),(chosen,b)])
    return [coords[k] for k in sorted(keep)]

class RailGraph:
    def __init__(self,features,points):
        self.lines=[];self.grid=collections.defaultdict(list);self.graph=collections.defaultdict(list);self.lookup={};self.nodes=[];self.cache={}
        for f in features:
            g=f.get('geometry') or {};p=f['properties']
            if g.get('type')!='LineString':continue
            coords=[[round(c[0],6),round(c[1],6)] for c in g['coordinates']]
            if len(coords)<2:continue
            eid=len(self.lines);self.lines.append((coords,p))
            for k,c in enumerate(coords):self.grid[self.cell(c)].append((eid,k,c))
        self.snaps={}
        cuts=collections.defaultdict(set)
        for point in points:
            for highspeed in [False,True]:
                snap=self.nearest(point,highspeed)
                if snap:
                    eid,k,c=snap;cuts[eid].add(k);self.snaps[(tuple(point),highspeed)]=self.node(c)
        for eid,(coords,props) in enumerate(self.lines):
            indexes=sorted({0,len(coords)-1,*cuts[eid]})
            for a,b in zip(indexes,indexes[1:]):
                sub=coords[a:b+1];u,v=self.node(sub[0]),self.node(sub[-1]);length=sum(metres(x,y) for x,y in zip(sub,sub[1:]))
                if u==v or not length:continue
                edge=(sub,props,length)
                self.graph[u].append((v,edge,False));self.graph[v].append((u,edge,True))
        # Never manufacture links between disconnected pieces of infrastructure.
    @staticmethod
    def cell(c):return (math.floor(c[0]*100),math.floor(c[1]*100))
    def node(self,c):
        # Adjacent IGN tiles occasionally differ by centimetres at a junction.
        # Quantization only repairs sub-metre endpoint precision, never a gap.
        key=tuple(round(v,5) for v in c)
        if key not in self.lookup:self.lookup[key]=len(self.nodes);self.nodes.append(c)
        return self.lookup[key]
    def nearest(self,point,highspeed=False):
        x,y=self.cell(point);best=None;error=500
        for xx in range(x-1,x+2):
            for yy in range(y-1,y+2):
                for candidate in self.grid.get((xx,yy),[]):
                    actual=metres(point,candidate[2])
                    if actual>500:continue
                    gauge=self.lines[candidate[0]][1].get('nominalgauge')
                    d=actual+(220 if highspeed and gauge!=1435 else 0)
                    if d<error:error=d;best=candidate
        return best
    def path(self,a,b,highspeed=False):
        u,v=self.snaps.get((tuple(a),highspeed)),self.snaps.get((tuple(b),highspeed))
        if u is None or v is None:return None
        key=(u,v,highspeed)
        if key in self.cache:return self.cache[key]
        if u==v:return [self.nodes[u]]
        queue=[(metres(self.nodes[u],self.nodes[v]),0,u)];dist={u:0};prev={};limit=metres(a,b)*5+30000
        while queue:
            _,cost,node=heapq.heappop(queue)
            if cost!=dist.get(node):continue
            if node==v:break
            if cost>limit:continue
            for target,edge,reverse in self.graph[node]:
                coords,props,length=edge;gauge=props.get('nominalgauge')
                penalty=(1 if gauge==1435 else 3 if gauge==1668 else 1.8) if highspeed else (1.35 if gauge==1435 else 1)
                at=cost+length*penalty
                if at<dist.get(target,math.inf):
                    dist[target]=at;prev[target]=(node,coords,reverse);heapq.heappush(queue,(at+metres(self.nodes[target],self.nodes[v]),at,target))
        if v not in prev:self.cache[key]=None;return None
        pieces=[];node=v
        while node!=u:
            before,coords,reverse=prev[node];pieces.append(list(reversed(coords)) if reverse else coords);node=before
        result=[]
        for piece in reversed(pieces):result.extend(piece if not result else piece[1:])
        length=sum(metres(x,y) for x,y in zip(result,result[1:]))
        if length>metres(a,b)*3+30000:result=None
        self.cache[key]=result
        return result

def enrich(n,s,feed):
    if not n.get('shapeInfo'):return
    missing=[i for i,v in enumerate(n['shapeInfo']) if v['kind']=='missing']
    if not missing:return
    count=0
    if feed['id']=='tussam':
        n['_trips']=s['trips'];count=tussam_geometry(n)
    elif feed['id']=='metro-sevilla':
        count=metro_geometry(n)
    elif feed['id'] in ['renfe','cercanias']:
        graph=RailGraph(rail_features(),[p for sid in missing for p in n['shapes'][sid]])
        modes={t[2]:('AVE' in n['routes'][t[0]]['name'].upper() or 'AVLO' in n['routes'][t[0]]['name'].upper()) for t in s['trips']}
        for sid in missing:
            coords=[];valid=True
            for a,b in zip(n['shapes'][sid],n['shapes'][sid][1:]):
                piece=graph.path(a,b,modes.get(sid,False))
                if not piece:valid=False;break
                coords.extend(piece if not coords else piece[1:])
            if valid and len(coords)>2:
                n['shapes'][sid]=simplify(coords);n['shapeInfo'][sid]={'kind':'rail-network','source':IGN,'license':LICENSE_IGN,'method':'Shortest connected infrastructure path through GTFS stops; gauge weighted for AVE/Avlo. Service corridor is inferred. Geometry simplified within 8 m.'};count+=1
    for r in n['routes']:
        for d in r['directions']:d['approximate']=n['shapeInfo'][d['shape']]['kind']=='missing'
    remaining=sum(x['kind']=='missing' for x in n['shapeInfo'])
    n['meta']['originalMissingShapes']=n['meta'].get('approximateShapes',0)
    n['meta']['approximateShapes']=remaining
    n['meta']['missingShapes']=remaining;n['meta']['reconstructedShapes']=count
    n['meta']['geometrySources']=list({x['source'] for x in n['shapeInfo'] if x['kind'] in ['municipal','rail-network','osm-route']})
    print(feed['id']+': '+str(count)+' recovered paths; '+str(remaining)+' unavailable (not drawn)',flush=True)

def clear_missing(n):
    for i,info in enumerate(n.get('shapeInfo',[])):
        if info['kind']=='missing':n['shapes'][i]=[]

def retain_published_geometry(network,schedule,old_network,old_schedule):
    """Reuse only an exact route/stop sequence when upstream geometry is offline."""
    def key(n,s,t):
        return (n['routes'][t[0]]['id'],tuple(n['stops'][i]['id'] for i in s['patterns'][t[4]][0]))
    previous={}
    for t in old_schedule['trips']:
        sid=t[2];info=old_network.get('shapeInfo',[])
        if sid<len(info) and info[sid]['kind'] in ['municipal','osm-route','rail-network'] and len(old_network['shapes'][sid])>=2:
            previous[key(old_network,old_schedule,t)]=(old_network['shapes'][sid],info[sid])
    restored=set()
    for t in schedule['trips']:
        sid=t[2]
        if network['shapeInfo'][sid]['kind']!='missing':continue
        found=previous.get(key(network,schedule,t))
        if found:
            network['shapes'][sid],info=found
            network['shapeInfo'][sid]={**info,'retained':True};restored.add(sid)
    for r in network['routes']:
        for d in r['directions']:d['approximate']=network['shapeInfo'][d['shape']]['kind']=='missing'
    for f in network['meta']['feeds']:
        shapes={t[2] for t in schedule['trips'] if network['routes'][t[0]]['feed']==f['id']}
        f['missingShapes']=f['approximateShapes']=sum(network['shapeInfo'][i]['kind']=='missing' for i in shapes)
        f['retainedShapes']=len(restored & shapes)
    return len(restored)
