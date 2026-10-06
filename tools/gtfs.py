"""GTFS normalization shared by every operator. Only Python's standard library."""
import collections
import csv
import datetime
import hashlib
import io
import json
import zipfile


def transport_mode(value):
    value = int(value)
    if value == 3 or 700 <= value < 800: return 'bus'
    if value == 1 or 400 <= value < 500: return 'metro'
    if value == 2 or 100 <= value < 200: return 'rail'
    if value == 0 or 900 <= value < 1000: return 'tram'
    if value == 7 or 1400 <= value < 1500: return 'funicular'
    if value == 4 or 1000 <= value < 1100: return 'ferry'
    return 'other'


def parse_gtfs(raw, feed, source):
    archive = zipfile.ZipFile(io.BytesIO(raw))
    files = {name.rsplit('/', 1)[-1]: name for name in archive.namelist()}
    prefix = feed['id'] + ':'

    def rows(name):
        if name not in files: return
        with archive.open(files[name]) as stream:
            for row in csv.DictReader(io.TextIOWrapper(stream, encoding='utf-8-sig')):
                yield {k.strip(): (v or '').strip() for k, v in row.items() if k}

    def number(value, default=0):
        return int(value) if value else default

    def seconds(value):
        if not value: return None
        h, m, s = map(int, value.split(':'))
        return h * 3600 + m * 60 + s

    stoprows = list(rows('stops.txt'))
    positions = {s['stop_id']: s for s in stoprows}
    stops = []
    for st in stoprows:
        point = st if st.get('stop_lat') and st.get('stop_lon') else positions.get(st.get('parent_station'), st)
        if not point.get('stop_lat') or not point.get('stop_lon'): continue
        stops.append({'id': prefix + st['stop_id'], 'sourceId': st['stop_id'], 'feed': feed['id'],
                      'code': st.get('stop_code') or st['stop_id'], 'name': st['stop_name'],
                      'lat': float(point['stop_lat']), 'lon': float(point['stop_lon']),
                      'kind': number(st.get('location_type')), 'parent': prefix + st['parent_station'] if st.get('parent_station') else '',
                      'accessible': number(st.get('wheelchair_boarding')), 'mode': 'other'})
    stopindex = {st['sourceId']: i for i, st in enumerate(stops)}
    routes = []
    for route in rows('routes.txt'):
        if feed.get('agency') and route.get('agency_id') != feed['agency']: continue
        mode = transport_mode(route['route_type'])
        if mode in feed.get('excludeModes', []): continue
        if feed.get('railMode') and mode == 'metro': mode = feed['railMode']
        color = route.get('route_color') or feed.get('color', '709774')
        if len(color) != 6 or any(c not in '0123456789abcdefABCDEF' for c in color): color = '709774'
        routes.append({'id': prefix + route['route_id'], 'sourceId': route['route_id'], 'feed': feed['id'],
                       'operator': feed['name'], 'name': route.get('route_short_name') or route.get('route_long_name') or route['route_id'],
                       'description': route.get('route_long_name') or '', 'type': number(route['route_type']), 'mode': mode,
                       'color': '#' + color, 'url': route.get('route_url') or feed['website']})
    routeindex = {r['sourceId']: i for i, r in enumerate(routes)}
    triprows = {t['trip_id']: t for t in rows('trips.txt') if t['route_id'] in routeindex}
    times = collections.defaultdict(list)
    for st in rows('stop_times.txt'):
        if st['trip_id'] not in triprows or st['stop_id'] not in stopindex: continue
        arrival, departure = seconds(st.get('arrival_time')), seconds(st.get('departure_time'))
        arrival = arrival if arrival is not None else departure
        departure = departure if departure is not None else arrival
        times[st['trip_id']].append([number(st['stop_sequence']), stopindex[st['stop_id']], arrival, departure,
                                   number(st.get('pickup_type')), number(st.get('drop_off_type'))])
    serviceids = sorted({t['service_id'] for t in triprows.values()})
    serviceindex = {v: i for i, v in enumerate(serviceids)}
    services = [{'id': prefix + sid, 'dates': [], 'removed': [], 'calendar': None} for sid in serviceids]
    days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
    for calendar in rows('calendar.txt'):
        if calendar['service_id'] in serviceindex:
            services[serviceindex[calendar['service_id']]]['calendar'] = [calendar['start_date'], calendar['end_date'], *[number(calendar[d]) for d in days]]
    for exception in rows('calendar_dates.txt'):
        if exception['service_id'] in serviceindex:
            services[serviceindex[exception['service_id']]]['dates' if exception['exception_type'] == '1' else 'removed'].append(exception['date'])
    used_shapes = {t.get('shape_id', '') for t in triprows.values()}
    points = collections.defaultdict(list)
    for point in rows('shapes.txt'):
        if point['shape_id'] in used_shapes:
            points[point['shape_id']].append((number(point['shape_pt_sequence']), [round(float(point['shape_pt_lon']), 6), round(float(point['shape_pt_lat']), 6)]))
    shapes = []; shapeindex = {}; shapeinfo = []
    for sid, values in points.items():
        shapeindex[sid] = len(shapes); shapes.append([p for _, p in sorted(values)])
        shapeinfo.append({'kind':'gtfs','source':source})
    patterns = []; patternindex = {}; heads = []; headindex = {}; trips = []; tripids = []; tripindex = {}; directions = collections.defaultdict(list)
    approximated = set(); skipped = 0
    for tid, trip in triprows.items():
        sequence = sorted(times.get(tid, []))
        known = [i for i, st in enumerate(sequence) if st[2] is not None and st[3] is not None]
        if len(sequence) < 2 or not known or known[0] != 0 or known[-1] != len(sequence) - 1:
            skipped += 1; continue
        for left, right in zip(known, known[1:]):
            for k in range(left + 1, right):
                at = round(sequence[left][3] + (sequence[right][2] - sequence[left][3]) * (k-left)/(right-left))
                sequence[k][2] = sequence[k][3] = at
        if any(st[2] > st[3] for st in sequence) or any(sequence[i-1][3] > sequence[i][2] for i in range(1, len(sequence))):
            skipped += 1; continue
        start = sequence[0][2]
        pattern = [[st[1] for st in sequence], [st[2]-start for st in sequence], [st[3]-start for st in sequence],
                   [st[4] for st in sequence], [st[5] for st in sequence]]
        pkey = json.dumps(pattern, separators=(',', ':'))
        if pkey not in patternindex: patternindex[pkey] = len(patterns); patterns.append(pattern)
        head = trip.get('trip_headsign') or stops[sequence[-1][1]]['name']
        if head not in headindex: headindex[head] = len(heads); heads.append(head)
        sid = trip.get('shape_id', '')
        if sid not in shapeindex:
            # Missing geometry is explicitly flagged: this is a stop-to-stop sketch.
            sid = 'stops:' + ','.join(str(st[1]) for st in sequence)
            if sid not in shapeindex:
                shapeindex[sid] = len(shapes); shapes.append([[stops[st[1]]['lon'], stops[st[1]]['lat']] for st in sequence])
                approximated.add(shapeindex[sid])
                shapeinfo.append({'kind':'missing','source':source})
        ri, pi, sh = routeindex[trip['route_id']], patternindex[pkey], shapeindex[sid]
        tripindex[tid] = len(trips); tripids.append(prefix + tid)
        trips.append([ri, serviceindex[trip['service_id']], sh, headindex[head], pi, start])
        directions[(ri, number(trip.get('direction_id')))].append((sh, pi))
        for st in sequence:
            stops[st[1]]['kind'] = 0  # Some feeds serve station nodes directly.
            stops[st[1]]['mode'] = routes[ri]['mode']
    frequencies = []
    for f in rows('frequencies.txt'):
        # EMT publishes a full stop_times itinerary for every departure and an
        # advisory frequency window for those same trips. Expanding every window
        # would multiply 86k published journeys into millions of duplicates.
        if feed.get('frequencyPolicy') == 'scheduled': continue
        if f['trip_id'] in tripindex and number(f.get('headway_secs')) > 0:
            frequencies.append([tripindex[f['trip_id']], seconds(f['start_time']), seconds(f['end_time']), number(f['headway_secs']), number(f.get('exact_times'))])
    for i, route in enumerate(routes):
        route['directions'] = []
        for direction in sorted(d for ri, d in directions if ri == i):
            sh, pi = collections.Counter(directions[(i, direction)]).most_common(1)[0][0]
            route['directions'].append({'shape': sh, 'stops': patterns[pi][0], 'direction': direction, 'approximate': sh in approximated})
        route['stops'] = sorted({st for (ri, _), choices in directions.items() if ri == i for _, pi in choices for st in patterns[pi][0]})
        if not route['description'] and route['directions']:
            seq = route['directions'][0]['stops']; route['description'] = stops[seq[0]]['name'] + ' - ' + stops[seq[-1]]['name']
    transfers = [[stopindex[t['from_stop_id']], stopindex[t['to_stop_id']], number(t['transfer_type']), number(t.get('min_transfer_time'))]
                 for t in rows('transfers.txt') if t['from_stop_id'] in stopindex and t['to_stop_id'] in stopindex]
    pathways = [[stopindex[p['from_stop_id']], stopindex[p['to_stop_id']], number(p.get('traversal_time')), number(p['pathway_mode']), p.get('signposted_as', '')]
                for p in rows('pathways.txt') if p['from_stop_id'] in stopindex and p['to_stop_id'] in stopindex]
    # Agency-filtered feeds can contain stops across several regions. Keep only
    # served stops and their station/access hierarchy in this operator's scope.
    keep = {st for p in patterns for st in p[0]}
    names = {stops[i]['id'] for i in keep}
    parents = {stops[i]['parent'] for i in keep if stops[i]['parent']}
    keep.update(i for i, st in enumerate(stops) if st['id'] in parents or st['parent'] in parents or (st['kind'] != 0 and st['parent'] in names))
    remap = {old: new for new, old in enumerate(sorted(keep))}
    stops = [stops[i] for i in sorted(keep)]
    for p in patterns: p[0] = [remap[i] for i in p[0]]
    for route in routes:
        route['stops'] = [remap[i] for i in route['stops']]
        for d in route['directions']: d['stops'] = [remap[i] for i in d['stops']]
    transfers = [[remap[a], remap[b], *rest] for a, b, *rest in transfers if a in remap and b in remap]
    pathways = [[remap[a], remap[b], *rest] for a, b, *rest in pathways if a in remap and b in remap]
    info = next(rows('feed_info.txt'), {})
    ranges = [value for service in services for value in [*service['dates'], *(service['calendar'][:2] if service['calendar'] else [])] if value]
    meta = {'id': feed['id'], 'publisher': feed['name'], 'source': source, 'website': feed['website'], 'license': feed['license'],
            'fetchedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'version': info.get('feed_version') or hashlib.sha256(raw).hexdigest()[:12],
            'start': info.get('feed_start_date') or min(ranges), 'end': info.get('feed_end_date') or max(ranges),
            'sha256': hashlib.sha256(raw).hexdigest(), 'routes': len(routes), 'stops': sum(st['kind'] == 0 for st in stops),
            'trips': len(trips), 'skippedTrips': skipped, 'approximateShapes': len(approximated), 'timezone': 'Europe/Madrid',
            'frequencyPolicy': feed.get('frequencyPolicy', 'expand')}
    return {'meta': meta, 'routes': routes, 'stops': stops, 'shapes': shapes, 'shapeInfo': shapeinfo, 'transfers': transfers, 'pathways': pathways}, \
           {'services': services, 'patterns': patterns, 'heads': heads, 'trips': trips, 'tripIds': tripids, 'frequencies': frequencies}


