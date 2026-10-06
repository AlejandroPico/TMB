import pathlib,sys,unittest
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[1]/'tools'))
from geometry import RailGraph,simplify,line_match,clear_missing,retain_published_geometry

def feature(coords,gauge=1435):
    return {'geometry':{'type':'LineString','coordinates':coords},'properties':{'nominalgauge':gauge}}

class GeometryTests(unittest.TestCase):
    def test_rail_path_retains_bends_and_rejects_disconnected_links(self):
        a=[0,40];b=[.01,40.01];c=[.02,40]
        graph=RailGraph([feature([a,[0,40.01],b]),feature([b,c])],[a,c])
        self.assertEqual(graph.path(a,c,True),[a,[0,40.01],b,c])
        graph=RailGraph([feature([a,b]),feature([[.02,40.01],c])],[a,c])
        self.assertIsNone(graph.path(a,c,True))
    def test_line_matching_rejects_the_wrong_direction_or_far_stops(self):
        line=[[0,40],[0,40.01],[.01,40.01]]
        self.assertIsNotNone(line_match([line[0],line[-1]],line))
        self.assertIsNone(line_match([line[-1],line[0]],line))
        self.assertIsNone(line_match([[1,40],line[-1]],line))
    def test_simplification_retains_corners_and_missing_geometry_is_empty(self):
        corners=[[0,40],[.001,40],[.002,40],[.002,40.01],[.003,40.01]]
        self.assertEqual(simplify(corners),[corners[i] for i in [0,2,3,4]])
        n={'shapes':[corners,corners],'shapeInfo':[{'kind':'missing'},{'kind':'gtfs'}]}
        clear_missing(n)
        self.assertEqual(n['shapes'][0],[])
        self.assertEqual(n['shapes'][1],corners)
    def test_retained_geometry_requires_the_identical_route_and_stop_sequence(self):
        import copy
        old={'routes':[{'id':'a:r','feed':'a','directions':[{'shape':0}]}], 'stops':[{'id':'a:x'},{'id':'a:y'}], 'shapes':[[[0,40],[0,40.01],[.01,40.01]]], 'shapeInfo':[{'kind':'municipal','source':'https://example.org'}], 'meta':{'feeds':[{'id':'a'}]}}
        schedule={'trips':[[0,0,0,0,0,0]],'patterns':[[[0,1]]]}
        n=copy.deepcopy(old);n['shapes']=[[]];n['shapeInfo']=[{'kind':'missing'}]
        self.assertEqual(retain_published_geometry(n,schedule,old,schedule),1)
        self.assertTrue(n['shapeInfo'][0]['retained'])
        n=copy.deepcopy(old);n['shapes']=[[]];n['shapeInfo']=[{'kind':'missing'}];n['stops'][1]['id']='a:changed'
        self.assertEqual(retain_published_geometry(n,schedule,old,schedule),0)
        self.assertEqual(n['shapes'][0],[])

if __name__=='__main__':unittest.main()
