import pathlib,sys,unittest
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[1]/'tools'))
from rail_services import normalize_renfe
from geometry import rail_path_quality,operator_corridor

class RailServicesTests(unittest.TestCase):
    def test_nuclei_and_reverse_directions_preserve_all_trips_and_aliases(self):
        def route(id):return {'id':'cercanias:'+id,'sourceId':id,'feed':'cercanias','name':'R3'}
        n={'routes':[route('51T001R3'),route('51T002R3'),route('62T001R3')], 'stops':[{'name':'A'},{'name':'B'}], 'shapeInfo':[{'kind':'gtfs'}], 'meta':{}}
        s={'trips':[[0,0,0,0,0,0],[1,0,0,0,1,0],[2,0,0,0,0,0]],'patterns':[[[0,1]],[[1,0]]]}
        normalize_renfe(n,s)
        self.assertEqual(len(n['routes']),2);self.assertEqual(len(n['routes'][0]['directions']),2)
        self.assertEqual([t[0] for t in s['trips']],[0,0,1]);self.assertEqual(len(n['routes'][0]['aliases']),2)
    def test_detour_rejected_and_operator_alignment_keeps_curves(self):
        a=[2,41];b=[2.02,41];line=[a,[2,41.1],[2.02,41.1],b]
        self.assertEqual(rail_path_quality(line,[a,b]),'local-detour')
        official=[a,[2.01,41.002],b]
        match=operator_corridor([a,b],[(official,'operator')])
        self.assertEqual(match[1],official);self.assertEqual(match[2],'operator')

if __name__=='__main__':unittest.main()
