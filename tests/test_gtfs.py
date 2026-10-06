import io
import pathlib
import sys
import unittest
import zipfile
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / 'tools'))
from gtfs import parse_gtfs, merge_networks

def archive():
    raw = io.BytesIO()
    with zipfile.ZipFile(raw, 'w') as z:
        for name, content in {
            'stops.txt': 'stop_id,stop_name,stop_lat,stop_lon\na,A,40,-3\nb,B,40.01,-3\nc,C,40.02,-3\nunused,Other region,42,1\n',
            'routes.txt': 'route_id,agency_id,route_short_name,route_type\nr,selected,1,704\nignored,other,2,3\n',
            'trips.txt': 'route_id,service_id,trip_id,direction_id,trip_short_name\nr,s,t,0,00190\n',
            'calendar.txt': 'service_id,monday,tuesday,wednesday,thursday,friday,saturday,sunday,start_date,end_date\ns,1,1,1,1,1,1,1,20260101,20261231\n',
            'stop_times.txt': 'trip_id,arrival_time,departure_time,stop_id,stop_sequence,pickup_type,drop_off_type\nt,10:00:00,10:00:00,a,1,0,0\nt,,,b,2,1,1\nt,10:10:00,10:10:00,c,3,0,0\n',
            'frequencies.txt': 'trip_id,start_time,end_time,headway_secs,exact_times\nt,10:00:00,11:00:00,600,1\n'
        }.items(): z.writestr('nested/'+name, content)
    return raw.getvalue()

class ImportTests(unittest.TestCase):
    def feed(self, id='one', **extra):
        return {'id':id,'name':id,'website':'https://example.org','license':'https://example.org/license','agency':'selected',**extra}
    def test_filter_interpolation_restrictions_and_missing_shapes(self):
        n,s = parse_gtfs(archive(), self.feed(), 'https://example.org/feed.zip')
        self.assertEqual(len(n['routes']),1)
        self.assertEqual(len(n['stops']),3)
        self.assertEqual(n['routes'][0]['mode'],'bus')
        self.assertEqual(s['patterns'][0][1],[0,300,600])
        self.assertEqual(s['patterns'][0][3],[0,1,0])
        self.assertTrue(n['routes'][0]['directions'][0]['approximate'])
        self.assertEqual(s['frequencies'][0][-1],1)
        self.assertEqual(s['tripNames'],['00190'])
    def test_namespacing_and_offset_merging(self):
        parts = [parse_gtfs(archive(),self.feed(id),'https://example.org') for id in ['one','two']]
        n,s = merge_networks(parts,{'name':'Test','id':'test','center':[-3,40],'source':'https://example.org'})
        self.assertEqual(len({st['id'] for st in n['stops']}),6)
        self.assertEqual(s['patterns'][1][0],[3,4,5])
        self.assertEqual(s['trips'][1][:5],[1,1,1,1,1])
        self.assertEqual(s['frequencies'][1][0],1)
        self.assertEqual(s['tripNames'],['00190','00190'])
    def test_emt_policy_preserves_explicit_departures_without_frequency_expansion(self):
        n,s = parse_gtfs(archive(),self.feed(frequencyPolicy='scheduled'),'https://example.org')
        self.assertEqual(s['frequencies'],[])
        self.assertEqual(s['trips'][0][-1],36000)
        self.assertEqual(n['meta']['frequencyPolicy'],'scheduled')

if __name__ == '__main__': unittest.main()
