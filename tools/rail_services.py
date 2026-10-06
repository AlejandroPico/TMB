"""Commercial Renfe identities, preserving every trip and its own alignment."""
import collections
import re


def contains(sequence, other):
    it = iter(sequence)
    return all(any(value == wanted for value in it) for wanted in other)


def normalize_renfe(network, schedule):
    routes = network['routes']
    used = collections.defaultdict(list)
    for trip in schedule['trips']:
        used[trip[0]].append(trip)
    groups = collections.defaultdict(list)
    for i, route in enumerate(routes):
        if route['feed'] == 'cercanias':
            # Numbers such as C1 and R3 are reused by different nuclei.
            nucleus = re.match(r'^(\d+)T', route['sourceId'])
            key = ('cercanias', nucleus[1] if nucleus else route['sourceId'], route['name'])
        else:
            ends = {tuple(sorted((schedule['patterns'][t[4]][0][0], schedule['patterns'][t[4]][0][-1]))) for t in used[i]}
            key = ('renfe', route['name'], tuple(sorted(ends))) if ends else ('unused', route['id'])
        groups[key].append(i)
    result = []
    remap = {}
    for key, members in groups.items():
        if not any(used[i] for i in members):
            continue
        candidates = {}
        for i in members:
            for trip in used[i]:
                stops = schedule['patterns'][trip[4]][0]
                candidates.setdefault(tuple(stops), {'shape': trip[2], 'stops': stops, 'approximate': network['shapeInfo'][trip[2]]['kind'] == 'missing'})
        directions = []
        for seq, direction in sorted(candidates.items(), key=lambda item: -len(item[0])):
            if not any(contains(d['stops'], seq) for d in directions):
                directions.append({**direction, 'direction': len(directions)})
        original = routes[members[0]]
        route = {**original, 'aliases': [routes[i]['id'] for i in members], 'directions': directions,
                 'stops': sorted({st for seq in candidates for st in seq}), 'variants': len(members),
                 'transferKey': ':'.join(map(str, key[:3])) if original['feed'] == 'cercanias' else 'renfe:' + original['name']}
        if directions:
            longest = directions[0]['stops']
            route['description'] = network['stops'][longest[0]]['name'] + ' ↔ ' + network['stops'][longest[-1]]['name']
        if original['feed'] == 'cercanias':
            route['nucleus'] = key[1]
            route['description'] = re.sub(r'\s+', ' ', original.get('description', '')).strip() or route['description']
        for i in members:
            remap[i] = len(result)
        result.append(route)
    for trip in schedule['trips']:
        trip[0] = remap[trip[0]]
    network['routes'] = result
    network['meta']['originalRoutes'] = len(routes)
    network['meta']['routes'] = len(result)
