"""Inventory night brands by source, without inventing service or geometry."""
import datetime
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[1]


def audit():
    config = json.loads((ROOT / 'tools/providers.json').read_text(encoding='utf-8'))
    report = {
        'generatedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
        'policy': 'Operator-specific night brands and explicit night descriptions. N alone is not a night-service indicator. Availability follows GTFS calendars, exceptions and service times, including times above 24:00. Missing geometry is never drawn or animated. Network absence does not prove that a city has no night services.',
        'cities': []
    }
    for city in config['cities']:
        directory = ROOT / 'public/data' / city['id']
        n = json.loads((directory / 'network.json').read_text(encoding='utf-8'))
        s = json.loads((directory / 'schedule.json').read_text(encoding='utf-8'))
        routes = []
        for i, r in enumerate(n['routes']):
            if not r.get('night') or not r['stops']: continue
            trips = [t for t in s['trips'] if t[0] == i]
            routes.append({
                'id': r['id'], 'name': r['name'], 'feed': r['feed'],
                'stops': len(r['stops']), 'scheduledTrips': len(trips),
                'mappedDirections': sum(not d['approximate'] for d in r['directions']),
                'directions': len(r['directions']),
                'services': [s['services'][j] for j in sorted({t[1] for t in trips})],
                'source': next(f['source'] for f in n['meta']['feeds'] if f['id'] == r['feed'])
            })
        report['cities'].append({'id': city['id'], 'name': city['name'],
                                'coverage': city['coverage'], 'nightRoutes': routes,
                                'declaredWithoutJourneys': [{'id': r['id'], 'name': r['name'], 'feed': r['feed']}
                                                           for r in n['routes'] if r.get('night') and not r['stops']]})
        print(city['id'] + ': ' + str(len(routes)) + ' night routes')
    return report


if __name__ == '__main__':
    path = ROOT / 'public/data/night-audit.json'
    path.write_text(json.dumps(audit(), ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
