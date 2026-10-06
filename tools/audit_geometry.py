"""Repeatable structural audit of every published geometry, with source totals."""
import collections,json,pathlib,datetime
from geometry import metres, projection
ROOT=pathlib.Path(__file__).resolve().parents[1]

def audit():
    report={'generatedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'policy':'No stop-to-stop fallback. Missing shapes are empty and are neither drawn nor animated. Rail-network alignments are inferred infrastructure paths, not operator-confirmed service itineraries.','cities':[]}
    for directory in sorted((ROOT/'public/data').iterdir()):
        if not directory.is_dir():continue
        n=json.loads((directory/'network.json').read_text(encoding='utf-8'));s=json.loads((directory/'schedule.json').read_text(encoding='utf-8'))
        assert len(n['shapes'])==len(n['shapeInfo'])
        counts=collections.defaultdict(collections.Counter);unavailable=0
        for t in s['trips']:counts[n['routes'][t[0]]['feed']][n['shapeInfo'][t[2]]['kind']]+=1
        for i,coords in enumerate(n['shapes']):
            info=n['shapeInfo'][i];assert info.get('source')
            if info['kind']=='missing':assert coords==[];unavailable+=1
            else:
                assert len(coords)>=2
                assert all(len(c)==2 and -180<=c[0]<=180 and -90<=c[1]<=90 for c in coords)
        for r in n['routes']:
            for d in r['directions']:assert d['approximate']==(n['shapeInfo'][d['shape']]['kind']=='missing')
        report['cities'].append({'id':directory.name,'shapes':len(n['shapes']),'unavailableShapes':unavailable,'scheduledTripsByGeometry':dict(counts)})
    return report

def audit_renfe():
    directory=ROOT/'public/data/espana'
    n=json.loads((directory/'network.json').read_text(encoding='utf-8'));s=json.loads((directory/'schedule.json').read_text(encoding='utf-8'))
    report={'routes':len(n['routes']),'trips':len(s['trips']), 'shapes':dict(collections.Counter(i['kind'] for i in n['shapeInfo'])),
            'rejected':dict(collections.Counter(i['rejectedReason'] for i in n['shapeInfo'] if i.get('rejectedReason'))),
            'policy':'All trip variants retain their own pattern and shape. Inferred loops/detours are withheld. Estimates for patterns with impossible segment speeds are suppressed at runtime. GPS is never inferred from timetable progress.',
            'inconsistentTimings':[]}
    paths={};seen=set()
    for t in s['trips']:
        p=s['patterns'][t[4]];key=(t[2],t[4])
        if key in seen:continue
        seen.add(key);coords=n['shapes'][t[2]]
        if not coords:continue
        pointskey=(t[2],tuple(p[0]))
        if pointskey not in paths:
            positions=[];last=0
            for st in p[0]:
                stop=n['stops'][st];match=projection([stop['lon'],stop['lat']],coords,last)
                if not match or match[0]>550:positions=[];break
                positions.append(match[1]);last=match[1]
            paths[pointskey]=positions
        positions=paths[pointskey]
        if not positions:continue
        r=n['routes'][t[0]]
        highspeed=any(word in r['name'].upper() for word in ['AVE','AVLO','AVANT','ALVIA','EUROMED','INTERCITY'])
        limit=200 if r['feed']=='cercanias' else 360 if highspeed else 220
        for k in range(len(positions)-1):
            seconds=p[1][k+1]-p[2][k];length=positions[k+1]-positions[k]
            if length*3.6/max(1,seconds)>limit:
                report['inconsistentTimings'].append({'route':r['id'],'shape':t[2],'pattern':t[4], 'from':n['stops'][p[0][k]]['name'], 'to':n['stops'][p[0][k+1]]['name'],'kmh':round(length*3.6/max(1,seconds)), 'seconds':seconds})
    report['checkedPatterns']=len(seen)
    return report

if __name__=='__main__':
    report=audit();(ROOT/'public/data/geometry-audit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    rail=audit_renfe();(ROOT/'public/data/renfe-audit.json').write_text(json.dumps(rail,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    for city in report['cities']:print(city['id'],city['shapes'],'shapes;',city['unavailableShapes'],'unavailable')
