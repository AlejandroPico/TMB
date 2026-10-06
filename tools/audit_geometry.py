"""Repeatable structural audit of every published geometry, with source totals."""
import collections,json,pathlib,datetime
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

if __name__=='__main__':
    report=audit();(ROOT/'public/data/geometry-audit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    for city in report['cities']:print(city['id'],city['shapes'],'shapes;',city['unavailableShapes'],'unavailable')