def merge_networks(parts, city):
    network = {key: [] for key in ['routes', 'stops', 'shapes', 'shapeInfo', 'transfers', 'pathways']}
    schedule = {key: [] for key in ['services', 'patterns', 'heads', 'trips', 'tripIds', 'frequencies']}
    feeds = []
    for n, s in parts:
        ro, so, sho = len(network['routes']), len(network['stops']), len(network['shapes'])
        se, po, ho, to = len(schedule['services']), len(schedule['patterns']), len(schedule['heads']), len(schedule['trips'])
        network['stops'].extend(n['stops']); network['shapes'].extend(n['shapes'])
        network['shapeInfo'].extend(n.get('shapeInfo',[]))
        network['routes'].extend([{**r, 'stops': [i+so for i in r['stops']], 'directions': [{**d, 'shape': d['shape']+sho, 'stops': [i+so for i in d['stops']]} for d in r['directions']]} for r in n['routes']])
        for key in ['transfers', 'pathways']: network[key].extend([[a+so, b+so, *rest] for a, b, *rest in n[key]])
        schedule['services'].extend(s['services']); schedule['heads'].extend(s['heads']); schedule['tripIds'].extend(s['tripIds'])
        schedule['patterns'].extend([[[i+so for i in p[0]], *p[1:]] for p in s['patterns']])
        schedule['trips'].extend([[r+ro, service+se, shape+sho, head+ho, pattern+po, start] for r, service, shape, head, pattern, start in s['trips']])
        schedule['frequencies'].extend([[trip+to, *rest] for trip, *rest in s['frequencies']])
        feeds.append(n['meta'])
    network['meta'] = {'publisher': city['name'], 'city': city['id'], 'center': city['center'], 'zoom': city.get('zoom', 12.3), 'feeds': feeds,
                       'source': city['source'], 'fetchedAt': max(f['fetchedAt'] for f in feeds), 'version': 'multifeed-v3',
                       'start': min(f['start'] for f in feeds), 'end': max(f['end'] for f in feeds), 'routes': len(network['routes']),
                       'stops': sum(st['kind'] == 0 for st in network['stops']), 'trips': len(schedule['trips']), 'timezone': 'Europe/Madrid'}
    return network, schedule
