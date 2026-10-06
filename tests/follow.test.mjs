import { test } from "node:test";
import assert from "node:assert/strict";
import { VehicleFollow } from "../src/follow.js";
test("camera follows only the selected moving vehicle without resetting zoom or bearing", () => {
  const calls = [],
    map = { easeTo: (view) => calls.push(view) },
    follow = new VehicleFollow();
  follow.start("a");
  assert.equal(follow.update(map, "b", [2, 41]), false);
  follow.update(map, "a", [2, 41]);
  follow.update(map, "a", [2.001, 41]);
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[1].center, [2.001, 41]);
  assert(!("zoom" in calls[1]));
  assert(!("bearing" in calls[1]));
  assert.equal(follow.update(map, "a", [2.001, 41]), false);
  follow.toggle();
  assert.equal(follow.update(map, "a", [3, 41]), false);
  follow.toggle();
  assert.equal(follow.update(map, "a", [3, 41]), true);
  follow.stop();
  assert.equal(follow.update(map, "a", [4, 41]), false);
  follow.start("b");
  assert.equal(follow.update(map, "a", [4, 41]), false);
  assert.equal(follow.update(map, "b", [NaN, 41]), false);
});
test("a stationary vehicle is recentered after panning and when following resumes", () => {
  let center = { lng: 2, lat: 41 };
  const calls = [],
    map = {
      getCenter: () => center,
      easeTo: (view) => {
        calls.push(view);
        center = { lng: view.center[0], lat: view.center[1] };
      },
    };
  const follow = new VehicleFollow();
  follow.start("stationary");
  follow.update(map, "stationary", [2, 41]);
  assert.equal(follow.update(map, "stationary", [2, 41]), false);
  center = { lng: 3, lat: 42 };
  assert.equal(follow.update(map, "stationary", [2, 41]), true);
  follow.toggle();
  center = { lng: 3, lat: 42 };
  assert.equal(follow.update(map, "stationary", [2, 41]), false);
  follow.toggle();
  assert.equal(follow.update(map, "stationary", [2, 41]), true);
  assert.equal(calls.length, 3);
});
